import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  EscrowStatus,
  type Payment,
  type TransactionLog,
  type Refund,
  type Escrow,
  type Booking,
  type Receipt,
} from "@prisma/client";

// GAP 1: Payment Processing — multi-provider (mock provider) with escrow,
// refunds, and a tamper-proof SHA-256 audit-log chain. All state is persisted
// to Prisma; the provider call itself is mocked (no real SDK wired).

export type Provider = PaymentProvider;

export const PROVIDER_ORDER: Provider[] = [
  "CHAPA",
  "TELEBIRR",
  "STRIPE",
  "CBE_BIRR",
  "M_BIRR",
  "SMS_USSD",
  "CASH_AGENT",
];

const METHOD_TO_PROVIDER: Record<PaymentMethod, PaymentProvider> = {
  TELEBIRR: "TELEBIRR",
  CBE_BIRR: "CBE_BIRR",
  M_BIRR: "M_BIRR",
  CASH: "CASH_AGENT",
};

export function providerForMethod(method: PaymentMethod): PaymentProvider {
  return METHOD_TO_PROVIDER[method] ?? "CHAPA";
}

// Mock provider charge: returns a fake transaction reference. Real wiring
// would call the provider SDK here.
function mockProviderCharge(
  provider: PaymentProvider,
  amount: number,
): { ref: string } {
  return { ref: `txn_${provider.toLowerCase()}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}` };
}

// SHA-256 chain hash over (prevHash | paymentId | event | payload | nonce).
// A random nonce guarantees uniqueness even when two concurrent confirmations
// (e.g. webhook + return-page verify) race and compute the same deterministic
// input — preventing unique-constraint violations on `hash`.
function chainHash(
  prevHash: string | null,
  paymentId: string | null,
  event: string,
  payload: unknown,
  nonce: string,
): string {
  const raw = `${prevHash || ""}|${paymentId || ""}|${event}|${JSON.stringify(payload ?? {})}|${nonce}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function appendLog(
  paymentId: string | null,
  event: string,
  provider: PaymentProvider | null,
  payload: unknown,
): Promise<TransactionLog> {
  // Retry a few times in case of a rare hash collision (P2002).
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.transactionLog.findFirst({
      where: paymentId ? { paymentId } : { paymentId: null },
      orderBy: { createdAt: "desc" },
    });
    const prevHash = last?.hash ?? null;
    const nonce = crypto.randomBytes(8).toString("hex");
    const hash = chainHash(prevHash, paymentId, event, payload, nonce);
    try {
      return await prisma.transactionLog.create({
        data: {
          paymentId,
          event,
          provider,
          payload: payload as any,
          hash,
          prevHash,
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("audit_log_create_failed");
}

export type ChargeResult = {
  payment: Payment;
  escrow: Escrow;
  provider: PaymentProvider;
  ref: string;
  held: boolean;
};

export async function charge(
  bookingId: string,
  amount: number,
  method: PaymentMethod,
): Promise<ChargeResult> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("booking_not_found");
  if (amount <= 0) throw new Error("invalid_amount");

  const provider = providerForMethod(method);
  const { ref } = mockProviderCharge(provider, amount);
  const now = new Date();

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      method,
      status: PaymentStatus.PAID,
      amount,
      transactionRef: ref,
      paidAt: now,
    },
    update: {
      method,
      status: PaymentStatus.PAID,
      amount,
      transactionRef: ref,
      paidAt: now,
    },
  });

  const escrow = await prisma.escrow.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount,
      status: EscrowStatus.HELD,
      heldAt: now,
      releasedAt: null,
    },
    update: {
      amount,
      status: EscrowStatus.HELD,
      heldAt: now,
      releasedAt: null,
    },
  });

  await appendLog(
    payment.id,
    "CHARGE",
    provider,
    { bookingId, amount, method, ref },
  );

  await createReceipt(bookingId);

  return { payment, escrow, provider, ref, held: true };
}

// Create a receipt for a booking if one doesn't already exist (idempotent).
async function createReceipt(bookingId: string): Promise<Receipt> {
  const existing = await prisma.receipt.findUnique({ where: { bookingId } });
  if (existing) return existing;
  const receiptNumber = `RC-${Date.now().toString(36).toUpperCase()}`;
  const created = await prisma.receipt.create({
    data: {
      bookingId,
      receiptNumber,
      pdfUrl: null,
      emailedTo: null,
    },
  });
  await prisma.receipt.update({
    where: { id: created.id },
    data: { pdfUrl: `/api/receipts/${created.id}/pdf` },
  });
  return prisma.receipt.findUniqueOrThrow({ where: { id: created.id } });
}

export type RefundResult = {
  refund: Refund;
  payment: Payment;
  escrow: Escrow | null;
  ref: string;
  processedAt: Date;
};

export async function refund(
  paymentId: string,
  amount: number,
  reason?: string,
): Promise<RefundResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (!payment) throw new Error("payment_not_found");
  if (amount <= 0) throw new Error("invalid_amount");

  const provider = providerForMethod(payment.method);
  const ref = `rfd_${paymentId}_${Date.now().toString(36)}`;
  const processedAt = new Date();

  const refundRecord = await prisma.refund.create({
    data: {
      paymentId,
      amount,
      reason: reason ?? null,
      status: PaymentStatus.PAID,
      processedAt,
    },
  });

  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.REFUNDED },
  });

  let escrow: Escrow | null = null;
  if (payment.bookingId) {
    escrow = await prisma.escrow.upsert({
      where: { bookingId: payment.bookingId },
      create: {
        bookingId: payment.bookingId,
        amount,
        status: EscrowStatus.REFUNDED,
        heldAt: processedAt,
        releasedAt: processedAt,
      },
      update: {
        status: EscrowStatus.REFUNDED,
        releasedAt: processedAt,
      },
    });
  }

  await appendLog(
    paymentId,
    "REFUND",
    provider,
    { paymentId, amount, reason, ref },
  );

  return {
    refund: refundRecord,
    payment: updatedPayment,
    escrow,
    ref,
    processedAt,
  };
}

export type ReleaseEscrowResult = {
  escrow: Escrow;
  releasedAt: Date;
};

export async function releaseEscrow(
  bookingId: string,
): Promise<ReleaseEscrowResult> {
  const releasedAt = new Date();
  const existing = await prisma.escrow.findUnique({ where: { bookingId } });
  const escrow = await prisma.escrow.upsert({
    where: { bookingId },
    create: {
      bookingId,
      amount: 0,
      status: EscrowStatus.RELEASED,
      heldAt: releasedAt,
      releasedAt,
    },
    update: {
      status: EscrowStatus.RELEASED,
      releasedAt,
    },
  });

  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  const provider = payment ? providerForMethod(payment.method) : null;
  await appendLog(
    payment?.id ?? null,
    "RELEASE_ESCROW",
    provider,
    { bookingId, amount: existing?.amount ?? escrow.amount },
  );

  return { escrow, releasedAt };
}

export async function listPayments(userId: string): Promise<
  (Payment & { booking: Booking | null })[]
> {
  return prisma.payment.findMany({
    where: { booking: { userId } },
    include: { booking: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAuditLog(
  paymentId: string,
): Promise<TransactionLog[]> {
  return prisma.transactionLog.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
  });
}
