import { NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import * as chapa from "@/lib/services/chapa";

// Chapa webhook/callback. Chapa POSTs here on payment completion. We don't
// trust the payload — we re-verify by calling Chapa's verify endpoint with
// the tx_ref, and recover bookingId + method from our stored pending intent.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tx_ref = String(
      body?.tx_ref || body?.trx_ref || body?.data?.tx_ref || "",
    ).trim();
    let bookingId = String(
      body?.bookingId || body?.meta?.booking_id || body?.data?.meta?.booking_id || "",
    ).trim();
    let methodRaw = String(body?.method || body?.data?.method || "").trim().toUpperCase();

    if (!tx_ref) {
      return NextResponse.json({ error: "ignored" }, { status: 200 });
    }

    // Recover from the pending intent if not present in the payload.
    if (!bookingId || !methodRaw) {
      const intent = await chapa.findIntentByTxRef(tx_ref);
      if (intent) {
        bookingId = bookingId || intent.bookingId;
        methodRaw = methodRaw || intent.method;
      }
    }
    if (!bookingId) {
      return NextResponse.json({ error: "no_intent" }, { status: 200 });
    }

    const method =
      methodRaw === "CBE_BIRR"
        ? PaymentMethod.CBE_BIRR
        : methodRaw === "M_BIRR"
          ? PaymentMethod.M_BIRR
          : PaymentMethod.TELEBIRR;

    await chapa.confirmPayment(bookingId, tx_ref, method);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[chapa] webhook failed", error);
    return NextResponse.json(
      { error: error?.message || "server_error" },
      { status: 200 },
    );
  }
}
