"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Bus = {
    id: string;
    plateNumber: string;
    sideNumber?: string | null;
    model?: string | null;
    seatCount: number;
    status?: string | null;
    level?: string | null;
    driverName?: string | null;
    imageUrl?: string | null;
    amenities?: any;
    safetyChecklist?: any;
    seatLayout?: any;
    companyName?: string | null;
};

type Route = {
    id: string;
    origin: { name: string; code: string } | null;
    destination: { name: string; code: string } | null;
    distanceKm?: number | null;
    defaultPrice?: number | null;
};

const TRIP_STATUSES = ["SCHEDULED", "CANCELLED", "COMPLETED"] as const;

export default function BusManagementClient() {
    const [buses, setBuses] = useState<Bus[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [newPlateNumber, setNewPlateNumber] = useState("");
    const [newSideNumber, setNewSideNumber] = useState("");
    const [newModel, setNewModel] = useState("");
    const [newLevel, setNewLevel] = useState("");
    const [newDriverName, setNewDriverName] = useState("");
    const [newSeatCount, setNewSeatCount] = useState("");
    const [newStatus, setNewStatus] = useState("active");
    const [newAmenities, setNewAmenities] = useState("");
    const [newSafety, setNewSafety] = useState("");
    const [newSeatLayout, setNewSeatLayout] = useState("");

    const [tripBusId, setTripBusId] = useState("");
    const [tripRouteId, setTripRouteId] = useState("");
    const [tripDepartAt, setTripDepartAt] = useState("");
    const [tripArriveAt, setTripArriveAt] = useState("");
    const [tripPrice, setTripPrice] = useState("");
    const [tripStatus, setTripStatus] = useState("SCHEDULED");

    const fetchData = async (active?: { current: boolean }) => {
        try {
            setLoading(true);
            const [busRes, routeRes] = await Promise.all([
                fetch("/api/buses"),
                fetch("/api/routes"),
            ]);
            if (!busRes.ok || !routeRes.ok) {
                throw new Error("Failed to load bus data.");
            }
            const busData = (await busRes.json()) as Bus[];
            const routeData = (await routeRes.json()) as Route[];
            if (!active || active.current) {
                setBuses(busData || []);
                setRoutes(routeData || []);
            }
        } catch (err: any) {
            if (!active || active.current) {
                setError(err?.message || "Failed to load data.");
            }
        } finally {
            if (!active || active.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        const active = { current: true };
        fetchData(active);
        return () => {
            active.current = false;
        };
    }, []);

    const handleBusSave = async (bus: Bus) => {
        setError(null);
        setMessage(null);
        try {
            const res = await fetch("/api/buses", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(bus),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to update bus.");
            }
            setMessage("Bus updated.");
        } catch (err: any) {
            setError(err?.message || "Failed to update bus.");
        }
    };

    const handleCreateBus = async () => {
        setError(null);
        setMessage(null);
        if (!newPlateNumber.trim() || !newSeatCount.trim()) {
            setError("Plate number and seat count are required.");
            return;
        }

        let parsedLayout: any = undefined;
        if (newSeatLayout.trim()) {
            try {
                parsedLayout = JSON.parse(newSeatLayout);
            } catch (e) {
                setError("Seat layout must be valid JSON.");
                return;
            }
        }

        try {
            const res = await fetch("/api/buses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plateNumber: newPlateNumber.trim(),
                    sideNumber: newSideNumber.trim() || undefined,
                    model: newModel.trim() || undefined,
                    level: newLevel.trim() || undefined,
                    driverName: newDriverName.trim() || undefined,
                    seatCount: Number(newSeatCount),
                    status: newStatus.trim() || undefined,
                    amenities: newAmenities
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    safetyChecklist: newSafety
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    seatLayout: parsedLayout,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to create bus.");
            }

            setNewPlateNumber("");
            setNewSideNumber("");
            setNewModel("");
            setNewLevel("");
            setNewDriverName("");
            setNewSeatCount("");
            setNewStatus("active");
            setNewAmenities("");
            setNewSafety("");
            setNewSeatLayout("");
            setMessage("Bus created.");
            await fetchData();
        } catch (err: any) {
            setError(err?.message || "Failed to create bus.");
        }
    };

    const handleCreateTrip = async () => {
        setError(null);
        setMessage(null);
        if (
            !tripBusId ||
            !tripRouteId ||
            !tripDepartAt ||
            !tripArriveAt ||
            !tripPrice
        ) {
            setError("Please fill all trip fields.");
            return;
        }
        try {
            const res = await fetch("/api/trips", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    busId: tripBusId,
                    routeId: tripRouteId,
                    departAt: tripDepartAt,
                    arriveAt: tripArriveAt,
                    basePrice: tripPrice,
                    status: tripStatus,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to create trip.");
            }
            setMessage("Trip created.");
        } catch (err: any) {
            setError(err?.message || "Failed to create trip.");
        }
    };

    const routeOptions = useMemo(() => {
        return routes.map((route) => ({
            id: route.id,
            label:
                route.origin && route.destination
                    ? `${route.origin.name} (${route.origin.code}) → ${route.destination.name} (${route.destination.code})`
                    : route.id,
            defaultPrice: route.defaultPrice,
        }));
    }, [routes]);

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                Loading buses...
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

            <div className="rounded border bg-card p-4">
                <h3 className="text-sm font-semibold">Assign Trip</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <select
                        className="h-10 rounded border px-3 text-sm"
                        value={tripBusId}
                        onChange={(e) => setTripBusId(e.target.value)}
                    >
                        <option value="">Select bus</option>
                        {buses.map((bus) => (
                            <option key={bus.id} value={bus.id}>
                                {bus.plateNumber}{" "}
                                {bus.model ? `• ${bus.model}` : ""}
                            </option>
                        ))}
                    </select>
                    <select
                        className="h-10 rounded border px-3 text-sm"
                        value={tripRouteId}
                        onChange={(e) => {
                            setTripRouteId(e.target.value);
                            const match = routeOptions.find(
                                (r) => r.id === e.target.value,
                            );
                            if (match?.defaultPrice)
                                setTripPrice(String(match.defaultPrice));
                        }}
                    >
                        <option value="">Select route</option>
                        {routeOptions.map((route) => (
                            <option key={route.id} value={route.id}>
                                {route.label}
                            </option>
                        ))}
                    </select>
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        type="datetime-local"
                        value={tripDepartAt}
                        onChange={(e) => setTripDepartAt(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        type="datetime-local"
                        value={tripArriveAt}
                        onChange={(e) => setTripArriveAt(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Base price"
                        value={tripPrice}
                        onChange={(e) => setTripPrice(e.target.value)}
                    />
                    <select
                        className="h-10 rounded border px-3 text-sm"
                        value={tripStatus}
                        onChange={(e) => setTripStatus(e.target.value)}
                    >
                        {TRIP_STATUSES.map((status) => (
                            <option key={status} value={status}>
                                {status}
                            </option>
                        ))}
                    </select>
                </div>
                <Button className="mt-3" onClick={handleCreateTrip}>
                    Create Trip
                </Button>
            </div>

            <div className="rounded border bg-card p-4">
                <h3 className="text-sm font-semibold">Add Bus</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Plate number"
                        value={newPlateNumber}
                        onChange={(e) => setNewPlateNumber(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Side number"
                        value={newSideNumber}
                        onChange={(e) => setNewSideNumber(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Model"
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Level (Luxury/Standard)"
                        value={newLevel}
                        onChange={(e) => setNewLevel(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Driver name"
                        value={newDriverName}
                        onChange={(e) => setNewDriverName(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Seat count"
                        value={newSeatCount}
                        onChange={(e) => setNewSeatCount(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Status"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                    />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                        <div className="text-[11px] text-muted-foreground">
                            Amenities (comma separated)
                        </div>
                        <textarea
                            className="mt-1 min-h-[80px] w-full rounded border px-3 py-2 text-sm"
                            value={newAmenities}
                            onChange={(e) => setNewAmenities(e.target.value)}
                        />
                    </div>
                    <div>
                        <div className="text-[11px] text-muted-foreground">
                            Safety checklist (comma separated)
                        </div>
                        <textarea
                            className="mt-1 min-h-[80px] w-full rounded border px-3 py-2 text-sm"
                            value={newSafety}
                            onChange={(e) => setNewSafety(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mt-3">
                    <div className="text-[11px] text-muted-foreground">
                        Seat layout (JSON)
                    </div>
                    <textarea
                        className="mt-1 min-h-[100px] w-full rounded border px-3 py-2 text-xs font-mono"
                        value={newSeatLayout}
                        onChange={(e) => setNewSeatLayout(e.target.value)}
                    />
                </div>
                <Button className="mt-3" onClick={handleCreateBus}>
                    Create Bus
                </Button>
            </div>

            {buses.map((bus) => (
                <BusCard key={bus.id} bus={bus} onSave={handleBusSave} />
            ))}
        </div>
    );
}

function BusCard({ bus, onSave }: { bus: Bus; onSave: (bus: Bus) => void }) {
    const [draft, setDraft] = useState<Bus>({ ...bus });
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [showUploader, setShowUploader] = useState(!bus.imageUrl);
    const amenitiesValue = Array.isArray(draft.amenities)
        ? draft.amenities.join(", ")
        : "";
    const safetyValue = Array.isArray(draft.safetyChecklist)
        ? draft.safetyChecklist.join(", ")
        : "";

    return (
        <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="md:col-span-2">
                    <h4 className="text-sm font-semibold">
                        {bus.plateNumber} {bus.model ? `• ${bus.model}` : ""}
                    </h4>
                    <div className="text-[11px] text-muted-foreground">
                        {bus.companyName || ""}
                    </div>
                </div>
                <Badge variant="outline" className="text-[11px]">
                    Seats: {bus.seatCount}
                </Badge>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                    <div className="text-[11px] text-muted-foreground">
                        Bus Image
                    </div>
                    {draft.imageUrl && !showUploader && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowUploader(true)}
                        >
                            Edit Image
                        </Button>
                    )}
                    {(!draft.imageUrl || showUploader) && (
                        <div className="mt-1 flex flex-col gap-2">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                    const file =
                                        event.target.files?.[0] || null;
                                    setSelectedFile(file);
                                }}
                                className="block w-full text-xs"
                            />
                            <Button
                                size="sm"
                                onClick={async () => {
                                    if (!selectedFile) return;
                                    setUploadError(null);
                                    setUploading(true);
                                    try {
                                        const reader = new FileReader();
                                        const base64 =
                                            await new Promise<string>(
                                                (resolve, reject) => {
                                                    reader.onerror = () =>
                                                        reject(
                                                            new Error(
                                                                "Failed to read file.",
                                                            ),
                                                        );
                                                    reader.onload = () =>
                                                        resolve(
                                                            String(
                                                                reader.result ||
                                                                    "",
                                                            ),
                                                        );
                                                    reader.readAsDataURL(
                                                        selectedFile,
                                                    );
                                                },
                                            );

                                        const res = await fetch(
                                            `/api/buses/${bus.id}/image`,
                                            {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type":
                                                        "application/json",
                                                },
                                                body: JSON.stringify({
                                                    fileName: selectedFile.name,
                                                    mimeType: selectedFile.type,
                                                    data: base64,
                                                }),
                                            },
                                        );

                                        if (!res.ok) {
                                            const text = await res
                                                .text()
                                                .catch(() => "");
                                            throw new Error(
                                                text || "Upload failed.",
                                            );
                                        }

                                        const payload = (await res
                                            .json()
                                            .catch(() => ({}))) as {
                                            imageUrl?: string;
                                        };
                                        if (payload?.imageUrl) {
                                            setDraft({
                                                ...draft,
                                                imageUrl: payload.imageUrl,
                                            });
                                        }
                                        setSelectedFile(null);
                                        setShowUploader(false);
                                    } catch (err: any) {
                                        setUploadError(
                                            err?.message || "Upload failed.",
                                        );
                                    } finally {
                                        setUploading(false);
                                    }
                                }}
                                disabled={!selectedFile || uploading}
                            >
                                {uploading ? "Uploading..." : "Upload Image"}
                            </Button>
                            {uploadError && (
                                <div className="text-xs text-destructive">
                                    {uploadError}
                                </div>
                            )}
                        </div>
                    )}
                    {draft.imageUrl && (
                        <img
                            src={draft.imageUrl}
                            alt="Bus"
                            className="mt-2 h-64 w-full rounded object-cover"
                        />
                    )}
                </div>
                <div className="grid gap-3">
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={draft.plateNumber}
                        onChange={(e) =>
                            setDraft({ ...draft, plateNumber: e.target.value })
                        }
                        placeholder="Plate number"
                    />
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={draft.sideNumber || ""}
                        onChange={(e) =>
                            setDraft({ ...draft, sideNumber: e.target.value })
                        }
                        placeholder="Side number"
                    />
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={draft.model || ""}
                        onChange={(e) =>
                            setDraft({ ...draft, model: e.target.value })
                        }
                        placeholder="Model"
                    />
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={draft.level || ""}
                        onChange={(e) =>
                            setDraft({ ...draft, level: e.target.value })
                        }
                        placeholder="Level (Luxury/Standard)"
                    />
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={draft.driverName || ""}
                        onChange={(e) =>
                            setDraft({ ...draft, driverName: e.target.value })
                        }
                        placeholder="Driver name"
                    />
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={String(draft.seatCount)}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                seatCount: Number(e.target.value) || 0,
                            })
                        }
                        placeholder="Seat count"
                    />
                    <input
                        className="h-10 w-full rounded border px-3 text-sm"
                        value={draft.status || ""}
                        onChange={(e) =>
                            setDraft({ ...draft, status: e.target.value })
                        }
                        placeholder="Status"
                    />
                </div>
                <div>
                    <div className="text-[11px] text-muted-foreground">
                        Amenities (comma separated)
                    </div>
                    <textarea
                        className="mt-1 min-h-[80px] w-full rounded border px-3 py-2 text-sm"
                        value={amenitiesValue}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                amenities: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                            })
                        }
                    />
                </div>
                <div>
                    <div className="text-[11px] text-muted-foreground">
                        Safety checklist (comma separated)
                    </div>
                    <textarea
                        className="mt-1 min-h-[80px] w-full rounded border px-3 py-2 text-sm"
                        value={safetyValue}
                        onChange={(e) =>
                            setDraft({
                                ...draft,
                                safetyChecklist: e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean),
                            })
                        }
                    />
                </div>
                <div className="md:col-span-2">
                    <div className="text-[11px] text-muted-foreground">
                        Seat layout (JSON)
                    </div>
                    <textarea
                        className="mt-1 min-h-[80px] w-full rounded border px-3 py-2 text-xs font-mono"
                        value={
                            draft.seatLayout
                                ? JSON.stringify(draft.seatLayout, null, 2)
                                : ""
                        }
                        onChange={(e) => {
                            const raw = e.target.value;
                            try {
                                const parsed = raw ? JSON.parse(raw) : null;
                                setDraft({ ...draft, seatLayout: parsed });
                            } catch {
                                setDraft({ ...draft, seatLayout: raw });
                            }
                        }}
                    />
                </div>
            </div>
            <Button className="mt-3" onClick={() => onSave(draft)}>
                Save Bus
            </Button>
        </div>
    );
}
