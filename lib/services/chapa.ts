import crypto from "crypto";
import { Chapa } from "chapa-nodejs";
import { prisma } from "@/lib/prisma";
import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  EscrowStatus,
  BookingStatus,
  type Payment,
  type Receipt,
  type TransactionLog,
} from "@prisma/client";

// Chapa (Ethiopian payment aggregator) integration via the official
// `chapa-nodejs` SDK. Supports Telebirr, CBE Birr, M-Birr through Chapa's
// hosted checkout. Sandbox/test keys work for local testing without real
// merchant onboarding; no real money is moved in test mode.
//
// Required env:
//   CHAPA_SECRET_KEY   - secret key from Chapa dashboard (test or live)
//   PAYMENT_TEST_MODE  - "1" forces amount to 1 ETB for local testing

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || "";
const TEST_MODE = process.env.PAYMENT_TEST_MODE === "1";

let _chapa: Chapa | null = null;
function getChapa(): Chapa {
  if (!_chapa) _chapa = new Chapa({ secretKey: CHAPA_SECRET_KEY });
  return _chapa;
}

export function chapaConfigured(): boolean {
  return !!CHAPA_SECRET_KEY;
}

export function testAmount(amount: number): number {
  return TEST_MODE ? 1 : amount;
}

export type ChapaInitInput = {
  amount: number;
  tx_ref: string;
  email: string;
  first_name: string;
  last_name?: string;
  phone?: string;
  return_url: string;
  callback_url?: string;
  title?: string;
  description?: string;
  bookingId?: string;
};

export type ChapaInitResult = {
  checkout_url: string;
  tx_ref: string;
};

// Initialize a Chapa transaction via the SDK. Returns the hosted checkout URL
// the user must be redirected to (they pick Telebirr etc. and approve there).
export async function initialize(
  input: ChapaInitInput,
): Promise<ChapaInitResult> {
  if (!chapaConfigured()) {
    throw new Error("chapa_not_configured");
  }
  const amount = testAmount(input.amount);
  try {
    const response = await getChapa().initialize({
      first_name: input.first_name,
      last_name: input.last_name || "Customer",
      email: input.email,
      phone_number: input.phone || undefined,
      currency: "ETB",
      amount: String(amount),
      tx_ref: input.tx_ref,
      callback_url: input.callback_url || input.return_url,
      return_url: input.return_url,
      customization: {
        title: (input.title || "Bus Ticket").slice(0, 16),
        description: (input.description || "Pay for your bus booking")
          .replace(/[^a-zA-Z0-9 _.\-]/g, "")
          .slice(0, 100),
      },
    } as any);

    const checkout_url = (response as any)?.data?.checkout_url;
    if (response.status !== "success" || !checkout_url) {
      const msg = (response as any)?.message;
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return { checkout_url, tx_ref: input.tx_ref };
  } catch (error: any) {
    const msg = error?.response?.data?.message ?? error?.message;
    throw new Error(typeof msg === "string" ? msg : "chapa_init_failed");
  }
}

// Generate a transaction reference using the SDK utility.
export async function genTxRef(prefix = "TX"): Promise<string> {
  if (!chapaConfigured()) return `${prefix}-${Date.now().toString(36)}`;
  try {
    return await getChapa().genTxRef({ prefix });
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

// Record a pending payment intent keyed by tx_ref so the return/callback flow
// can recover bookingId + method even if Chapa drops our return_url query params.
export async function recordPendingIntent(
  bookingId: string,
  tx_ref: string,
  method: PaymentMethod,
  amount: number,
): Promise<void> {
  const value = testAmount(amount);
  await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      method,
      status: PaymentStatus.PENDING,
      amount: value,
      transactionRef: tx_ref,
    },
    update: {
      method,
      status: PaymentStatus.PENDING,
      amount: value,
      transactionRef: tx_ref,
      paidAt: null,
    },
  });
}

// Look up a pending intent by tx_ref to recover bookingId + method.
export async function findIntentByTxRef(
  tx_ref: string,
): Promise<{ bookingId: string; method: PaymentMethod } | null> {
  const payment = await prisma.payment.findFirst({
    where: { transactionRef: tx_ref },
  });
  if (!payment) return null;
  return { bookingId: payment.bookingId, method: payment.method };
}

export type ChapaVerifyResult = {
  success: boolean;
  status: string;
  amount?: number;
  raw: unknown;
};

// Verify a transaction by tx_ref via the SDK. Returns whether Chapa reports it paid.
export async function verify(tx_ref: string): Promise<ChapaVerifyResult> {
  if (!chapaConfigured()) {
    throw new Error("chapa_not_configured");
  }
  try {
    const response = await getChapa().verify({ tx_ref });
    const data = (response as any)?.data || {};
    const status = String(data.status || response.status || "").toLowerCase();
    return {
      success: response.status === "success" && status === "success",
      status,
      amount: data.amount != null ? Number(data.amount) : undefined,
      raw: response,
    };
  } catch (error: any) {
    const data = error?.response?.data;
    const status = String(data?.data?.status || data?.status || "").toLowerCase();
    return { success: false, status: status || "error", raw: data ?? error };
  }
}

// Cancel an active transaction (expires the checkout link). PUT /transaction/cancel/<tx_ref>
export async function cancel(tx_ref: string): Promise<boolean> {
  if (!chapaConfigured()) throw new Error("chapa_not_configured");
  try {
    const response = await (getChapa() as any).cancel?.({ tx_ref });
    return (response as any)?.status === "success";
  } catch (error: any) {
    throw new Error(error?.response?.data?.message || error?.message || "chapa_cancel_failed");
  }
}

// Direct Charge — initiate a charge directly to a mobile money account
// (telebirr/mpesa/Amole/CBEBirr/Coopay-Ebirr/AwashBirr). This is the in-app
// OTP/approval flow: after this, call authorizeDirectCharge with the returned
// reference + the OTP the customer receives.
export type DirectChargeType =
  | "telebirr"
  | "mpesa"
  | "Amole"
  | "CBEBirr"
  | "Coopay-Ebirr"
  | "AwashBirr"
  | string;

export async function directCharge(opts: {
  mobile: string;
  amount: number;
  tx_ref: string;
  type: DirectChargeType;
  first_name?: string;
  last_name?: string;
  email?: string;
}): Promise<{ reference: string; auth_type?: string; raw: unknown }> {
  if (!chapaConfigured()) throw new Error("chapa_not_configured");
  const response = await getChapa().directCharge({
    first_name: opts.first_name,
    last_name: opts.last_name,
    email: opts.email,
    mobile: opts.mobile,
    currency: "ETB",
    amount: String(testAmount(opts.amount)),
    tx_ref: opts.tx_ref,
    type: opts.type,
  } as any);
  const data = (response as any)?.data || {};
  const reference = data?.meta?.ref_id || data?.reference || "";
  if (!reference) throw new Error("direct_charge_no_reference");
  return { reference, auth_type: data?.auth_type, raw: response };
}

// Authorize a direct charge with the OTP/approval the customer received.
export async function authorizeDirectCharge(opts: {
  reference: string;
  type: DirectChargeType;
  client?: string;
}): Promise<{ tx_ref?: string; raw: unknown }> {
  if (!chapaConfigured()) throw new Error("chapa_not_configured");
  const response = await getChapa().authorizeDirectCharge({
    reference: opts.reference,
    client: opts.client || "",
    type: opts.type,
  } as any);
  return { tx_ref: (response as any)?.trx_ref, raw: response };
}

// SHA-256 chain hash with a random nonce to guarantee uniqueness even under
// concurrent confirmations (webhook + return-page verify racing).
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
        data: { paymentId, event, provider, payload: payload as any, hash, prevHash },
      });
    } catch (err: any) {
      if (err?.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
  throw new Error("audit_log_create_failed");
}

export type ConfirmResult = {
  payment: Payment;
  receipt: Receipt;
  alreadyConfirmed: boolean;
};

// Confirm a booking payment after Chapa verification: mark Payment PAID,
// hold escrow, write audit log, and auto-generate a Receipt. Idempotent —
// if already paid, returns the existing payment + receipt.
export async function confirmPayment(
  bookingId: string,
  tx_ref: string,
  method: PaymentMethod,
  chapaReceiptUrl?: string,
): Promise<ConfirmResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: true, payment: true, receipt: true },
  });
  if (!booking) throw new Error("booking_not_found");

  // Idempotent: already paid.
  if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
    let receipt = booking.receipt;
    if (!receipt) {
      receipt = await createReceipt(bookingId, booking.user?.email || null);
    }
    // Update the Chapa receipt URL if we now have one and the receipt doesn't.
    if (chapaReceiptUrl && receipt && !receipt.chapaReceiptUrl) {
      receipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: { chapaReceiptUrl },
      });
    }
    return { payment: booking.payment, receipt, alreadyConfirmed: true };
  }

  const result = await verify(tx_ref);
  if (!result.success) {
    throw new Error("payment_not_verified");
  }

  const provider: PaymentProvider =
    method === PaymentMethod.TELEBIRR
      ? "TELEBIRR"
      : method === PaymentMethod.CBE_BIRR
        ? "CBE_BIRR"
        : method === PaymentMethod.M_BIRR
          ? "M_BIRR"
          : "CHAPA";
  const amount = testAmount(booking.totalPrice);
  const now = new Date();

  const payment = await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      method,
      status: PaymentStatus.PAID,
      amount,
      transactionRef: tx_ref,
      paidAt: now,
    },
    update: {
      method,
      status: PaymentStatus.PAID,
      amount,
      transactionRef: tx_ref,
      paidAt: now,
    },
  });

  await prisma.escrow.upsert({
    where: { bookingId },
    create: { bookingId, amount, status: EscrowStatus.HELD, heldAt: now },
    update: { amount, status: EscrowStatus.HELD, heldAt: now, releasedAt: null },
  });

  // Confirm the booking now that payment is verified.
  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CONFIRMED },
  });

  await appendLog(payment.id, "CHARGE", provider, {
    bookingId,
    amount,
    method,
    tx_ref,
    provider: "chapa",
  });

  const receipt = await createReceipt(bookingId, booking.user?.email || null);

  // Store the Chapa-hosted receipt URL (captured from document.referrer on the
  // return page) so the user can view/download the original Chapa receipt.
  if (chapaReceiptUrl && receipt && !receipt.chapaReceiptUrl) {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { chapaReceiptUrl },
    });
  }

  return { payment, receipt, alreadyConfirmed: false };
}

async function createReceipt(
  bookingId: string,
  emailedTo: string | null,
): Promise<Receipt> {
  const existing = await prisma.receipt.findUnique({ where: { bookingId } });
  if (existing) return existing;
  const receiptNumber = `RC-${Date.now().toString(36).toUpperCase()}`;
  const created = await prisma.receipt.create({
    data: {
      bookingId,
      receiptNumber,
      pdfUrl: null,
      emailedTo,
    },
  });
  // Link to the existing PDF endpoint so the client can download/view it.
  await prisma.receipt.update({
    where: { id: created.id },
    data: { pdfUrl: `/api/receipts/${created.id}/pdf` },
  });
  return prisma.receipt.findUniqueOrThrow({ where: { id: created.id } });
}
