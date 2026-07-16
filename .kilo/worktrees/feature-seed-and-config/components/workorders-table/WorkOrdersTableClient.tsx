"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
    ArrowDown,
    ArrowUp,
    BusFront,
    CheckCircle,
    ChevronsLeft,
    ChevronsRight,
    ChevronsUpDown,
    Circle,
    Filter,
    Loader2,
    MoreHorizontal,
    RefreshCcw,
    Search,
    Settings2,
    Timer,
    Users,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useLayoutEffect,
    useRef,
} from "react";

// Helper to highlight search matches (returns React nodes)
function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function highlightText(text: string, query?: string) {
    if (!query) return text;
    const tokens = String(query || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(escapeRegExp);
    if (!tokens.length) return text;
    const pattern = tokens.join("|");
    const splitter = new RegExp(`(${pattern})`, "i");
    const exactMatch = new RegExp(`^(${pattern})$`, "i");
    const parts = String(text || "").split(new RegExp(`(${pattern})`, "gi"));
    return parts.map((part, i) =>
        exactMatch.test(part) ? (
            <span
                key={i}
                className="rounded bg-emerald-100 text-emerald-800 px-0.5"
            >
                {part}
            </span>
        ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
        ),
    );
}
import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { createPortal } from "react-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import table, {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import router from "next/router";

const STATUS_OPTIONS = [
    { value: "pending", label: "Pending", icon: Circle },
    { value: "confirmed", label: "Confirmed", icon: CheckCircle },
    { value: "cancelled", label: "Cancelled", icon: Timer },
    { value: "completed", label: "Completed", icon: CheckCircle },
];

const TYPE_OPTIONS = [
    { value: "telebirr", label: "Telebirr" },
    { value: "cbe_birr", label: "CBE Birr" },
    { value: "m_birr", label: "M-Birr" },
    { value: "cash", label: "Cash" },
    { value: "unknown", label: "Unknown" },
];

type StatusKey = (typeof STATUS_OPTIONS)[number]["value"];
type PaymentKey = "pending" | "paid" | "failed" | "refunded" | "none";

export type WorkOrderRow = {
    id: string;
    taskNumber: string;
    title: string;
    status: StatusKey;
    type: string;
    team: string;
    site: string;
    assignedTo: string;
    paymentStatus: PaymentKey;
    scheduledWindow: string;
    bookedSeats: number;
    busSeatCount?: number | null;
    createdAt: string;
    updatedAt: string;
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    closedAt?: string | null;
    archived?: boolean;
    // fractional days overdue (positive means overdue)
    delayDays?: number;
    // newly created within threshold (true => highlight as new)
    isNew?: boolean;
    // whether this booking was auto-created
    isAutoCreated?: boolean;
};

const statusVariant = (status: StatusKey) => {
    switch (status) {
        case "confirmed":
            return "default" as const;
        case "pending":
            return "secondary" as const;
        case "cancelled":
            return "destructive" as const;
        case "completed":
            return "outline" as const;
        default:
            return "outline" as const;
    }
};

const paymentBadge = (status: PaymentKey) => {
    switch (status) {
        case "paid":
            return "default" as const;
        case "pending":
            return "secondary" as const;
        case "failed":
            return "destructive" as const;
        case "refunded":
            return "outline" as const;
        default:
            return "outline" as const;
    }
};

const formatDate = (iso?: string | null) => {
    if (!iso) return "-";
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        });
    } catch (e) {
        return iso ?? "-";
    }
};

const formatSchedule = (start?: string | null, end?: string | null) => {
    if (!start && !end) return "-";
    if (start && end) return `${formatDate(start)} — ${formatDate(end)}`;
    return formatDate(start || end || undefined);
};

const mapPaymentStatus = (status?: string | null): PaymentKey => {
    const raw = String(status || "").toLowerCase();
    if (raw === "paid") return "paid";
    if (raw === "pending") return "pending";
    if (raw === "failed") return "failed";
    if (raw === "refunded") return "refunded";
    return "none";
};

const MENU_BG_CLASS =
    "z-50 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-foreground shadow-md";
const FILTER_TRIGGER_CLASS =
    "h-7 sm:h-9 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700";

function DataTableColumnHeader<TData, TValue>(props: {
    column: any;
    title: string;
    className?: string;
}) {
    const { column, title, className } = props;
    if (!column.getCanSort()) {
        return <div className={cn(className)}>{title}</div>;
    }

    return (
        <div
            className={cn(
                "flex items-center gap-2 bg-background text-foreground",
                className,
            )}
        >
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 px-2"
                    >
                        <span>{title}</span>
                        {column.getIsSorted() === "desc" ? (
                            <ArrowDown className="ml-1 h-4 w-4" />
                        ) : column.getIsSorted() === "asc" ? (
                            <ArrowUp className="ml-1 h-4 w-4" />
                        ) : (
                            <ChevronsUpDown className="ml-1 h-4 w-4" />
                        )}
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                    side="bottom"
                    align="start"
                    className={cn(MENU_BG_CLASS)}
                >
                    <DropdownMenu.Item
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        onSelect={() => column.toggleSorting(false)}
                    >
                        Sort ascending
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        onSelect={() => column.toggleSorting(true)}
                    >
                        Sort descending
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Item
                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                        onSelect={() => column.toggleVisibility(false)}
                    >
                        Hide column
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>
    );
}

type AssignContextValue = {
    viewerRole: string;
    supervisorTechs: any[];
    supervisorTeam: any[];
    managerManager: any[];
    adminManager: any[];
    assigning: boolean;
    onAssign: (
        woId: string,
        targetType: "user" | "team",
        targetId: string,
    ) => void;
};

const AssignContext = React.createContext<AssignContextValue | null>(null);

const DataTableRowActions = ({ row }: { row: any }) => {
    const router = useRouter();
    const wo = row.original as WorkOrderRow;
    const { data: session } = useSession();
    const ctx = React.useContext(AssignContext);
    const roleKey = String((session as any)?.user?.role || "").toLowerCase();
    const rolePath =
        roleKey === "admin"
            ? "admin"
            : roleKey === "manager"
              ? "manager"
              : roleKey === "supervisor"
                ? "supervisor"
                : roleKey === "technician" || roleKey === "staff"
                  ? "technician"
                  : "passenger";
    const detailPath =
        roleKey === "passenger"
            ? `/passenger/bookings/${wo.id}`
            : `/${rolePath}/bookings/${wo.id}`;

    const canAssign =
        (roleKey === "admin" ||
            roleKey === "manager" ||
            roleKey === "supervisor") &&
        wo.status !== "completed" &&
        !wo.archived;

    const buildAssignItems = () => {
        if (!ctx)
            return [] as Array<{
                key: string;
                label: string;
                type: "user" | "team";
                id: string;
            }>;
        if (roleKey === "supervisor") {
            const teamItems = (ctx.supervisorTeam || []).map((t) => ({
                key: `team-${t.id}`,
                label: t.name || t.id,
                type: "team" as const,
                id: t.id,
            }));
            const techItems = (ctx.supervisorTechs || []).map((t) => ({
                key: `user-${t.id}`,
                label: t.fullName || t.email || t.id,
                type: "user" as const,
                id: t.id,
            }));
            return [...teamItems, ...techItems];
        }

        if (roleKey === "manager") {
            return (ctx.managerManager || []).map((s) => ({
                key: `user-${s.id}`,
                label: s.fullName || s.email || s.id,
                type: "user" as const,
                id: s.id,
            }));
        }

        if (roleKey === "admin") {
            return (ctx.adminManager || []).map((m) => ({
                key: `user-${m.id}`,
                label: m.fullName || m.email || m.id,
                type: "user" as const,
                id: m.id,
            }));
        }

        return [] as Array<{
            key: string;
            label: string;
            type: "user" | "team";
            id: string;
        }>;
    };

    const assignItems = buildAssignItems();

    const hasAssignee =
        (wo.assignedTo && String(wo.assignedTo).trim() !== "-") ||
        (wo.team && String(wo.team).trim() !== "-");

    const actionButtons = hasAssignee
        ? [{ label: "Reassign", key: "reassign" }]
        : [{ label: "Assign", key: "assign" }];

    const canApprovePayment =
        (roleKey === "admin" || roleKey === "supervisor") &&
        wo.paymentStatus === "pending";

    const handleApprovePayment = async () => {
        try {
            await fetch(`/api/bookings/${wo.id}/approve-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            router.refresh();
        } catch (e) {
            // ignore
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Button
                size="sm"
                variant="link"
                className={cn(
                    row.original.isNew
                        ? "text-emerald-800 hover:text-emerald-900"
                        : undefined,
                )}
                onClick={() => router.push(detailPath)}
            >
                Details
            </Button>
            {canApprovePayment && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleApprovePayment}
                >
                    Approve Payment
                </Button>
            )}
            {canAssign && ctx && (
                <div className="flex items-center gap-1">
                    {actionButtons.map((btn) => (
                        <DropdownMenu.Root key={btn.key}>
                            <DropdownMenu.Trigger asChild>
                                <Button
                                    size="sm"
                                    className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[11px] hover:bg-primary/90 transition-colors duration-200"
                                    disabled={
                                        ctx.assigning ||
                                        assignItems.length === 0
                                    }
                                >
                                    {btn.label}
                                </Button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Content
                                side="bottom"
                                align="end"
                                className={cn(
                                    MENU_BG_CLASS,
                                    "max-h-72 overflow-y-auto",
                                )}
                            >
                                {assignItems.length === 0 && (
                                    <DropdownMenu.Item className="px-3 py-2 text-sm text-muted-foreground">
                                        No users available
                                    </DropdownMenu.Item>
                                )}
                                {assignItems.map((item) => (
                                    <DropdownMenu.Item
                                        key={item.key}
                                        className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                                        onSelect={() =>
                                            ctx.onAssign(
                                                wo.id,
                                                item.type,
                                                item.id,
                                            )
                                        }
                                    >
                                        {item.label}
                                    </DropdownMenu.Item>
                                ))}
                            </DropdownMenu.Content>
                        </DropdownMenu.Root>
                    ))}
                </div>
            )}
        </div>
    );
};

const WorkOrderCardsView = ({ data }: { data: WorkOrderRow[] }) => {
    const router = useRouter();
    const { data: session } = useSession();
    const roleKey = String((session as any)?.user?.role || "").toLowerCase();
    const rolePath =
        roleKey === "admin"
            ? "admin"
            : roleKey === "manager"
              ? "manager"
              : roleKey === "supervisor"
                ? "supervisor"
                : "passenger";

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data || []).map((wo) => (
                <div
                    key={wo.id}
                    className="rounded border bg-card p-3 text-[11px] leading-snug"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="text-xs text-muted-foreground">
                                Task
                            </div>
                            <div className="font-semibold text-sm">
                                {wo.taskNumber}
                            </div>
                        </div>
                        <Badge variant={statusVariant(wo.status)}>
                            {wo.status}
                        </Badge>
                    </div>
                    <div className="mt-2">
                        <div className="text-xs text-muted-foreground">
                            Title
                        </div>
                        <div className="truncate text-sm" title={wo.title}>
                            {wo.title}
                        </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                            <div className="text-[11px] text-muted-foreground">
                                Site
                            </div>
                            <div className="text-sm truncate" title={wo.site}>
                                {wo.site}
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] text-muted-foreground">
                                Assignee
                            </div>
                            <div
                                className="text-sm truncate"
                                title={wo.assignedTo}
                            >
                                {wo.assignedTo}
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                        Scheduled: {wo.scheduledWindow || "-"}
                    </div>
                    <div className="mt-3">
                        <Button
                            size="sm"
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[11px] hover:bg-primary/90"
                            onClick={() =>
                                router.push(`/${rolePath}/bookings/${wo.id}`)
                            }
                        >
                            Details
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

function DelayCell({ row }: { row: any }) {
    const { data: session } = useSession();
    // NOTE: "delay" in this table now represents the age of the booking
    // since creation, not time overdue past the scheduled end. We therefore
    // prefer createdAt as the primary reference, and only fall back to
    // scheduledStartAt/scheduledEndAt when createdAt is unavailable so that
    // a duration can still be shown consistently for all rows.
    const refIso =
        row.original.createdAt ||
        row.original.scheduledStartAt ||
        row.original.scheduledEndAt;
    if (!refIso) return <span className="text-sm">0d 0h</span>;
    const ref = new Date(refIso);
    if (isNaN(ref.getTime())) return <span className="text-sm">0d 0h</span>;
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - ref.getTime());
    const daysFloat = diffMs / (1000 * 60 * 60 * 24);
    const days = Math.floor(daysFloat);
    const hours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );

    // Color the duration text to match row highlight thresholds
    let colorClass = "text-muted-foreground";
    if (daysFloat > 3) colorClass = "text-red-600 font-semibold";
    else if (daysFloat >= 1.5 && daysFloat <= 2.5)
        colorClass = "text-yellow-600 font-medium";
    else if (daysFloat > 0) colorClass = "text-emerald-600 font-medium";

    return (
        <span className={"text-sm " + colorClass}>
            {days}d {hours}h
        </span>
    );
}

const columns: ColumnDef<WorkOrderRow>[] = [
    {
        accessorKey: "taskNumber",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Booking Ref" />
        ),
        cell: ({ row, table }) => {
            const q = String(table.getState().globalFilter || "");
            return (
                <div className="flex items-center gap-2 text-[11px] leading-snug">
                    <span
                        className={cn(
                            "font-medium",
                            row.original.isNew
                                ? "text-emerald-800"
                                : "text-foreground",
                        )}
                    >
                        {highlightText(
                            String(row.getValue("taskNumber") || ""),
                            q,
                        )}
                    </span>
                </div>
            );
        },
    },
    {
        accessorKey: "title",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Route" />
        ),
        filterFn: (row, id, value) => {
            if (!value) return true;
            const haystack =
                `${row.original.title} ${row.original.taskNumber}`.toLowerCase();
            return haystack.includes(String(value).toLowerCase());
        },
        cell: ({ row, table }) => {
            const q = String(table.getState().globalFilter || "");
            const type = TYPE_OPTIONS.find(
                (t) => t.value === row.original.type,
            );
            return (
                <div className="flex max-w-[520px] items-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis text-[11px] leading-snug">
                    {type && (
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] whitespace-nowrap",
                                row.original.isNew
                                    ? "text-emerald-800 border-emerald-200"
                                    : undefined,
                            )}
                        >
                            {type.label}
                        </Badge>
                    )}
                    {row.original.isAutoCreated && (
                        <Badge
                            variant="secondary"
                            className="text-[10px] whitespace-nowrap bg-blue-100 text-blue-800"
                        >
                            Auto
                        </Badge>
                    )}
                    <div className="flex flex-col">
                        <span className="truncate" title={row.original.title}>
                            {highlightText(String(row.original.title || ""), q)}
                        </span>
                        <a
                            href={`./${row.original.id}`}
                            className={cn(
                                "mt-1 text-xs md:hidden",
                                row.original.isNew
                                    ? "text-emerald-600 hover:text-emerald-700"
                                    : "text-primary-600 hover:text-primary-700",
                            )}
                        >
                            Details
                        </a>
                    </div>
                </div>
            );
        },
    },
    {
        accessorKey: "type",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Payment Method" />
        ),
        filterFn: (row, id, value) => {
            if (!value || value.length === 0) return true;
            return value.includes(row.getValue(id));
        },
        cell: ({ row }) => {
            const type = TYPE_OPTIONS.find(
                (t) => t.value === row.original.type,
            );
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "text-[11px]",
                        row.original.type === "telebirr"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : undefined,
                    )}
                >
                    {type?.label || row.original.type}
                </Badge>
            );
        },
    },
    {
        accessorKey: "site",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Stations" />
        ),
        filterFn: (row, id, value) => {
            if (!value) return true;
            return String(row.original.site || "")
                .toLowerCase()
                .includes(String(value).toLowerCase());
        },
        cell: ({ row, table }) => {
            const q = String(table.getState().globalFilter || "");
            return (
                <span className="text-sm truncate" title={row.original.site}>
                    {highlightText(String(row.original.site || ""), q)}
                </span>
            );
        },
    },
    {
        accessorKey: "team",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Bus" />
        ),
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                    <BusFront className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="text-sm truncate" title={row.original.team}>
                    {row.original.team}
                </span>
            </div>
        ),
    },
    {
        accessorKey: "bookedSeats",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Seats" />
        ),
        cell: ({ row }) => {
            const booked = row.original.bookedSeats || 0;
            const total = row.original.busSeatCount;
            return (
                <span className="text-sm">
                    {total ? `${booked} / ${total}` : String(booked)}
                </span>
            );
        },
    },
    {
        accessorKey: "assignedTo",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Passenger" />
        ),
        filterFn: (row, id, value) => {
            if (!value || value.length === 0) return true;
            return value.includes(row.getValue(id));
        },
        cell: ({ row, table }) => {
            const q = String(table.getState().globalFilter || "");
            return (
                <span
                    className="text-sm truncate"
                    title={row.original.assignedTo}
                >
                    {highlightText(String(row.original.assignedTo || ""), q)}
                </span>
            );
        },
    },
    {
        accessorKey: "status",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Status" />
        ),
        filterFn: (row, id, value) => {
            if (!value || value.length === 0) return true;
            return value.includes(row.getValue(id));
        },
        cell: ({ row }) => {
            const status = STATUS_OPTIONS.find(
                (s) => s.value === row.original.status,
            );
            if (!status) return <span>{row.original.status}</span>;
            const Icon = status.icon;
            return (
                <div className="flex items-center gap-2">
                    <Badge
                        variant={statusVariant(status.value)}
                        className={cn(
                            "text-[11px]",
                            row.original.isNew ? "text-emerald-800" : undefined,
                        )}
                    >
                        <Icon className="mr-1 h-3.5 w-3.5" />
                        {status.label}
                    </Badge>
                </div>
            );
        },
    },
    {
        id: "delay",
        header: ({ column }) => (
            <DataTableColumnHeader column={column} title="Delay" />
        ),
        cell: ({ row }) => <DelayCell row={row} />,
    },
    {
        accessorKey: "paymentStatus",
        header: ({ column }) => (
            <DataTableColumnHeader
                column={column}
                title="Payment"
                className="hidden xl:flex"
            />
        ),
        filterFn: (row, id, value) => {
            if (!value || value.length === 0) return true;
            return value.includes(row.getValue(id));
        },
        cell: ({ row }) => (
            <div className="hidden xl:block">
                <Badge
                    variant={paymentBadge(row.original.paymentStatus)}
                    className="text-[11px]"
                >
                    {row.original.paymentStatus || "none"}
                </Badge>
            </div>
        ),
    },
    {
        accessorKey: "scheduledWindow",
        header: ({ column }) => (
            <DataTableColumnHeader
                column={column}
                title="Departure"
                className="hidden xl:flex"
            />
        ),
        cell: ({ row }) => (
            <div className="hidden xl:block">
                <span
                    className="text-sm truncate"
                    title={row.original.scheduledWindow}
                >
                    {row.original.scheduledWindow}
                </span>
            </div>
        ),
    },
    // mobile actions column removed; mobile-only Details link added under Title cell
    /* removed createdAt column per request */
    {
        id: "actions",
        header: "",
        cell: ({ row }) => <DataTableRowActions row={row} />,
        enableSorting: false,
    },
];

function DataTableToolbar({
    table,
    onRefresh,
    refreshing,
}: {
    table: any;
    onRefresh: () => void;
    refreshing: boolean;
}) {
    const router = useRouter();
    const { data: session } = useSession();
    const roleKey = String((session as any)?.user?.role || "").toLowerCase();
    const isPassenger = roleKey === "passenger";
    const rolePath =
        roleKey === "admin"
            ? "admin"
            : roleKey === "manager"
              ? "manager"
              : roleKey === "supervisor"
                ? "supervisor"
                : "passenger";

    const [showFilters, setShowFilters] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [panelPos, setPanelPos] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generateMessage, setGenerateMessage] = useState<string | null>(null);
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [assigningUnassigned, setAssigningUnassigned] = useState(false);
    const [assignMessage, setAssignMessage] = useState<string | null>(null);
    const [assignError, setAssignError] = useState<string | null>(null);

    const preRows = useMemo(
        () => table.getPreFilteredRowModel().rows || [],
        [table],
    );
    const siteOptions = useMemo(() => {
        const s = new Set<string>();
        preRows.forEach((r: any) =>
            s.add(String(r.original.site || "").trim()),
        );
        return Array.from(s).filter(Boolean).sort();
    }, [preRows]);
    const staffOptions = useMemo(() => {
        const s = new Set<string>();
        preRows.forEach((r: any) =>
            s.add(String(r.original.assignedTo || "").trim()),
        );
        return Array.from(s).filter(Boolean).sort();
    }, [preRows]);

    const handleGenerateAutoSchedule = async () => {
        if (roleKey !== "admin") return;
        setGenerating(true);
        setGenerateMessage(null);
        setGenerateError(null);
        try {
            const res = await fetch("/api/workorders/auto-schedule", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ mode: "weekly" }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    json?.error || "Failed to generate auto-schedule",
                );
            }
            const total =
                typeof json.totalCreated === "number" ? json.totalCreated : 0;
            setGenerateMessage(
                total > 0
                    ? `Generated ${total} booking${total === 1 ? "" : "s"}`
                    : "No new bookings were generated",
            );
            onRefresh();
        } catch (e: any) {
            setGenerateError(
                e?.message || "Failed to generate auto-scheduled bookings",
            );
        } finally {
            setGenerating(false);
        }
    };

    const handleAutoAssignUnassigned = async () => {
        if (roleKey !== "admin" && roleKey !== "manager") return;
        setAssigningUnassigned(true);
        setAssignMessage(null);
        setAssignError(null);
        try {
            const res = await fetch("/api/workorders/auto-assign", {
                method: "POST",
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(
                    json?.error || "Failed to assign unassigned bookings",
                );
            }
            const updated = typeof json.updated === "number" ? json.updated : 0;
            setAssignMessage(
                updated > 0
                    ? `Assigned ${updated} unassigned booking${
                          updated === 1 ? "" : "s"
                      }`
                    : "No unassigned bookings to assign",
            );
            onRefresh();
        } catch (e: any) {
            setAssignError(
                e?.message || "Failed to assign unassigned bookings",
            );
        } finally {
            setAssigningUnassigned(false);
        }
    };

    const [runningMaintenance, setRunningMaintenance] = useState(false);
    const [maintenanceResult, setMaintenanceResult] = useState<any | null>(
        null,
    );
    const [maintenanceError, setMaintenanceError] = useState<string | null>(
        null,
    );

    const handleRunMaintenance = async () => {
        if (roleKey !== "admin") return;
        setRunningMaintenance(true);
        setMaintenanceResult(null);
        setMaintenanceError(null);
        try {
            const res = await fetch("/api/admin/maintenance", {
                method: "POST",
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json?.error || "Maintenance failed");
            setMaintenanceResult(json.results || json);
            onRefresh();
        } catch (err: any) {
            setMaintenanceError(err?.message || String(err));
        } finally {
            setRunningMaintenance(false);
        }
    };

    return (
        <div className="flex w-full items-center gap-2 overflow-visible">
            <div className="relative w-full sm:max-w-xs flex flex-col gap-1">
                <div className="relative">
                    <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search: booking ref, station, passenger, bus"
                        className="pl-7 py-1.5"
                        value={String(table.getState().globalFilter || "")}
                        onChange={(e) =>
                            table.setGlobalFilter(String(e.target.value || ""))
                        }
                    />
                </div>
                {/* Archived checkbox: hide for passengers */}
                {!isPassenger ? (
                    <label className="flex items-center gap-2 text-xs mt-1">
                        <input
                            type="checkbox"
                            onChange={(e) => {
                                table
                                    .getColumn("archived")
                                    ?.setFilterValue(
                                        e.target.checked ? "true" : "",
                                    );
                            }}
                        />
                        Archived
                    </label>
                ) : null}
            </div>

            <div className="flex items-center gap-2">
                <div className="relative overflow-visible">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        ref={triggerRef}
                        onClick={() => setShowFilters((s) => !s)}
                    >
                        <Filter className="h-4 w-4 text-foreground hover:[background:var(--button-background)] transition-colors duration-200 bg-background" />
                    </Button>
                    {typeof showFilters !== "undefined" &&
                        showFilters &&
                        triggerRef.current &&
                        createPortal(
                            <>
                                {/* overlay only behind the panel so background content is hidden just under the panel */}
                                <div
                                    onClick={() => setShowFilters(false)}
                                    style={{
                                        position: "absolute",
                                        top:
                                            triggerRef.current.getBoundingClientRect()
                                                .bottom +
                                            window.scrollY +
                                            6,
                                        left:
                                            triggerRef.current.getBoundingClientRect()
                                                .left + window.scrollX,
                                        width: 288, // matches w-72 (18rem)
                                        height: 520, // estimated panel height
                                        background: "#ffffff",
                                        zIndex: 9998,
                                    }}
                                />

                                <div
                                    style={{
                                        position: "absolute",
                                        top:
                                            triggerRef.current.getBoundingClientRect()
                                                .bottom +
                                            window.scrollY +
                                            6,
                                        left:
                                            triggerRef.current.getBoundingClientRect()
                                                .left + window.scrollX,
                                        zIndex: 9999,
                                    }}
                                    className="w-72 rounded border p-3 shadow-lg bg-card text-foreground"
                                >
                                    <div className="mb-2 text-xs font-semibold">
                                        Filters
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {!isPassenger && (
                                            <>
                                                <label className="text-[12px]">
                                                    Passenger
                                                </label>
                                                <select
                                                    className="w-full rounded border px-2 py-1 text-sm"
                                                    onChange={(e) => {
                                                        const v =
                                                            e.target.value;
                                                        if (!v)
                                                            table
                                                                .getColumn(
                                                                    "assignedTo",
                                                                )
                                                                ?.setFilterValue(
                                                                    [],
                                                                );
                                                        else
                                                            table
                                                                .getColumn(
                                                                    "assignedTo",
                                                                )
                                                                ?.setFilterValue(
                                                                    [v],
                                                                );
                                                    }}
                                                    defaultValue=""
                                                >
                                                    <option value="">
                                                        All
                                                    </option>
                                                    {staffOptions.map(
                                                        (name) => (
                                                            <option
                                                                key={name}
                                                                value={name}
                                                            >
                                                                {name}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </>
                                        )}

                                        <label className="text-[12px]">
                                            Stations
                                        </label>
                                        <select
                                            className="w-full rounded border px-2 py-1 text-sm"
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (!v)
                                                    table
                                                        .getColumn("site")
                                                        ?.setFilterValue([]);
                                                else
                                                    table
                                                        .getColumn("site")
                                                        ?.setFilterValue([v]);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="">All</option>
                                            {siteOptions.map((s) => (
                                                <option key={s} value={s}>
                                                    {s}
                                                </option>
                                            ))}
                                        </select>

                                        <label className="text-[12px]">
                                            Status
                                        </label>
                                        <select
                                            className="w-full rounded border px-2 py-1 text-sm"
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (!v)
                                                    table
                                                        .getColumn("status")
                                                        ?.setFilterValue([]);
                                                else
                                                    table
                                                        .getColumn("status")
                                                        ?.setFilterValue([v]);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="">All</option>
                                            {STATUS_OPTIONS.map((s) => (
                                                <option
                                                    key={s.value}
                                                    value={s.value}
                                                >
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>

                                        <label className="text-[12px]">
                                            Payment Method
                                        </label>
                                        <select
                                            className="w-full rounded border px-2 py-1 text-sm"
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (!v)
                                                    table
                                                        .getColumn("type")
                                                        ?.setFilterValue([]);
                                                else
                                                    table
                                                        .getColumn("type")
                                                        ?.setFilterValue([v]);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="">All</option>
                                            {TYPE_OPTIONS.map((t) => (
                                                <option
                                                    key={t.value}
                                                    value={t.value}
                                                >
                                                    {t.label}
                                                </option>
                                            ))}
                                        </select>

                                        <label className="text-[12px]">
                                            Payment
                                        </label>
                                        <select
                                            className="w-full rounded border px-2 py-1 text-sm"
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (!v)
                                                    table
                                                        .getColumn(
                                                            "paymentStatus",
                                                        )
                                                        ?.setFilterValue([]);
                                                else
                                                    table
                                                        .getColumn(
                                                            "paymentStatus",
                                                        )
                                                        ?.setFilterValue([v]);
                                            }}
                                            defaultValue=""
                                        >
                                            <option value="">All</option>
                                            <option value="paid">Paid</option>
                                            <option value="pending">
                                                Pending
                                            </option>
                                            <option value="failed">
                                                Failed
                                            </option>
                                            <option value="refunded">
                                                Refunded
                                            </option>
                                            <option value="none">None</option>
                                        </select>

                                        <div className="flex items-center gap-2 pt-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    table
                                                        .getColumn("status")
                                                        ?.setFilterValue([]);
                                                    table
                                                        .getColumn("type")
                                                        ?.setFilterValue([]);
                                                    table
                                                        .getColumn(
                                                            "paymentStatus",
                                                        )
                                                        ?.setFilterValue([]);
                                                    table
                                                        .getColumn("site")
                                                        ?.setFilterValue([]);
                                                    table
                                                        .getColumn("assignedTo")
                                                        ?.setFilterValue([]);
                                                }}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </>,
                            document.body,
                        )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-foreground bg-background hover:[background:var(--button-background)] transition-colors duration-200"
                    onClick={onRefresh}
                >
                    {refreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCcw className="h-4 w-4" />
                    )}
                </Button>
                {/* page-size selector moved to pagination area */}
                {!isPassenger && (
                    <Button
                        size="sm"
                        className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors duration-200"
                        onClick={() =>
                            router.push(
                                `/${rolePath}/bookings/create-new-order`,
                            )
                        }
                    >
                        New Booking
                    </Button>
                )}
                {(roleKey === "admin" || roleKey === "manager") && (
                    <Button
                        size="sm"
                        className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors duration-200"
                        disabled={assigningUnassigned}
                        onClick={handleAutoAssignUnassigned}
                    >
                        {assigningUnassigned
                            ? "Assigning..."
                            : "Assign unassigned"}
                    </Button>
                )}
                {roleKey === "admin" && (
                    <>
                        <Button
                            size="sm"
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors duration-200"
                            disabled={generating}
                            onClick={handleGenerateAutoSchedule}
                        >
                            {generating
                                ? "Generating..."
                                : "Generate auto schedule"}
                        </Button>

                        <Button
                            size="sm"
                            className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors duration-200"
                            disabled={runningMaintenance}
                            onClick={handleRunMaintenance}
                        >
                            {runningMaintenance
                                ? "Running..."
                                : "Run maintenance"}
                        </Button>
                    </>
                )}
                {/* view mode auto-switch enabled; manual toggle removed */}
            </div>
            {(roleKey === "admin" || roleKey === "manager") &&
                (assignMessage ||
                    assignError ||
                    generateMessage ||
                    generateError ||
                    maintenanceResult ||
                    maintenanceError) && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                        {assignMessage && (
                            <span className="text-emerald-600">
                                {assignMessage}
                            </span>
                        )}
                        {assignError && (
                            <span className="text-destructive">
                                {assignError}
                            </span>
                        )}
                        {generateMessage && (
                            <span className="text-emerald-600">
                                {generateMessage}
                            </span>
                        )}
                        {generateError && (
                            <span className="text-destructive">
                                {generateError}
                            </span>
                        )}
                        {maintenanceResult && (
                            <span className="text-emerald-600 block">
                                Maintenance finished — summary written to
                                console / returned by API
                            </span>
                        )}
                        {maintenanceError && (
                            <span className="text-destructive block">
                                {maintenanceError}
                            </span>
                        )}
                    </div>
                )}
        </div>
    );
}

const DataTablePagination = ({ table }: { table: any }) => {
    return (
        <div className="flex w-full flex-col items-center gap-1 px-2 py-2 md:flex-row md:flex-wrap md:justify-between">
            <div className="flex items-center gap-2">
                <div className="text-[10px] sm:text-xs text-muted-foreground">
                    Total {table.getFilteredRowModel().rows.length} items
                </div>
            </div>
            <div className="flex w-full items-center gap-2 overflow-x-auto whitespace-nowrap">
                <div className="flex items-center justify-start gap-1">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-1.5"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Prev
                    </Button>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{" "}
                        {table.getPageCount() || 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px]"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-1.5"
                        onClick={() =>
                            table.setPageIndex(table.getPageCount() - 1)
                        }
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="ml-2">
                    <select
                        className="h-7 rounded border px-2 text-[10px] sm:text-xs"
                        value={String(table.getState().pagination.pageSize)}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v === "all") {
                                const total =
                                    table.getFilteredRowModel().rows.length ||
                                    1;
                                table.setPageSize(total);
                                table.setPageIndex(0);
                            } else {
                                const n = Number(v) || 7;
                                table.setPageSize(n);
                                table.setPageIndex(0);
                            }
                        }}
                    >
                        <option value="7">7 / page</option>
                        <option value="20">20 / page</option>
                        <option value="50">50 / page</option>
                        <option value="all">All</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

const DataTableViewOptions = ({ table }: { table: any }) => {
    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="hidden h-9 gap-2 md:flex"
                >
                    <Settings2 className="h-4 w-4" /> View
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
                align="end"
                className={cn("w-48", MENU_BG_CLASS)}
            >
                <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                    Toggle columns
                </DropdownMenu.Label>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                {table
                    .getAllColumns()
                    .filter(
                        (column: any) =>
                            typeof column.accessorFn !== "undefined" &&
                            column.getCanHide(),
                    )
                    .map((column: any) => {
                        return (
                            <DropdownMenu.CheckboxItem
                                key={column.id}
                                className="capitalize px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                                checked={column.getIsVisible()}
                                onCheckedChange={(value) =>
                                    column.toggleVisibility(!!value)
                                }
                            >
                                {column.id}
                            </DropdownMenu.CheckboxItem>
                        );
                    })}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    );
};

const WorkOrdersDataTable = ({
    data,
    onRefresh,
    refreshing,
    initialView,
}: {
    data: WorkOrderRow[];
    onRefresh: () => void;
    refreshing: boolean;
    initialView?: string;
}) => {
    const router = useRouter();
    const { data: session } = useSession();
    const viewerRole = String((session as any)?.user?.role || "").toLowerCase();
    const [isMobile, setIsMobile] = useState(false);
    const useCards = isMobile && initialView === "cards";
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        {},
    );
    // Global search input used to OR-match taskNumber, site, title, NE name and assignee
    const [globalFilter, setGlobalFilter] = useState<string>("");
    const [rowSelection, setRowSelection] = useState({});
    const [supervisorTechs, setStaffTechs] = useState<any[]>([]);
    const [supervisorTeam, setStaffTeam] = useState<any[]>([]);
    const [managerManager, setManagerManager] = useState<any[]>([]);
    const [assigning, setAssigning] = useState(false);
    const [assignMessage, setAssignMessage] = useState<string | null>(null);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [adminManager, setAdminManager] = useState<any[]>([]);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(max-width: 767.98px)");
        const apply = (e: MediaQueryListEvent | MediaQueryList) => {
            setIsMobile((e as MediaQueryList).matches ?? (e as any).matches);
        };
        apply(mq);
        if (mq.addEventListener) mq.addEventListener("change", apply as any);
        else mq.addListener(apply as any);
        return () => {
            if (mq.removeEventListener)
                mq.removeEventListener("change", apply as any);
            else mq.removeListener(apply as any);
        };
    }, []);

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            globalFilter,
        },
        initialState: { pagination: { pageSize: 7 } },
        enableRowSelection: true,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: setGlobalFilter,
        // global filter: OR across a set of important fields
        globalFilterFn: (row, _columnId, filterValue: string) => {
            if (!filterValue) return true;
            const q = String(filterValue).toLowerCase().trim();
            const get = (k: string) =>
                String((row.original as any)[k] ?? "").toLowerCase();
            return (
                get("taskNumber").includes(q) ||
                get("site").includes(q) ||
                get("title").includes(q) ||
                get("assignedTo").includes(q)
            );
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    // Load supervisor passengers & groups (team) for assign/reassign actions (supervisor view)
    useEffect(() => {
        if (viewerRole !== "supervisor") return;
        (async () => {
            try {
                const res = await fetch("/api/debug/supervisor-report");
                if (!res.ok) return;
                const data = await res.json();
                setStaffTechs(data.passengers || []);
                if (Array.isArray(data.team)) {
                    const byName = new Map<string, any>();
                    for (const raw of data.team as any[]) {
                        const name = String(raw?.name || "").trim();
                        if (!name) continue;
                        // Only keep Group-* style team for assignment
                        const m = name.match(/^group-(\d+)$/i);
                        if (!m) continue;
                        const norm = `group-${m[1]}`; // normalized key
                        if (!byName.has(norm)) {
                            byName.set(norm, raw);
                        }
                    }
                    // Sort by group index: Group-1, Group-2, ...
                    const uniqueGroups = Array.from(byName.values()).sort(
                        (a, b) => {
                            const na = String(a.name || "");
                            const nb = String(b.name || "");
                            const ma = na.match(/(\d+)/);
                            const mb = nb.match(/(\d+)/);
                            const ia = ma ? parseInt(ma[1], 10) : 0;
                            const ib = mb ? parseInt(mb[1], 10) : 0;
                            return ia - ib;
                        },
                    );
                    setStaffTeam(uniqueGroups);
                }
            } catch (e) {
                // ignore debug errors
            }
        })();
    }, [viewerRole]);

    // Load manager's supervisors for assign/reassign actions (manager view).
    // Use the same organization data and filtering logic as the Team page
    // so the list exactly matches the manager's Manager section there.
    useEffect(() => {
        if (viewerRole !== "manager") return;
        (async () => {
            try {
                const orgRes = await fetch("/api/team/organization");
                if (!orgRes.ok) return;
                const organization = await orgRes.json();

                const me = (session as any)?.user as any;
                if (!me) return;
                const userRegions: string[] = me.assignedRegion || [];

                const visibleOrg: any = {};
                Object.entries(organization || {}).forEach(
                    ([regionCode, region]: any) => {
                        if (
                            region?.manager?.id === me.id ||
                            userRegions.includes(regionCode as string)
                        ) {
                            visibleOrg[regionCode] = region;
                        }
                    },
                );

                const out: any[] = [];
                Object.entries(visibleOrg).forEach(
                    ([regionCode, region]: any) => {
                        Object.entries(region.areas || {}).forEach(
                            ([areaName, supervisors]: any) => {
                                (supervisors || []).forEach((s: any) => {
                                    out.push({
                                        ...s,
                                        areaName,
                                        regionCode,
                                    });
                                });
                            },
                        );
                    },
                );

                if (out.length > 0) {
                    setManagerManager(out);
                    return;
                }

                // Fallback: load supervisors and filter by manager's assigned zones/regions
                const regionParam =
                    Array.isArray(me?.assignedRegion) && me.assignedRegion[0]
                        ? `&regionId=${me.assignedRegion[0]}`
                        : "";
                const zoneParam =
                    Array.isArray(me?.assignedZone) && me.assignedZone[0]
                        ? `&zoneId=${me.assignedZone[0]}`
                        : "";
                const [supervisorRes, zonesRes, regionsRes] = await Promise.all(
                    [
                        fetch(
                            `/api/users?role=supervisor${regionParam}${zoneParam}`,
                        ),
                        fetch("/api/zones"),
                        fetch("/api/regions"),
                    ],
                );
                if (!supervisorRes.ok) return;
                const supervisors = await supervisorRes.json();
                const zones = zonesRes.ok ? await zonesRes.json() : [];
                const regions = regionsRes.ok ? await regionsRes.json() : [];

                const zoneByName = new Map(
                    (zones || []).map((z: any) => [
                        String(z.name || "").toLowerCase(),
                        z.id,
                    ]),
                );
                const regionByName = new Map(
                    (regions || []).map((r: any) => [
                        String(r.name || "").toLowerCase(),
                        r.id,
                    ]),
                );

                const allowedZoneIds = Array.isArray(me.assignedZone)
                    ? me.assignedZone
                    : [];
                const allowedRegionIds = Array.isArray(me.assignedRegion)
                    ? me.assignedRegion
                    : [];

                const normalizeZoneIds = (values: any[]) =>
                    (values || [])
                        .map((v) => {
                            const s = String(v || "").trim();
                            return (
                                zones.find((z: any) => z.id === s)?.id ||
                                zoneByName.get(s.toLowerCase()) ||
                                null
                            );
                        })
                        .filter(Boolean);

                const normalizeRegionIds = (values: any[]) =>
                    (values || [])
                        .map((v) => {
                            const s = String(v || "").trim();
                            return (
                                regions.find((r: any) => r.id === s)?.id ||
                                regionByName.get(s.toLowerCase()) ||
                                null
                            );
                        })
                        .filter(Boolean);

                const filtered = (
                    Array.isArray(supervisors) ? supervisors : []
                ).filter((s: any) => {
                    const supZones = normalizeZoneIds(s.assignedZone || []);
                    const supRegions = normalizeRegionIds(
                        s.assignedRegion || [],
                    );

                    if (allowedZoneIds.length) {
                        return supZones.some((z: any) =>
                            allowedZoneIds.includes(z),
                        );
                    }
                    if (allowedRegionIds.length) {
                        return supRegions.some((r: any) =>
                            allowedRegionIds.includes(r),
                        );
                    }
                    // No constraints -> include all supervisors
                    return true;
                });

                setManagerManager(filtered);
            } catch (e) {
                // ignore debug errors
            }
        })();
    }, [viewerRole, session]);

    // Load managers for admin assign/reassign actions
    useEffect(() => {
        if (viewerRole !== "admin") return;
        (async () => {
            try {
                const me = (session as any)?.user as any;
                if (!me) return;
                const regionParam2 =
                    Array.isArray(me?.assignedRegion) && me.assignedRegion[0]
                        ? `&regionId=${me.assignedRegion[0]}`
                        : "";
                const zoneParam2 =
                    Array.isArray(me?.assignedZone) && me.assignedZone[0]
                        ? `&zoneId=${me.assignedZone[0]}`
                        : "";
                const res = await fetch(
                    `/api/users?role=manager${regionParam2}${zoneParam2}`,
                );
                if (!res.ok) return;
                const data = await res.json();
                setAdminManager(Array.isArray(data) ? data : []);
            } catch (e) {
                // ignore
            }
        })();
    }, [viewerRole, session]);

    const selectedRows = table.getSelectedRowModel().rows || [];
    const canAdminBulkManage =
        viewerRole === "admin" && selectedRows.length >= 1;
    const handleAssignSingle = useCallback(
        async (woId: string, targetType: "user" | "team", targetId: string) => {
            if (!woId || !targetId) return;
            setAssigning(true);
            setAssignError(null);
            setAssignMessage(null);
            try {
                const res = await fetch(`/api/workorders/${woId}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify(
                        targetType === "team"
                            ? { teamId: targetId, assignedToId: null }
                            : { assignedToId: targetId, teamId: null },
                    ),
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to update booking");
                }
                setAssignMessage("Booking updated successfully.");
                onRefresh();
            } catch (e: any) {
                setAssignError(e?.message || "Failed to assign booking");
            } finally {
                setAssigning(false);
            }
        },
        [onRefresh],
    );

    const handleAdminDelete = useCallback(async () => {
        if (!canAdminBulkManage || !selectedRows.length) return;
        setDeleting(true);
        setAssignError(null);
        setAssignMessage(null);
        try {
            let successCount = 0;
            for (const row of selectedRows) {
                const wo = row.original as WorkOrderRow;
                const res = await fetch(`/api/workorders/${wo.id}`, {
                    method: "DELETE",
                });
                if (res.ok) {
                    const json = await res.json().catch(() => null);
                    const deletedCount =
                        json && typeof json.deleted === "number"
                            ? json.deleted
                            : 1;
                    successCount += deletedCount;
                } else {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to delete booking");
                }
            }
            setAssignMessage(
                `Deleted ${successCount} booking${
                    successCount === 1 ? "" : "s"
                } successfully.`,
            );
            onRefresh();
        } catch (e: any) {
            setAssignError(e?.message || "Failed to delete selected bookings");
        } finally {
            setDeleting(false);
        }
    }, [canAdminBulkManage, selectedRows, onRefresh]);

    const assignContextValue = React.useMemo(
        () => ({
            viewerRole,
            supervisorTechs,
            supervisorTeam,
            managerManager,
            adminManager,
            assigning,
            onAssign: handleAssignSingle,
        }),
        [
            viewerRole,
            supervisorTechs,
            supervisorTeam,
            managerManager,
            adminManager,
            assigning,
            handleAssignSingle,
        ],
    );

    return (
        <AssignContext.Provider value={assignContextValue}>
            <div className="flex flex-col gap-2">
                <DataTableToolbar
                    table={table}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                />
                {viewerRole === "admin" && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] leading-tight">
                        <div className="text-muted-foreground">
                            {selectedRows.length === 0
                                ? "Select one or more bookings to manage."
                                : `Selected: ${selectedRows.length} bookings.`}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2 text-[11px] py-1 rounded"
                                disabled={!canAdminBulkManage || deleting}
                                onClick={handleAdminDelete}
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </Button>
                        </div>
                    </div>
                )}
                {useCards ? (
                    <WorkOrderCardsView data={data} />
                ) : (
                    <div className="w-full max-w-none overflow-x-auto rounded-md border">
                        <Table>
                            <table className="min-w-full w-full table-auto text-[11px] leading-tight">
                                <TableHeader>
                                    {table
                                        .getHeaderGroups()
                                        .map((headerGroup) => (
                                            <TableRow key={headerGroup.id}>
                                                {headerGroup.headers.map(
                                                    (header) => {
                                                        const hideOnMobile = [
                                                            "paymentStatus",
                                                            "scheduledWindow",
                                                        ].includes(header.id);
                                                        return (
                                                            <TableHead
                                                                key={header.id}
                                                                colSpan={
                                                                    header.colSpan
                                                                }
                                                                className={`text-[11px] leading-tight ${
                                                                    hideOnMobile
                                                                        ? "hidden md:table-cell"
                                                                        : ""
                                                                }`}
                                                            >
                                                                {header.isPlaceholder
                                                                    ? null
                                                                    : flexRender(
                                                                          header
                                                                              .column
                                                                              .columnDef
                                                                              .header,
                                                                          header.getContext(),
                                                                      )}
                                                            </TableHead>
                                                        );
                                                    },
                                                )}
                                            </TableRow>
                                        ))}
                                </TableHeader>
                                <TableBody>
                                    {table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className={
                                                row.original.isNew
                                                    ? "bg-emerald-50 text-emerald-800"
                                                    : undefined
                                            }
                                        >
                                            {row
                                                .getVisibleCells()
                                                .map((cell) => {
                                                    const hideOnMobile = [
                                                        "paymentStatus",
                                                        "scheduledWindow",
                                                    ].includes(cell.column.id);
                                                    return (
                                                        <TableCell
                                                            key={cell.id}
                                                            className={`text-[11px] leading-snug ${
                                                                hideOnMobile
                                                                    ? "hidden md:table-cell"
                                                                    : ""
                                                            }`}
                                                        >
                                                            {flexRender(
                                                                cell.column
                                                                    .columnDef
                                                                    .cell,
                                                                cell.getContext(),
                                                            )}
                                                        </TableCell>
                                                    );
                                                })}
                                        </TableRow>
                                    ))}
                                    {table.getRowModel().rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={columns.length}
                                                className="h-24 px-2 py-1.5 text-center text-muted-foreground text-[11px] leading-snug"
                                            >
                                                No bookings found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </table>
                        </Table>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <DataTablePagination table={table} />
                </div>
                {(assignMessage || assignError) && (
                    <div className="text-[10px] text-muted-foreground">
                        {assignMessage && (
                            <span className="text-emerald-600">
                                {assignMessage}
                            </span>
                        )}
                        {assignError && (
                            <span className="text-destructive">
                                {assignError}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </AssignContext.Provider>
    );
};

const mapWorkOrders = (list: any[]): WorkOrderRow[] => {
    return (list || []).map((booking) => {
        const rawStatus = String(booking.status || "pending").toLowerCase();
        const statusOption = STATUS_OPTIONS.find((s) => s.value === rawStatus);
        const statusValue = statusOption ? statusOption.value : "pending";

        const origin = booking.trip?.route?.origin?.name || "-";
        const destination = booking.trip?.route?.destination?.name || "-";
        const originCode = booking.trip?.route?.origin?.code || "";
        const destinationCode = booking.trip?.route?.destination?.code || "";
        const routeLabel = `${origin} → ${destination}`;
        const stationLabel =
            originCode || destinationCode
                ? `${origin} (${originCode}) → ${destination} (${destinationCode})`
                : routeLabel;

        const busPlate = booking.trip?.bus?.plateNumber || "-";
        const busModel = booking.trip?.bus?.model || "";
        const busLabel = busModel ? `${busPlate} • ${busModel}` : busPlate;
        const bookedSeats = Array.isArray(booking.seats)
            ? booking.seats.length
            : 0;
        const busSeatCount = booking.trip?.bus?.seatCount ?? null;

        const passengerLabel =
            booking.passenger?.name || booking.passenger?.email || "-";

        const paymentMethod = String(
            booking.payment?.method || "unknown",
        ).toLowerCase();
        const paymentStatus = mapPaymentStatus(booking.payment?.status);

        const bookingRef =
            booking.bookingRef || `BK-${String(booking.id).slice(0, 8)}`;

        return {
            id: booking.id,
            taskNumber: bookingRef,
            title: routeLabel,
            status: statusValue as StatusKey,
            type: paymentMethod,
            team: busLabel,
            site: stationLabel,
            assignedTo: passengerLabel,
            paymentStatus,
            scheduledWindow: formatSchedule(
                booking.trip?.departAt,
                booking.trip?.arriveAt,
            ),
            bookedSeats,
            busSeatCount,
            scheduledStartAt: booking.trip?.departAt || null,
            scheduledEndAt: booking.trip?.arriveAt || null,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
            delayDays: (() => {
                try {
                    const refIso = booking.trip?.departAt || booking.createdAt;
                    if (!refIso) return 0;
                    const ref = new Date(refIso);
                    if (isNaN(ref.getTime())) return 0;
                    const now = new Date();
                    const diffMs = Math.max(0, now.getTime() - ref.getTime());
                    return diffMs / (1000 * 60 * 60 * 24);
                } catch (e) {
                    return 0;
                }
            })(),
            isNew: (() => {
                try {
                    if (!booking.createdAt) return false;
                    const created = new Date(booking.createdAt);
                    if (isNaN(created.getTime())) return false;
                    const now = new Date();
                    const diffMs = now.getTime() - created.getTime();
                    return diffMs >= 0 && diffMs < 1000 * 60 * 60;
                } catch (e) {
                    return false;
                }
            })(),
            archived: false,
            isAutoCreated: false,
        } as WorkOrderRow;
    });
};

export function WorkOrdersTableClient() {
    const { data: session, status } = useSession();
    const searchParams = useSearchParams();
    const newCreatedId = String(searchParams?.get("new") || "");
    const statusFilter = String(searchParams?.get("status") || "");
    const [rows, setRows] = useState<WorkOrderRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const me = session?.user as any;
    const roleKey = String(me?.role || "").toLowerCase();
    const rolePath =
        roleKey === "admin"
            ? "admin"
            : roleKey === "manager"
              ? "manager"
              : roleKey === "supervisor"
                ? "supervisor"
                : "passenger";

    const fetchData = useCallback(async () => {
        if (!session || !session.user) return;
        setRefreshing(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.set("take", "500");
            if (statusFilter) {
                params.set("status", statusFilter);
            }
            const res = await fetch(`/api/bookings?${params.toString()}`, {
                cache: "no-store",
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error(
                    "[WorkOrdersTable] Fetch failed:",
                    res.status,
                    text,
                );
                throw new Error(
                    text || `Failed to fetch bookings (status ${res.status})`,
                );
            }
            const json = await res.json();
            const mapped = mapWorkOrders(json || []);
            // sort by delay (highest overdue first) for manager/supervisor/admin
            try {
                const me = session?.user as any;
                const roleKey = String(me?.role || "").toLowerCase();
                if (
                    roleKey === "manager" ||
                    roleKey === "supervisor" ||
                    roleKey === "admin"
                ) {
                    mapped.sort(
                        (a, b) => (b.delayDays || 0) - (a.delayDays || 0),
                    );
                }
            } catch (e) {
                // ignore
            }
            // If a `new` query param was provided, mark the matching row as new
            try {
                if (newCreatedId) {
                    for (const m of mapped) {
                        if (
                            String(m.id) === String(newCreatedId) ||
                            String(m.taskNumber) === String(newCreatedId)
                        ) {
                            m.isNew = true;
                            break;
                        }
                    }
                }
            } catch (e) {
                /* ignore */
            }
            setRows(mapped);
        } catch (err: any) {
            if (err?.name === "AbortError") return;
            console.error("Failed to load bookings", err);
            setError(err?.message || "Failed to load bookings");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [newCreatedId, statusFilter, session]);

    useEffect(() => {
        if (status === "authenticated") {
            setLoading(true);
            fetchData();
        }
    }, [status, fetchData]);

    useEffect(() => {
        if (status === "unauthenticated") {
            setRows([]);
            setLoading(false);
        }
    }, [status]);

    const headerTitle = useMemo(() => {
        const me = session?.user as any;
        const roleKey = String(me?.role || "").toLowerCase();
        if (!roleKey) return "Bookings";
        if (roleKey === "passenger" || roleKey === "technician") {
            return "My Bookings";
        }
        const labelMap: Record<string, string> = {
            admin: "Admin",
            manager: "Manager",
            supervisor: "Staff",
            staff: "Staff",
        };
        const label = labelMap[roleKey] || roleKey;
        return `Bookings · ${label}`;
    }, [session]);

    if (status === "loading" || loading) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">
                            {headerTitle}
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Loading bookings...
                        </p>
                    </div>
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
                <div className="rounded border bg-card p-8 text-center text-muted-foreground">
                    Fetching latest data...
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="rounded border bg-card p-6 text-center">
                <p className="mb-3 text-muted-foreground">
                    You need to log in to view bookings.
                </p>
                <Button onClick={() => (window.location.href = "/login")}>
                    Go to Login
                </Button>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex flex-col gap-1 text-[12px] leading-snug">
                <h2 className="text-lg font-semibold tracking-tight">
                    {headerTitle}
                </h2>
            </div>

            <div className="w-full max-w-none rounded-lg border bg-card p-2.5 shadow-sm text-[11px] leading-tight">
                <WorkOrdersDataTable
                    data={rows}
                    onRefresh={fetchData}
                    refreshing={refreshing}
                    initialView="table"
                />
                {error && (
                    <div className="mt-3 rounded border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
