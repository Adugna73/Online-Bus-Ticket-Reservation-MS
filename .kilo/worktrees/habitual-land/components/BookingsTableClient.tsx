"use client";

import { Fragment, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, ChevronDown, ChevronUp, CheckCircle, Clock, User, Mail, Phone, Bus, MapPin, Calendar } from "lucide-react";
import Link from "next/link";

type Booking = {
    id: string;
    bookingRef?: string;
    status: string;
    totalPrice?: number;
    createdAt: string;
    passenger?: { id?: string; name?: string; email?: string; phone?: string };
    passengerInfo?: {
        fullName?: string;
        phone?: string;
        email?: string;
        idNumber?: string;
        gender?: string;
        age?: number | string;
    };
    payment?: {
        id?: string;
        status?: string;
        method?: string;
        amount?: number;
        paidAt?: string;
        transactionRef?: string;
    };
    trip?: {
        id?: string;
        departAt?: string;
        arriveAt?: string;
        basePrice?: number;
        bus?: { plateNumber?: string; model?: string; companyName?: string; driverName?: string };
        route?: {
            origin?: { name?: string; code?: string };
            destination?: { name?: string; code?: string };
        };
    };
    seats?: { seatNumber?: string; seatType?: string; fare?: number }[];
};

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700 border-amber-300",
    CONFIRMED: "bg-blue-100 text-blue-700 border-blue-300",
    CANCELLED: "bg-red-100 text-red-700 border-red-300",
    COMPLETED: "bg-green-100 text-green-700 border-green-300",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
    PAID: "bg-green-100 text-green-700 border-green-300",
    PENDING: "bg-amber-100 text-amber-700 border-amber-300",
    FAILED: "bg-red-100 text-red-700 border-red-300",
    REFUNDED: "bg-purple-100 text-purple-700 border-purple-300",
};

function formatDate(dateStr?: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(dateStr?: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function BookingsTableClient() {
    const { data: session } = useSession();
    const role = (session?.user?.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "supervisor" || role === "staff";

    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [approvingId, setApprovingId] = useState<string | null>(null);

    const loadBookings = async () => {
        try {
            const res = await fetch("/api/bookings");
            if (!res.ok) throw new Error("Failed to load bookings");
            setBookings(await res.json());
        } catch (err: any) {
            setError(err?.message || "Failed to load bookings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();
    }, []);

    const handleApprovePayment = async (bookingId: string) => {
        setApprovingId(bookingId);
        try {
            const res = await fetch(`/api/bookings/${bookingId}/approve-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Failed to approve payment");
            }
            await loadBookings();
        } catch (err: any) {
            setError(err?.message || "Failed to approve payment");
        } finally {
            setApprovingId(null);
        }
    };

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground">
                Loading bookings...
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isStaff && (
                <div className="flex justify-end">
                    <Link
                        href="/passenger/book-now"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-4 w-4" /> Book for Passenger
                    </Link>
                </div>
            )}

            {bookings.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                    No bookings found.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr className="text-left">
                                <th className="px-3 py-2 font-semibold w-8"></th>
                                <th className="px-3 py-2 font-semibold">Ref</th>
                                <th className="px-3 py-2 font-semibold">Passenger</th>
                                <th className="px-3 py-2 font-semibold">Bus</th>
                                <th className="px-3 py-2 font-semibold">Route</th>
                                <th className="px-3 py-2 font-semibold">Seats</th>
                                <th className="px-3 py-2 font-semibold">Status</th>
                                <th className="px-3 py-2 font-semibold">Payment</th>
                                <th className="px-3 py-2 font-semibold">Amount</th>
                                <th className="px-3 py-2 font-semibold">Date</th>
                                {isStaff && <th className="px-3 py-2 font-semibold">Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {bookings.map((b) => {
                                const isExpanded = expandedId === b.id;
                                const passengerName =
                                    b.passenger?.name ||
                                    b.passengerInfo?.fullName ||
                                    b.passenger?.email ||
                                    "—";
                                const routeStr = `${b.trip?.route?.origin?.name || "—"} → ${b.trip?.route?.destination?.name || "—"}`;
                                const seatsStr =
                                    (b.seats || [])
                                        .map((s) => s.seatNumber)
                                        .filter(Boolean)
                                        .join(", ") || "—";
                                const paymentStatus = b.payment?.status || "PENDING";
                                const paymentMethod = b.payment?.method || "—";
                                const canApprove =
                                    isStaff &&
                                    paymentStatus === "PENDING" &&
                                    (paymentMethod === "CASH" || paymentMethod === "—");

                                return (
                                    <Fragment key={b.id}>
                                        <tr
                                            className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                                            onClick={() =>
                                                setExpandedId(isExpanded ? null : b.id)
                                            }
                                        >
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {isExpanded ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-xs">
                                                {b.bookingRef || b.id.slice(0, 8)}
                                            </td>
                                            <td className="px-3 py-2">{passengerName}</td>
                                            <td className="px-3 py-2">
                                                {b.trip?.bus?.plateNumber || "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {routeStr}
                                            </td>
                                            <td className="px-3 py-2">{seatsStr}</td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                        STATUS_COLORS[b.status] ||
                                                        "bg-gray-100 text-gray-700 border-gray-300"
                                                    }`}
                                                >
                                                    {b.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span
                                                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                        PAYMENT_STATUS_COLORS[paymentStatus] ||
                                                        "bg-gray-100 text-gray-700 border-gray-300"
                                                    }`}
                                                >
                                                    {paymentStatus}
                                                    {paymentMethod !== "—" && ` (${paymentMethod})`}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {b.totalPrice != null
                                                    ? `ETB ${b.totalPrice.toLocaleString()}`
                                                    : "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {formatDate(b.createdAt)}
                                            </td>
                                            {isStaff && (
                                                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                    {canApprove ? (
                                                        <button
                                                            onClick={() => handleApprovePayment(b.id)}
                                                            disabled={approvingId === b.id}
                                                            className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                                                        >
                                                            <CheckCircle className="h-3 w-3" />
                                                            {approvingId === b.id ? "Approving..." : "Approve Cash"}
                                                        </button>
                                                    ) : paymentStatus === "PAID" ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                                            <CheckCircle className="h-3 w-3" /> Paid
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                        {isExpanded && (
                                            <tr className="border-b bg-muted/20">
                                                <td colSpan={isStaff ? 11 : 10} className="px-6 py-4">
                                                    <div className="grid gap-4 md:grid-cols-3">
                                                        {/* Passenger info */}
                                                        <div className="rounded border bg-card p-3">
                                                            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                                                <User className="h-3 w-3" /> Passenger
                                                            </h4>
                                                            <dl className="space-y-1 text-xs">
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Name</dt>
                                                                    <dd className="font-medium">{passengerName}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</dt>
                                                                    <dd>{b.passengerInfo?.phone || b.passenger?.phone || "—"}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</dt>
                                                                    <dd>{b.passengerInfo?.email || b.passenger?.email || "—"}</dd>
                                                                </div>
                                                                {b.passengerInfo?.idNumber && (
                                                                    <div className="flex justify-between">
                                                                        <dt className="text-muted-foreground">ID</dt>
                                                                        <dd>{b.passengerInfo.idNumber}</dd>
                                                                    </div>
                                                                )}
                                                                {b.passengerInfo?.gender && (
                                                                    <div className="flex justify-between">
                                                                        <dt className="text-muted-foreground">Gender</dt>
                                                                        <dd>{b.passengerInfo.gender}</dd>
                                                                    </div>
                                                                )}
                                                            </dl>
                                                        </div>

                                                        {/* Trip info */}
                                                        <div className="rounded border bg-card p-3">
                                                            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                                                <Bus className="h-3 w-3" /> Trip
                                                            </h4>
                                                            <dl className="space-y-1 text-xs">
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> From</dt>
                                                                    <dd>{b.trip?.route?.origin?.name || "—"}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> To</dt>
                                                                    <dd>{b.trip?.route?.destination?.name || "—"}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Depart</dt>
                                                                    <dd>{formatDateTime(b.trip?.departAt)}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Arrive</dt>
                                                                    <dd>{formatDateTime(b.trip?.arriveAt)}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Bus</dt>
                                                                    <dd>{b.trip?.bus?.plateNumber || "—"} {b.trip?.bus?.model ? `(${b.trip.bus.model})` : ""}</dd>
                                                                </div>
                                                                {b.trip?.bus?.driverName && (
                                                                    <div className="flex justify-between">
                                                                        <dt className="text-muted-foreground">Driver</dt>
                                                                        <dd>{b.trip.bus.driverName}</dd>
                                                                    </div>
                                                                )}
                                                            </dl>
                                                        </div>

                                                        {/* Payment & booking info */}
                                                        <div className="rounded border bg-card p-3">
                                                            <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                                                <Clock className="h-3 w-3" /> Payment & Booking
                                                            </h4>
                                                            <dl className="space-y-1 text-xs">
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Booking Ref</dt>
                                                                    <dd className="font-mono">{b.bookingRef || "—"}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Status</dt>
                                                                    <dd>
                                                                        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${STATUS_COLORS[b.status] || ""}`}>
                                                                            {b.status}
                                                                        </span>
                                                                    </dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Total</dt>
                                                                    <dd className="font-semibold">ETB {b.totalPrice?.toLocaleString() || "—"}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Pay Method</dt>
                                                                    <dd>{paymentMethod}</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Pay Status</dt>
                                                                    <dd>
                                                                        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[paymentStatus] || ""}`}>
                                                                            {paymentStatus}
                                                                        </span>
                                                                    </dd>
                                                                </div>
                                                                {b.payment?.paidAt && (
                                                                    <div className="flex justify-between">
                                                                        <dt className="text-muted-foreground">Paid At</dt>
                                                                        <dd>{formatDateTime(b.payment.paidAt)}</dd>
                                                                    </div>
                                                                )}
                                                                {b.payment?.transactionRef && (
                                                                    <div className="flex justify-between">
                                                                        <dt className="text-muted-foreground">Tx Ref</dt>
                                                                        <dd className="font-mono">{b.payment.transactionRef}</dd>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Seats</dt>
                                                                    <dd>{seatsStr} ({(b.seats || []).length} seat(s))</dd>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <dt className="text-muted-foreground">Created</dt>
                                                                    <dd>{formatDateTime(b.createdAt)}</dd>
                                                                </div>
                                                            </dl>
                                                            {canApprove && (
                                                                <button
                                                                    onClick={() => handleApprovePayment(b.id)}
                                                                    disabled={approvingId === b.id}
                                                                    className="mt-3 w-full inline-flex items-center justify-center gap-1 rounded border border-green-300 bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                                                                >
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    {approvingId === b.id ? "Approving..." : "Approve Cash Payment"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
