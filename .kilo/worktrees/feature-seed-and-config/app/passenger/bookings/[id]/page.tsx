"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardShell from "@/components/DashboardShell";
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

export default function PassengerBookingDetailPage() {
    const { status } = useSession();
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const paramId = Array.isArray(params?.id) ? params?.id[0] : params?.id;
    const bookingId = String(paramId || "");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [uploadingProof, setUploadingProof] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;
        let normalizedId = bookingId.trim();
        if (!normalizedId && pathname) {
            const parts = pathname.split("/").filter(Boolean);
            const last = parts[parts.length - 1] || "";
            normalizedId = String(last || "").trim();
        }
        if (
            !normalizedId ||
            normalizedId === "undefined" ||
            normalizedId === "null"
        ) {
            setError("Invalid booking id.");
            setLoading(false);
            return;
        }

        let active = true;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/bookings/${normalizedId}`);
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

    const refreshBooking = async () => {
        if (!bookingId) return;
        try {
            const res = await fetch(`/api/bookings/${bookingId}`);
            if (!res.ok) return;
            const data = (await res.json()) as BookingDetail;
            setBooking(data);
        } catch (e) {
            // ignore refresh failures
        }
    };

    const seatNumbers = useMemo(() => {
        return (booking?.seats || [])
            .map((seat) => seat.seatNumber)
            .filter(Boolean)
            .join(", ");
    }, [booking]);

    const seatTypes = useMemo(() => {
        return (booking?.seats || [])
            .map((seat) => seat.seatType)
            .filter(Boolean)
            .join(", ");
    }, [booking]);

    const paymentStatus = String(booking?.payment?.status || "pending");
    const receiptUrl = booking?.receipt?.id
        ? `/api/receipts/${booking.receipt.id}/pdf`
        : booking?.receipt?.pdfUrl || null;
    const isPaid = paymentStatus.toLowerCase() === "paid";
    const paymentMethod = String(booking?.payment?.method || "").toUpperCase();
    const showUploadProof = !isPaid && !!paymentMethod;

    const handleProofUpload = async () => {
        if (!proofFile || !bookingId) return;
        setUploadError(null);
        setUploadingProof(true);
        try {
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onerror = () =>
                    reject(new Error("Failed to read file."));
                reader.onload = () => resolve(String(reader.result || ""));
                reader.readAsDataURL(proofFile);
            });

            const res = await fetch(
                `/api/bookings/${bookingId}/payment-proof`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fileName: proofFile.name,
                        mimeType: proofFile.type,
                        data: base64,
                    }),
                },
            );

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Upload failed.");
            }

            setProofFile(null);
            await refreshBooking();
        } catch (err: any) {
            setUploadError(err?.message || "Upload failed.");
        } finally {
            setUploadingProof(false);
        }
    };

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
                                Passenger booking details
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
                            <div className="rounded border bg-card p-4">
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
                                        variant={isPaid ? "default" : "outline"}
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
                                            {booking.passengerInfo?.fullName ||
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
                                            {booking.passengerInfo?.idNumber ||
                                                "-"}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Gender / Age
                                        </div>
                                        <div className="text-sm">
                                            {booking.passengerInfo?.gender ||
                                                "-"}
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
                                    <div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Seat Types
                                        </div>
                                        <div className="text-sm">
                                            {seatTypes || "-"}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="text-[11px] text-muted-foreground">
                                            Amenities
                                        </div>
                                        <div className="text-sm">
                                            {Array.isArray(
                                                booking.trip?.bus?.amenities,
                                            )
                                                ? booking.trip?.bus?.amenities.join(
                                                      ", ",
                                                  )
                                                : "-"}
                                        </div>
                                    </div>
                                    <div className="md:col-span-2">
                                        <div className="text-[11px] text-muted-foreground">
                                            Safety Checklist
                                        </div>
                                        <div className="text-sm">
                                            {Array.isArray(
                                                booking.trip?.bus
                                                    ?.safetyChecklist,
                                            )
                                                ? booking.trip?.bus?.safetyChecklist.join(
                                                      ", ",
                                                  )
                                                : "-"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded border bg-card p-4">
                                <h3 className="text-sm font-semibold">
                                    Payment & Receipt
                                </h3>
                                {showUploadProof && (
                                    <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                        <div className="text-xs font-semibold uppercase tracking-wide">
                                            Upload Payment Proof
                                        </div>
                                        <div className="mt-2">
                                            Upload your payment screenshot to
                                            get staff approval and receive your
                                            receipt.
                                        </div>
                                        <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) => {
                                                    const file =
                                                        event.target
                                                            .files?.[0] || null;
                                                    setProofFile(file);
                                                }}
                                                className="block w-full text-xs"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={handleProofUpload}
                                                disabled={
                                                    !proofFile || uploadingProof
                                                }
                                            >
                                                {uploadingProof
                                                    ? "Uploading..."
                                                    : "Upload Proof"}
                                            </Button>
                                        </div>
                                        {uploadError && (
                                            <div className="mt-2 text-xs text-red-600">
                                                {uploadError}
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {isPaid && receiptUrl ? (
                                        <Button asChild size="sm">
                                            <a
                                                href={receiptUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Download Receipt
                                            </a>
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled
                                        >
                                            Receipt unavailable
                                        </Button>
                                    )}
                                    {!isPaid && (
                                        <Button
                                            size="sm"
                                            variant="default"
                                            disabled
                                        >
                                            Pay Now
                                        </Button>
                                    )}
                                </div>
                                {booking?.paymentProofs?.length ? (
                                    <div className="mt-4">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                            Uploaded Proofs
                                        </div>
                                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                            {booking.paymentProofs.map(
                                                (proof) => (
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
                                                                href={
                                                                    proof.fileUrl
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="block"
                                                            >
                                                                <img
                                                                    src={
                                                                        proof.fileUrl
                                                                    }
                                                                    alt="Payment proof"
                                                                    className="h-32 w-full rounded object-cover"
                                                                />
                                                            </a>
                                                            <a
                                                                href={
                                                                    proof.fileUrl
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-2 inline-flex text-xs font-medium text-emerald-600"
                                                            >
                                                                View full image
                                                            </a>
                                                        </div>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
