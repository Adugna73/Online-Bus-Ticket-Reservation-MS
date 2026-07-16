"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import ExcelJS from "exceljs";

type Bucket = {
    key: string;
    label: string;
    ongoing: number;
    completed: number;
    total: number;
    completionPct: number;
    le3?: number;
    le5?: number;
    gt5?: number;
    w1?: number;
    w2?: number;
    w3?: number;
    w4?: number;
};

type WorkOrderDetail = {
    id: string;
    taskNumber: string | null;
    title: string;
    description: string | null;
    type: string;
    status: string;
    planned: boolean;
    priority: number | null;
    siteName: string;
    siteCode: string | null;
    region: string | null;
    zone: string | null;
    neName: string | null;
    assetTag: string | null;
    assetType: string | null;
    template: string | null;
    checklistScope: string | null;
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    actualStartAt: string | null;
    actualEndAt: string | null;
    completedAt: string | null;
    archivedAt: string | null;
    createdAt: string;
    updatedAt: string | null;
    createdBy: string | null;
    assignedTo: string | null;
    completedBy: string | null;
    team: string | null;
};

type ApiResponse = {
    buckets: Bucket[];
    window: { start: string | Date; end: string | Date };
    details?: WorkOrderDetail[];
    error?: string;
};

function weekRange() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = (day + 6) % 7; // days since Monday
    const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - diffToMonday,
    );
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
}

export function ReportAnalysisTable() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const assignedToIdFilter = String(searchParams?.get("assignedToId") || "");
    const statusFilter = String(searchParams?.get("status") || "");
    const delayFilter = String(searchParams?.get("delay") || "");

    const defaultRange = useMemo(() => weekRange(), []);
    const [start, setStart] = useState(defaultRange.start);
    const [end, setEnd] = useState(defaultRange.end);
    const monthLabel = useMemo(() => {
        if (!start) return "Month";
        const d = new Date(start);
        return isNaN(d.getTime())
            ? "Month"
            : d.toLocaleString("en-US", { month: "short" });
    }, [start]);
    const [ongoingRows, setOngoingRows] = useState<Bucket[]>([]);
    const [completedRows, setCompletedRows] = useState<Bucket[]>([]);
    const [ongoingDetails, setOngoingDetails] = useState<WorkOrderDetail[]>([]);
    const [completedDetails, setCompletedDetails] = useState<WorkOrderDetail[]>(
        [],
    );
    const [loadingOngoing, setLoadingOngoing] = useState(false);
    const [loadingCompleted, setLoadingCompleted] = useState(false);
    const [errorOngoing, setErrorOngoing] = useState<string | null>(null);
    const [errorCompleted, setErrorCompleted] = useState<string | null>(null);
    const weekClass = (value?: number) =>
        value ? "" : "text-red-600 font-semibold";
    const managerLabel =
        (session?.user as any)?.fullName ||
        (session?.user as any)?.name ||
        "Manager";

    const ongoingSummary = useMemo(() => {
        const total = ongoingRows.reduce((s, r) => s + (r.total || 0), 0);
        const ongoing = ongoingRows.reduce((s, r) => s + (r.ongoing || 0), 0);
        const le3 = ongoingRows.reduce((s, r) => s + (r.le3 || 0), 0);
        const le5 = ongoingRows.reduce((s, r) => s + (r.le5 || 0), 0);
        const gt5 = ongoingRows.reduce((s, r) => s + (r.gt5 || 0), 0);
        return { total, ongoing, le3, le5, gt5 };
    }, [ongoingRows]);

    const ongoingByKey = useMemo(() => {
        const map = new Map<string, number>();
        ongoingRows.forEach((r) => map.set(r.key, r.ongoing || 0));
        return map;
    }, [ongoingRows]);

    const managerId = String(session?.user?.id || "");
    const sessionRole = String(
        (session?.user as any)?.role || "",
    ).toLowerCase();
    const workOrdersPath =
        sessionRole === "supervisor"
            ? "/supervisor/bookings"
            : sessionRole === "admin"
              ? "/admin/bookings"
              : "/manager/bookings";

    // build a link scoped to either a handler or a region/zone group
    function isUuid(val: string) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            val,
        );
    }

    function buildWorkOrdersUrl(
        groupKey: string,
        opts: { status?: string; delay?: string; archived?: string } = {},
    ) {
        const params = new URLSearchParams();

        // Pass handlerId for any bucket key so the API can resolve it to a user if needed.
        // If the key does not correspond to a user, the API will fall back to region/zone logic.
        if (groupKey) {
            params.set("handlerId", groupKey);
            const upper = groupKey.toUpperCase();
            if (upper.includes("AAZ")) {
                // zone-based bucket
                params.set("zoneName", groupKey);
            } else {
                params.set("regionName", groupKey);
            }
        } else if (managerId) {
            params.set("managerId", managerId);
        }

        if (opts.status) params.set("status", opts.status);
        if (opts.delay) params.set("delay", opts.delay);
        if (opts.archived) params.set("archived", opts.archived);
        return `${workOrdersPath}?${params.toString()}`;
    }

    // wrappers for backwards compatibility
    const buildWorkOrderLink = (handlerId: string, status?: string) =>
        buildWorkOrdersUrl(handlerId, { status });
    const buildWorkOrderDelayLink = (handlerId: string, delay: string) =>
        buildWorkOrdersUrl(handlerId, { delay });

    async function load(kind: "ongoing" | "completed") {
        if (kind === "ongoing") setLoadingOngoing(true);
        else setLoadingCompleted(true);
        try {
            const params = new URLSearchParams();
            params.set("kind", kind);
            params.set("includeDetails", "1");
            if (kind === "completed") {
                if (start) params.set("start", start);
                if (end) params.set("end", end);
            }
            // propagate any filters from the URL to the report API
            if (assignedToIdFilter)
                params.set("assignedToId", assignedToIdFilter);
            if (statusFilter) params.set("status", statusFilter);
            if (delayFilter) params.set("delay", delayFilter);

            const res = await fetch(
                `/api/reports/analysis?${params.toString()}`,
            );
            const json: ApiResponse = await res.json();
            if (!res.ok || json.error)
                throw new Error(json.error || res.statusText);
            if (kind === "ongoing") {
                setOngoingRows(json.buckets || []);
                setOngoingDetails(json.details || []);
                setErrorOngoing(null);
            } else {
                setCompletedRows(json.buckets || []);
                setCompletedDetails(json.details || []);
                setErrorCompleted(null);
            }
        } catch (err: any) {
            if (kind === "ongoing") {
                setErrorOngoing(err?.message || "Failed to load ongoing");
                setOngoingRows([]);
                setOngoingDetails([]);
            } else {
                setErrorCompleted(err?.message || "Failed to load completed");
                setCompletedRows([]);
                setCompletedDetails([]);
            }
        } finally {
            if (kind === "ongoing") setLoadingOngoing(false);
            else setLoadingCompleted(false);
        }
    }

    useEffect(() => {
        load("ongoing");
        load("completed");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function copyTable(rows: Bucket[], mode: "ongoing" | "completed") {
        if (!rows.length) return;
        if (mode === "ongoing") {
            const header = [
                "Handler",
                "Total",
                "Ongoing",
                "≤3 days",
                "≤5 days",
                ">5 days",
            ];
            const lines = [
                header.join("\t"),
                ...rows.map((r) =>
                    [
                        r.label,
                        r.total,
                        r.ongoing,
                        r.le3 ?? 0,
                        r.le5 ?? 0,
                        r.gt5 ?? 0,
                    ].join("\t"),
                ),
            ];
            navigator.clipboard.writeText(lines.join("\n"));
        } else {
            const header = [
                "Handler",
                "Target",
                "Total",
                "Completed",
                `${monthLabel} - W1`,
                `${monthLabel} - W2`,
                `${monthLabel} - W3`,
                `${monthLabel} - W4`,
                "≤3 days",
                "≤5 days",
                ">5 days",
                "Completion %",
            ];
            const lines = [
                header.join("\t"),
                ...rows.map((r) =>
                    [
                        r.label,
                        "-",
                        r.total,
                        r.completed,
                        r.w1 ?? 0,
                        r.w2 ?? 0,
                        r.w3 ?? 0,
                        r.w4 ?? 0,
                        r.le3 ?? 0,
                        r.le5 ?? 0,
                        r.gt5 ?? 0,
                        r.completionPct + "%",
                    ].join("\t"),
                ),
            ];
            navigator.clipboard.writeText(lines.join("\n"));
        }
    }
    async function exportExcel(
        rows: Bucket[],
        details: WorkOrderDetail[],
        suffix: string,
        mode: "ongoing" | "completed",
    ) {
        if (!rows.length) return;
        const workbook = new ExcelJS.Workbook();
        const summary = workbook.addWorksheet(
            mode === "ongoing" ? "Ongoing" : "Completed",
        );
        const detailsSheet = workbook.addWorksheet("Bookings");

        // Summary sheet
        if (mode === "ongoing") {
            summary.addRow([
                "Handler",
                "Total",
                "Ongoing",
                "≤3 days",
                "≤5 days",
                ">5 days",
            ]);
            rows.forEach((r) => {
                summary.addRow([
                    r.label,
                    r.total,
                    r.ongoing,
                    r.le3 ?? 0,
                    r.le5 ?? 0,
                    r.gt5 ?? 0,
                ]);
            });
        } else {
            summary.addRow([
                "Handler",
                "Target",
                "Total",
                "Completed",
                `${monthLabel} - W1`,
                `${monthLabel} - W2`,
                `${monthLabel} - W3`,
                `${monthLabel} - W4`,
                "≤3 days",
                "≤5 days",
                ">5 days",
                "Completion %",
            ]);
            rows.forEach((r) => {
                summary.addRow([
                    r.label,
                    "-",
                    r.total,
                    r.completed,
                    r.w1 ?? 0,
                    r.w2 ?? 0,
                    r.w3 ?? 0,
                    r.w4 ?? 0,
                    r.le3 ?? 0,
                    r.le5 ?? 0,
                    r.gt5 ?? 0,
                    r.completionPct,
                ]);
            });
        }

        // Details sheet
        detailsSheet.addRow([
            "Task #",
            "Title",
            "Type",
            "Status",
            "Planned",
            "Priority",
            "Handler",
            "Created By",
            "Completed By",
            "Team",
            "Site",
            "Site Code",
            "Region",
            "Zone",
            "NEs",
            "Asset Tag",
            "Asset Type",
            "Template",
            "Checklist Scope",
            "Scheduled Start",
            "Scheduled End",
            "Actual Start",
            "Actual End",
            "Completed At",
            "Archived At",
            "Created At",
            "Updated At",
        ]);
        details.forEach((d) => {
            detailsSheet.addRow([
                d.taskNumber || "",
                d.title,
                d.type,
                d.status,
                d.planned ? "Yes" : "No",
                d.priority ?? "",
                d.assignedTo || "",
                d.createdBy || "",
                d.completedBy || "",
                d.team || "",
                d.siteName,
                d.siteCode || "",
                d.region || "",
                d.zone || "",
                d.neName || "",
                d.assetTag || "",
                d.assetType || "",
                d.template || "",
                d.checklistScope || "",
                d.scheduledStartAt ? new Date(d.scheduledStartAt) : "",
                d.scheduledEndAt ? new Date(d.scheduledEndAt) : "",
                d.actualStartAt ? new Date(d.actualStartAt) : "",
                d.actualEndAt ? new Date(d.actualEndAt) : "",
                d.completedAt ? new Date(d.completedAt) : "",
                d.archivedAt ? new Date(d.archivedAt) : "",
                d.createdAt ? new Date(d.createdAt) : "",
                d.updatedAt ? new Date(d.updatedAt) : "",
            ]);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pm-analysis-${suffix}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-6">
            <div className="p-6 bg-background text-foreground rounded shadow space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold">
                            Ongoing bookings
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Live view (no interval) grouped by your scope.
                        </p>
                    </div>
                    <div className="flex gap-2 text-sm">
                        <button
                            onClick={() => load("ongoing")}
                            disabled={loadingOngoing}
                            className="border border-border rounded-md px-4 py-2 bg-card"
                        >
                            {loadingOngoing ? "Loading..." : "Refresh"}
                        </button>
                        <button
                            onClick={() => copyTable(ongoingRows, "ongoing")}
                            disabled={!ongoingRows.length}
                            className="border border-border rounded-md px-4 py-2 bg-card"
                        >
                            Copy
                        </button>
                        <button
                            onClick={() =>
                                exportExcel(
                                    ongoingRows,
                                    ongoingDetails,
                                    "ongoing",
                                    "ongoing",
                                )
                            }
                            disabled={!ongoingRows.length}
                            className="border border-border rounded-md px-4 py-2 bg-card"
                        >
                            Export Excel
                        </button>
                    </div>
                </div>
                {errorOngoing && (
                    <div className="text-sm text-red-600">{errorOngoing}</div>
                )}
                <div className="overflow-auto">
                    <table className="min-w-full text-sm border border-border">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className="text-left px-3 py-2 border-b">
                                    Handler
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    Total
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    Ongoing
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    ≤3 days
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    ≤5 days
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    &gt;5 days
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!ongoingRows.length && !loadingOngoing ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-3 py-3 text-center text-muted-foreground"
                                    >
                                        No ongoing bookings. You can
                                        check&nbsp;
                                        <a
                                            href="/manager/bookings"
                                            className="text-primary hover:underline"
                                        >
                                            Bookings
                                        </a>{" "}
                                        or&nbsp;
                                        <a
                                            href="/manager/dashboard"
                                            className="text-primary hover:underline"
                                        >
                                            Dashboard
                                        </a>{" "}
                                        for more details.
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    <tr className="bg-muted/30 font-semibold">
                                        <td className="px-3 py-2 border-b">
                                            {managerLabel} (Total)
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrderLink("")}
                                                className="text-primary hover:underline"
                                            >
                                                {ongoingSummary.total}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrderLink(
                                                    "",
                                                    "processing",
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {ongoingSummary.ongoing}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrderDelayLink(
                                                    "",
                                                    "le3",
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {ongoingSummary.le3}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrderDelayLink(
                                                    "",
                                                    "le5",
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {ongoingSummary.le5}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrderDelayLink(
                                                    "",
                                                    "gt5",
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {ongoingSummary.gt5}
                                            </Link>
                                        </td>
                                    </tr>
                                    {ongoingRows.map((row) => (
                                        <tr
                                            key={row.key}
                                            className="odd:bg-muted/20"
                                        >
                                            <td className="px-3 py-2 border-b font-medium">
                                                <Link
                                                    href={buildWorkOrdersUrl(
                                                        row.key,
                                                    )}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.label}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 border-b text-right">
                                                <Link
                                                    href={buildWorkOrdersUrl(
                                                        row.key,
                                                    )}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.total}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 border-b text-right">
                                                <Link
                                                    href={buildWorkOrdersUrl(
                                                        row.key,
                                                        {
                                                            status: "processing",
                                                        },
                                                    )}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.ongoing}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 border-b text-right">
                                                <Link
                                                    href={buildWorkOrderDelayLink(
                                                        row.key,
                                                        "le3",
                                                    )}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.le3 ?? 0}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 border-b text-right">
                                                <Link
                                                    href={buildWorkOrderDelayLink(
                                                        row.key,
                                                        "le5",
                                                    )}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.le5 ?? 0}
                                                </Link>
                                            </td>
                                            <td className="px-3 py-2 border-b text-right">
                                                <Link
                                                    href={buildWorkOrderDelayLink(
                                                        row.key,
                                                        "gt5",
                                                    )}
                                                    className="text-primary hover:underline"
                                                >
                                                    {row.gt5 ?? 0}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="p-6 bg-background text-foreground rounded shadow space-y-3">
                <div>
                    <p className="text-lg font-semibold">
                        Completed / archived
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Use an interval to review completion performance.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm">Start</label>
                        <input
                            type="date"
                            value={start}
                            onChange={(e) => setStart(e.target.value)}
                            className="mt-1 p-2 border rounded w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm">End</label>
                        <input
                            type="date"
                            value={end}
                            onChange={(e) => setEnd(e.target.value)}
                            className="mt-1 p-2 border rounded w-full"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button
                            onClick={() => load("completed")}
                            disabled={loadingCompleted}
                            className="border border-border rounded-md px-4 py-2 bg-card"
                        >
                            {loadingCompleted ? "Generating..." : "Generate"}
                        </button>
                        <button
                            onClick={() =>
                                copyTable(completedRows, "completed")
                            }
                            disabled={!completedRows.length}
                            className="border border-border rounded-md px-4 py-2 bg-card"
                        >
                            Copy
                        </button>
                        <button
                            onClick={() =>
                                exportExcel(
                                    completedRows,
                                    completedDetails,
                                    `${start}-to-${end}-completed`,
                                    "completed",
                                )
                            }
                            disabled={!completedRows.length}
                            className="border border-border rounded-md px-4 py-2 bg-card"
                        >
                            Export Excel
                        </button>
                    </div>
                </div>
                {errorCompleted && (
                    <div className="text-sm text-red-600">{errorCompleted}</div>
                )}
                <div className="overflow-auto">
                    <table className="min-w-full text-sm border border-border">
                        <thead className="bg-muted/40">
                            <tr>
                                <th className="text-left px-3 py-2 border-b">
                                    Handler
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    Target
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    Total
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    Completed
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    {monthLabel} - W1
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    {monthLabel} - W2
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    {monthLabel} - W3
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    {monthLabel} - W4
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    ≤3 days
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    ≤5 days
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    &gt;5 days
                                </th>
                                <th className="text-right px-3 py-2 border-b">
                                    Completion %
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {!completedRows.length && !loadingCompleted ? (
                                <tr>
                                    <td
                                        colSpan={12}
                                        className="px-3 py-3 text-center text-muted-foreground"
                                    >
                                        No completed bookings for this
                                        interval. You may want to look in&nbsp;
                                        <a
                                            href="/manager/bookings"
                                            className="text-primary hover:underline"
                                        >
                                            Bookings
                                        </a>{" "}
                                        or the&nbsp;
                                        <a
                                            href="/manager/dashboard"
                                            className="text-primary hover:underline"
                                        >
                                            Dashboard
                                        </a>
                                        .
                                    </td>
                                </tr>
                            ) : (
                                completedRows.map((row) => (
                                    <tr
                                        key={row.key}
                                        className="odd:bg-muted/20"
                                    >
                                        <td className="px-3 py-2 border-b font-medium">
                                            <Link
                                                href={buildWorkOrdersUrl(
                                                    row.key,
                                                    {
                                                        status: "completed",
                                                        archived: "all",
                                                    },
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {row.label}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            -
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrdersUrl(
                                                    row.key,
                                                    {
                                                        status: "completed",
                                                        archived: "all",
                                                    },
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {row.total}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            <Link
                                                href={buildWorkOrdersUrl(
                                                    row.key,
                                                    {
                                                        status: "completed",
                                                        archived: "all",
                                                    },
                                                )}
                                                className="text-primary hover:underline"
                                            >
                                                {row.completed}
                                            </Link>
                                        </td>
                                        <td
                                            className={`px-3 py-2 border-b text-right ${weekClass(
                                                row.w1,
                                            )}`}
                                        >
                                            {row.w1 ?? 0}
                                        </td>
                                        <td
                                            className={`px-3 py-2 border-b text-right ${weekClass(
                                                row.w2,
                                            )}`}
                                        >
                                            {row.w2 ?? 0}
                                        </td>
                                        <td
                                            className={`px-3 py-2 border-b text-right ${weekClass(
                                                row.w3,
                                            )}`}
                                        >
                                            {row.w3 ?? 0}
                                        </td>
                                        <td
                                            className={`px-3 py-2 border-b text-right ${weekClass(
                                                row.w4,
                                            )}`}
                                        >
                                            {row.w4 ?? 0}
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            {row.le3 ?? 0}
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            {row.le5 ?? 0}
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            {row.gt5 ?? 0}
                                        </td>
                                        <td className="px-3 py-2 border-b text-right">
                                            {Math.round(
                                                ((row.completed || 0) /
                                                    ((row.completed || 0) +
                                                        (ongoingByKey.get(
                                                            row.key,
                                                        ) || 0))) *
                                                    10000,
                                            ) / 100}
                                            %
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
