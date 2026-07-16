"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Trash2, Wrench, Phone, Mail, MapPin, Plus, Calendar, CheckCircle, Clock, User, AlertTriangle } from "lucide-react";

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
    const [garageOwners, setGarageOwners] = useState<{ id: string; fullName: string; email: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"garages" | "maintenance">(
        "maintenance",
    );

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
        } catch (err: any) {
            setError(err?.message || "Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
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
                    <div className="rounded border bg-card p-4">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Schedule Vehicle Maintenance
                        </h3>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                            <input
                                type="date"
                                className="h-10 w-full rounded border px-3 text-sm"
                                placeholder="Owner drop-off date"
                                value={newMaintenance.ownerDropoffDate}
                                onChange={(e) =>
                                    setNewMaintenance({
                                        ...newMaintenance,
                                        ownerDropoffDate: e.target.value,
                                    })
                                }
                            />
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
                        <Button className="mt-3" onClick={handleCreateMaintenance}>
                            Schedule Maintenance
                        </Button>
                    </div>

                    {maintenances.length === 0 ? (
                        <div className="text-center text-muted-foreground text-sm py-8">
                            No maintenance records found.
                        </div>
                    ) : isAdmin ? (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
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
                                    {maintenances.map((m) => {
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
                                                    <div className="flex flex-wrap gap-1">
                                                        <select
                                                            className="h-7 rounded border px-1 text-xs"
                                                            value={m.status}
                                                            onChange={(e) =>
                                                                handleUpdateMaintenance(m.id, {
                                                                    status: e.target.value,
                                                                    completedDate:
                                                                        e.target.value === "COMPLETED"
                                                                            ? new Date().toISOString()
                                                                            : undefined,
                                                                })
                                                            }
                                                        >
                                                            <option value="REQUESTED">Requested</option>
                                                            <option value="ACCEPTED">Accepted</option>
                                                            <option value="NOT_FIXABLE">Not Fixable</option>
                                                            <option value="COST_PENDING">Cost Pending</option>
                                                            <option value="COST_APPROVED">Cost Approved</option>
                                                            <option value="SCHEDULED">Scheduled</option>
                                                            <option value="IN_PROGRESS">In Progress</option>
                                                            <option value="PARTS_ORDERED">Parts Ordered</option>
                                                            <option value="REPAIR_DONE">Repair Done</option>
                                                            <option value="AWAITING_PAYMENT">Awaiting Payment</option>
                                                            <option value="PAID">Paid</option>
                                                            <option value="BUS_READY">Bus Ready</option>
                                                            <option value="DRIVER_ACCEPTED">Driver Accepted</option>
                                                            <option value="COMPLETED">Completed</option>
                                                            <option value="CANCELLED">Cancelled</option>
                                                        </select>
                                                        {(m as any).rejectionReason && (
                                                            <div className="text-[10px] text-red-600 mt-1 max-w-[100px] truncate">
                                                                {(m as any).rejectionReason}
                                                            </div>
                                                        )}
                                                        {m.status === "COST_PENDING" && isAdmin && (
                                                            <div className="flex gap-1 mt-1">
                                                                <button
                                                                    className="h-6 rounded bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200"
                                                                    onClick={() => handleUpdateMaintenance(m.id, { status: "COST_APPROVED" })}
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    className="h-6 rounded bg-red-100 px-1.5 text-[10px] font-medium text-red-700 hover:bg-red-200"
                                                                    onClick={() => {
                                                                        const reason = prompt("Rejection reason:");
                                                                        if (reason) handleUpdateMaintenance(m.id, { status: "ACCEPTED", costRejectedReason: reason });
                                                                    }}
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                        {m.status === "AWAITING_PAYMENT" && isAdmin && (
                                                            <div className="flex gap-1 mt-1">
                                                                <button
                                                                    className="h-6 rounded bg-violet-100 px-1.5 text-[10px] font-medium text-violet-700 hover:bg-violet-200"
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
                                                            </div>
                                                        )}
                                                        {m.status === "PAID" && !(m as any).driverAcceptedAt && isAdmin && (
                                                            <div className="text-[10px] text-green-600 mt-1">
                                                                Paid via Telebirr: {(m as any).telebirrRef || m.paymentTxRef || "—"}
                                                                {(m as any).telebirrAmount != null && ` (${(m as any).telebirrAmount.toLocaleString()} ETB)`}
                                                            </div>
                                                        )}
                                                        {m.status === "DRIVER_ACCEPTED" && isAdmin && (
                                                            <button
                                                                className="h-6 rounded bg-cyan-100 px-1.5 text-[10px] font-medium text-cyan-700 hover:bg-cyan-200 mt-1"
                                                                onClick={() => handleUpdateMaintenance(m.id, { status: "COMPLETED", adminConfirmedAt: new Date().toISOString() })}
                                                            >
                                                                Confirm Handover
                                                            </button>
                                                        )}
                                                        {m.status === "BUS_READY" && isAdmin && (
                                                            <button
                                                                className="h-6 rounded bg-blue-100 px-1.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200 mt-1"
                                                                onClick={() => handleUpdateMaintenance(m.id, { driverAcceptedAt: new Date().toISOString(), status: "DRIVER_ACCEPTED" })}
                                                            >
                                                                Driver Accepted
                                                            </button>
                                                        )}
                                                        <select
                                                            className="h-7 rounded border px-1 text-xs"
                                                            value={bus?.status || ""}
                                                            onChange={(e) =>
                                                                handleUpdateMaintenance(
                                                                    m.id,
                                                                    {},
                                                                    e.target.value,
                                                                )
                                                            }
                                                        >
                                                            <option value="active">Active</option>
                                                            <option value="maintenance">Maintenance</option>
                                                            <option value="inactive">Inactive</option>
                                                            <option value="retired">Retired</option>
                                                        </select>
                                                        <input
                                                            type="date"
                                                            className="h-7 rounded border px-1 text-xs"
                                                            value={
                                                                m.ownerPickupDate
                                                                    ? m.ownerPickupDate.split("T")[0]
                                                                    : ""
                                                            }
                                                            onChange={(e) =>
                                                                handleUpdateMaintenance(m.id, {
                                                                    ownerPickupDate: e.target.value || null,
                                                                })
                                                            }
                                                            title="Owner pickup date"
                                                        />
                                                        <input
                                                            className="h-7 w-20 rounded border px-1 text-xs"
                                                            placeholder="Cost"
                                                            type="number"
                                                            defaultValue={m.actualCost || ""}
                                                            onBlur={(e) =>
                                                                handleUpdateMaintenance(m.id, {
                                                                    actualCost: e.target.value
                                                                        ? Number(e.target.value)
                                                                        : null,
                                                                })
                                                            }
                                                        />
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
                        <div className="grid gap-4">
                            {maintenances.map((m) => {
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
                                                Mechanic Actions:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <select
                                                    className="h-8 rounded border px-2 text-xs"
                                                    value={m.status}
                                                    onChange={(e) =>
                                                        handleUpdateMaintenance(m.id, {
                                                            status: e.target.value,
                                                            completedDate:
                                                                e.target.value === "COMPLETED"
                                                                    ? new Date().toISOString()
                                                                    : undefined,
                                                        })
                                                    }
                                                >
                                                    <option value="REQUESTED">Requested</option>
                                                    <option value="ACCEPTED">Accepted</option>
                                                    <option value="NOT_FIXABLE">Not Fixable</option>
                                                    <option value="COST_PENDING">Cost Pending</option>
                                                    <option value="COST_APPROVED">Cost Approved</option>
                                                    <option value="SCHEDULED">Scheduled</option>
                                                    <option value="IN_PROGRESS">In Progress</option>
                                                    <option value="PARTS_ORDERED">Parts Ordered</option>
                                                    <option value="REPAIR_DONE">Repair Done</option>
                                                    <option value="AWAITING_PAYMENT">Awaiting Payment</option>
                                                    <option value="PAID">Paid</option>
                                                    <option value="BUS_READY">Bus Ready</option>
                                                    <option value="DRIVER_ACCEPTED">Driver Accepted</option>
                                                    <option value="COMPLETED">Completed</option>
                                                    <option value="CANCELLED">Cancelled</option>
                                                </select>
                                                <select
                                                    className="h-8 rounded border px-2 text-xs"
                                                    value={bus?.status || ""}
                                                    onChange={(e) =>
                                                        handleUpdateMaintenance(
                                                            m.id,
                                                            {},
                                                            e.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="active">Bus: Active</option>
                                                    <option value="maintenance">Bus: Maintenance</option>
                                                    <option value="inactive">Bus: Inactive</option>
                                                    <option value="retired">Bus: Retired</option>
                                                </select>
                                                <input
                                                    type="date"
                                                    className="h-8 rounded border px-2 text-xs"
                                                    value={
                                                        m.ownerPickupDate
                                                            ? m.ownerPickupDate.split("T")[0]
                                                            : ""
                                                    }
                                                    onChange={(e) =>
                                                        handleUpdateMaintenance(m.id, {
                                                            ownerPickupDate: e.target.value || null,
                                                        })
                                                    }
                                                    title="Owner pickup date"
                                                />
                                                <input
                                                    className="h-8 w-32 rounded border px-2 text-xs"
                                                    placeholder="Mechanic notes"
                                                    defaultValue={m.mechanicNotes || ""}
                                                    onBlur={(e) =>
                                                        handleUpdateMaintenance(m.id, {
                                                            mechanicNotes: e.target.value,
                                                        })
                                                    }
                                                />
                                                <input
                                                    className="h-8 w-24 rounded border px-2 text-xs"
                                                    placeholder="Actual cost"
                                                    type="number"
                                                    defaultValue={m.actualCost || ""}
                                                    onBlur={(e) =>
                                                        handleUpdateMaintenance(m.id, {
                                                            actualCost: e.target.value
                                                                ? Number(e.target.value)
                                                                : null,
                                                        })
                                                    }
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
