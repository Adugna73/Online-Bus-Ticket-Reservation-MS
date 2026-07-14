import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as svc from "@/lib/services/payments";

// GAP 1: Payment Processing — single payment detail with escrow, refunds,
// and the tamper-proof audit-log chain.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        booking: true,
      },
    });
    if (!payment) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (payment.booking?.userId !== userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const escrow = payment.bookingId
      ? await prisma.escrow.findUnique({
          where: { bookingId: payment.bookingId },
        })
      : null;
    const refunds = await prisma.refund.findMany({
      where: { paymentId: id },
      orderBy: { createdAt: "desc" },
    });
    const auditLog = await svc.getAuditLog(id);
    let receipt = payment.bookingId
      ? await prisma.receipt.findUnique({
          where: { bookingId: payment.bookingId },
        })
      : null;
    // Auto-create a receipt for PAID payments that are missing one (e.g. older
    // cash/mock charges that predated receipt generation).
    if (!receipt && payment.bookingId && payment.status === "PAID") {
      const receiptNumber = `RC-${Date.now().toString(36).toUpperCase()}`;
      try {
        receipt = await prisma.receipt.create({
          data: {
            bookingId: payment.bookingId,
            receiptNumber,
            pdfUrl: null,
            emailedTo: null,
          },
        });
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: { pdfUrl: `/api/receipts/${receipt.id}/pdf` },
        });
        receipt = await prisma.receipt.findUniqueOrThrow({
          where: { id: receipt.id },
        });
      } catch {
        // race — another request created it; re-fetch
        receipt = await prisma.receipt.findUnique({
          where: { bookingId: payment.bookingId },
        });
      }
    }

    return NextResponse.json({
      payment: {
        id: payment.id,
        bookingId: payment.bookingId,
        method: payment.method,
        status: payment.status,
        amount: payment.amount,
        transactionRef: payment.transactionRef,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
      },
      booking: payment.booking
        ? {
            id: payment.booking.id,
            bookingRef: payment.booking.bookingRef,
            status: payment.booking.status,
            totalPrice: payment.booking.totalPrice,
          }
        : null,
      escrow: escrow
        ? {
            id: escrow.id,
            bookingId: escrow.bookingId,
            amount: escrow.amount,
            status: escrow.status,
            heldAt: escrow.heldAt,
            releasedAt: escrow.releasedAt,
          }
        : null,
      refunds: refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        processedAt: r.processedAt,
        createdAt: r.createdAt,
      })),
      receipt: receipt
        ? {
            id: receipt.id,
            receiptNumber: receipt.receiptNumber,
            issuedAt: receipt.issuedAt,
            pdfUrl: `/api/receipts/${receipt.id}/pdf`,
            chapaReceiptUrl: (receipt as any).chapaReceiptUrl ?? null,
          }
        : null,
      auditLog: auditLog.map((log) => ({
        id: log.id,
        event: log.event,
        provider: log.provider,
        payload: log.payload,
        hash: log.hash,
        prevHash: log.prevHash,
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    console.error("[payments/detail] failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
