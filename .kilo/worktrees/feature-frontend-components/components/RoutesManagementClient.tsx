"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type StationOption = {
    id: string;
    name: string;
    code: string;
};

type RouteItem = {
    id: string;
    origin: StationOption | null;
    destination: StationOption | null;
    distanceKm?: number | null;
    defaultPrice?: number | null;
};

export default function RoutesManagementClient() {
    const { data: session } = useSession();
    const [routes, setRoutes] = useState<RouteItem[]>([]);
    const [stations, setStations] = useState<StationOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [originInput, setOriginInput] = useState("");
    const [destinationInput, setDestinationInput] = useState("");
    const [distanceKm, setDistanceKm] = useState("");
    const [defaultPrice, setDefaultPrice] = useState("");

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                setLoading(true);
                const [routesRes, stationsRes] = await Promise.all([
                    fetch("/api/routes"),
                    fetch("/api/stations"),
                ]);
                if (!routesRes.ok || !stationsRes.ok) {
                    throw new Error("Failed to load routes.");
                }
                const routesData = (await routesRes.json()) as RouteItem[];
                const stationsData =
                    (await stationsRes.json()) as StationOption[];
                if (active) {
                    setRoutes(routesData || []);
                    setStations(stationsData || []);
                }
            } catch (err: any) {
                if (active) setError(err?.message || "Failed to load data.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [session?.user]);

    const stationLabel = useMemo(() => {
        const map = new Map(stations.map((s) => [s.id, s]));
        return (id: string) => {
            const station = map.get(id);
            return station ? `${station.name} (${station.code})` : "-";
        };
    }, [stations]);

    const normalizeStationInput = (value: string) =>
        value
            .toLowerCase()
            .replace(/\s+/g, "")
            .replace(/[()]/g, "")
            .replace(/[^a-z0-9]/g, "")
            .trim();

    const resolveStationId = (value: string) => {
        const rawText = value.trim();
        if (!rawText) return "";
        const inputNorm = normalizeStationInput(rawText);
        const tokens = (rawText.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
            Boolean,
        );

        const byExact = stations.find((s) => {
            const nameNorm = normalizeStationInput(s.name);
            const codeNorm = normalizeStationInput(s.code);
            const labelNorm = normalizeStationInput(`${s.name} (${s.code})`);
            return (
                nameNorm === inputNorm ||
                codeNorm === inputNorm ||
                labelNorm === inputNorm ||
                tokens.includes(codeNorm)
            );
        });
        if (byExact) return byExact.id;

        const byPartial = stations.find((s) => {
            const nameNorm = normalizeStationInput(s.name);
            const codeNorm = normalizeStationInput(s.code);
            return (
                inputNorm.includes(nameNorm) ||
                inputNorm.includes(codeNorm) ||
                nameNorm.includes(inputNorm) ||
                codeNorm.includes(inputNorm) ||
                tokens.some(
                    (token) =>
                        nameNorm.includes(token) || codeNorm.includes(token),
                )
            );
        });
        return byPartial?.id || "";
    };

    const parseStationInput = (value: string) => {
        const raw = value.trim();
        if (!raw) return null;
        const match = raw.match(/^(.*)\(([^)]+)\)\s*$/);
        if (match) {
            return {
                name: match[1].trim(),
                code: match[2].trim().toUpperCase(),
            };
        }
        return null;
    };

    const createStationIfMissing = async (value: string) => {
        const parsed = parseStationInput(value);
        if (!parsed) return "";
        const res = await fetch("/api/stations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: parsed.name,
                code: parsed.code,
                city: parsed.name,
            }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(text || "Failed to create station.");
        }
        const created = (await res.json()) as StationOption;
        if (created?.id) {
            setStations((prev) => {
                const exists = prev.some((s) => s.id === created.id);
                return exists ? prev : [...prev, created];
            });
            return created.id;
        }
        return "";
    };

    const refreshRoutes = async () => {
        const res = await fetch("/api/routes");
        if (!res.ok) return;
        const data = (await res.json()) as RouteItem[];
        setRoutes(data || []);
    };

    const handleCreateRoute = async () => {
        setError(null);
        setMessage(null);
        let originId = resolveStationId(originInput);
        let destinationId = resolveStationId(destinationInput);
        try {
            if (!originId) {
                originId = await createStationIfMissing(originInput);
            }
            if (!destinationId) {
                destinationId = await createStationIfMissing(destinationInput);
            }
        } catch (err: any) {
            setError(err?.message || "Failed to create station.");
            return;
        }
        console.log("[routes:create] input", {
            originInput,
            destinationInput,
            originId,
            destinationId,
        });
        if (!originId || !destinationId) {
            const missing = [
                !originId ? "origin" : null,
                !destinationId ? "destination" : null,
            ]
                .filter(Boolean)
                .join(" and ");
            if (!originId || !destinationId) {
                const helper =
                    "Use existing stations or type like 'Nekemte (NKMT)'.";
                setError(`Please select ${missing}. ${helper}`);
                return;
            }
            console.warn("[routes:create] missing", {
                originInput,
                destinationInput,
                originId,
                destinationId,
                missing,
            });
            return;
        }
        setOriginInput(stationLabel(originId));
        setDestinationInput(stationLabel(destinationId));
        try {
            const res = await fetch("/api/routes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    originStationId: originId,
                    destinationStationId: destinationId,
                    distanceKm: distanceKm ? Number(distanceKm) : undefined,
                    defaultPrice: defaultPrice
                        ? Number(defaultPrice)
                        : undefined,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                console.error("[routes:create] failed", res.status, text);
                throw new Error(text || "Failed to create route.");
            }
            setOriginInput("");
            setDestinationInput("");
            setDistanceKm("");
            setDefaultPrice("");
            setMessage("Route created.");
            await refreshRoutes();
        } catch (err: any) {
            setError(err?.message || "Failed to create route.");
        }
    };

    const handleUpdate = async (route: RouteItem) => {
        setError(null);
        setMessage(null);
        try {
            const res = await fetch("/api/routes", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: route.id,
                    originStationId: route.origin?.id || undefined,
                    destinationStationId: route.destination?.id || undefined,
                    distanceKm:
                        route.distanceKm !== undefined
                            ? Number(route.distanceKm)
                            : undefined,
                    defaultPrice:
                        route.defaultPrice !== undefined
                            ? Number(route.defaultPrice)
                            : undefined,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to update route.");
            }
            setMessage("Route updated.");
            await refreshRoutes();
        } catch (err: any) {
            setError(err?.message || "Failed to update route.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this route?")) return;
        setError(null);
        setMessage(null);
        try {
            const res = await fetch(`/api/routes?id=${id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to delete route.");
            }
            setMessage("Route deleted.");
            await refreshRoutes();
        } catch (err: any) {
            setError(err?.message || "Failed to delete route.");
        }
    };

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                Loading routes...
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
                <h3 className="text-sm font-semibold">Add Route</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                        <input
                            className="h-10 w-full rounded border px-3 text-sm"
                            list="stations-list"
                            placeholder="Origin (type name or code)"
                            value={originInput}
                            onChange={(e) => setOriginInput(e.target.value)}
                        />
                    </div>
                    <div>
                        <input
                            className="h-10 w-full rounded border px-3 text-sm"
                            list="stations-list"
                            placeholder="Destination (type name or code)"
                            value={destinationInput}
                            onChange={(e) =>
                                setDestinationInput(e.target.value)
                            }
                        />
                    </div>
                    <datalist id="stations-list">
                        {stations.map((station) => (
                            <option
                                key={station.id}
                                value={`${station.name} (${station.code})`}
                            />
                        ))}
                    </datalist>
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Distance (km)"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                    />
                    <input
                        className="h-10 rounded border px-3 text-sm"
                        placeholder="Default price"
                        value={defaultPrice}
                        onChange={(e) => setDefaultPrice(e.target.value)}
                    />
                </div>
                <Button className="mt-3" onClick={handleCreateRoute}>
                    Create Route
                </Button>
            </div>

            <div className="grid gap-4">
                {routes.map((route) => (
                    <RouteCard
                        key={route.id}
                        route={route}
                        stations={stations}
                        stationLabel={stationLabel}
                        resolveStationId={resolveStationId}
                        onSave={handleUpdate}
                        onDelete={handleDelete}
                    />
                ))}
            </div>
        </div>
    );
}

function RouteCard({
    route,
    stations,
    stationLabel,
    resolveStationId,
    onSave,
    onDelete,
}: {
    route: RouteItem;
    stations: StationOption[];
    stationLabel: (id: string) => string;
    resolveStationId: (value: string) => string;
    onSave: (route: RouteItem) => void;
    onDelete: (id: string) => void;
}) {
    const [draft, setDraft] = useState<RouteItem>({ ...route });
    const [originText, setOriginText] = useState(
        route.origin ? `${route.origin.name} (${route.origin.code})` : "",
    );
    const [destinationText, setDestinationText] = useState(
        route.destination
            ? `${route.destination.name} (${route.destination.code})`
            : "",
    );

    return (
        <div className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">
                    {draft.origin?.name
                        ? `${draft.origin.name} (${draft.origin.code})`
                        : "-"}{" "}
                    →{" "}
                    {draft.destination?.name
                        ? `${draft.destination.name} (${draft.destination.code})`
                        : "-"}
                </div>
                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDelete(draft.id)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                    className="h-10 w-full rounded border px-3 text-sm"
                    list={`stations-list-${route.id}-origin`}
                    placeholder="Origin (type name or code)"
                    value={originText}
                    onChange={(e) => {
                        const input = e.target.value;
                        setOriginText(input);
                        const resolvedId = resolveStationId(input);
                        const resolved = stations.find(
                            (s) => s.id === resolvedId,
                        );
                        if (resolved) setDraft({ ...draft, origin: resolved });
                    }}
                />
                <datalist id={`stations-list-${route.id}-origin`}>
                    {stations.map((station) => (
                        <option
                            key={station.id}
                            value={`${station.name} (${station.code})`}
                        />
                    ))}
                </datalist>
                <input
                    className="h-10 w-full rounded border px-3 text-sm"
                    list={`stations-list-${route.id}-destination`}
                    placeholder="Destination (type name or code)"
                    value={destinationText}
                    onChange={(e) => {
                        const input = e.target.value;
                        setDestinationText(input);
                        const resolvedId = resolveStationId(input);
                        const resolved = stations.find(
                            (s) => s.id === resolvedId,
                        );
                        if (resolved)
                            setDraft({ ...draft, destination: resolved });
                    }}
                />
                <datalist id={`stations-list-${route.id}-destination`}>
                    {stations.map((station) => (
                        <option
                            key={station.id}
                            value={`${station.name} (${station.code})`}
                        />
                    ))}
                </datalist>
                <input
                    className="h-10 rounded border px-3 text-sm"
                    value={
                        draft.distanceKm !== null &&
                        draft.distanceKm !== undefined
                            ? String(draft.distanceKm)
                            : ""
                    }
                    onChange={(e) =>
                        setDraft({
                            ...draft,
                            distanceKm: e.target.value
                                ? Number(e.target.value)
                                : null,
                        })
                    }
                    placeholder="Distance (km)"
                />
                <input
                    className="h-10 rounded border px-3 text-sm"
                    value={
                        draft.defaultPrice !== null &&
                        draft.defaultPrice !== undefined
                            ? String(draft.defaultPrice)
                            : ""
                    }
                    onChange={(e) =>
                        setDraft({
                            ...draft,
                            defaultPrice: e.target.value
                                ? Number(e.target.value)
                                : null,
                        })
                    }
                    placeholder="Default price"
                />
            </div>
            <Button className="mt-3" onClick={() => onSave(draft)}>
                Save Route
            </Button>
        </div>
    );
}
