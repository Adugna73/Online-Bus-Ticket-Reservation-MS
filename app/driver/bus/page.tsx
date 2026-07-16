"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Bus, CheckCircle, Clock, User, Phone, MapPin } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Task = {
    id: string;
    status: string;
    description: string | null;
    partsNeedingMaintenance: string | null;
    mechanicNotes: string | null;
    telebirrRef: string | null;
    telebirrAmount: number | null;
    scheduledDate: string | null;
    completedDate: string | null;
    busReleasedAt: string | null;
    driverAcceptedAt: string | null;
    bus: { plateNumber: string; model: string | null; driverName: string | null };
    garage: { name: string; contactPhone: string | null; address: string | null };
    assignedMechanic: { name: string; position: string; phone: string | null } | null;
    createdAt: string;
};

function formatDate(v?: string | null) {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function DriverBusPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadTasks = async () => {
        try {
            const res = await fetch("/api/vehicle-maintenance", { credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            const all = await res.json();
            setTasks(all.filter((t: any) => t.driverId === session?.user?.id));
        } catch {
            toast({ title: "Error", description: "Failed to load", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "unauthenticated") { router.replace("/login"); return; }
        if (status !== "authenticated") return;
        loadTasks();
    }, [status, router]);

    const acceptBus = async (id: string) => {
        setActionLoading(id);
        try {
            const res = await fetch("/api/vehicle-maintenance", {
                method: "PATCH", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status: "DRIVER_ACCEPTED", driverAcceptedAt: new Date().toISOString() }),
            });
            if (!res.ok) throw new Error("Failed");
            toast({ title: "Bus accepted" });
            await loadTasks();
        } catch (err: any) {
            toast({ title: "Error", description: err?.message, variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const pending = tasks.filter((t) => t.status === "BUS_READY");
    const accepted = tasks.filter((t) => t.status === "DRIVER_ACCEPTED");
    const completed = tasks.filter((t) => t.status === "COMPLETED");

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
                    <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-semibold text-sky-700">
                        <Bus className="h-3.5 w-3.5" /> My Bus
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">Bus Pickup</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Accept your assigned bus after maintenance is complete.
                    </p>
                </div>

                {tasks.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            <Bus className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                            <p className="font-medium">No buses assigned yet</p>
                            <p className="mt-1 text-xs">Admin will assign you to a bus after maintenance.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        {pending.length > 0 && (
                            <div>
                                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-amber-500" /> Ready for Pickup ({pending.length})
                                </h2>
                                <div className="space-y-3">
                                    {pending.map((t) => (
                                        <Card key={t.id}>
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <Bus className="h-5 w-5 text-sky-600" />
                                                            <span className="font-semibold text-lg">{t.bus?.plateNumber}</span>
                                                            <Badge className="bg-sky-100 text-sky-700">Ready</Badge>
                                                        </div>
                                                        <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
                                                            <div><span className="font-medium">Model:</span> {t.bus?.model || "—"}</div>
                                                            <div><span className="font-medium">Garage:</span> {t.garage?.name}</div>
                                                            {t.garage?.address && (
                                                                <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.garage.address}</div>
                                                            )}
                                                            {t.garage?.contactPhone && (
                                                                <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {t.garage.contactPhone}</div>
                                                            )}
                                                            <div><span className="font-medium">Released:</span> {formatDate(t.busReleasedAt)}</div>
                                                            {t.assignedMechanic && (
                                                                <div className="flex items-center gap-1">
                                                                    <User className="h-3 w-3" />
                                                                    {t.assignedMechanic.name} ({t.assignedMechanic.position})
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => acceptBus(t.id)}
                                                        disabled={actionLoading === t.id}
                                                    >
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        {actionLoading === t.id ? "..." : "Accept Bus"}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {accepted.length > 0 && (
                            <div>
                                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" /> Accepted ({accepted.length})
                                </h2>
                                {accepted.map((t) => (
                                    <Card key={t.id} className="mb-2">
                                        <CardContent className="p-3">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <span className="font-medium">{t.bus?.plateNumber}</span>
                                                    <span className="ml-2 text-xs text-muted-foreground">{t.garage?.name}</span>
                                                </div>
                                                <Badge className="bg-cyan-100 text-cyan-700">
                                                    <CheckCircle className="h-3 w-3 mr-1" /> Awaiting Admin Confirmation
                                                </Badge>
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Accepted: {formatDate(t.driverAcceptedAt)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {completed.length > 0 && (
                            <div>
                                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-500" /> Completed ({completed.length})
                                </h2>
                                {completed.map((t) => (
                                    <Card key={t.id} className="mb-2">
                                        <CardContent className="p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium">{t.bus?.plateNumber} — {t.garage?.name}</span>
                                                <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
