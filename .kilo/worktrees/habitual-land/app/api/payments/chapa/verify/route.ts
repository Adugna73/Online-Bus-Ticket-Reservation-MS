import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PaymentMethod } from "@prisma/client";
import * as chapa from "@/lib/services/chapa";

const METHOD_VALUES = new Set<string>(Object.values(PaymentMethod));

// Verify a Chapa transaction after the user returns from checkout, then
// persist the payment + auto-generate a receipt. Called by the return page.
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const tx_ref = String(body?.tx_ref || "").trim();
    let bookingId = String(body?.bookingId || "").trim();
    let methodRaw = String(body?.method || "").trim().toUpperCase();
    const chapaReceiptUrl = body?.chapaReceiptUrl
      ? String(body.chapaReceiptUrl).trim()
      : undefined;

    if (!tx_ref) {
      return NextResponse.json(
        { error: "tx_ref_required" },
        { status: 400 },
      );
    }

    // Recover bookingId + method from the pending intent if the client didn't
    // pass them (Chapa's return redirect often drops our query params).
    if (!bookingId || !methodRaw || !METHOD_VALUES.has(methodRaw)) {
      const intent = await chapa.findIntentByTxRef(tx_ref);
      if (intent) {
        bookingId = bookingId || intent.bookingId;
        methodRaw = methodRaw || intent.method;
      }
    }

    if (!bookingId) {
      return NextResponse.json(
        { error: "booking_not_found" },
        { status: 404 },
      );
    }
    if (!METHOD_VALUES.has(methodRaw)) {
      return NextResponse.json({ error: "invalid_method" }, { status: 400 });
    }

    const result = await chapa.confirmPayment(
      bookingId,
      tx_ref,
      methodRaw as PaymentMethod,
      chapaReceiptUrl,
    );

    return NextResponse.json({
      ok: true,
      paymentId: result.payment.id,
      receiptId: result.receipt.id,
      receiptNumber: result.receipt.receiptNumber,
      chapaReceiptUrl: result.receipt.chapaReceiptUrl ?? null,
      alreadyConfirmed: result.alreadyConfirmed,
    });
  } catch (error: any) {
    console.error("[chapa] verify failed", error);
    const message = error?.message || "server_error";
    const status =
      message === "booking_not_found"
        ? 404
        : message === "payment_not_verified"
          ? 402
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
