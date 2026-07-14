"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";

import DashboardShell from "@/components/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type BookingDetail = {
    id: string;
    bookingRef: string;
    status: string;
    totalPrice: number;
    createdAt: string;
    updatedAt: string;
    passenger: {
        name: string;
        email?: string | null;
        phone?: string | null;
    } | null;
    passengerInfo: {
        fullName?: string | null;
        phone?: string | null;
        email?: string | null;
        idNumber?: string | null;
        gender?: string | null;
        age?: number | null;
        emergencyContact?: string | null;
        notes?: string | null;
    } | null;
    payment: {
        status: string;
        method: string;
        amount: number;
        paidAt?: string | null;
        transactionRef?: string | null;
    } | null;
    receipt: {
        id: string;
        receiptNumber: string;
        pdfUrl?: string | null;
        emailedTo?: string | null;
        issuedAt?: string | null;
    } | null;
    paymentProofs: Array<{
        id: string;
        fileUrl: string;
        fileName: string;
        fileType?: string | null;
        createdAt: string;
        uploadedBy?: { id: string; name: string } | null;
    }>;
    trip: {
        departAt: string;
        arriveAt: string;
        status: string;
        bus: {
            plateNumber: string;
            model: string;
            seatCount: number;
            companyName?: string | null;
            level?: string | null;
            driverName?: string | null;
            imageUrl?: string | null;
            amenities?: any;
            safetyChecklist?: any;
            seatLayout?: any;
        } | null;
        route: {
            origin: { name: string; code: string } | null;
            destination: { name: string; code: string } | null;
        } | null;
    } | null;
    seats: Array<{
        seatNumber: string;
        seatType?: string | null;
        fare: number;
    }>;
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

export default function BookingDetailAdmin() {
    const { status } = useSession();
    const router = useRouter();
    const params = useParams();
    const bookingId = String(params?.id || "");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [transactionRef, setTransactionRef] = useState("");
    const [approving, setApproving] = useState(false);

    const refreshBooking = async () => {
        if (!bookingId) return;
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) return;
        const data = (await res.json()) as BookingDetail;
        setBooking(data);
    };

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;
        if (!bookingId) return;

        let active = true;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/bookings/${bookingId}`);
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load booking.");
                }
                const data = (await res.json()) as BookingDetail;
                if (active) setBooking(data);
            } catch (err: any) {
                if (active) setError(err?.message || "Failed to load booking.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, bookingId, router]);

    const seatNumbers = useMemo(() => {
        return (booking?.seats || [])
            .map((seat) => seat.seatNumber)
            .filter(Boolean)
            .join(", ");
    }, [booking]);

    const paymentStatus = String(booking?.payment?.status || "pending");
    const receiptUrl = booking?.receipt?.id
        ? `/api/receipts/${booking.receipt.id}/pdf`
        : booking?.receipt?.pdfUrl || null;
    const isPaid = paymentStatus.toLowerCase() === "paid";

    const approvePayment = async () => {
        if (!bookingId || approving || isPaid) return;
        setApproving(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/bookings/${bookingId}/approve-payment`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        transactionRef: transactionRef.trim() || undefined,
                    }),
                },
            );
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Approval failed.");
            }
            await refreshBooking();
        } catch (err: any) {
            setError(err?.message || "Approval failed.");
        } finally {
            setApproving(false);
        }
    };

    const imageSrc = booking?.trip?.bus?.imageUrl || "/images/bus-card-1.svg";

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-4 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold tracking-tight">
                                Booking {booking?.bookingRef || ""}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                Review passenger info and approve payment.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.back()}
                        >
                            Back
                        </Button>
                    </div>

                    {loading && (
                        <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                            Loading booking details...
                        </div>
                    )}

                    {!loading && error && (
                        <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    {!loading && !error && booking && (
                        <div className="grid gap-4">
                            <div className="overflow-hidden rounded-2xl border bg-card">
                                <div className="relative h-40 w-full">
                                    <Image
                                        src={imageSrc}
                                        alt="Bus"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                                        <Badge className="bg-white/20 text-white">
                                            {booking.trip?.bus?.model ||
                                                "Coach"}
                                        </Badge>
                                        <Badge className="bg-emerald-500/80 text-white">
                                            {booking.trip?.bus?.plateNumber ||
                                                "-"}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge
                                            className={cn(
                                                "text-xs",
                                                booking.status === "CONFIRMED"
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : undefined,
                                            )}
                                        >
                                            {booking.status}
                                        </Badge>
                                        <Badge
                                            variant={
                                                isPaid ? "default" : "outline"
                                            }
                                            className="text-xs"
                                        >
                                            {paymentStatus}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Passenger Name
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo
                                                    ?.fullName ||
                                                    booking.passenger?.name ||
                                                    "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Booking Total
                                            </div>
                                            <div className="text-sm">
                                                {booking.totalPrice.toFixed(2)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Passenger Phone
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo?.phone ||
                                                    booking.passenger?.phone ||
                                                    "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Passenger Email
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo?.email ||
                                                    booking.passenger?.email ||
                                                    "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                ID Number
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo
                                                    ?.idNumber || "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] text-muted-foreground">
                                                Gender / Age
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo
                                                    ?.gender || "-"}
                                                {booking.passengerInfo?.age
                                                    ? ` · ${booking.passengerInfo.age}`
                                                    : ""}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <div className="text-[11px] text-muted-foreground">
                                                Emergency Contact
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo
                                                    ?.emergencyContact || "-"}
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <div className="text-[11px] text-muted-foreground">
                                                Notes
                                            </div>
                                            <div className="text-sm">
                                                {booking.passengerInfo?.notes ||
                                                    "-"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded border bg-card p-4">
                                <h3 className="text-sm font-semibold">
                                    Trip Info
                                </h3>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Departure
                                        </div>
                                        <div className="text-sm">
                                            {booking.trip?.route?.origin
                                                ? `${booking.trip.route.origin.name} (${booking.trip.route.origin.code})`
                                                : "-"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDateTime(
                                                booking.trip?.departAt,
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Destination
                                        </div>
                                        <div className="text-sm">
                                            {booking.trip?.route?.destination
                                                ? `${booking.trip.route.destination.name} (${booking.trip.route.destination.code})`
                                                : "-"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {formatDateTime(
                                                booking.trip?.arriveAt,
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded border bg-card p-4">
                                <h3 className="text-sm font-semibold">
                                    Bus & Seat Info
                                </h3>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Bus Level
                                        </div>
                                        <div className="text-sm">
                                            {booking.trip?.bus?.level || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Bus Plate Number
                                        </div>
                                        <div className="text-sm">
                                            {booking.trip?.bus?.plateNumber ||
                                                "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Bus Model
                                        </div>
                                        <div className="text-sm">
                                            {booking.trip?.bus?.model || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Driver Name
                                        </div>
                                        <div className="text-sm">
                                            {booking.trip?.bus?.driverName ||
                                                "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Seat Numbers
                                        </div>
                                        <div className="text-sm">
                                            {seatNumbers || "-"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded border bg-card p-4">
                                <h3 className="text-sm font-semibold">
                                    Payment Proofs
                                </h3>
                                {booking.paymentProofs?.length ? (
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {booking.paymentProofs.map((proof) => (
                                            <div
                                                key={proof.id}
                                                className="rounded border bg-background p-2"
                                            >
                                                <div className="text-[11px] text-muted-foreground">
                                                    {new Date(
                                                        proof.createdAt,
                                                    ).toLocaleString()}
                                                </div>
                                                <div className="mt-1 text-xs font-medium">
                                                    {proof.fileName}
                                                </div>
                                                <div className="mt-2">
                                                    <a
                                                        href={proof.fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block"
                                                    >
                                                        <img
                                                            src={proof.fileUrl}
                                                            alt="Payment proof"
                                                            className="h-32 w-full rounded object-cover"
                                                        />
                                                    </a>
                                                    <a
                                                        href={proof.fileUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-2 inline-flex text-xs font-medium text-emerald-600"
                                                    >
                                                        View full image
                                                    </a>
                                                </div>
                                                {proof.uploadedBy && (
                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                        Uploaded by{" "}
                                                        {proof.uploadedBy.name}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-3 text-sm text-muted-foreground">
                                        No payment proofs uploaded yet.
                                    </div>
                                )}
                            </div>

                            <div className="rounded border bg-card p-4">
                                <h3 className="text-sm font-semibold">
                                    Payment & Receipt
                                </h3>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Payment Method
                                        </div>
                                        <div className="text-sm">
                                            {booking.payment?.method || "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Payment Status
                                        </div>
                                        <div className="text-sm">
                                            {paymentStatus}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Transaction Ref
                                        </div>
                                        <div className="text-sm">
                                            {booking.payment?.transactionRef ||
                                                "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Paid At
                                        </div>
                                        <div className="text-sm">
                                            {formatDateTime(
                                                booking.payment?.paidAt,
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                                    <Input
                                        placeholder="Transaction reference (optional)"
                                        value={transactionRef}
                                        onChange={(event) =>
                                            setTransactionRef(
                                                event.target.value,
                                            )
                                        }
                                        className="md:max-w-sm"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={approvePayment}
                                        disabled={approving || isPaid}
                                    >
                                        {isPaid
                                            ? "Already Approved"
                                            : approving
                                              ? "Approving..."
                                              : "Approve Payment"}
                                    </Button>
                                    {receiptUrl && isPaid && (
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                        >
                                            <a
                                                href={receiptUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Download Receipt
                                            </a>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
