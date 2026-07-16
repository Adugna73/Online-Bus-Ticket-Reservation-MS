import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";
import * as chapa from "@/lib/services/chapa";

const METHOD_VALUES = new Set<string>(Object.values(PaymentMethod));

const TYPE_FOR_METHOD: Record<string, string> = {
  TELEBIRR: "telebirr",
  CBE_BIRR: "CBEBirr",
  M_BIRR: "Amole",
};

// Direct Charge flow (in-app OTP, no hosted-checkout redirect). Keeps the user
// on our site: charge → user enters OTP → authorize → confirm + receipt.
//
// POST { action: "charge", bookingId, method, phone }
//     { action: "authorize", tx_ref, reference, otp, bookingId, method }
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "charge") {
      const bookingId = String(body?.bookingId || "").trim();
      const methodRaw = String(body?.method || "TELEBIRR").trim().toUpperCase();
      const phone = String(body?.phone || "").trim();
      if (!bookingId) {
        return NextResponse.json({ error: "booking_required" }, { status: 400 });
      }
      if (!METHOD_VALUES.has(methodRaw)) {
        return NextResponse.json({ error: "invalid_method" }, { status: 400 });
      }
      if (phone.length < 9) {
        return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
      }
      const method = methodRaw as PaymentMethod;
      const type = TYPE_FOR_METHOD[method] || "telebirr";

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: true },
      });
      if (!booking) {
        return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
      }
      if (booking.userId !== session.user.id) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }

      const tx_ref = `${booking.bookingRef}-DC-${Date.now().toString(36)}`;
      await chapa.recordPendingIntent(bookingId, tx_ref, method, booking.totalPrice);

      const result = await chapa.directCharge({
        mobile: phone,
        amount: booking.totalPrice,
        tx_ref,
        type,
        first_name: booking.passengerFullName || booking.user?.fullName || "Customer",
        last_name: "Customer",
        email: booking.user?.email || booking.passengerEmail || "guest@bus.et",
      });

      return NextResponse.json({
        ok: true,
        tx_ref,
        reference: result.reference,
        auth_type: result.auth_type,
        test_mode: process.env.PAYMENT_TEST_MODE === "1",
      });
    }

    if (action === "authorize") {
      const tx_ref = String(body?.tx_ref || "").trim();
      const reference = String(body?.reference || "").trim();
      const otp = String(body?.otp || body?.client || "").trim();
      let bookingId = String(body?.bookingId || "").trim();
      let methodRaw = String(body?.method || "").trim().toUpperCase();

      if (!tx_ref || !reference) {
        return NextResponse.json(
          { error: "tx_ref_and_reference_required" },
          { status: 400 },
        );
      }

      // Recover bookingId + method from the pending intent if not provided.
      if (!bookingId || !METHOD_VALUES.has(methodRaw)) {
        const intent = await chapa.findIntentByTxRef(tx_ref);
        if (intent) {
          bookingId = bookingId || intent.bookingId;
          methodRaw = methodRaw || intent.method;
        }
      }
      if (!bookingId || !METHOD_VALUES.has(methodRaw)) {
        return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
      }

      const method = methodRaw as PaymentMethod;
      const type = TYPE_FOR_METHOD[method] || "telebirr";

      // Authorize with the OTP the customer entered.
      await chapa.authorizeDirectCharge({ reference, type, client: otp });

      // Verify + persist payment + auto-generate receipt.
      const result = await chapa.confirmPayment(bookingId, tx_ref, method);

      return NextResponse.json({
        ok: true,
        paymentId: result.payment.id,
        receiptId: result.receipt.id,
        receiptNumber: result.receipt.receiptNumber,
        alreadyConfirmed: result.alreadyConfirmed,
      });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error: any) {
    console.error("[chapa] direct charge failed", error);
    const message = error?.message || "server_error";
    const status = message === "payment_not_verified" ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
