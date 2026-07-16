"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Timer, RefreshCw } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

const TEST_MODE = process.env.NEXT_PUBLIC_PAY_TEST_MODE === "1";
const DEFAULT_TEST_PHONE = "0900123456";
const PAY_METHODS = [
  { value: "TELEBIRR", label: "Telebirr" },
  { value: "CBE_BIRR", label: "CBE Birr" },
  { value: "M_BIRR", label: "M-Birr" },
  { value: "CASH", label: "Cash" },
];

type SeatRow = {
    id: string;
    seatNumber: string;
    seatType: string;
    isActive: boolean;
    status: "available" | "held" | "booked";
    heldByMe: boolean;
    holdId: string | null;
    expiresAt: string | null;
};

type SeatMap = {
    trip: {
        id: string;
        departAt: string;
        arriveAt: string;
        basePrice: number;
        status: string;
        route: {
            origin: { name: string; code: string } | null;
            destination: { name: string; code: string } | null;
        } | null;
        bus: {
            id: string;
            plateNumber: string;
            model: string | null;
            seatCount: number;
            seatLayout: unknown;
        } | null;
    };
    seats: SeatRow[];
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

export default function SeatMapPage() {
    const { status, data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const tripId = String(params?.id || "");
    const { toast } = useToast();

    const role = (session?.user?.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "supervisor" || role === "staff";

    const [seatMap, setSeatMap] = useState<SeatMap | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");

    // Inline payment state (shown after seats are booked, before redirect).
    const [bookedBooking, setBookedBooking] = useState<{
        id: string;
        bookingRef: string;
    } | null>(null);
    const [bookedAmount, setBookedAmount] = useState(0);
    const [payMethod, setPayMethod] = useState(isStaff ? "CASH" : "TELEBIRR");
    const [payPhone, setPayPhone] = useState("");

    const loadSeatMap = useCallback(async () => {
        const res = await fetch(`/api/seats?tripId=${encodeURIComponent(tripId)}`);
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || "Failed to load seat map.");
        }
        return (await res.json()) as SeatMap;
    }, [tripId]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;
        if (!tripId) return;

        let active = true;
        (async () => {
            try {
                setLoading(true);
                const data = await loadSeatMap();
                if (active) setSeatMap(data);
            } catch (err: any) {
                if (active) setError(err?.message || "Failed to load seat map.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, tripId, router, loadSeatMap]);

    // Pre-fill passenger details from session (only for passengers, not staff booking for others).
    useEffect(() => {
        if (!session?.user) return;
        if (isStaff) return;
        setFullName((prev) => prev || String((session.user as any)?.name || "").trim());
        setEmail((prev) => prev || String((session.user as any)?.email || "").trim());
        setPhone((prev) => prev || String((session.user as any)?.phone || "").trim());
    }, [session, isStaff]);

    // Poll for live seat status every 15 seconds.
    useEffect(() => {
        if (loading || error || !seatMap) return;
        const interval = setInterval(async () => {
            try {
                const data = await loadSeatMap();
                setSeatMap(data);
            } catch {
                // silent refresh failure
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [loading, error, seatMap, loadSeatMap]);

    const seats = (seatMap?.seats || []).slice().sort((a, b) => {
        const na = parseInt(a.seatNumber, 10);
        const nb = parseInt(b.seatNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.seatNumber.localeCompare(b.seatNumber);
    });

    const selectableSeats = useMemo(
        () => seats.filter((s) => s.isActive && s.status === "available"),
        [seats],
    );

    const heldByMe = useMemo(
        () => seats.filter((s) => s.heldByMe),
        [seats],
    );

    const availableCount = seats.filter(
        (s) => s.isActive && s.status === "available",
    ).length;
    const heldCount = seats.filter((s) => s.status === "held").length;
    const bookedCount = seats.filter((s) => s.status === "booked").length;

    const toggleSeat = (seat: SeatRow) => {
        if (!seat.isActive || seat.status !== "available") return;
        setSelected((prev) => {
            if (prev.has(seat.id)) {
                const next = new Set(prev);
                next.delete(seat.id);
                return next;
            }
            return new Set([seat.id]);
        });
    };

    const refresh = async () => {
        try {
            setBusy(true);
            const data = await loadSeatMap();
            setSeatMap(data);
        } catch (err: any) {
            toast({
                title: "Refresh failed",
                description: err?.message || "Could not refresh seats.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    const releaseHeld = async (holdId: string, seatNumber: string) => {
        setBusy(true);
        try {
            const res = await fetch("/api/seats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "release", holdId }),
            });
            if (!res.ok) throw new Error("Could not release seat.");
            toast({ title: "Seat released", description: `Seat ${seatNumber} released.` });
            const data = await loadSeatMap();
            setSeatMap(data);
        } catch (err: any) {
            toast({
                title: "Release failed",
                description: err?.message || "Could not release seat.",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    const origin = seatMap?.trip.route?.origin
        ? `${seatMap.trip.route.origin.name} (${seatMap.trip.route.origin.code})`
        : "-";
    const destination = seatMap?.trip.route?.destination
        ? `${seatMap.trip.route.destination.name} (${seatMap.trip.route.destination.code})`
        : "-";
    const totalPrice =
        seatMap && heldByMe.length > 0
            ? seatMap.trip.basePrice * heldByMe.length
            : seatMap && selected.size > 0
              ? seatMap.trip.basePrice * selected.size
              : 0;

    // Hold selected seats, then book all seats held by me, then reveal the
    // payment step. This is the single "Next" action from the seat picker.
    const goToPayment = async () => {
        if (!seatMap) return;
        if (selected.size === 0 && heldByMe.length === 0) return;
        setBusy(true);
        setError(null);
        try {
            // 1. Hold any freshly-selected seats.
            if (selected.size > 0) {
                const ids = Array.from(selected);
                for (const seatId of ids) {
                    const res = await fetch("/api/seats", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "hold",
                            tripId: seatMap.trip.id,
                            seatId,
                        }),
                    });
                    if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        const code = String(body?.error || "");
                        if (code === "seat_held")
                            throw new Error("A selected seat was just held by someone else.");
                        if (code === "seat_booked")
                            throw new Error("A selected seat was just booked.");
                        throw new Error("Could not hold seat.");
                    }
                }
                setSelected(new Set());
                const data = await loadSeatMap();
                setSeatMap(data);
            }

            // 2. Book all seats currently held by me.
            const fresh = await loadSeatMap();
            setSeatMap(fresh);
            const mine = fresh.seats.filter((s) => s.heldByMe);
            if (mine.length === 0) {
                throw new Error("No seats held to book. Please select seats again.");
            }
            const res = await fetch("/api/seats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "book",
                    tripId: fresh.trip.id,
                    seatIds: mine.map((s) => s.id),
                    passengerFullName: fullName,
                    passengerPhone: phone,
                    passengerEmail: email,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const code = String(body?.error || "");
                if (code === "seat_booked" || code === "seat_unavailable")
                    throw new Error("One or more seats are no longer available.");
                throw new Error("Booking failed.");
            }
            const data = (await res.json()) as {
                booking?: { id: string; bookingRef: string };
            };
            setBookedBooking({
                id: data.booking?.id || "",
                bookingRef: data.booking?.bookingRef || "",
            });
            setBookedAmount(fresh.trip.basePrice * mine.length);
            setPayPhone(TEST_MODE ? DEFAULT_TEST_PHONE : phone);
            toast({
                title: "Seats booked",
                description: `Reference ${data.booking?.bookingRef || ""}. Choose a payment method below.`,
            });
            const after = await loadSeatMap();
            setSeatMap(after);
        } catch (err: any) {
            toast({
                title: "Could not proceed",
                description: err?.message || "Please try again.",
                variant: "destructive",
            });
            const data = await loadSeatMap().catch(() => null);
            if (data) setSeatMap(data);
        } finally {
            setBusy(false);
        }
    };

    // Pay now: redirect to Chapa hosted checkout (Telebirr/CBE Birr/M-Birr),
    // or mock-charge for Cash. After the redirect, the return page shows the
    // receipt (ours) plus a link to Chapa's receipt.
    const payNow = async () => {
        if (!bookedBooking) return;
        const payAmount = TEST_MODE ? 1 : (bookedAmount || totalPrice);
        setBusy(true);
        try {
            if (payMethod === "CASH") {
                const res = await fetch("/api/payments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        action: "charge",
                        bookingId: bookedBooking.id,
                        amount: payAmount,
                        method: "CASH",
                    }),
                });
                const data = await res.json();
                if (!res.ok || data?.error)
                    throw new Error(data?.error || "Charge failed.");
                toast({ title: "Paid (cash)", description: `Ref ${data.ref}` });
                router.push(`/passenger/bookings/${bookedBooking.id}`);
                return;
            }

            const res = await fetch("/api/payments/chapa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "chapa_init",
                    bookingId: bookedBooking.id,
                    method: payMethod,
                    phone: payPhone.trim(),
                }),
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
                    ? "Test mode. Approve the payment on Chapa's checkout."
                    : "Approve the payment on Chapa's checkout.",
            });
            // Persist the intent so the return page can recover it even if
            // Chapa's redirect drops the tx_ref query param (common in test
            // mode). Cleared by the return page after successful verification.
            try {
                sessionStorage.setItem(
                    "chapa_pending",
                    JSON.stringify({
                        tx_ref: data.tx_ref,
                        bookingId: bookedBooking.id,
                        method: payMethod,
                        ts: Date.now(),
                    }),
                );
            } catch {}
            window.location.href = data.checkout_url;
        } catch (err: any) {
            toast({
                title: "Payment failed",
                description: err?.message || "Unknown error",
                variant: "destructive",
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-4 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                            {isStaff ? "Book seats for passenger" : "Choose your seats"}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Live seat map with 15-minute holds. Select one seat at a time.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refresh}
                            disabled={busy}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/passenger/book-now")}
                        >
                            Back to trips
                        </Button>
                    </div>
                </div>

                {loading && (
                    <div className="mt-4 rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading seat map...
                    </div>
                )}

                {!loading && error && (
                    <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && !error && seatMap && (
                    <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>
                                        {origin} → {destination}
                                    </CardTitle>
                                    <span className="text-sm font-semibold text-emerald-600">
                                        {seatMap.trip.basePrice.toFixed(2)} ETB
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Timer className="h-3.5 w-3.5" />
                                    Departure: {formatDateTime(seatMap.trip.departAt)}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Arrival: {formatDateTime(seatMap.trip.arriveAt)}
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline" className="text-[11px]">
                                        {availableCount} available
                                    </Badge>
                                    <Badge variant="outline" className="text-[11px]">
                                        {heldCount} held
                                    </Badge>
                                    <Badge variant="outline" className="text-[11px]">
                                        {bookedCount} booked
                                    </Badge>
                                    <Badge variant="outline" className="text-[11px]">
                                        {seatMap.trip.bus?.plateNumber || "-"}
                                    </Badge>
                                </div>

                                <div className="mt-4">
                                    <div className="mb-2 text-[11px] text-muted-foreground">
                                        Seat map
                                    </div>
                                    {seats.length === 0 ? (
                                        <div className="rounded border p-4 text-center text-xs text-muted-foreground">
                                            No seats are configured for this bus.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                                            {seats.map((seat) => {
                                                const isBooked =
                                                    seat.status === "booked" ||
                                                    !seat.isActive;
                                                const isHeld =
                                                    seat.status === "held" &&
                                                    !seat.heldByMe;
                                                const isMine = seat.heldByMe;
                                                const isSelected =
                                                    selected.has(seat.id);
                                                return (
                                                    <button
                                                        key={seat.id}
                                                        type="button"
                                                        disabled={
                                                            isBooked || isHeld || isMine
                                                        }
                                                        onClick={() =>
                                                            toggleSeat(seat)
                                                        }
                                                        className={`h-11 rounded border text-xs font-medium transition ${
                                                            isBooked
                                                                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed border-neutral-300"
                                                                : isHeld
                                                                  ? "bg-amber-200 text-amber-800 cursor-not-allowed border-amber-300"
                                                                  : isMine
                                                                    ? "bg-sky-600 text-white border-sky-700"
                                                                    : isSelected
                                                                      ? "bg-emerald-600 text-white border-emerald-700"
                                                                      : "bg-background hover:bg-emerald-50 border-emerald-200 text-emerald-700"
                                                        }`}
                                                        title={
                                                            isBooked
                                                                ? "Booked"
                                                                : isHeld
                                                                  ? "Held by another passenger"
                                                                  : isMine
                                                                    ? "Held by you"
                                                                    : "Available"
                                                        }
                                                    >
                                                        {seat.seatNumber}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block h-3 w-3 rounded border border-emerald-200 bg-background" />
                                            Available
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block h-3 w-3 rounded border bg-emerald-600" />
                                            Selected
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block h-3 w-3 rounded border bg-sky-600" />
                                            Held by you
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block h-3 w-3 rounded border bg-amber-200" />
                                            Held by others
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="inline-block h-3 w-3 rounded border bg-neutral-200" />
                                            Booked
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex flex-col gap-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {isStaff ? "Passenger details" : "Your details"}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isStaff && (
                                        <p className="text-xs text-blue-600 mb-2">
                                            Enter the passenger's details (not your own).
                                        </p>
                                    )}
                                    <div className="grid gap-3">
                                        <input
                                            className="h-10 w-full rounded border px-3 text-sm"
                                            placeholder="Full name"
                                            value={fullName}
                                            onChange={(e) =>
                                                setFullName(e.target.value)
                                            }
                                        />
                                        <input
                                            className="h-10 w-full rounded border px-3 text-sm"
                                            placeholder="Phone"
                                            value={phone}
                                            onChange={(e) =>
                                                setPhone(e.target.value)
                                            }
                                        />
                                        <input
                                            className="h-10 w-full rounded border px-3 text-sm"
                                            placeholder="Email"
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {isStaff ? "Booking summary" : "Your selection"}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {selected.size === 0 &&
                                    heldByMe.length === 0 ? (
                                        <div className="text-xs text-muted-foreground">
                                            Tap available seats to select them.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selected.size > 0 && (
                                                <div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        Selected ({selected.size})
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {seats
                                                            .filter((s) =>
                                                                selected.has(s.id),
                                                            )
                                                            .map((s) => (
                                                                <Badge
                                                                    key={s.id}
                                                                    variant="outline"
                                                                    className="text-[11px]"
                                                                >
                                                                    {s.seatNumber}
                                                                </Badge>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
                                            {heldByMe.length > 0 && (
                                                <div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        Held by you (
                                                        {heldByMe.length})
                                                    </div>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {heldByMe.map((s) => (
                                                            <Badge
                                                                key={s.id}
                                                                className="bg-sky-600 text-white text-[11px]"
                                                            >
                                                                {s.seatNumber}
                                                                <button
                                                                    type="button"
                                                                    className="ml-1 text-white/80 hover:text-white"
                                                                    onClick={() =>
                                                                        releaseHeld(
                                                                            s.holdId!,
                                                                            s.seatNumber,
                                                                        )
                                                                    }
                                                                    disabled={busy}
                                                                    aria-label={`Release seat ${s.seatNumber}`}
                                                                >
                                                                    ×
                                                                </button>
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-sm font-semibold">
                                                Total: {totalPrice.toFixed(2)} ETB
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-col gap-2">
                                        {!bookedBooking && (
                                            <Button
                                                onClick={goToPayment}
                                                disabled={
                                                    busy ||
                                                    (selected.size === 0 &&
                                                        heldByMe.length === 0)
                                                }
                                            >
                                                {busy
                                                    ? "Working..."
                                                    : `Next${
                                                          selected.size > 0 ||
                                                          heldByMe.length > 0
                                                              ? ` — ${
                                                                    selected.size +
                                                                    heldByMe.length
                                                                } seat(s)`
                                                              : ""
                                                      }`}
                                            </Button>
                                        )}
                                        {bookedBooking && (
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    router.push(
                                                        `/passenger/bookings/${bookedBooking.id}`,
                                                    )
                                                }
                                            >
                                                View booking
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {bookedBooking && (
                                <Card className="border-emerald-400/60">
                                    <CardHeader>
                                        <CardTitle>
                                            {isStaff ? "Collect payment" : "Pay now"}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="rounded border bg-muted/40 p-2 text-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Booking</span>
                                                <span className="font-mono">{bookedBooking.bookingRef}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground">Amount</span>
                                                <span className="font-semibold">
                                                    {TEST_MODE ? "1.00" : (bookedAmount || totalPrice).toFixed(2)} ETB
                                                </span>
                                            </div>
                                        </div>
                                        <label className="text-xs font-medium">Payment method</label>
                                        <select
                                            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                            value={payMethod}
                                            onChange={(e) => setPayMethod(e.target.value)}
                                        >
                                            {PAY_METHODS.map((m) => (
                                                <option key={m.value} value={m.value}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>
                                        {payMethod !== "CASH" && (
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium">
                                                    {payMethod === "TELEBIRR"
                                                        ? "Telebirr mobile number"
                                                        : payMethod === "CBE_BIRR"
                                                          ? "CBE Birr mobile number"
                                                          : "M-Birr mobile number"}
                                                </label>
                                                <Input
                                                    type="tel"
                                                    placeholder="09xxxxxxxx"
                                                    value={payPhone}
                                                    onChange={(e) => setPayPhone(e.target.value)}
                                                />
                                                <p className="text-[11px] text-muted-foreground">
                                                    You'll be redirected to Chapa to approve the
                                                    payment from your{" "}
                                                    {payMethod === "TELEBIRR"
                                                        ? "Telebirr"
                                                        : payMethod === "CBE_BIRR"
                                                          ? "CBE Birr"
                                                          : "M-Birr"}{" "}
                                                    app/USSD.
                                                </p>
                                                {TEST_MODE && (
                                                    <p className="text-[11px] text-amber-600">
                                                        Test numbers: 0900123456 / 0900112233 / 0900881111
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {payMethod === "CASH" && (
                                            <p className="text-[11px] text-muted-foreground">
                                                Pay at the agent/counter. Your booking will be
                                                marked paid once confirmed.
                                            </p>
                                        )}
                                        <Button
                                            onClick={payNow}
                                            disabled={
                                                busy ||
                                                (payMethod !== "CASH" &&
                                                    payPhone.trim().length < 9)
                                            }
                                            className="w-full"
                                        >
                                            {busy
                                                ? "Processing..."
                                                : `Pay ${TEST_MODE ? "1.00" : (bookedAmount || totalPrice).toFixed(2)} ETB now`}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full"
                                            onClick={() =>
                                                router.push(`/passenger/bookings/${bookedBooking.id}`)
                                            }
                                        >
                                            Pay later from Payments
                                        </Button>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
