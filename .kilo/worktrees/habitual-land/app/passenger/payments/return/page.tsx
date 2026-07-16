"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle, Download } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";

type ReceiptDetail = {
  receipt: { id: string; receiptNumber: string; issuedAt: string; pdfUrl: string };
  booking: {
    id: string;
    bookingRef: string;
    status: string;
    totalPrice: number;
    passengerFullName: string | null;
    passengerPhone: string | null;
    passengerEmail: string | null;
    seats: string[];
  };
  trip: {
    departAt: string;
    arriveAt: string;
    origin: { name: string; code: string } | null;
    destination: { name: string; code: string } | null;
    bus: { plateNumber: string; model: string | null } | null;
  } | null;
  payment: {
    method: string;
    status: string;
    amount: number;
    transactionRef: string | null;
    paidAt: string | null;
  } | null;
};

function fmt(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function ReturnInner() {
  const search = useSearchParams();
  const router = useRouter();
  // Chapa may pass back tx_ref under several names; also keep our own params
  // as a fallback. bookingId/method are recovered server-side from the intent.
  const queryTx =
    search?.get("tx_ref") ||
    search?.get("trx_ref") ||
    search?.get("trxRef") ||
    search?.get("transaction_id") ||
    "";
  const queryBooking = search?.get("bookingId") || "";
  const queryMethod = search?.get("method") || "";

  // Recover from sessionStorage if Chapa's redirect dropped the params
  // (common in test mode). Falls back gracefully.
  const stored = (() => {
    try {
      const raw = sessionStorage.getItem("chapa_pending");
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v?.tx_ref) return null;
      // Ignore stale intents older than 30 minutes.
      if (v.ts && Date.now() - v.ts > 30 * 60 * 1000) return null;
      return v;
    } catch {
      return null;
    }
  })();

  const tx_ref = queryTx || stored?.tx_ref || "";
  const bookingId = queryBooking || stored?.bookingId || "";
  const method = queryMethod || stored?.method || "";

  const [status, setStatus] = useState<"verifying" | "success" | "failed">(
    "verifying",
  );
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    receiptId?: string;
    receiptNumber?: string;
    chapaReceiptUrl?: string | null;
    error?: string;
  }>({});
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);

  // Capture the Chapa receipt URL from the referrer (Chapa's receipt page
  // redirects here, so document.referrer is the Chapa receipt URL).
  const chapaReferrer = (() => {
    try {
      const ref = document.referrer || "";
      if (ref.includes("chapa.co") || ref.includes("checkout.chapa")) return ref;
      return "";
    } catch {
      return "";
    }
  })();

  useEffect(() => {
    if (status === "success" && result.receiptId) {
      let cancelled = false;
      (async () => {
        try {
          const res = await fetch(`/api/receipts/${result.receiptId}`);
          if (cancelled) return;
          if (res.ok) setReceipt(await res.json());
        } catch {}
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [status, result.receiptId]);

  useEffect(() => {
    if (!tx_ref) {
      // No reference in the URL or sessionStorage — try to recover the user's
      // most recent pending payment server-side (stored during checkout init)
      // and verify it with Chapa. This handles Chapa dropping the return params.
      let cancelled = false;
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const MAX_ATTEMPTS = 12;
      (async () => {
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
          if (cancelled) return;
          try {
            const res = await fetch("/api/payments/chapa/recover", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chapaReceiptUrl: chapaReferrer }),
            });
            const data = await res.json();
            if (cancelled) return;
            if (res.ok && data?.ok) {
              setStatus("success");
              setResult({
                receiptId: data.receiptId,
                receiptNumber: data.receiptNumber,
                chapaReceiptUrl: data.chapaReceiptUrl ?? null,
              });
              try {
                sessionStorage.removeItem("chapa_pending");
              } catch {}
              return;
            }
            // No pending payment at all — nothing to recover.
            if (data?.error === "no_pending_payment") {
              setStatus("failed");
              setResult({
                error:
                  "We couldn't find a pending payment. If you just completed payment on Chapa, open your Payments or Bookings page — your booking will be confirmed automatically once Chapa notifies us.",
              });
              return;
            }
          } catch {
            // network blip — keep trying
          }
          setAttempt(i + 1);
          await delay(5000);
        }
        if (!cancelled) {
          setStatus("failed");
          setResult({
            error:
              "Payment is still pending on Chapa. If money was deducted, your booking will be confirmed shortly via webhook.",
          });
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    const MAX_ATTEMPTS = 12; // ~ up to 60s of polling
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    // Hard errors that mean we should stop polling immediately.
    const HARD_ERRORS = new Set([
      "booking_not_found",
      "invalid_method",
      "tx_ref_required",
      "forbidden",
      "unauthorized",
    ]);

    (async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/payments/chapa/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              bookingId
                ? { tx_ref, bookingId, method, chapaReceiptUrl: chapaReferrer }
                : { tx_ref, chapaReceiptUrl: chapaReferrer },
            ),
          });
          const data = await res.json();
          if (cancelled) return;
          if (res.ok && data?.ok) {
            setStatus("success");
            setResult({
              receiptId: data.receiptId,
              receiptNumber: data.receiptNumber,
              chapaReceiptUrl: data.chapaReceiptUrl ?? null,
            });
            try {
              sessionStorage.removeItem("chapa_pending");
            } catch {}
            return;
          }
          // Only stop on hard errors; transient/server errors keep polling.
          if (data?.error && HARD_ERRORS.has(data.error)) {
            setStatus("failed");
            setResult({ error: data.error });
            return;
          }
        } catch (e: any) {
          // network blip — keep polling
        }
        setAttempt(i + 1);
        await delay(5000);
      }
      if (!cancelled) {
        setStatus("failed");
        setResult({
          error:
            "Payment is still pending on Chapa. If money was deducted, your booking will be confirmed shortly via webhook.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tx_ref, bookingId, method]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Payment verification</CardTitle>
          <CardDescription>
            {status === "verifying"
              ? "Confirming your payment with Chapa..."
              : status === "success"
                ? "Your payment was successful."
                : "Payment verification failed."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "verifying" && (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mb-2 h-5 w-5 animate-spin" />
              <span className="text-sm">
                Verifying payment with Chapa... (attempt {attempt + 1})
              </span>
              <span className="text-xs">
                Waiting for the provider to confirm the transfer.
              </span>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Payment confirmed</span>
              </div>

              {receipt ? (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="mb-3 border-b pb-2">
                    <div className="text-base font-bold">BUS TICKET RECEIPT</div>
                    <div className="text-xs text-muted-foreground">
                      Receipt: {receipt.receipt.receiptNumber}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5">
                    <span className="text-muted-foreground">Booking</span>
                    <span className="font-mono">{receipt.booking.bookingRef}</span>
                    <span className="text-muted-foreground">Passenger</span>
                    <span>{receipt.booking.passengerFullName || "-"}</span>
                    <span className="text-muted-foreground">Phone</span>
                    <span>{receipt.booking.passengerPhone || "-"}</span>
                    <span className="text-muted-foreground">Email</span>
                    <span className="break-all">{receipt.booking.passengerEmail || "-"}</span>
                    <span className="text-muted-foreground">From</span>
                    <span>
                      {receipt.trip?.origin
                        ? `${receipt.trip.origin.name} (${receipt.trip.origin.code})`
                        : "-"}
                    </span>
                    <span className="text-muted-foreground">To</span>
                    <span>
                      {receipt.trip?.destination
                        ? `${receipt.trip.destination.name} (${receipt.trip.destination.code})`
                        : "-"}
                    </span>
                    <span className="text-muted-foreground">Depart</span>
                    <span>{fmt(receipt.trip?.departAt)}</span>
                    <span className="text-muted-foreground">Bus</span>
                    <span>
                      {receipt.trip?.bus?.plateNumber || "-"}
                      {receipt.trip?.bus?.model ? ` (${receipt.trip.bus.model})` : ""}
                    </span>
                    <span className="text-muted-foreground">Seat(s)</span>
                    <span className="font-semibold">
                      {receipt.booking.seats.join(", ") || "-"}
                    </span>
                    <span className="text-muted-foreground">Amount paid</span>
                    <span className="font-bold text-emerald-600">
                      {(receipt.payment?.amount ?? receipt.booking.totalPrice).toFixed(2)} ETB
                    </span>
                    <span className="text-muted-foreground">Method</span>
                    <span>{receipt.payment?.method || "-"}</span>
                    <span className="text-muted-foreground">Tx ref</span>
                    <span className="font-mono text-xs">
                      {receipt.payment?.transactionRef || "-"}
                    </span>
                    <span className="text-muted-foreground">Paid at</span>
                    <span>{fmt(receipt.payment?.paidAt)}</span>
                  </div>
                  <div className="mt-3">
                    <Badge variant="default">PAID</Badge>{" "}
                    <Badge variant="outline">{receipt.booking.status}</Badge>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Receipt number:{" "}
                  <span className="font-mono font-semibold">
                    {result.receiptNumber}
                  </span>
                </div>
              )}

              {/* Chapa-hosted receipt — the original provider receipt */}
              {(result.chapaReceiptUrl || chapaReferrer) && (
                <div className="rounded-lg border border-[#6D28D9]/30 bg-[#6D28D9]/5 p-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#6D28D9] px-2 py-0.5 text-xs font-bold text-white">
                      CHAPA
                    </span>
                    <span className="text-sm font-semibold">
                      Chapa payment receipt
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    This is the original receipt generated by Chapa for your
                    payment. Open it to view, print, or save as PDF.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={result.chapaReceiptUrl || chapaReferrer}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        View / Download Chapa receipt
                      </Button>
                    </a>
                  </div>
                  <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                    {result.chapaReceiptUrl || chapaReferrer}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {result.receiptId && (
                  <Link href={`/api/receipts/${result.receiptId}/pdf`}>
                    <Button size="sm" variant="outline">
                      Download system receipt (PDF)
                    </Button>
                  </Link>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/passenger/bookings")}
                >
                  View my bookings
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push("/passenger/payments")}
                >
                  Back to payments
                </Button>
              </div>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Not verified</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {result.error ||
                  "The payment could not be confirmed. If money was deducted, it will be auto-refunded by Chapa."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => router.push("/passenger/bookings")}
                >
                  View my bookings
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push("/passenger/payments")}
                >
                  Back to payments
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <DashboardShell>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading...
          </div>
        }
      >
        <ReturnInner />
      </Suspense>
    </DashboardShell>
  );
}
