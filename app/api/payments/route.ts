import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { PaymentMethod } from "@prisma/client";
import * as svc from "@/lib/services/payments";

const METHOD_VALUES = new Set<string>(Object.values(PaymentMethod));

function normalizeMethod(value?: string | null): PaymentMethod | null {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return METHOD_VALUES.has(normalized) ? (normalized as PaymentMethod) : null;
}

// GAP 1: Payment Processing — list the current user's payments (with booking).
export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const payments = await svc.listPayments(userId);
    return NextResponse.json(payments);
  } catch (error) {
    console.error("[payments] list failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// GAP 1: Payment Processing — charge / refund / release escrow.
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    if (action === "charge") {
      const bookingId = String(body?.bookingId || "").trim();
      if (!bookingId) {
        return NextResponse.json(
          { error: "booking_required" },
          { status: 400 },
        );
      }
      const method = normalizeMethod(body?.method);
      if (!method) {
        return NextResponse.json(
          { error: "invalid_method" },
          { status: 400 },
        );
      }
      const result = await svc.charge(bookingId, Number(body?.amount || 0), method);
      return NextResponse.json({
        ok: true,
        paymentId: result.payment.id,
        provider: result.provider,
        ref: result.ref,
        held: result.held,
      });
    }

    if (action === "refund") {
      const paymentId = String(body?.paymentId || "").trim();
      if (!paymentId) {
        return NextResponse.json(
          { error: "payment_required" },
          { status: 400 },
        );
      }
      const amount = Number(body?.amount || 0);
      if (!amount || amount <= 0) {
        return NextResponse.json(
          { error: "amount_required" },
          { status: 400 },
        );
      }
      const reason = body?.reason ? String(body.reason) : undefined;
      const result = await svc.refund(paymentId, amount, reason);
      return NextResponse.json({
        ok: true,
        refundId: result.refund.id,
        ref: result.ref,
        processedAt: result.processedAt,
      });
    }

    if (action === "release_escrow") {
      const bookingId = String(body?.bookingId || "").trim();
      if (!bookingId) {
        return NextResponse.json(
          { error: "booking_required" },
          { status: 400 },
        );
      }
      const result = await svc.releaseEscrow(bookingId);
      return NextResponse.json({
        ok: true,
        bookingId,
        releasedAt: result.releasedAt,
      });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error: any) {
    console.error("[payments] action failed", error);
    const message = error?.message || "server_error";
    const status =
      message === "booking_not_found" ||
      message === "payment_not_found"
        ? 404
        : message === "invalid_amount"
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
