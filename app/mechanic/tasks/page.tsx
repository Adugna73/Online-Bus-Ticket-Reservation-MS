"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench, Clock, CheckCircle, AlertCircle, Send } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Task = {
    id: string;
    status: string;
    description: string | null;
    partsNeedingMaintenance: string | null;
    mechanicNotes: string | null;
    scheduledDate: string | null;
    estimatedCost: number | null;
    bus: { plateNumber: string; model: string | null; driverName: string | null };
    garage: { name: string };
    requestedBy: { fullName: string } | null;
    createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
    ACCEPTED: "bg-blue-100 text-blue-700 border-blue-300",
    COST_PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300",
    COST_APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-300",
    PARTS_ORDERED: "bg-indigo-100 text-indigo-700 border-indigo-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    REPAIR_DONE: "bg-teal-100 text-teal-700 border-teal-300",
    AWAITING_PAYMENT: "bg-violet-100 text-violet-700 border-violet-300",
    PAID: "bg-green-100 text-green-700 border-green-300",
    BUS_READY: "bg-sky-100 text-sky-700 border-sky-300",
    DRIVER_ACCEPTED: "bg-cyan-100 text-cyan-700 border-cyan-300",
};

const STATUS_LABELS: Record<string, string> = {
    ACCEPTED: "Accepted",
    COST_PENDING: "Cost Pending",
    COST_APPROVED: "Cost Approved",
    IN_PROGRESS: "In Progress",
    PARTS_ORDERED: "Parts Ordered",
    COMPLETED: "Completed",
    REPAIR_DONE: "Repair Done",
    AWAITING_PAYMENT: "Awaiting Payment",
    PAID: "Paid",
    BUS_READY: "Bus Ready",
    DRIVER_ACCEPTED: "Driver Accepted",
};

function formatDate(v?: string | null) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const MECHANIC_STATUS_OPTIONS: Record<string, string[]> = {
    COST_APPROVED: ["IN_PROGRESS"],
    IN_PROGRESS: ["PARTS_ORDERED", "REPAIR_DONE"],
    PARTS_ORDERED: ["IN_PROGRESS", "REPAIR_DONE"],
};

export default function MechanicTasksPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [statusSelects, setStatusSelects] = useState<Record<string, string>>({});

    const loadTasks = async () => {
        try {
            const res = await fetch("/api/vehicle-maintenance", { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            const all = await res.json();
            const filtered = all.filter((t: any) => {
                if (!t.assignedMechanic) return false;
                if (["REQUESTED", "CANCELLED", "REPAIR_DONE", "COMPLETED", "AWAITING_PAYMENT", "PAID", "BUS_READY", "DRIVER_ACCEPTED"].includes(t.status)) return false;
                return true;
            });
            setTasks(filtered);
        } catch {
            toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "unauthenticated") { router.replace("/login"); return; }
        if (status !== "authenticated") return;
        loadTasks();
    }, [status, router]);

    const handleSubmit = async (t: Task) => {
        const selectedStatus = statusSelects[t.id] || t.status;
        const noteText = notes[t.id] || undefined;

        setActionLoading(t.id);
        try {
            const body: any = {
                id: t.id,
                status: selectedStatus,
                mechanicNotes: noteText,
            };
            if (selectedStatus === "REPAIR_DONE") {
                body.completedDate = new Date().toISOString();
            }
            const res = await fetch("/api/vehicle-maintenance", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("Failed");
            toast({
                title: selectedStatus === "REPAIR_DONE"
                    ? "Repair completed — moved to owner for review"
                    : "Status updated",
            });
            setNotes((prev) => { const n = { ...prev }; delete n[t.id]; return n; });
            setStatusSelects((prev) => { const n = { ...prev }; delete n[t.id]; return n; });
            await loadTasks();
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
                    <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-[11px] font-semibold text-orange-700">
                        <Wrench className="h-3.5 w-3.5" /> My Tasks
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">Assigned Maintenance</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Update status and submit — completed tasks move to the garage owner for review.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 mb-6">
                    <Card>
                        <CardContent className="py-3">
                            <div className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-500" /> Active Tasks
                            </div>
                            <div className="text-2xl font-bold mt-1">{tasks.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="py-3">
                            <div className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-blue-500" /> Next
                            </div>
                            <div className="text-2xl font-bold mt-1">{tasks.filter((t) => MECHANIC_STATUS_OPTIONS[t.status]).length}</div>
                            <p className="text-xs text-muted-foreground">Ready for action</p>
                        </CardContent>
                    </Card>
                </div>

                {tasks.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            <Wrench className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                            <p className="font-medium">No active tasks</p>
                            <p className="mt-1 text-xs">Completed tasks have been moved to the garage owner for review.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((t) => {
                            const options = MECHANIC_STATUS_OPTIONS[t.status] || [];
                            const selectedStatus = statusSelects[t.id] || (options[0] || t.status);
                            return (
                                <div key={t.id} className="rounded-lg border bg-card p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold">{t.bus?.plateNumber || "—"}</span>
                                                <span className="text-xs text-muted-foreground">{t.bus?.model || ""}</span>
                                                <Badge className={STATUS_COLORS[t.status] || ""}>
                                                    {STATUS_LABELS[t.status] || t.status}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                <div>Garage: {t.garage?.name} | Driver: {t.bus?.driverName || "—"}</div>
                                                <div>Parts: {t.partsNeedingMaintenance || "—"}</div>
                                                <div>Description: {t.description || "—"}</div>
                                                <div>Scheduled: {formatDate(t.scheduledDate)}</div>
                                            </div>
                                            <div className="mt-3">
                                                <Textarea
                                                    className="h-16 text-xs"
                                                    placeholder="Add completion remarks..."
                                                    value={notes[t.id] || t.mechanicNotes || ""}
                                                    onChange={(e) => setNotes({ ...notes, [t.id]: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 min-w-[160px]">
                                            {options.length > 0 && (
                                                <>
                                                    <select
                                                        className="h-9 w-full rounded border px-2 text-xs bg-background"
                                                        value={selectedStatus}
                                                        onChange={(e) => setStatusSelects({ ...statusSelects, [t.id]: e.target.value })}
                                                    >
                                                        {options.map((opt) => (
                                                            <option key={opt} value={opt}>
                                                                {STATUS_LABELS[opt] || opt.replace(/_/g, " ")}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSubmit(t)}
                                                        disabled={actionLoading === t.id}
                                                    >
                                                        <Send className="h-3 w-3 mr-1" />
                                                        {actionLoading === t.id ? "Submitting..." : "Submit"}
                                                    </Button>
                                                </>
                                            )}
                                            {options.length === 0 && (
                                                <div className="text-xs text-muted-foreground text-center py-2">
                                                    Awaiting owner
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
