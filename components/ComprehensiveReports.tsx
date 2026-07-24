"use client";

import { useEffect, useState } from "react";
import { DollarSign, Users, TrendingUp, Calendar, Download, Archive, Wrench } from "lucide-react";

type ReportRow = {
    bookingRef: string;
    passengerName: string;
    passengerPhone: string;
    passengerEmail: string;
    route: string;
    busPlate: string;
    busModel: string;
    companyName: string;
    driverName: string;
    departDate: string;
    arriveDate: string;
    seatNumbers: string;
    totalPrice: number;
    bookingStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    createdAt: string;
};

type ReportData = {
    summary: {
        totalRevenue: number;
        totalBookings: number;
        confirmedBookings: number;
        cancelledBookings: number;
        refundedBookings: number;
        avgBookingValue: number;
    };
    topRoutes: { route: string; revenue: number; count: number }[];
    rows: ReportRow[];
};

function formatDate(dateStr?: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function formatTime(dateStr?: string | null): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function ComprehensiveReports() {
    const [data, setData] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [search, setSearch] = useState("");
    const [archivedMaint, setArchivedMaint] = useState<any[]>([]);
    const [maintLoading, setMaintLoading] = useState(false);

    const loadReport = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (start) params.set("start", start);
            if (end) params.set("end", end);
            const res = await fetch(`/api/reports/comprehensive?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load report");
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err?.message || "Failed to load report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReport();
    }, []);

    const loadArchivedMaint = async () => {
        try {
            setMaintLoading(true);
            const res = await fetch("/api/vehicle-maintenance", { credentials: "include" });
            if (!res.ok) return;
            const all = await res.json();
            setArchivedMaint(
                (all as any[]).filter((m) => m.status === "COMPLETED" || m.status === "CANCELLED"),
            );
        } catch {
            // ignore
        } finally {
            setMaintLoading(false);
        }
    };

    useEffect(() => {
        loadArchivedMaint();
    }, []);

    const handleExportMaintCSV = () => {
        if (!archivedMaint.length) return;
        const headers = [
            "Bus Plate",
            "Bus Model",
            "Status",
            "Garage",
            "Mechanic",
            "Parts",
            "Description",
            "Mechanic Notes",
            "Scheduled Date",
            "Completed Date",
            "Estimated Cost (ETB)",
            "Actual Cost (ETB)",
            "Telebirr Ref",
            "Telebirr Amount",
            "Driver",
            "Created At",
        ];
        const escape = (v: any) => {
            const s = v == null ? "" : String(v);
            return `"${s.replace(/"/g, '""')}"`;
        };
        const lines = [headers.join(",")];
        for (const m of archivedMaint) {
            lines.push(
                [
                    escape(m.bus?.plateNumber || ""),
                    escape(m.bus?.model || ""),
                    escape(m.status),
                    escape(m.garage?.name || ""),
                    escape(m.assignedMechanic?.name || ""),
                    escape(m.partsNeedingMaintenance || ""),
                    escape(m.description || ""),
                    escape(m.mechanicNotes || ""),
                    escape(formatDate(m.scheduledDate)),
                    escape(formatDate(m.completedDate)),
                    m.estimatedCost != null ? m.estimatedCost : "",
                    m.actualCost != null ? m.actualCost : "",
                    escape(m.telebirrRef || ""),
                    m.telebirrAmount != null ? m.telebirrAmount : "",
                    escape(m.driver?.fullName || m.bus?.driverName || ""),
                    escape(formatDate(m.createdAt)),
                ].join(","),
            );
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `maintenance-archive-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filteredRows = (data?.rows || []).filter((r) => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            r.passengerName.toLowerCase().includes(s) ||
            r.passengerPhone.toLowerCase().includes(s) ||
            r.passengerEmail.toLowerCase().includes(s) ||
            r.route.toLowerCase().includes(s) ||
            r.busPlate.toLowerCase().includes(s) ||
            r.driverName.toLowerCase().includes(s) ||
            r.bookingRef.toLowerCase().includes(s)
        );
    });

    const handleExportCSV = () => {
        if (!data?.rows.length) return;
        const headers = [
            "Booking Ref",
            "Passenger Name",
            "Passenger Phone",
            "Passenger Email",
            "Route",
            "Bus Plate",
            "Bus Model",
            "Company",
            "Driver Name",
            "Depart Date",
            "Arrive Date",
            "Seats",
            "Total Price (ETB)",
            "Booking Status",
            "Payment Status",
            "Payment Method",
        ];
        const lines = [headers.join(",")];
        for (const r of filteredRows) {
            lines.push(
                [
                    r.bookingRef,
                    `"${r.passengerName}"`,
                    `"${r.passengerPhone}"`,
                    `"${r.passengerEmail}"`,
                    `"${r.route}"`,
                    r.busPlate,
                    `"${r.busModel}"`,
                    `"${r.companyName}"`,
                    `"${r.driverName}"`,
                    formatDate(r.departDate),
                    formatDate(r.arriveDate),
                    `"${r.seatNumbers}"`,
                    r.totalPrice,
                    r.bookingStatus,
                    r.paymentStatus,
                    r.paymentMethod,
                ].join(","),
            );
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `comprehensive-report-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                Loading comprehensive report...
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

    const summary = data?.summary;

    return (
        <div className="space-y-6">
            {summary && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                    <KpiCard
                        icon={<DollarSign className="h-5 w-5" />}
                        label="Total Revenue"
                        value={`ETB ${(summary.totalRevenue || 0).toLocaleString()}`}
                        color="text-green-600"
                    />
                    <KpiCard
                        icon={<Users className="h-5 w-5" />}
                        label="Total Bookings"
                        value={summary.totalBookings}
                        color="text-blue-600"
                    />
                    <KpiCard
                        icon={<TrendingUp className="h-5 w-5" />}
                        label="Confirmed"
                        value={summary.confirmedBookings}
                        color="text-emerald-600"
                    />
                    <KpiCard
                        icon={<Calendar className="h-5 w-5" />}
                        label="Cancelled"
                        value={summary.cancelledBookings}
                        color="text-red-600"
                    />
                    <KpiCard
                        icon={<TrendingUp className="h-5 w-5" />}
                        label="Refunded"
                        value={summary.refundedBookings}
                        color="text-amber-600"
                    />
                    <KpiCard
                        icon={<DollarSign className="h-5 w-5" />}
                        label="Avg Booking"
                        value={`ETB ${(summary.avgBookingValue || 0).toLocaleString()}`}
                        color="text-purple-600"
                    />
                </div>
            )}

            <div className="rounded border bg-card p-4">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="block text-xs text-muted-foreground">Start date</label>
                        <input
                            type="date"
                            className="h-9 rounded border px-2 text-sm"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted-foreground">End date</label>
                        <input
                            type="date"
                            className="h-9 rounded border px-2 text-sm"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={loadReport}
                        className="h-9 rounded bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
                    >
                        Generate
                    </button>
                    <button
                        onClick={handleExportCSV}
                        className="h-9 rounded border px-4 text-sm hover:bg-muted flex items-center gap-1"
                    >
                        <Download className="h-4 w-4" /> Export CSV
                    </button>
                    <input
                        className="h-9 flex-1 min-w-[200px] rounded border px-3 text-sm"
                        placeholder="Search by name, phone, route, bus, driver..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {data?.topRoutes && data.topRoutes.length > 0 && (
                <div className="rounded border bg-card p-4">
                    <h3 className="text-sm font-semibold mb-3">Top Revenue Routes</h3>
                    <div className="space-y-2">
                        {data.topRoutes.map((r, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between text-sm"
                            >
                                <span className="font-medium">
                                    {i + 1}. {r.route}
                                </span>
                                <span className="text-muted-foreground">
                                    {r.count} bookings • ETB {r.revenue.toLocaleString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded border bg-card p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Archive className="h-4 w-4" />
                    Maintenance Archive
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {archivedMaint.length} records
                    </span>
                    {archivedMaint.length > 0 && (
                        <button
                            onClick={handleExportMaintCSV}
                            className="ml-auto inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                            <Download className="h-3.5 w-3.5" /> Export CSV
                        </button>
                    )}
                </h3>
                {maintLoading ? (
                    <div className="text-center text-muted-foreground text-sm py-4">
                        Loading archived maintenance…
                    </div>
                ) : archivedMaint.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-4">
                        No archived maintenance records.
                    </div>
                ) : (
                    <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-[800px] text-xs md:text-sm">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-2 py-2 text-left font-medium">Bus</th>
                                    <th className="px-2 py-2 text-left font-medium">Status</th>
                                    <th className="px-2 py-2 text-left font-medium">Garage</th>
                                    <th className="px-2 py-2 text-left font-medium">Mechanic</th>
                                    <th className="px-2 py-2 text-left font-medium">Parts</th>
                                    <th className="px-2 py-2 text-left font-medium">Completed</th>
                                    <th className="px-2 py-2 text-right font-medium">Est. ETB</th>
                                    <th className="px-2 py-2 text-right font-medium">Actual ETB</th>
                                    <th className="px-2 py-2 text-left font-medium">Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {archivedMaint.map((m) => (
                                    <tr key={m.id} className="border-t hover:bg-muted/40">
                                        <td className="px-2 py-2 align-top">
                                            {m.bus?.plateNumber || "—"}
                                            {m.bus?.model && (
                                                <span className="text-xs text-muted-foreground block">
                                                    {m.bus.model}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 align-top">
                                            <span
                                                className={`rounded px-1.5 py-0.5 text-xs ${
                                                    m.status === "COMPLETED"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-red-100 text-red-700"
                                                }`}
                                            >
                                                {m.status}
                                            </span>
                                        </td>
                                        <td className="px-2 py-2 align-top">{m.garage?.name || "—"}</td>
                                        <td className="px-2 py-2 align-top">{m.assignedMechanic?.name || "—"}</td>
                                        <td className="px-2 py-2 align-top">{m.partsNeedingMaintenance || "—"}</td>
                                        <td className="px-2 py-2 align-top whitespace-nowrap">{formatDate(m.completedDate)}</td>
                                        <td className="px-2 py-2 align-top text-right">
                                            {m.estimatedCost != null ? m.estimatedCost.toLocaleString() : "—"}
                                        </td>
                                        <td className="px-2 py-2 align-top text-right">
                                            {m.actualCost != null ? m.actualCost.toLocaleString() : "—"}
                                        </td>
                                        <td className="px-2 py-2 align-top max-w-[160px] truncate">
                                            {m.mechanicNotes || m.description || "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="w-full overflow-x-auto rounded border bg-card">
                <table className="w-full min-w-[900px] text-xs md:text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-2 py-2 text-left font-medium">Booking Ref</th>
                            <th className="px-2 py-2 text-left font-medium">Passenger</th>
                            <th className="px-2 py-2 text-left font-medium">Phone</th>
                            <th className="px-2 py-2 text-left font-medium">Route</th>
                            <th className="px-2 py-2 text-left font-medium">Bus</th>
                            <th className="px-2 py-2 text-left font-medium">Driver</th>
                            <th className="px-2 py-2 text-left font-medium">Travel Date</th>
                            <th className="px-2 py-2 text-left font-medium">Arrival</th>
                            <th className="px-2 py-2 text-left font-medium">Seats</th>
                            <th className="px-2 py-2 text-right font-medium">Price (ETB)</th>
                            <th className="px-2 py-2 text-left font-medium">Status</th>
                            <th className="px-2 py-2 text-left font-medium">Payment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={12}
                                    className="px-3 py-4 text-center text-muted-foreground"
                                >
                                    No bookings found.
                                </td>
                            </tr>
                        ) : (
                            filteredRows.slice(0, 200).map((r) => (
                                <tr
                                    key={r.bookingRef}
                                    className="border-t hover:bg-muted/40"
                                >
                                    <td className="px-2 py-2 align-top">{r.bookingRef}</td>
                                    <td className="px-2 py-2 align-top">{r.passengerName}</td>
                                    <td className="px-2 py-2 align-top">{r.passengerPhone}</td>
                                    <td className="px-2 py-2 align-top">{r.route}</td>
                                    <td className="px-2 py-2 align-top">
                                        {r.busPlate}
                                        {r.companyName ? ` (${r.companyName})` : ""}
                                    </td>
                                    <td className="px-2 py-2 align-top">{r.driverName}</td>
                                    <td className="px-2 py-2 align-top">
                                        {formatDate(r.departDate)}
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                        {formatDate(r.arriveDate)}{" "}
                                        {r.arriveDate && formatTime(r.arriveDate)}
                                    </td>
                                    <td className="px-2 py-2 align-top">{r.seatNumbers}</td>
                                    <td className="px-2 py-2 align-top text-right">
                                        {(r.totalPrice || 0).toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                        <span
                                            className={`rounded px-1.5 py-0.5 text-xs ${
                                                r.bookingStatus === "CONFIRMED" ||
                                                r.bookingStatus === "COMPLETED"
                                                    ? "bg-green-100 text-green-700"
                                                    : r.bookingStatus === "CANCELLED"
                                                      ? "bg-red-100 text-red-700"
                                                      : "bg-amber-100 text-amber-700"
                                            }`}
                                        >
                                            {r.bookingStatus}
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 align-top">
                                        <span
                                            className={`rounded px-1.5 py-0.5 text-xs ${
                                                r.paymentStatus === "PAID"
                                                    ? "bg-green-100 text-green-700"
                                                    : r.paymentStatus === "REFUNDED"
                                                      ? "bg-red-100 text-red-700"
                                                      : "bg-amber-100 text-amber-700"
                                            }`}
                                        >
                                            {r.paymentStatus}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {filteredRows.length > 200 && (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                        Showing 200 of {filteredRows.length} rows. Use search to filter.
                    </div>
                )}
            </div>
        </div>
    );
}

function KpiCard({
    icon,
    label,
    value,
    color,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
}) {
    return (
        <div className="rounded border bg-card p-3 shadow-sm">
            <div className={`flex items-center gap-2 ${color}`}>
                {icon}
                <span className="text-xs font-medium">{label}</span>
            </div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
        </div>
    );
}
