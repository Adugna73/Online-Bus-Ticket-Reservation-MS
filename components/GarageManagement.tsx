"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Trash2, Wrench, Phone, Mail, MapPin, Plus, Calendar, CheckCircle, Clock, User, AlertTriangle, CheckCircle2, XCircle, UserCog, Ban, FileText, Archive, Download } from "lucide-react";

const ACTION_NEEDED_STATUSES = ["COST_PENDING", "AWAITING_PAYMENT", "DRIVER_ACCEPTED", "BUS_READY"];
const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"];

type Garage = {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    managerName?: string | null;
    owner?: { id: string; fullName: string; email: string } | null;
    buses?: any[];
    _count?: { buses: number; maintenances: number; mechanics: number };
};

type Bus = {
    id: string;
    plateNumber: string;
    model?: string | null;
    status: string;
    driverName?: string | null;
    seatCount: number;
    companyName?: string | null;
};

type Maintenance = {
    id: string;
    busId: string;
    garageId: string;
    status: string;
    partsNeedingMaintenance?: string | null;
    description?: string | null;
    mechanicNotes?: string | null;
    rejectionReason?: string | null;
    costRejectedReason?: string | null;
    paymentTxRef?: string | null;
    telebirrRef?: string | null;
    telebirrAmount?: number | null;
    driverAcceptedAt?: string | null;
    busReleasedAt?: string | null;
    adminConfirmedAt?: string | null;
    acceptedAt?: string | null;
    scheduledDate?: string | null;
    completedDate?: string | null;
    ownerPickupDate?: string | null;
    ownerDropoffDate?: string | null;
    estimatedCost?: number | null;
    actualCost?: number | null;
    bus?: Bus;
    garage?: { id: string; name: string };
    assignedMechanic?: { id: string; name: string; position: string; phone: string | null } | null;
    createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
    REQUESTED: "bg-amber-100 text-amber-700 border-amber-300",
    ACCEPTED: "bg-blue-100 text-blue-700 border-blue-300",
    NOT_FIXABLE: "bg-red-100 text-red-700 border-red-300",
    COST_PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300",
    COST_APPROVED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    SCHEDULED: "bg-blue-100 text-blue-700 border-blue-300",
    IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-300",
    PARTS_ORDERED: "bg-purple-100 text-purple-700 border-purple-300",
    REPAIR_DONE: "bg-teal-100 text-teal-700 border-teal-300",
    AWAITING_PAYMENT: "bg-violet-100 text-violet-700 border-violet-300",
    PAID: "bg-green-100 text-green-700 border-green-300",
    BUS_READY: "bg-sky-100 text-sky-700 border-sky-300",
    DRIVER_ACCEPTED: "bg-cyan-100 text-cyan-700 border-cyan-300",
    COMPLETED: "bg-green-100 text-green-700 border-green-300",
    CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

function daysUntil(dateStr?: string | null): number | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

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

export default function GarageManagement() {
    const { data: session } = useSession();
    const role = (session?.user?.role || "").toLowerCase();
    const isMechanic = role === "mechanic";
    const isAdmin = role === "admin";
    const isStaff = role === "supervisor" || role === "staff";
    const canSeeGarageTab = isAdmin || isStaff;

    const [garages, setGarages] = useState<Garage[]>([]);
    const [buses, setBuses] = useState<Bus[]>([]);
    const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
    const [mechanics, setMechanics] = useState<{ id: string; name: string; position: string; garageId: string }[]>([]);
    const [garageOwners, setGarageOwners] = useState<{ id: string; fullName: string; email: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"garages" | "maintenance">(
        "maintenance",
    );
    const [maintSubTab, setMaintSubTab] = useState<"active" | "archived">("active");
    const [reassignId, setReassignId] = useState<string | null>(null);

    const [newGarage, setNewGarage] = useState({
        name: "",
        address: "",
        city: "",
        contactPhone: "",
        contactEmail: "",
        managerName: "",
        ownerId: "",
    });

    const [newMaintenance, setNewMaintenance] = useState({
        busId: "",
        garageId: "",
        partsNeedingMaintenance: "",
        description: "",
        scheduledDate: "",
        ownerDropoffDate: "",
        estimatedCost: "",
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [garagesRes, busesRes, maintRes, ownersRes] = await Promise.all([
                fetch("/api/garages"),
                fetch("/api/buses"),
                fetch("/api/vehicle-maintenance"),
                fetch("/api/users?role=garage_owner"),
            ]);
            if (garagesRes.ok) setGarages(await garagesRes.json());
            if (busesRes.ok) setBuses(await busesRes.json());
            if (maintRes.ok) setMaintenances(await maintRes.json());
            if (ownersRes.ok) setGarageOwners(await ownersRes.json());
            if (canSeeGarageTab && garages.length > 0) {
                const mechResults = await Promise.all(
                    garages.map((g) =>
                        fetch(`/api/mechanics?garageId=${g.id}`, { credentials: "include" })
                            .then((r) => (r.ok ? r.json() : []))
                            .catch(() => []),
                    ),
                );
                setMechanics(mechResults.flat());
            }
        } catch (err: any) {
            setError(err?.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateGarage = async () => {
        setError(null);
        setMessage(null);
        if (!newGarage.name.trim()) {
            setError("Garage name is required");
            return;
        }
        try {
            const res = await fetch("/api/garages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newGarage.name,
                    address: newGarage.address || undefined,
                    city: newGarage.city || undefined,
                    contactPhone: newGarage.contactPhone || undefined,
                    contactEmail: newGarage.contactEmail || undefined,
                    managerName: newGarage.managerName || undefined,
                    ownerId: newGarage.ownerId || undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed to create garage");
            setNewGarage({
                name: "",
                address: "",
                city: "",
                contactPhone: "",
                contactEmail: "",
                managerName: "",
                ownerId: "",
            });
            setMessage("Garage created successfully");
            await loadData();
        } catch (err: any) {
            setError(err?.message || "Failed to create garage");
        }
    };

    const handleDeleteGarage = async (id: string) => {
        if (!confirm("Delete this garage?")) return;
        try {
            await fetch(`/api/garages?id=${id}`, { method: "DELETE" });
            await loadData();
        } catch (err: any) {
            setError(err?.message || "Failed to delete garage");
        }
    };

    const handleCreateMaintenance = async () => {
        setError(null);
        setMessage(null);
        if (!newMaintenance.busId || !newMaintenance.garageId) {
            setError("Please select a bus and garage");
            return;
        }
        try {
            const res = await fetch("/api/vehicle-maintenance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...newMaintenance,
                    estimatedCost: newMaintenance.estimatedCost
                        ? Number(newMaintenance.estimatedCost)
                        : undefined,
                }),
            });
            if (!res.ok) throw new Error("Failed to create maintenance record");
            setNewMaintenance({
                busId: "",
                garageId: "",
                partsNeedingMaintenance: "",
                description: "",
                scheduledDate: "",
                ownerDropoffDate: "",
                estimatedCost: "",
            });
            setMessage("Maintenance record created");
            await loadData();
        } catch (err: any) {
            setError(err?.message || "Failed to create maintenance record");
        }
    };

    const handleUpdateMaintenance = async (
        id: string,
        updates: Partial<Maintenance>,
        busStatus?: string,
    ) => {
        try {
            await fetch("/api/vehicle-maintenance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, ...updates, busStatus }),
            });
            await loadData();
        } catch (err: any) {
            setError(err?.message || "Failed to update maintenance");
        }
    };

    const handleDeleteMaintenance = async (id: string) => {
        if (!confirm("Delete this maintenance record?")) return;
        try {
            await fetch(`/api/vehicle-maintenance?id=${id}`, {
                method: "DELETE",
            });
            await loadData();
        } catch (err: any) {
            setError(err?.message || "Failed to delete maintenance");
        }
    };

    const handleReassign = async (id: string, mechanicId: string) => {
        try {
            await fetch("/api/vehicle-maintenance", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, assignedMechanicId: mechanicId || null }),
            });
            setReassignId(null);
            await loadData();
        } catch (err: any) {
            setError(err?.message || "Failed to reassign mechanic");
        }
    };

    const activeMaintenances = maintenances.filter((m) => !TERMINAL_STATUSES.includes(m.status));
    const archivedMaintenances = maintenances.filter((m) => TERMINAL_STATUSES.includes(m.status));
    const actionNeeded = activeMaintenances.filter((m) => ACTION_NEEDED_STATUSES.includes(m.status));

    const handleExportCSV = () => {
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
            "Owner Drop-off",
            "Owner Pickup",
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
        for (const m of maintenances) {
            const bus = buses.find((b) => b.id === m.busId);
            lines.push(
                [
                    escape(m.bus?.plateNumber || bus?.plateNumber || ""),
                    escape(m.bus?.model || ""),
                    escape(m.status),
                    escape(m.garage?.name || ""),
                    escape((m as any).assignedMechanic?.name || ""),
                    escape(m.partsNeedingMaintenance || ""),
                    escape(m.description || ""),
                    escape(m.mechanicNotes || ""),
                    escape(formatDate(m.scheduledDate)),
                    escape(formatDate(m.completedDate)),
                    escape(formatDate(m.ownerDropoffDate)),
                    escape(formatDate(m.ownerPickupDate)),
                    m.estimatedCost != null ? m.estimatedCost : "",
                    m.actualCost != null ? m.actualCost : "",
                    escape((m as any).telebirrRef || ""),
                    (m as any).telebirrAmount != null ? (m as any).telebirrAmount : "",
                    escape((m as any).driver?.fullName || m.bus?.driverName || ""),
                    escape(formatDate(m.createdAt)),
                ].join(","),
            );
        }
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `maintenance-export-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                Loading garage data...
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {error && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}
            {message && (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    {message}
                </div>
            )}

            {canSeeGarageTab && actionNeeded.length > 0 && (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <h3 className="text-sm font-semibold text-amber-800">
                            Action Needed ({actionNeeded.length})
                        </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {actionNeeded.slice(0, 8).map((m) => (
                            <span
                                key={m.id}
                                className={`rounded border px-2 py-1 text-xs font-medium ${
                                    STATUS_COLORS[m.status] || "bg-gray-100 text-gray-700 border-gray-300"
                                }`}
                            >
                                {m.bus?.plateNumber || "Unknown"} — {m.status.replace(/_/g, " ")}
                            </span>
                        ))}
                        {actionNeeded.length > 8 && (
                            <span className="text-xs text-amber-700 self-center">
                                +{actionNeeded.length - 8} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div className="flex gap-2 border-b">
                {canSeeGarageTab && (
                    <button
                        className={`px-4 py-2 text-sm font-medium border-b-2 ${
                            activeTab === "garages"
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground"
                        }`}
                        onClick={() => setActiveTab("garages")}
                    >
                        Garages
                    </button>
                )}
                <button
                    className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        activeTab === "maintenance"
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground"
                    }`}
                    onClick={() => setActiveTab("maintenance")}
                >
                    Vehicle Maintenance
                </button>
            </div>

            {activeTab === "garages" && (
                <>
                    <div className="rounded border bg-card p-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Add Garage
                        </h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Garage name *"
                                value={newGarage.name}
                                onChange={(e) =>
                                    setNewGarage({ ...newGarage, name: e.target.value })
                                }
                            />
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Address"
                                value={newGarage.address}
                                onChange={(e) =>
                                    setNewGarage({ ...newGarage, address: e.target.value })
                                }
                            />
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="City"
                                value={newGarage.city}
                                onChange={(e) =>
                                    setNewGarage({ ...newGarage, city: e.target.value })
                                }
                            />
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Contact phone"
                                value={newGarage.contactPhone}
                                onChange={(e) =>
                                    setNewGarage({
                                        ...newGarage,
                                        contactPhone: e.target.value,
                                    })
                                }
                            />
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Contact email"
                                value={newGarage.contactEmail}
                                onChange={(e) =>
                                    setNewGarage({
                                        ...newGarage,
                                        contactEmail: e.target.value,
                                    })
                                }
                            />
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Manager name"
                                value={newGarage.managerName}
                                onChange={(e) =>
                                    setNewGarage({
                                        ...newGarage,
                                        managerName: e.target.value,
                                    })
                                }
                            />
                            <select
                                className="h-10 w-full rounded border px-3 text-sm"
                                value={newGarage.ownerId}
                                onChange={(e) =>
                                    setNewGarage({ ...newGarage, ownerId: e.target.value })
                                }
                            >
                                <option value="">Select owner (optional)</option>
                                {garageOwners
                                    .filter((o) => !garages.some((g) => g.owner?.id === o.id))
                                    .map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.fullName} ({o.email})
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <Button className="mt-3" onClick={handleCreateGarage}>
                            Create Garage
                        </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {garages.length === 0 ? (
                            <div className="col-span-2 text-center text-muted-foreground text-sm py-8">
                                No garages found. Create one above.
                            </div>
                        ) : (
                            garages.map((garage) => (
                                <div
                                    key={garage.id}
                                    className="rounded-2xl border bg-card p-5 shadow-sm"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="text-lg font-semibold flex items-center gap-2">
                                                <Wrench className="h-5 w-5 text-primary" />
                                                {garage.name}
                                            </h4>
                                            {garage.managerName && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Manager: {garage.managerName}
                                                </p>
                                            )}
                                            {garage.owner && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Owner: {garage.owner.fullName}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteGarage(garage.id)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="mt-3 space-y-1.5 text-sm">
                                        {garage.address && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MapPin className="h-4 w-4" />
                                                {garage.address}
                                                {garage.city ? `, ${garage.city}` : ""}
                                            </div>
                                        )}
                                        {garage.contactPhone && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Phone className="h-4 w-4" />
                                                {garage.contactPhone}
                                            </div>
                                        )}
                                        {garage.contactEmail && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Mail className="h-4 w-4" />
                                                {garage.contactEmail}
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 flex gap-4 text-sm">
                                        <span className="rounded bg-primary/10 px-2 py-1 text-primary">
                                            {garage._count?.buses || 0} buses
                                        </span>
                                        <span className="rounded bg-amber-100 px-2 py-1 text-amber-700">
                                            {garage._count?.maintenances || 0} maint.
                                        </span>
                                        <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
                                            {garage._count?.mechanics || 0} mechanics
                                        </span>
                                    </div>
                                    {garage.buses && garage.buses.length > 0 && (
                                        <div className="mt-3 border-t pt-3">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                                                Buses at this garage:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {garage.buses.map((bus) => (
                                                    <span
                                                        key={bus.id}
                                                        className="rounded border px-2 py-1 text-xs"
                                                    >
                                                        {bus.plateNumber}
                                                        {bus.model ? ` (${bus.model})` : ""}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {activeTab === "maintenance" && (
                <>
                    <div className="rounded border bg-card p-6">
                        <h3 className="text-sm font-semibold flex items-center gap-2 mb-1">
                            <Plus className="h-4 w-4" /> Schedule Vehicle Maintenance
                        </h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Select a bus and garage, then fill in the maintenance details below.
                        </p>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            <select
                                className="h-10 w-full rounded border px-3 text-sm"
                                value={newMaintenance.busId}
                                onChange={(e) =>
                                    setNewMaintenance({
                                        ...newMaintenance,
                                        busId: e.target.value,
                                    })
                                }
                            >
                                <option value="">Select bus *</option>
                                {buses.map((bus) => (
                                    <option key={bus.id} value={bus.id}>
                                        {bus.plateNumber}
                                        {bus.model ? ` - ${bus.model}` : ""}
                                    </option>
                                ))}
                            </select>
                            <select
                                className="h-10 w-full rounded border px-3 text-sm"
                                value={newMaintenance.garageId}
                                onChange={(e) =>
                                    setNewMaintenance({
                                        ...newMaintenance,
                                        garageId: e.target.value,
                                    })
                                }
                            >
                                <option value="">Select garage *</option>
                                {garages.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Parts needing maintenance (e.g. brakes, tires, oil filter)"
                                value={newMaintenance.partsNeedingMaintenance}
                                onChange={(e) =>
                                    setNewMaintenance({
                                        ...newMaintenance,
                                        partsNeedingMaintenance: e.target.value,
                                    })
                                }
                            />
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Description"
                                value={newMaintenance.description}
                                onChange={(e) =>
                                    setNewMaintenance({
                                        ...newMaintenance,
                                        description: e.target.value,
                                    })
                                }
                            />
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Scheduled date</label>
                                <input
                                    type="date"
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    value={newMaintenance.scheduledDate}
                                    onChange={(e) =>
                                        setNewMaintenance({
                                            ...newMaintenance,
                                            scheduledDate: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1">Owner drop-off date</label>
                                <input
                                    type="date"
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    value={newMaintenance.ownerDropoffDate}
                                    onChange={(e) =>
                                        setNewMaintenance({
                                            ...newMaintenance,
                                            ownerDropoffDate: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            <input
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Estimated cost (ETB)"
                                value={newMaintenance.estimatedCost}
                                onChange={(e) =>
                                    setNewMaintenance({
                                        ...newMaintenance,
                                        estimatedCost: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <Button className="mt-4 w-full md:w-auto" onClick={handleCreateMaintenance}>
                            Schedule Maintenance
                        </Button>
                    </div>

                    <div className="flex gap-2 border-b mb-4">
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                maintSubTab === "active"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground"
                            }`}
                            onClick={() => setMaintSubTab("active")}
                        >
                            Active ({activeMaintenances.length})
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                maintSubTab === "archived"
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground"
                            }`}
                            onClick={() => setMaintSubTab("archived")}
                        >
                            <Archive className="inline h-3.5 w-3.5 mr-1" />
                            Archived ({archivedMaintenances.length})
                        </button>
                    </div>

                    {maintSubTab === "archived" ? (
                        archivedMaintenances.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-8">
                                No archived maintenance records.
                            </div>
                        ) : (
                            <>
                            <div className="flex justify-end mb-3">
                                <button
                                    onClick={handleExportCSV}
                                    className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-medium hover:bg-muted [background:var(--button-background)] [color:var(--button-foreground)]"
                                >
                                    <Download className="h-4 w-4" /> Export CSV
                                </button>
                            </div>
                            <div className="w-full overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[800px] text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr className="text-left">
                                            <th className="px-3 py-2 font-semibold">Bus</th>
                                            <th className="px-3 py-2 font-semibold">Status</th>
                                            <th className="px-3 py-2 font-semibold">Garage</th>
                                            <th className="px-3 py-2 font-semibold">Mechanic</th>
                                            <th className="px-3 py-2 font-semibold">Parts</th>
                                            <th className="px-3 py-2 font-semibold">Completed</th>
                                            <th className="px-3 py-2 font-semibold">Est. ETB</th>
                                            <th className="px-3 py-2 font-semibold">Actual ETB</th>
                                            <th className="px-3 py-2 font-semibold">Notes</th>
                                            <th className="px-3 py-2 font-semibold"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {archivedMaintenances.map((m) => {
                                            const bus = buses.find((b) => b.id === m.busId);
                                            return (
                                                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                                                    <td className="px-3 py-2">
                                                        <div className="font-medium">
                                                            {m.bus?.plateNumber || bus?.plateNumber || "Unknown"}
                                                        </div>
                                                        {m.bus?.model && (
                                                            <div className="text-xs text-muted-foreground">
                                                                {m.bus.model}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span
                                                            className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                                STATUS_COLORS[m.status] ||
                                                                "bg-gray-100 text-gray-700 border-gray-300"
                                                            }`}
                                                        >
                                                            {m.status.replace(/_/g, " ")}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2">{m.garage?.name || "Unknown"}</td>
                                                    <td className="px-3 py-2 text-xs">
                                                        {(m as any).assignedMechanic?.name || "—"}
                                                    </td>
                                                    <td className="px-3 py-2">{m.partsNeedingMaintenance || "—"}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {formatDate(m.completedDate)}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {m.estimatedCost != null ? m.estimatedCost.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        {m.actualCost != null ? m.actualCost.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-3 py-2 max-w-[160px] truncate">
                                                        {m.mechanicNotes || m.description || "—"}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <button
                                                            onClick={() => handleDeleteMaintenance(m.id)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            </>
                        )
                    ) : activeMaintenances.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                            No active maintenance records.
                        </div>
                    ) : isAdmin ? (
                        <div className="w-full overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[1200px] text-sm">
                                <thead className="bg-muted/50 border-b">
                                    <tr className="text-left">
                                        <th className="px-3 py-2 font-semibold">Bus</th>
                                        <th className="px-3 py-2 font-semibold">Status</th>
                                        <th className="px-3 py-2 font-semibold">Garage</th>
                                        <th className="px-3 py-2 font-semibold">Mechanic</th>
                                        <th className="px-3 py-2 font-semibold">Parts</th>
                                        <th className="px-3 py-2 font-semibold">Scheduled</th>
                                        <th className="px-3 py-2 font-semibold">Drop-off</th>
                                        <th className="px-3 py-2 font-semibold">Pickup</th>
                                        <th className="px-3 py-2 font-semibold">Est. ETB</th>
                                        <th className="px-3 py-2 font-semibold">Actual ETB</th>
                                        <th className="px-3 py-2 font-semibold">Notes</th>
                                        <th className="px-3 py-2 font-semibold">Actions</th>
                                        <th className="px-3 py-2 font-semibold"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeMaintenances.map((m) => {
                                        const countdown = daysUntil(m.scheduledDate);
                                        const bus = buses.find((b) => b.id === m.busId);
                                        return (
                                            <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">
                                                        {m.bus?.plateNumber || bus?.plateNumber || "Unknown"}
                                                    </div>
                                                    {m.bus?.model && (
                                                        <div className="text-xs text-muted-foreground">
                                                            {m.bus.model}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span
                                                        className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                            STATUS_COLORS[m.status] ||
                                                            "bg-gray-100 text-gray-700 border-gray-300"
                                                        }`}
                                                    >
                                                        {m.status.replace(/_/g, " ")}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {m.garage?.name || "Unknown"}
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    {(m as any).assignedMechanic?.name || "—"}
                                                    {(m as any).assignedMechanic?.position && (
                                                        <span className="text-muted-foreground"> ({(m as any).assignedMechanic.position})</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {m.partsNeedingMaintenance || "—"}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {formatDate(m.scheduledDate)}
                                                    {countdown !== null && m.status !== "COMPLETED" && (
                                                        <span
                                                            className={`ml-1 text-xs font-medium ${
                                                                countdown < 0
                                                                    ? "text-red-600"
                                                                    : countdown <= 3
                                                                      ? "text-amber-600"
                                                                      : "text-green-600"
                                                            }`}
                                                        >
                                                            {countdown < 0
                                                                ? `${Math.abs(countdown)}d ov`
                                                                : `${countdown}d`}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {formatDate(m.ownerDropoffDate)}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {formatDate(m.ownerPickupDate)}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {m.estimatedCost != null
                                                        ? m.estimatedCost.toLocaleString()
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    {m.actualCost != null
                                                        ? m.actualCost.toLocaleString()
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-2 max-w-[160px] truncate">
                                                    {m.mechanicNotes || m.description || "—"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-col gap-1 min-w-[120px]">
                                                        {m.status === "REQUESTED" && (
                                                            <button
                                                                className="h-7 rounded bg-blue-100 px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "ACCEPTED", acceptedAt: new Date().toISOString() })}
                                                            >
                                                                <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Accept
                                                            </button>
                                                        )}
                                                        {m.status === "ACCEPTED" && (
                                                            <button
                                                                className="h-7 rounded bg-amber-100 px-2 text-[11px] font-medium text-amber-700 hover:bg-amber-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "COST_PENDING" })}
                                                            >
                                                                Submit Cost
                                                            </button>
                                                        )}
                                                        {m.status === "COST_PENDING" && (
                                                            <button
                                                                className="h-7 rounded bg-emerald-100 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "COST_APPROVED" })}
                                                            >
                                                                <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Approve Cost
                                                            </button>
                                                        )}
                                                        {m.status === "COST_APPROVED" && (
                                                            <button
                                                                className="h-7 rounded bg-blue-100 px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "SCHEDULED" })}
                                                            >
                                                                Schedule
                                                            </button>
                                                        )}
                                                        {m.status === "SCHEDULED" && (
                                                            <button
                                                                className="h-7 rounded bg-blue-100 px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "IN_PROGRESS" })}
                                                            >
                                                                Start Work
                                                            </button>
                                                        )}
                                                        {m.status === "IN_PROGRESS" && (
                                                            <button
                                                                className="h-7 rounded bg-teal-100 px-2 text-[11px] font-medium text-teal-700 hover:bg-teal-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "REPAIR_DONE" })}
                                                            >
                                                                Repair Done
                                                            </button>
                                                        )}
                                                        {m.status === "PARTS_ORDERED" && (
                                                            <button
                                                                className="h-7 rounded bg-blue-100 px-2 text-[11px] font-medium text-blue-700 hover:bg-blue-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "IN_PROGRESS" })}
                                                            >
                                                                Start Repair
                                                            </button>
                                                        )}
                                                        {m.status === "REPAIR_DONE" && (
                                                            <button
                                                                className="h-7 rounded bg-violet-100 px-2 text-[11px] font-medium text-violet-700 hover:bg-violet-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "AWAITING_PAYMENT" })}
                                                            >
                                                                Request Payment
                                                            </button>
                                                        )}
                                                        {m.status === "AWAITING_PAYMENT" && (
                                                            <button
                                                                className="h-7 rounded bg-violet-100 px-2 text-[11px] font-medium text-violet-700 hover:bg-violet-200"
                                                                onClick={() => {
                                                                    const targetAmount = m.actualCost || m.estimatedCost || 0;
                                                                    const telebirrRef = prompt(`Enter Telebirr reference number:\nAmount to pay: ${targetAmount.toLocaleString()} ETB`);
                                                                    if (telebirrRef) {
                                                                        const telebirrAmount = prompt(`Confirm Telebirr payment amount:`);
                                                                        if (telebirrAmount && Number(telebirrAmount) >= targetAmount) {
                                                                            handleUpdateMaintenance(m.id, { status: "PAID", telebirrRef, telebirrAmount: Number(telebirrAmount), paymentTxRef: telebirrRef });
                                                                        } else if (telebirrAmount) {
                                                                            alert(`Amount must be at least ${targetAmount.toLocaleString()} ETB`);
                                                                        }
                                                                    }
                                                                }}
                                                            >
                                                                Pay via Telebirr
                                                            </button>
                                                        )}
                                                        {m.status === "PAID" && (
                                                            <button
                                                                className="h-7 rounded bg-sky-100 px-2 text-[11px] font-medium text-sky-700 hover:bg-sky-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "BUS_READY" })}
                                                            >
                                                                Bus Ready
                                                            </button>
                                                        )}
                                                        {m.status === "BUS_READY" && (
                                                            <span className="text-[11px] text-amber-600 italic flex items-center gap-1">
                                                                <Clock className="inline h-3.5 w-3.5" />Waiting for driver to accept
                                                            </span>
                                                        )}
                                                        {m.status === "DRIVER_ACCEPTED" && (
                                                            <button
                                                                className="h-7 rounded bg-emerald-100 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-200"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "COMPLETED", adminConfirmedAt: new Date().toISOString(), completedDate: new Date().toISOString() })}
                                                            >
                                                                <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Confirm Handover
                                                            </button>
                                                        )}
                                                        {m.status === "NOT_FIXABLE" && (
                                                            <button
                                                                className="h-7 rounded bg-red-100 px-2 text-[11px] font-medium text-red-700 hover:bg-red-200"
                                                                onClick={() => {
                                                                    if (confirm("Cancel this maintenance record?")) handleUpdateMaintenance(m.id, { status: "CANCELLED" });
                                                                }}
                                                            >
                                                                <Ban className="inline h-3.5 w-3.5 mr-1" />Cancel
                                                            </button>
                                                        )}
                                                        {(m.status === "COMPLETED" || m.status === "CANCELLED") && (
                                                            <span className="text-xs text-muted-foreground italic">No action</span>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="date"
                                                                className="h-6 rounded border px-1 text-[10px]"
                                                                value={m.ownerPickupDate ? m.ownerPickupDate.split("T")[0] : ""}
                                                                onChange={(e) => handleUpdateMaintenance(m.id, { ownerPickupDate: e.target.value || null })}
                                                                title="Owner pickup date"
                                                            />
                                                            <input
                                                                className="h-6 w-16 rounded border px-1 text-[10px]"
                                                                placeholder="ETB"
                                                                type="number"
                                                                defaultValue={m.actualCost || ""}
                                                                onBlur={(e) => handleUpdateMaintenance(m.id, { actualCost: e.target.value ? Number(e.target.value) : null })}
                                                            />
                                                        </div>
                                                        {(m as any).rejectionReason && (
                                                            <div className="text-[10px] text-red-600 max-w-[160px] truncate">
                                                                {(m as any).rejectionReason}
                                                            </div>
                                                        )}
                                                        {(m as any).costRejectedReason && (
                                                            <div className="text-[10px] text-red-600 max-w-[160px] truncate">
                                                                Cost rejected: {(m as any).costRejectedReason}
                                                            </div>
                                                        )}
                                                        {m.status === "PAID" && (m as any).telebirrRef && (
                                                            <div className="text-[10px] text-green-600">
                                                                Paid: {(m as any).telebirrRef}{(m as any).telebirrAmount != null && ` (${(m as any).telebirrAmount.toLocaleString()} ETB)`}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        onClick={() => handleDeleteMaintenance(m.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                            {activeMaintenances.map((m) => {
                                const countdown = daysUntil(m.scheduledDate);
                                const bus = buses.find((b) => b.id === m.busId);
                                return (
                                    <div
                                        key={m.id}
                                        className="rounded-2xl border bg-card p-5 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-semibold">
                                                        {m.bus?.plateNumber || bus?.plateNumber || "Unknown bus"}
                                                    </h4>
                                                    <span
                                                        className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                            STATUS_COLORS[m.status] ||
                                                            "bg-gray-100 text-gray-700 border-gray-300"
                                                        }`}
                                                    >
                                                        {m.status.replace(/_/g, " ")}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {(!isMechanic || m.status !== "SCHEDULED") && (
                                                        <>
                                                            {m.garage?.name || "Unknown garage"}
                                                            {m.bus?.model ? ` • ${m.bus.model}` : ""}
                                                            {m.bus?.driverName
                                                                ? ` • Driver: ${m.bus.driverName}`
                                                                : ""}
                                                        </>
                                                    )}
                                                    {isMechanic && m.status === "SCHEDULED" && (
                                                        <>
                                                            {m.bus?.model || ""}
                                                            {m.bus?.driverName
                                                                ? ` • Driver: ${m.bus.driverName}`
                                                                : ""}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteMaintenance(m.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>

                                        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                                            <div className="rounded border p-2 text-sm">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Wrench className="h-3 w-3" /> Parts
                                                </div>
                                                <div className="mt-1">
                                                    {m.partsNeedingMaintenance || "—"}
                                                </div>
                                            </div>
                                            <div className="rounded border p-2 text-sm">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Calendar className="h-3 w-3" /> Scheduled
                                                </div>
                                                <div className="mt-1">
                                                    {formatDate(m.scheduledDate)}
                                                    {countdown !== null && m.status !== "COMPLETED" && (
                                                        <span
                                                            className={`ml-2 text-xs font-medium ${
                                                                countdown < 0
                                                                    ? "text-red-600"
                                                                    : countdown <= 3
                                                                      ? "text-amber-600"
                                                                      : "text-green-600"
                                                            }`}
                                                        >
                                                            {countdown < 0
                                                                ? `${Math.abs(countdown)}d overdue`
                                                                : `${countdown}d left`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="rounded border p-2 text-sm">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <User className="h-3 w-3" /> Owner Drop-off
                                                </div>
                                                <div className="mt-1">
                                                    {formatDate(m.ownerDropoffDate)}
                                                </div>
                                            </div>
                                            <div className="rounded border p-2 text-sm">
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <CheckCircle className="h-3 w-3" /> Owner Pickup
                                                </div>
                                                <div className="mt-1">
                                                    {formatDate(m.ownerPickupDate)}
                                                </div>
                                            </div>
                                        </div>

                                        {m.description && (
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                {m.description}
                                            </p>
                                        )}
                                        {m.mechanicNotes && (
                                            <p className="mt-1 text-sm italic text-muted-foreground">
                                                Notes: {m.mechanicNotes}
                                            </p>
                                        )}

                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            {m.estimatedCost != null && (
                                                <span className="rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                                                    Est. ETB {m.estimatedCost.toLocaleString()}
                                                </span>
                                            )}
                                            {m.actualCost != null && (
                                                <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                                                    Actual: ETB {m.actualCost.toLocaleString()}
                                                </span>
                                            )}
                                            {m.completedDate && (
                                                <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">
                                                    Completed: {formatDate(m.completedDate)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-4 border-t pt-3">
                                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                                                Next Action:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {m.status === "REQUESTED" && (
                                                    <button
                                                        className="h-8 rounded bg-blue-100 px-3 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "ACCEPTED", acceptedAt: new Date().toISOString() })}
                                                    >
                                                        <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Accept
                                                    </button>
                                                )}
                                                {m.status === "ACCEPTED" && (
                                                    <button
                                                        className="h-8 rounded bg-amber-100 px-3 text-xs font-medium text-amber-700 hover:bg-amber-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "COST_PENDING" })}
                                                    >
                                                        Submit Cost
                                                    </button>
                                                )}
                                                {m.status === "COST_PENDING" && (isAdmin || isStaff) && (
                                                    <button
                                                        className="h-8 rounded bg-emerald-100 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "COST_APPROVED" })}
                                                    >
                                                        <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Approve Cost
                                                    </button>
                                                )}
                                                {m.status === "COST_APPROVED" && (
                                                    <button
                                                        className="h-8 rounded bg-blue-100 px-3 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "SCHEDULED" })}
                                                    >
                                                        Schedule
                                                    </button>
                                                )}
                                                {m.status === "SCHEDULED" && (
                                                    <button
                                                        className="h-8 rounded bg-blue-100 px-3 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "IN_PROGRESS" })}
                                                    >
                                                        Start Work
                                                    </button>
                                                )}
                                                {m.status === "IN_PROGRESS" && (
                                                    <button
                                                        className="h-8 rounded bg-teal-100 px-3 text-xs font-medium text-teal-700 hover:bg-teal-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "REPAIR_DONE" })}
                                                    >
                                                        Repair Done
                                                    </button>
                                                )}
                                                {m.status === "PARTS_ORDERED" && (
                                                    <button
                                                        className="h-8 rounded bg-blue-100 px-3 text-xs font-medium text-blue-700 hover:bg-blue-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "IN_PROGRESS" })}
                                                    >
                                                        Start Repair
                                                    </button>
                                                )}
                                                {m.status === "REPAIR_DONE" && (
                                                    <button
                                                        className="h-8 rounded bg-violet-100 px-3 text-xs font-medium text-violet-700 hover:bg-violet-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "AWAITING_PAYMENT" })}
                                                    >
                                                        Request Payment
                                                    </button>
                                                )}
                                                {m.status === "AWAITING_PAYMENT" && (isAdmin || isStaff) && (
                                                    <button
                                                        className="h-8 rounded bg-violet-100 px-3 text-xs font-medium text-violet-700 hover:bg-violet-200"
                                                        onClick={() => {
                                                            const targetAmount = m.actualCost || m.estimatedCost || 0;
                                                            const telebirrRef = prompt(`Enter Telebirr reference number:\nAmount to pay: ${targetAmount.toLocaleString()} ETB`);
                                                            if (telebirrRef) {
                                                                const telebirrAmount = prompt(`Confirm Telebirr payment amount:`);
                                                                if (telebirrAmount && Number(telebirrAmount) >= targetAmount) {
                                                                    handleUpdateMaintenance(m.id, { status: "PAID", telebirrRef, telebirrAmount: Number(telebirrAmount), paymentTxRef: telebirrRef });
                                                                } else if (telebirrAmount) {
                                                                    alert(`Amount must be at least ${targetAmount.toLocaleString()} ETB`);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        Pay via Telebirr
                                                    </button>
                                                )}
                                                {m.status === "PAID" && (
                                                    <button
                                                        className="h-8 rounded bg-sky-100 px-3 text-xs font-medium text-sky-700 hover:bg-sky-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "BUS_READY" })}
                                                    >
                                                        Bus Ready
                                                    </button>
                                                )}
                                                {m.status === "BUS_READY" && (
                                                    <span className="text-xs text-amber-600 italic flex items-center gap-1">
                                                        <Clock className="inline h-3.5 w-3.5" />Waiting for driver to accept
                                                    </span>
                                                )}
                                                {m.status === "DRIVER_ACCEPTED" && (isAdmin || isStaff) && (
                                                    <button
                                                        className="h-8 rounded bg-emerald-100 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-200"
                                                        onClick={() => handleUpdateMaintenance(m.id, { status: "COMPLETED", adminConfirmedAt: new Date().toISOString(), completedDate: new Date().toISOString() })}
                                                    >
                                                        <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />Confirm Handover
                                                    </button>
                                                )}
                                                {m.status === "NOT_FIXABLE" && (
                                                    <button
                                                        className="h-8 rounded bg-red-100 px-3 text-xs font-medium text-red-700 hover:bg-red-200"
                                                        onClick={() => {
                                                            if (confirm("Cancel this maintenance record?")) handleUpdateMaintenance(m.id, { status: "CANCELLED" });
                                                        }}
                                                    >
                                                        <Ban className="inline h-3.5 w-3.5 mr-1" />Cancel
                                                    </button>
                                                )}
                                                {(m.status === "COMPLETED" || m.status === "CANCELLED") && (
                                                    <span className="text-xs text-muted-foreground italic self-center">No action needed</span>
                                                )}
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <input
                                                    type="date"
                                                    className="h-8 rounded border px-2 text-xs"
                                                    value={m.ownerPickupDate ? m.ownerPickupDate.split("T")[0] : ""}
                                                    onChange={(e) => handleUpdateMaintenance(m.id, { ownerPickupDate: e.target.value || null })}
                                                    title="Owner pickup date"
                                                />
                                                <input
                                                    className="h-8 w-32 rounded border px-2 text-xs"
                                                    placeholder="Mechanic notes"
                                                    defaultValue={m.mechanicNotes || ""}
                                                    onBlur={(e) => handleUpdateMaintenance(m.id, { mechanicNotes: e.target.value })}
                                                />
                                                <input
                                                    className="h-8 w-24 rounded border px-2 text-xs"
                                                    placeholder="Actual cost"
                                                    type="number"
                                                    defaultValue={m.actualCost || ""}
                                                    onBlur={(e) => handleUpdateMaintenance(m.id, { actualCost: e.target.value ? Number(e.target.value) : null })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
