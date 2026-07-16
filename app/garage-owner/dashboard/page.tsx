"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Wrench, Users, ClipboardList, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

type MaintenanceItem = {
    id: string;
    status: string;
    description: string | null;
    bus: { plateNumber: string; model: string | null; driverName: string | null };
    requestedBy: { fullName: string } | null;
    assignedMechanic: { name: string; position: string } | null;
    createdAt: string;
};

type GarageInfo = {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
};

const STATUS_COLORS: Record<string, string> = {
    REQUESTED: "bg-amber-100 text-amber-700 border-amber-300",
    ACCEPTED: "bg-blue-100 text-blue-700 border-blue-300",
    SCHEDULED: "bg-purple-100 text-purple-700 border-purple-300",
    IN_PROGRESS: "bg-orange-100 text-orange-700 border-orange-300",
    PARTS_ORDERED: "bg-indigo-100 text-indigo-700 border-indigo-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

export default function GarageOwnerDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [garage, setGarage] = useState<GarageInfo | null>(null);
    const [maintenances, setMaintenances] = useState<MaintenanceItem[]>([]);
    const [mechanicCount, setMechanicCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === "unauthenticated") { router.replace("/login"); return; }
        if (status !== "authenticated") return;

        (async () => {
            try {
                const [gRes, mRes, mechRes] = await Promise.all([
                    fetch("/api/garages", { credentials: "include" }),
                    fetch("/api/vehicle-maintenance", { credentials: "include" }),
                    fetch("/api/mechanics", { credentials: "include" }),
                ]);

                if (gRes.ok) {
                    const garages = await gRes.json();
                    const owned = garages.find((g: any) => true);
                    setGarage(owned || null);
                }
                if (mRes.ok) setMaintenances(await mRes.json());
                if (mechRes.ok) setMechanicCount((await mechRes.json()).length);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [status, router]);

    const pending = maintenances.filter((m) => m.status === "REQUESTED");
    const active = maintenances.filter((m) => m.status === "ACCEPTED" || m.status === "IN_PROGRESS" || m.status === "PARTS_ORDERED");
    const completed = maintenances.filter((m) => m.status === "COMPLETED");

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-700">
                        <Wrench className="h-3.5 w-3.5" />
                        Garage Owner
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">
                        {garage?.name || "My Garage"}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage maintenance requests and mechanic assignments.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3 mb-8">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                Pending Requests
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{pending.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">Awaiting your response</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                Active Jobs
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{active.length}</div>
                            <p className="text-xs text-muted-foreground mt-1">In progress</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users className="h-4 w-4 text-emerald-500" />
                                Mechanics
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{mechanicCount}</div>
                            <p className="text-xs text-muted-foreground mt-1">Team members</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex gap-4 mb-6">
                    <Link
                        href="/garage-owner/mechanics"
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Users className="h-4 w-4" /> Manage Mechanics
                    </Link>
                    <Link
                        href="/garage-owner/maintenance"
                        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                        <ClipboardList className="h-4 w-4" /> All Maintenance
                    </Link>
                </div>

                {maintenances.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            <Wrench className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                            <p className="font-medium">No maintenance requests yet</p>
                            <p className="mt-1 text-xs">System admin will request maintenance for buses here.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold">Recent Maintenance</h2>
                        {maintenances.slice(0, 10).map((m) => (
                            <div key={m.id} className="flex items-center justify-between rounded-lg border p-4">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <div className="font-medium">{m.bus?.plateNumber || "—"}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {m.bus?.model || ""} {m.bus?.driverName ? `• ${m.bus.driverName}` : ""}
                                        </div>
                                        {m.assignedMechanic && (
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Assigned: {m.assignedMechanic.name} ({m.assignedMechanic.position})
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Badge className={STATUS_COLORS[m.status] || "bg-gray-100 text-gray-700"}>
                                    {m.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
