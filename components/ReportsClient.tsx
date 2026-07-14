"use client";

import { useEffect, useState } from "react";

type ReportData = {
    summary?: {
        totalRevenue?: number;
        totalBookings?: number;
        confirmedBookings?: number;
        cancelledBookings?: number;
        refundedBookings?: number;
        avgBookingValue?: number;
    };
    topRoutes?: { route: string; revenue: number; count: number }[];
    rows?: {
        bookingRef?: string;
        passengerName?: string;
        route?: string;
        busPlate?: string;
        seatNumbers?: string;
        totalPrice?: number;
        bookingStatus?: string;
        paymentStatus?: string;
        createdAt?: string;
    }[];
};

function formatDate(dateStr?: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700 border-amber-300",
    CONFIRMED: "bg-blue-100 text-blue-700 border-blue-300",
    CANCELLED: "bg-red-100 text-red-700 border-red-300",
    COMPLETED: "bg-green-100 text-green-700 border-green-300",
};

export default function ReportsClient() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/reports/comprehensive");
                if (!res.ok) throw new Error("Failed to load reports");
                setData(await res.json());
            } catch (err: any) {
                setError(err?.message || "Failed to load reports");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground">
                Loading reports...
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

    if (!data) {
        return (
            <div className="text-center text-muted-foreground text-sm py-8">
                No report data available.
            </div>
        );
    }

    const s = data.summary || {};

    return (
        <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[
                    { label: "Total Revenue", value: s.totalRevenue != null ? `ETB ${s.totalRevenue.toLocaleString()}` : "—" },
                    { label: "Total Bookings", value: s.totalBookings ?? "—" },
                    { label: "Confirmed", value: s.confirmedBookings ?? "—" },
                    { label: "Cancelled", value: s.cancelledBookings ?? "—" },
                    { label: "Refunded", value: s.refundedBookings ?? "—" },
                    { label: "Avg. Value", value: s.avgBookingValue != null ? `ETB ${s.avgBookingValue.toLocaleString()}` : "—" },
                ].map((card) => (
                    <div key={card.label} className="rounded-lg border bg-card p-4">
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="text-xl font-semibold mt-1">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Top routes */}
            {data.topRoutes && data.topRoutes.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-3">Top Routes by Revenue</h3>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr className="text-left">
                                    <th className="px-3 py-2 font-semibold">Route</th>
                                    <th className="px-3 py-2 font-semibold">Bookings</th>
                                    <th className="px-3 py-2 font-semibold">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topRoutes.map((r, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                        <td className="px-3 py-2">{r.route}</td>
                                        <td className="px-3 py-2">{r.count}</td>
                                        <td className="px-3 py-2">ETB {r.revenue.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Booking details */}
            {data.rows && data.rows.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-3">Booking Details</h3>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b">
                                <tr className="text-left">
                                    <th className="px-3 py-2 font-semibold">Ref</th>
                                    <th className="px-3 py-2 font-semibold">Passenger</th>
                                    <th className="px-3 py-2 font-semibold">Route</th>
                                    <th className="px-3 py-2 font-semibold">Bus</th>
                                    <th className="px-3 py-2 font-semibold">Seats</th>
                                    <th className="px-3 py-2 font-semibold">Status</th>
                                    <th className="px-3 py-2 font-semibold">Payment</th>
                                    <th className="px-3 py-2 font-semibold">Amount</th>
                                    <th className="px-3 py-2 font-semibold">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((r, i) => (
                                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                                        <td className="px-3 py-2 font-mono text-xs">
                                            {r.bookingRef || "—"}
                                        </td>
                                        <td className="px-3 py-2">{r.passengerName || "—"}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{r.route || "—"}</td>
                                        <td className="px-3 py-2">{r.busPlate || "—"}</td>
                                        <td className="px-3 py-2">{r.seatNumbers || "—"}</td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                    STATUS_COLORS[r.bookingStatus || ""] ||
                                                    "bg-gray-100 text-gray-700 border-gray-300"
                                                }`}
                                            >
                                                {r.bookingStatus || "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">{r.paymentStatus || "—"}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {r.totalPrice != null ? `ETB ${r.totalPrice.toLocaleString()}` : "—"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatDate(r.createdAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
