"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Loader2, RefreshCw, Download } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type BookingPayment = {
  id: string;
  status: string;
  method: string;
  amount: number;
  paidAt: string | null;
  transactionRef: string | null;
} | null;

type BookingItem = {
  id: string;
  bookingRef: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  payment: BookingPayment;
  trip: {
    id: string;
    departAt: string;
    arriveAt: string;
    route: {
      origin: { name: string; code: string } | null;
      destination: { name: string; code: string } | null;
    } | null;
  } | null;
};

type PaymentDetail = {
  payment: {
    id: string;
    bookingId: string;
    method: string;
    status: string;
    amount: number;
    transactionRef: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  booking: {
    id: string;
    bookingRef: string;
    status: string;
    totalPrice: number;
  } | null;
  escrow: {
    id: string;
    bookingId: string;
    amount: number;
    status: string;
    heldAt: string;
    releasedAt: string | null;
  } | null;
  refunds: {
    id: string;
    amount: number;
    reason: string | null;
    status: string;
    processedAt: string | null;
    createdAt: string;
  }[];
  receipt: {
    id: string;
    receiptNumber: string;
    issuedAt: string;
    pdfUrl: string;
    chapaReceiptUrl: string | null;
  } | null;
  auditLog: {
    id: string;
    event: string;
    provider: string | null;
    payload: unknown;
    hash: string;
    prevHash: string | null;
    createdAt: string;
  }[];
};

const METHODS = [
  { value: "TELEBIRR", label: "Telebirr" },
  { value: "CBE_BIRR", label: "CBE Birr" },
  { value: "M_BIRR", label: "M-Birr" },
  { value: "CASH", label: "Cash Agent" },
];

const TEST_MODE = process.env.NEXT_PUBLIC_PAY_TEST_MODE === "1";
const DEFAULT_TEST_PHONE = "0900123456";

// Chapa sandbox test mobile money numbers (success). OTP 12345 where noted.
const TEST_NUMBERS: Record<string, { phone: string; otp?: string; note?: string }[]> = {
  TELEBIRR: [
    { phone: "0900123456" },
    { phone: "0900112233" },
    { phone: "0900881111" },
  ],
  CBE_BIRR: [
    { phone: "0900123456" },
    { phone: "0900112233" },
    { phone: "0900881111" },
  ],
  M_BIRR: [
    { phone: "0900123456", otp: "12345", note: "Amole/Awash" },
    { phone: "0900112233", otp: "12345" },
    { phone: "0900881111", otp: "12345" },
  ],
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const s = status.toUpperCase();
  if (s === "PAID" || s === "RELEASED" || s === "CONFIRMED" || s === "COMPLETED")
    return "default";
  if (s === "REFUNDED" || s === "FAILED" || s === "CANCELLED") return "destructive";
  if (s === "HELD" || s === "PENDING") return "secondary";
  return "outline";
}

export default function PaymentsPage() {
  const { toast } = useToast();
  const { data: session } = useSession();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [paymentByBooking, setPaymentByBooking] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("TELEBIRR");
  const [telebirrPhone, setTelebirrPhone] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/bookings");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load bookings.");
      }
      const data = (await res.json()) as BookingItem[];
      setBookings(data || []);

      const payRes = await fetch("/api/payments");
      if (payRes.ok) {
        const payData = (await payRes.json()) as {
          id: string;
          bookingId: string;
        }[];
        const map: Record<string, string> = {};
        for (const p of payData || []) map[p.bookingId] = p.id;
        setPaymentByBooking(map);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const loadDetail = useCallback(async (paymentId: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/payments/${paymentId}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load payment detail.");
      }
      const data = (await res.json()) as PaymentDetail;
      setDetail(data);
    } catch (err: any) {
      toast({
        title: "Could not load payment detail",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedPaymentId) {
      loadDetail(selectedPaymentId);
    } else {
      setDetail(null);
    }
  }, [selectedPaymentId, loadDetail]);

  async function handleCharge(bookingId: string, amount: number, phone?: string) {
    try {
      setBusy(true);
      const chapaMethods = new Set(["TELEBIRR", "CBE_BIRR", "M_BIRR"]);
      if (chapaMethods.has(method)) {
        // Real payment via Chapa hosted checkout (Telebirr/CBE Birr/M-Birr).
        const res = await fetch("/api/payments/chapa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "chapa_init", bookingId, method, phone }),
        });
        const data = await res.json();
        if (!res.ok || data?.error || !data?.checkout_url) {
          throw new Error(
            data?.error === "chapa_not_configured"
              ? "Chapa is not configured. Set CHAPA_SECRET_KEY in .env."
              : data?.error === "rate_limited"
                ? `Too many payment attempts. Please wait ${data?.retry_after ?? 30}s and try again.`
                : data?.error || "Could not start payment.",
          );
        }
        toast({
          title: "Redirecting to Chapa",
          description: data.test_mode
            ? "Test mode (1 ETB). Approve the payment on Chapa's checkout."
            : "Approve the payment on Chapa's checkout.",
        });
        // Persist intent so the return page can recover it if Chapa drops
        // the tx_ref query param on redirect.
        try {
          sessionStorage.setItem(
            "chapa_pending",
            JSON.stringify({
              tx_ref: data.tx_ref,
              bookingId,
              method,
              ts: Date.now(),
            }),
          );
        } catch {}
        // Redirect to Chapa hosted checkout — user pays/approves there.
        window.location.href = data.checkout_url;
        return;
      }

      // Cash / other: mock charge directly.
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "charge",
          bookingId,
          amount,
          method,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Charge failed.");
      }
      toast({
        title: "Payment successful",
        description: `Ref ${data.ref} via ${data.provider}. Escrow held.`,
      });
      setPayingBookingId(null);
      await loadBookings();
    } catch (err: any) {
      toast({
        title: "Payment failed",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRefund() {
    if (!detail) return;
    const amount = Number(refundAmount || 0);
    if (!amount || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a refund amount greater than zero.",
        variant: "destructive",
      });
      return;
    }
    try {
      setBusy(true);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refund",
          paymentId: detail.payment.id,
          amount,
          reason: refundReason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Refund failed.");
      }
      toast({
        title: "Refund processed",
        description: `Ref ${data.ref} at ${formatDateTime(data.processedAt)}.`,
      });
      setRefundAmount("");
      setRefundReason("");
      await loadDetail(detail.payment.id);
      await loadBookings();
    } catch (err: any) {
      toast({
        title: "Refund failed",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReleaseEscrow() {
    if (!detail) return;
    try {
      setBusy(true);
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "release_escrow",
          bookingId: detail.payment.bookingId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Release failed.");
      }
      toast({
        title: "Escrow released",
        description: `Released at ${formatDateTime(data.releasedAt)}.`,
      });
      await loadDetail(detail.payment.id);
      await loadBookings();
    } catch (err: any) {
      toast({
        title: "Release failed",
        description: err?.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell>
      <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pay for your bookings, request refunds, and track escrow with a
              tamper-proof audit log.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadBookings} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {loading && (
          <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading your bookings...
          </div>
        )}

        {!loading && error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <div className="rounded border bg-card p-8 text-center text-muted-foreground text-sm">
            You have no bookings yet. Book a trip first to make a payment.
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bookings.map((booking) => {
              const origin = booking.trip?.route?.origin
                ? `${booking.trip.route.origin.name} (${booking.trip.route.origin.code})`
                : "-";
              const destination = booking.trip?.route?.destination
                ? `${booking.trip.route.destination.name} (${booking.trip.route.destination.code})`
                : "-";
              const isPaying = payingBookingId === booking.id;
              return (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{booking.bookingRef}</CardTitle>
                      <Badge variant={statusVariant(booking.status)}>
                        {booking.status}
                      </Badge>
                    </div>
                    <CardDescription>
                      {origin} → {destination}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">
                        {booking.totalPrice.toFixed(2)} ETB
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Depart</span>
                      <span>{formatDateTime(booking.trip?.departAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Payment</span>
                      {booking.payment ? (
                        <Badge variant={statusVariant(booking.payment.status)}>
                          {booking.payment.status}
                        </Badge>
                      ) : (
                        <Badge variant="outline">UNPAID</Badge>
                      )}
                    </div>
                    {booking.payment?.transactionRef && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Ref</span>
                        <span className="font-mono text-xs">
                          {booking.payment.transactionRef}
                        </span>
                      </div>
                    )}

                    {isPaying && !booking.payment && (
                      <div className="mt-3 space-y-2 rounded border bg-muted/40 p-3">
                        <label className="text-xs font-medium">
                          Payment method
                        </label>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={method}
                          onChange={(e) => setMethod(e.target.value)}
                        >
                          {METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>

                        {["TELEBIRR", "CBE_BIRR", "M_BIRR"].includes(method) && (
                          <div className="space-y-2 rounded border border-primary/30 bg-primary/5 p-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Amount to pay</span>
                              <span className="font-semibold">
                                {TEST_MODE ? "1.00" : booking.totalPrice.toFixed(2)} ETB
                              </span>
                            </div>
                            <label className="text-xs font-medium">
                              {method === "TELEBIRR"
                                ? "Telebirr mobile number"
                                : method === "CBE_BIRR"
                                  ? "CBE Birr mobile number"
                                  : "M-Birr mobile number"}
                            </label>
                            <Input
                              type="tel"
                              inputMode="tel"
                              placeholder="09xxxxxxxx"
                              value={telebirrPhone}
                              onChange={(e) => setTelebirrPhone(e.target.value)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                              You'll be redirected to Chapa to approve the payment
                              from your {method === "TELEBIRR" ? "Telebirr" : method === "CBE_BIRR" ? "CBE Birr" : "M-Birr"} app/USSD.
                            </p>

                            {TEST_MODE && (
                              <div className="mt-2 rounded border border-dashed border-amber-400/60 bg-amber-50/60 dark:bg-amber-900/20 p-2 text-[11px]">
                                <div className="font-semibold text-amber-700 dark:text-amber-300">
                                  Test mode — use these numbers on Chapa checkout
                                </div>
                                <ul className="mt-1 space-y-0.5">
                                  {(TEST_NUMBERS[method] || []).map((tn) => (
                                    <li key={tn.phone} className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="font-mono text-primary underline-offset-2 hover:underline"
                                        onClick={() => setTelebirrPhone(tn.phone)}
                                      >
                                        {tn.phone}
                                      </button>
                                      {tn.otp && (
                                        <span className="text-muted-foreground">
                                          OTP {tn.otp}
                                        </span>
                                      )}
                                      {tn.note && (
                                        <span className="text-muted-foreground">
                                          ({tn.note})
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-1 text-muted-foreground">
                                  Tap a number to fill it. Any other number returns
                                  failed.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            disabled={
                              busy ||
                              (["TELEBIRR", "CBE_BIRR", "M_BIRR"].includes(method) &&
                                telebirrPhone.trim().length < 9)
                            }
                            onClick={() =>
                              handleCharge(
                                booking.id,
                                booking.totalPrice,
                                telebirrPhone.trim(),
                              )
                            }
                          >
                            {busy ? "Processing..." : "Confirm payment"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setPayingBookingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between">
                    {!booking.payment ? (
                      isPaying ? (
                        <span className="text-xs text-muted-foreground">
                          Choose a method above
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setTelebirrPhone(
                              TEST_MODE
                                ? DEFAULT_TEST_PHONE
                                : String((session?.user as any)?.phone || ""),
                            );
                            setPayingBookingId(booking.id);
                            setSelectedPaymentId(null);
                          }}
                        >
                          Pay now
                        </Button>
                      )
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPaymentId(null)}
                        disabled
                      >
                        {booking.payment.status === "PAID"
                          ? "Paid"
                          : booking.payment.status === "PENDING"
                            ? "Pending"
                            : booking.payment.status}
                      </Button>
                    )}
                    {booking.payment && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSelectedPaymentId(
                            paymentByBooking[booking.id] ??
                              booking.payment?.id ??
                              null,
                          )
                        }
                      >
                        View details
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog
          open={!!selectedPaymentId}
          onOpenChange={(open) => {
            if (!open) setSelectedPaymentId(null);
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Payment detail</DialogTitle>
              <DialogDescription>
                Receipt, escrow, refunds, and audit log for this payment.
              </DialogDescription>
            </DialogHeader>

            {detailLoading && (
              <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                Loading payment detail...
              </div>
            )}

            {!detailLoading && detail && (
              <div className="grid gap-4 md:grid-cols-2">
                {/* Branded receipt card with download */}
                <Card className="md:col-span-2 overflow-hidden border-0">
                  <div className="flex items-center justify-between bg-[#6D28D9] px-5 py-3 text-white">
                    <div>
                      <div className="text-sm font-bold tracking-wide">BUS TICKET RECEIPT</div>
                      <div className="text-[11px] text-white/80">
                        {detail.receipt?.receiptNumber ?? detail.payment.transactionRef ?? "-"}
                      </div>
                    </div>
                    {["TELEBIRR", "CBE_BIRR", "M_BIRR"].includes(detail.payment.method) && (
                      <span className="rounded bg-white px-2 py-1 text-xs font-bold text-[#6D28D9]">
                        CHAPA
                      </span>
                    )}
                  </div>
                  <CardContent className="space-y-2 pt-4 text-sm">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Booking</span>
                        <span className="font-mono">{detail.booking?.bookingRef ?? "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Receipt</span>
                        <span className="font-mono">{detail.receipt?.receiptNumber ?? "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Method</span>
                        <span className="font-semibold">{detail.payment.method}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider</span>
                        <span>
                          {["TELEBIRR", "CBE_BIRR", "M_BIRR"].includes(detail.payment.method)
                            ? "Chapa"
                            : detail.payment.method}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tx Ref</span>
                        <span className="font-mono text-xs">{detail.payment.transactionRef ?? "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paid at</span>
                        <span>{formatDateTime(detail.payment.paidAt)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-bold text-emerald-600">
                          {detail.payment.amount.toFixed(2)} ETB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant={statusVariant(detail.payment.status)}>
                          {detail.payment.status}
                        </Badge>
                      </div>
                    </div>
                    {detail.receipt && (
                      <Link href={detail.receipt.pdfUrl} className="block pt-2">
                        <Button className="w-full">
                          <Download className="mr-2 h-4 w-4" />
                          Download receipt (PDF)
                        </Button>
                      </Link>
                    )}
                    {detail.receipt?.chapaReceiptUrl && (
                      <a
                        href={detail.receipt.chapaReceiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block pt-2"
                      >
                        <Button variant="outline" className="w-full">
                          <Download className="mr-2 h-4 w-4" />
                          View / Download Chapa receipt
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Payment</CardTitle>
                    <CardDescription>
                      {detail.booking?.bookingRef ?? "-"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={statusVariant(detail.payment.status)}>
                        {detail.payment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Method</span>
                      <span>{detail.payment.method}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">
                        {detail.payment.amount.toFixed(2)} ETB
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ref</span>
                      <span className="font-mono text-xs">
                        {detail.payment.transactionRef ?? "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Paid at</span>
                      <span>{formatDateTime(detail.payment.paidAt)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Escrow</CardTitle>
                    <CardDescription>Held funds for this booking</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {detail.escrow ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant={statusVariant(detail.escrow.status)}>
                            {detail.escrow.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Amount</span>
                          <span className="font-semibold">
                            {detail.escrow.amount.toFixed(2)} ETB
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Held at</span>
                          <span>{formatDateTime(detail.escrow.heldAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Released</span>
                          <span>
                            {formatDateTime(detail.escrow.releasedAt)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        No escrow record.
                      </span>
                    )}
                  </CardContent>
                  {detail.escrow?.status === "HELD" && (
                    <CardFooter>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={handleReleaseEscrow}
                      >
                        {busy ? "Releasing..." : "Release escrow"}
                      </Button>
                    </CardFooter>
                  )}
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Refund</CardTitle>
                    <CardDescription>Request a refund for this payment</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Refund amount (ETB)"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder="Reason (optional)"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={handleRefund}
                    >
                      {busy ? "Processing..." : "Request refund"}
                    </Button>
                    {detail.refunds.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="text-xs font-medium">Past refunds</div>
                        {detail.refunds.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span>
                              {r.amount.toFixed(2)} ETB
                              {r.reason ? ` — ${r.reason}` : ""}
                            </span>
                            <Badge variant={statusVariant(r.status)}>
                              {r.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Audit log chain</CardTitle>
                    <CardDescription>
                      Tamper-proof SHA-256 linked log
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {detail.auditLog.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        No audit events.
                      </span>
                    ) : (
                      <ol className="space-y-2">
                        {detail.auditLog.map((log) => (
                          <li
                            key={log.id}
                            className="rounded border bg-muted/30 p-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{log.event}</span>
                              <span className="text-muted-foreground">
                                {formatDateTime(log.createdAt)}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
                              <span>provider: {log.provider ?? "-"}</span>
                              <span>prev: {log.prevHash ?? "null"}</span>
                            </div>
                            <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                              hash: {log.hash}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardShell>
  );
}
