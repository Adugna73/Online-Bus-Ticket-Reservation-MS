"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, ClipboardList, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, User, AlertTriangle, DollarSign, Phone, Send, Eye } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type MaintenanceItem = {
    id: string;
    status: string;
    description: string | null;
    partsNeedingMaintenance: string | null;
    mechanicNotes: string | null;
    rejectionReason: string | null;
    costRejectedReason: string | null;
    paymentTxRef: string | null;
    telebirrRef: string | null;
    telebirrAmount: number | null;
    scheduledDate: string | null;
    completedDate: string | null;
    driverAcceptedAt: string | null;
    busReleasedAt: string | null;
    estimatedCost: number | null;
    actualCost: number | null;
    acceptedAt: string | null;
    bus: { id: string; plateNumber: string; model: string | null; driverName: string | null };
    garage: { name: string };
    requestedBy: { fullName: string } | null;
    assignedMechanic: { id: string; name: string; position: string; phone: string | null } | null;
    driver: { id: string; fullName: string; email: string } | null;
    createdAt: string;
};

type Mechanic = {
    id: string;
    name: string;
    position: string;
    phone: string | null;
};

const STATUS_COLORS: Record<string, string> = {
    REQUESTED: "bg-amber-100 text-amber-700 border-amber-300",
    ACCEPTED: "bg-blue-100 text-blue-700 border-blue-300",
    NOT_FIXABLE: "bg-red-100 text-red-700 border-red-300",
    COST_PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300",
    COST_APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    SCHEDULED: "bg-purple-100 text-purple-700 border-purple-300",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-300",
    PARTS_ORDERED: "bg-indigo-100 text-indigo-700 border-indigo-300",
    REPAIR_DONE: "bg-teal-100 text-teal-700 border-teal-300",
    AWAITING_PAYMENT: "bg-violet-100 text-violet-700 border-violet-300",
    PAID: "bg-green-100 text-green-700 border-green-300",
    BUS_READY: "bg-sky-100 text-sky-700 border-sky-300",
    DRIVER_ACCEPTED: "bg-cyan-100 text-cyan-700 border-cyan-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    CANCELLED: "bg-gray-100 text-gray-700 border-gray-300",
};

const STATUS_LABELS: Record<string, string> = {
    REQUESTED: "New Request",
    ACCEPTED: "Accepted",
    NOT_FIXABLE: "Not Fixable",
    COST_PENDING: "Awaiting Cost Approval",
    COST_APPROVED: "Cost Approved",
    SCHEDULED: "Scheduled",
    IN_PROGRESS: "In Progress",
    PARTS_ORDERED: "Parts Ordered",
    REPAIR_DONE: "Repair Done",
    AWAITING_PAYMENT: "Awaiting Payment",
    PAID: "Paid",
    BUS_READY: "Bus Ready",
    DRIVER_ACCEPTED: "Driver Accepted",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
};

function formatDate(v?: string | null) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function MaintenancePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const role = String((session?.user as any)?.role || "").toLowerCase();
    const isOwner = role === "garage_owner";
    const isAdmin = role === "admin" || role === "supervisor";

    const [items, setItems] = useState<MaintenanceItem[]>([]);
    const [mechanics, setMechanics] = useState<Mechanic[]>([]);
    const [drivers, setDrivers] = useState<{ id: string; fullName: string }[]>([]);
    const [driverSelects, setDriverSelects] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actualCostInputs, setActualCostInputs] = useState<Record<string, string>>({});

    const loadData = async () => {
        try {
            const [mRes, mechRes, driverRes] = await Promise.all([
                fetch("/api/vehicle-maintenance", { credentials: "include" }),
                fetch("/api/mechanics", { credentials: "include" }),
                fetch("/api/users?role=driver", { credentials: "include" }),
            ]);
            if (mRes.ok) setItems(await mRes.json());
            if (mechRes.ok) setMechanics(await mechRes.json());
            if (driverRes.ok) setDrivers(await driverRes.json());
        } catch {
            toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "unauthenticated") { router.replace("/login"); return; }
        if (status !== "authenticated") return;
        loadData();
    }, [status, router]);

    const updateStatus = async (id: string, data: any) => {
        setActionLoading(id);
        try {
            const res = await fetch("/api/vehicle-maintenance", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...data }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d?.error || "Failed");
            }
            toast({ title: "Updated" });
            setActualCostInputs((prev) => { const n = { ...prev }; delete n[id]; return n; });
            await loadData();
        } catch (err: any) {
            toast({ title: "Error", description: err?.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-700">
                        <ClipboardList className="h-3.5 w-3.5" /> Maintenance
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                        {isOwner ? "Maintenance Requests" : "Maintenance Tracking"}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {isOwner ? "Inspect, estimate costs, assign mechanics, review work, and notify for payment." : "Track bus maintenance across all garages."}
                    </p>
                </div>

                {items.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                            <p className="font-medium">No maintenance records</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {items.map((m) => {
                            const isExpanded = expandedId === m.id;
                            const isPending = m.status === "REQUESTED";
                            const isAccepted = m.status === "ACCEPTED";
                            const isActive = !["REPAIR_DONE", "COMPLETED", "CANCELLED", "NOT_FIXABLE", "AWAITING_PAYMENT", "PAID", "BUS_READY", "DRIVER_ACCEPTED"].includes(m.status) && !isPending;
                            const isOwnerActive = isActive || m.status === "COST_PENDING";
                            return (
                                <div key={m.id} className="rounded-lg border overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30"
                                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                            <div>
                                                <div className="font-medium">{m.bus?.plateNumber || "—"}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {m.bus?.model || ""} • {m.garage?.name}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {m.assignedMechanic && (
                                                <span className="text-xs text-muted-foreground">
                                                    <User className="inline h-3 w-3 mr-1" />
                                                    {m.assignedMechanic.name}
                                                </span>
                                            )}
                                            <Badge className={STATUS_COLORS[m.status] || ""}>
                                                {STATUS_LABELS[m.status] || m.status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t bg-muted/10 p-4">
                                            <div className="grid gap-4 md:grid-cols-2 text-sm">
                                                <div className="space-y-2">
                                                    <div><span className="text-muted-foreground">Bus:</span> {m.bus?.plateNumber} ({m.bus?.model || "—"})</div>
                                                    <div><span className="text-muted-foreground">Driver:</span> {m.bus?.driverName || "—"}</div>
                                                    <div><span className="text-muted-foreground">Garage:</span> {m.garage?.name}</div>
                                                    <div><span className="text-muted-foreground">Requested by:</span> {m.requestedBy?.fullName || "—"}</div>
                                                    <div><span className="text-muted-foreground">Assigned Driver:</span> {m.driver?.fullName || m.bus?.driverName || "—"}</div>
                                                    <div><span className="text-muted-foreground">Created:</span> {formatDate(m.createdAt)}</div>
                                                    {m.acceptedAt && (
                                                        <div><span className="text-muted-foreground">Accepted:</span> {formatDate(m.acceptedAt)}</div>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <div><span className="text-muted-foreground">Parts needed:</span> {m.partsNeedingMaintenance || "—"}</div>
                                                    <div><span className="text-muted-foreground">Description:</span> {m.description || "—"}</div>
                                                    <div><span className="text-muted-foreground">Scheduled:</span> {formatDate(m.scheduledDate)}</div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-muted-foreground">Est. Cost:</span>
                                                        <span className="font-medium">{m.estimatedCost != null ? `${m.estimatedCost.toLocaleString()} ETB` : "—"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-muted-foreground">Actual Cost:</span>
                                                        <span className={`font-medium ${m.actualCost != null ? "text-emerald-600" : ""}`}>
                                                            {m.actualCost != null ? `${m.actualCost.toLocaleString()} ETB` : "—"}
                                                        </span>
                                                    </div>
                                                    {m.paymentTxRef && (
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-muted-foreground">Tx Ref:</span>
                                                            <span className="font-mono text-xs">{m.paymentTxRef}</span>
                                                        </div>
                                                    )}
                                                    {m.telebirrRef && (
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-muted-foreground">Telebirr:</span>
                                                            <span className="font-mono text-xs">{m.telebirrRef}</span>
                                                            {m.telebirrAmount != null && (
                                                                <span className="text-emerald-600 font-medium text-xs">{m.telebirrAmount.toLocaleString()} ETB</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {m.rejectionReason && (
                                                <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                                                    Not fixable: {m.rejectionReason}
                                                </div>
                                            )}

                                            {m.costRejectedReason && (
                                                <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                                                    <DollarSign className="inline h-4 w-4 mr-1" />
                                                    Cost rejected by admin: {m.costRejectedReason}
                                                </div>
                                            )}

                                            {m.mechanicNotes && (
                                                <div className="mt-2 text-xs text-muted-foreground italic">
                                                    Mechanic notes: {m.mechanicNotes}
                                                </div>
                                            )}

                                            {m.completedDate && m.assignedMechanic && (
                                                <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
                                                    <div className="font-medium text-emerald-700 flex items-center gap-2">
                                                        <CheckCircle className="h-4 w-4" /> Work Completed
                                                    </div>
                                                    <div className="mt-1 text-xs space-y-0.5">
                                                        <div>Completed by: <span className="font-medium">{m.assignedMechanic.name}</span> ({m.assignedMechanic.position})</div>
                                                        {m.assignedMechanic.phone && (
                                                            <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {m.assignedMechanic.phone}</div>
                                                        )}
                                                        <div>Date: {formatDate(m.completedDate)}</div>
                                                        {m.mechanicNotes && <div>Remarks: {m.mechanicNotes}</div>}
                                                    </div>
                                                </div>
                                            )}

                                            {m.driverAcceptedAt && (
                                                <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                                                    <CheckCircle className="inline h-4 w-4 mr-1" />
                                                    Driver accepted pickup: {m.bus?.driverName || "Driver"} at {formatDate(m.driverAcceptedAt)}
                                                </div>
                                            )}

                                            {/* Assign mechanic section */}
                                            {isOwner && isOwnerActive && (
                                                <div className="mt-3 pt-3 border-t">
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className="text-xs text-muted-foreground mr-1">Assign mechanic:</span>
                                                        <select
                                                            className="h-8 rounded border px-2 text-xs bg-background"
                                                            value={m.assignedMechanic?.id || ""}
                                                            onChange={(e) => {
                                                                const mechId = e.target.value;
                                                                setActionLoading(m.id);
                                                                fetch("/api/vehicle-maintenance", {
                                                                    method: "PATCH", credentials: "include",
                                                                    headers: { "Content-Type": "application/json" },
                                                                    body: JSON.stringify({ id: m.id, assignedMechanicId: mechId || null }),
                                                                }).then(() => loadData()).finally(() => setActionLoading(null));
                                                            }}
                                                            disabled={actionLoading === m.id}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="">— Unassigned —</option>
                                                            {mechanics.map((mech) => (
                                                                <option key={mech.id} value={mech.id}>{mech.name} ({mech.position})</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                                                        <Input
                                                            className="h-8 w-32 text-xs"
                                                            type="number"
                                                            placeholder="Actual cost"
                                                            value={actualCostInputs[m.id] ?? (m.actualCost != null ? String(m.actualCost) : "")}
                                                            onChange={(e) => setActualCostInputs({ ...actualCostInputs, [m.id]: e.target.value })}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <Button
                                                            size="sm" variant="ghost" className="h-8 text-xs"
                                                            onClick={(e) => { e.stopPropagation(); const cost = actualCostInputs[m.id]; updateStatus(m.id, { actualCost: cost ? Number(cost) : null }); }}
                                                            disabled={actionLoading === m.id}
                                                        >
                                                            Set Cost
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">
                                                {/* Accept */}
                                                {isOwner && isPending && (
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "ACCEPTED", acceptedAt: new Date().toISOString() }); }} disabled={actionLoading === m.id}>
                                                        <CheckCircle className="h-3 w-3 mr-1" /> Accept Request
                                                    </Button>
                                                )}

                                                {/* After accept: inspect, set cost, submit for approval */}
                                                {isOwner && isAccepted && (
                                                    <>
                                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); const cost = actualCostInputs[m.id] || m.actualCost; updateStatus(m.id, { status: "COST_PENDING", actualCost: cost ? Number(cost) : m.actualCost }); }} disabled={actionLoading === m.id}>
                                                            <Send className="h-3 w-3 mr-1" /> Submit Cost for Approval
                                                        </Button>
                                                        <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); const reason = prompt("Why can't this be fixed?"); if (reason) updateStatus(m.id, { status: "NOT_FIXABLE", rejectionReason: reason }); }} disabled={actionLoading === m.id}>
                                                            <AlertTriangle className="h-3 w-3 mr-1" /> Not Fixable
                                                        </Button>
                                                    </>
                                                )}

                                                {/* Cost rejected by admin - re-submit */}
                                                {isOwner && m.status === "COST_PENDING" && m.costRejectedReason && (
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); const cost = actualCostInputs[m.id] || m.actualCost; updateStatus(m.id, { status: "COST_PENDING", actualCost: cost ? Number(cost) : m.actualCost, costRejectedReason: null }); }} disabled={actionLoading === m.id}>
                                                        <Send className="h-3 w-3 mr-1" /> Re-Submit Cost
                                                    </Button>
                                                )}

                                                {/* Cost approved - start work */}
                                                {isOwner && m.status === "COST_APPROVED" && (
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "IN_PROGRESS" }); }} disabled={actionLoading === m.id}>
                                                        <Clock className="h-3 w-3 mr-1" /> Start Work
                                                    </Button>
                                                )}

                                                {/* Work in progress */}
                                                {isOwner && m.status === "IN_PROGRESS" && (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "PARTS_ORDERED" }); }} disabled={actionLoading === m.id}>
                                                            Parts Ordered
                                                        </Button>
                                                        <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "REPAIR_DONE", completedDate: new Date().toISOString(), busStatus: "active" }); }} disabled={actionLoading === m.id}>
                                                            <CheckCircle className="h-3 w-3 mr-1" /> Repair Done
                                                        </Button>
                                                    </>
                                                )}

                                                {isOwner && m.status === "REPAIR_DONE" && (
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "AWAITING_PAYMENT" }); }} disabled={actionLoading === m.id}>
                                                        <DollarSign className="h-3 w-3 mr-1" /> Notify Admin for Payment
                                                    </Button>
                                                )}

                                                {isOwner && m.status === "PAID" && (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <select
                                                            className="h-8 rounded border px-2 text-xs bg-background"
                                                            value={driverSelects[m.id] || m.driver?.id || ""}
                                                            onChange={(e) => setDriverSelects({ ...driverSelects, [m.id]: e.target.value })}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <option value="">Select driver...</option>
                                                            {m.bus?.driverName && (
                                                                <option value={drivers.find((d) => d.fullName === m.bus.driverName)?.id || ""}>
                                                                    {m.bus.driverName} (bus driver)
                                                                </option>
                                                            )}
                                                            {drivers
                                                                .filter((d) => d.fullName !== m.bus?.driverName)
                                                                .map((d) => (
                                                                    <option key={d.id} value={d.id}>{d.fullName}</option>
                                                                ))}
                                                        </select>
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const selectedDriverId = driverSelects[m.id] || m.driver?.id || drivers.find((d) => d.fullName === m.bus?.driverName)?.id;
                                                                if (!selectedDriverId) {
                                                                    toast({ title: "Error", description: "Please select a driver first", variant: "destructive" });
                                                                    return;
                                                                }
                                                                updateStatus(m.id, { status: "BUS_READY", driverId: selectedDriverId, busReleasedAt: new Date().toISOString() });
                                                            }}
                                                            disabled={actionLoading === m.id}
                                                        >
                                                            <Send className="h-3 w-3 mr-1" /> Assign & Release Bus
                                                        </Button>
                                                    </div>
                                                )}

                                                {isOwner && m.status === "BUS_READY" && (
                                                    <div className="text-xs text-muted-foreground py-1">
                                                        <User className="inline h-3 w-3 mr-1" />
                                                        {m.driver?.fullName || "Driver"} — waiting to accept pickup...
                                                    </div>
                                                )}

                                                {isOwner && m.status === "DRIVER_ACCEPTED" && (
                                                    <div className="text-xs text-emerald-600 py-1 flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Driver accepted — awaiting admin final confirmation
                                                    </div>
                                                )}

                                                {isOwner && m.status === "COMPLETED" && (
                                                    <div className="text-xs text-emerald-600 py-1 flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" /> Fully completed
                                                    </div>
                                                )}

                                                {isOwner && m.status === "PARTS_ORDERED" && (
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "IN_PROGRESS" }); }} disabled={actionLoading === m.id}>
                                                        <Clock className="h-3 w-3 mr-1" /> Resume Work
                                                    </Button>
                                                )}

                                                {/* After completion: notify admin for payment */}
                                                {isOwner && m.status === "COMPLETED" && (
                                                    <Button size="sm" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "AWAITING_PAYMENT" }); }} disabled={actionLoading === m.id}>
                                                        <DollarSign className="h-3 w-3 mr-1" /> Notify Admin for Payment
                                                    </Button>
                                                )}

                                                {/* Cancel actions */}
                                                {(isAdmin || isOwner) && m.status === "NOT_FIXABLE" && (
                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "CANCELLED" }); }} disabled={actionLoading === m.id}>
                                                        <XCircle className="h-3 w-3 mr-1" /> Cancel
                                                    </Button>
                                                )}
                                                {isOwner && ["REQUESTED", "COST_PENDING"].includes(m.status) && (
                                                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); updateStatus(m.id, { status: "CANCELLED" }); }} disabled={actionLoading === m.id}>
                                                        <XCircle className="h-3 w-3 mr-1" /> Cancel
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
