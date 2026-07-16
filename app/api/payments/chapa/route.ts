import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";
import * as chapa from "@/lib/services/chapa";

const METHOD_VALUES = new Set<string>(Object.values(PaymentMethod));
const SUPPORTED = new Set<string>(["TELEBIRR", "CBE_BIRR", "M_BIRR"]);

// Initialize a Chapa hosted-checkout transaction for a booking.
// The client is redirected to the returned checkout_url where the user picks
// Telebirr (etc.) and approves the payment on Chapa's side.
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const bookingId = String(body?.bookingId || "").trim();
    if (!bookingId) {
      return NextResponse.json({ error: "booking_required" }, { status: 400 });
    }

    const methodRaw = String(body?.method || "TELEBIRR")
      .trim()
      .toUpperCase();
    if (!METHOD_VALUES.has(methodRaw)) {
      return NextResponse.json({ error: "invalid_method" }, { status: 400 });
    }
    if (!SUPPORTED.has(methodRaw)) {
      return NextResponse.json(
        { error: "method_not_supported_by_chapa" },
        { status: 400 },
      );
    }
    const method = methodRaw as PaymentMethod;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true, trip: { include: { route: { include: { originStation: true, destinationStation: true } } } } },
    });
    if (!booking) {
      return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
    }
    if (booking.userId !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (!chapa.chapaConfigured()) {
      return NextResponse.json(
        { error: "chapa_not_configured", hint: "Set CHAPA_SECRET_KEY in .env" },
        { status: 500 },
      );
    }

    const origin = new URL(req.url).origin;
    const tx_ref = `${booking.bookingRef}-${Date.now().toString(36)}`;
    // Keep return_url clean — Chapa appends its own tx_ref/trx_ref. We recover
    // bookingId + method server-side from the stored pending intent.
    const return_url = `${origin}/passenger/payments/return`;
    const callback_url = `${origin}/api/payments/chapa/webhook`;

    const email = booking.user?.email || booking.passengerEmail || "guest@bus.et";
    const fullName = booking.passengerFullName || booking.user?.fullName || "Customer";
    const [first_name, ...rest] = fullName.split(/\s+/);
    const last_name = rest.join(" ") || "Customer";
    const originName = booking.trip?.route?.originStation?.name || "Origin";
    const destName = booking.trip?.route?.destinationStation?.name || "Destination";

    // Chapa validation: title <= 16 chars; description only letters, numbers,
    // hyphens, underscores, spaces, dots. Sanitize accordingly.
    const rawDesc = `${originName} to ${destName}`;
    const description = rawDesc.replace(/[^a-zA-Z0-9 _.\-]/g, "").slice(0, 100);

    const phone =
      String(body?.phone || "").trim() ||
      booking.passengerPhone ||
      booking.user?.phone ||
      undefined;

    // Chapa performs strict email validation and rejects some legitimate
    // domains (e.g. `.et` addresses like `user@bus.et`). If init fails with
    // `validation.email`, retry once with a valid placeholder email so the
    // checkout can proceed — Chapa only uses it for the receipt, and the
    // booking's real contact is stored on our side.
    const FALLBACK_EMAIL = `passenger+${bookingId.slice(0, 8)}@gmail.com`;

    const initInput = {
      amount: booking.totalPrice,
      tx_ref,
      email,
      first_name,
      last_name,
      phone,
      return_url,
      callback_url,
      title: "Bus Ticket",
      description,
      bookingId,
    };

    let init: chapa.ChapaInitResult;
    try {
      init = await chapa.initialize(initInput);
    } catch (err: any) {
      const isEmailError =
        err instanceof chapa.ChapaApiError &&
        /validation\.email/i.test(JSON.stringify(err.details ?? ""));
      if (isEmailError && email !== FALLBACK_EMAIL) {
        console.warn(
          "[chapa] email rejected by Chapa, retrying with fallback",
          email,
        );
        init = await chapa.initialize({ ...initInput, email: FALLBACK_EMAIL });
      } else {
        throw err;
      }
    }

    // Persist a pending intent so the return/callback flow can recover
    // bookingId + method from tx_ref alone (Chapa may drop return_url params).
    await chapa.recordPendingIntent(bookingId, init.tx_ref, method, booking.totalPrice);

    return NextResponse.json({
      ok: true,
      checkout_url: init.checkout_url,
      tx_ref: init.tx_ref,
      amount: chapa.testAmount(booking.totalPrice),
      test_mode: process.env.PAYMENT_TEST_MODE === "1",
    });
  } catch (error: any) {
    if (error instanceof chapa.ChapaRateLimitError) {
      const retryAfter = error.retryAfter ?? 30;
      console.warn("[chapa] rate limited, retry after", retryAfter, "s");
      return NextResponse.json(
        { error: "rate_limited", message: error.message, retry_after: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    if (error instanceof chapa.ChapaApiError) {
      console.error("[chapa] init failed", error.status, error.message, error.details);
      return NextResponse.json(
        { error: "chapa_error", message: error.message, status: error.status },
        { status: error.status >= 400 && error.status < 600 ? error.status : 502 },
      );
    }
    console.error("[chapa] init failed", error);
    return NextResponse.json(
      { error: error?.message || "server_error" },
      { status: 500 },
    );
  }
}
