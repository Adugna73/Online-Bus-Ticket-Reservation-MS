import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import * as chapa from "@/lib/services/chapa";

// Recover + verify the current user's most recent PENDING Chapa payment when
// the return redirect dropped the tx_ref query param (common in Chapa test
// mode). The pending intent was stored server-side as a PENDING Payment with
// transactionRef = tx_ref during checkout initialization.
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));
    const chapaReceiptUrl = body?.chapaReceiptUrl
      ? String(body.chapaReceiptUrl).trim()
      : undefined;
    const recentCutoff = new Date(Date.now() - 30 * 60 * 1000);

    // 1. If the user has a recently PAID payment (e.g. they're refreshing the
    //    return page after a successful verification), return its receipt.
    const recentPaid = await prisma.payment.findFirst({
      where: {
        status: PaymentStatus.PAID,
        booking: { userId },
        createdAt: { gte: recentCutoff },
      },
      orderBy: { createdAt: "desc" },
      include: { booking: true },
    });
    if (recentPaid) {
      const receipt = await prisma.receipt.findUnique({
        where: { bookingId: recentPaid.bookingId },
      });
      if (receipt) {
        // Update Chapa receipt URL if provided and not yet stored.
        let finalReceipt = receipt;
        if (chapaReceiptUrl && !receipt.chapaReceiptUrl) {
          finalReceipt = await prisma.receipt.update({
            where: { id: receipt.id },
            data: { chapaReceiptUrl },
          });
        }
        return NextResponse.json({
          ok: true,
          paymentId: recentPaid.id,
          receiptId: finalReceipt.id,
          receiptNumber: finalReceipt.receiptNumber,
          chapaReceiptUrl: finalReceipt.chapaReceiptUrl ?? null,
          alreadyConfirmed: true,
        });
      }
    }

    // 2. Find the user's most recent PENDING payment (last 30 min) with a tx_ref.
    const pending = await prisma.payment.findFirst({
      where: {
        status: PaymentStatus.PENDING,
        transactionRef: { not: null },
        booking: { userId },
        createdAt: { gte: recentCutoff },
      },
      orderBy: { createdAt: "desc" },
      include: { booking: true },
    });

    if (!pending) {
      return NextResponse.json(
        { error: "no_pending_payment" },
        { status: 404 },
      );
    }

    const result = await chapa.confirmPayment(
      pending.bookingId,
      pending.transactionRef!,
      pending.method as PaymentMethod,
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
    console.error("[chapa] recover failed", error);
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
