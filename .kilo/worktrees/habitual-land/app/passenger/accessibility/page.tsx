"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    Loader2,
    Accessibility,
    Users,
    Armchair,
    Volume2,
    Bus,
    Save,
} from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type TripBus = {
    id: string;
    plateNumber: string;
    model: string | null;
    seatCount: number;
    wheelchairAccessible: boolean;
    womenOnly: boolean;
    hasPrioritySeating: boolean;
    audioAnnouncements: boolean;
};

type TripRoute = {
    id: string;
    origin: { name: string; code: string } | null;
    destination: { name: string; code: string } | null;
};

type AccessibleTrip = {
    id: string;
    departAt: string;
    arriveAt: string;
    basePrice: number;
    status: string;
    bus: TripBus | null;
    route: TripRoute | null;
};

type EditableBus = {
    id: string;
    plateNumber: string;
    model: string | null;
    seatCount: number;
    status: string;
    wheelchairAccessible: boolean;
    womenOnly: boolean;
    hasPrioritySeating: boolean;
    audioAnnouncements: boolean;
    company: { id: string; name: string } | null;
};

type Summary = {
    totalBuses: number;
    wheelchairAccessible: number;
    womenOnly: number;
    hasPrioritySeating: number;
    audioAnnouncements: number;
};

const FILTERS = [
    {
        key: "wheelchair",
        label: "Wheelchair accessible",
        icon: Accessibility,
    },
    { key: "womenOnly", label: "Women-only", icon: Users },
    { key: "priority", label: "Priority seating", icon: Armchair },
    { key: "audio", label: "Audio announcements", icon: Volume2 },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

function routeLabel(route: TripRoute | null) {
    if (!route) return "-";
    const o = route.origin;
    const d = route.destination;
    const origin = o ? `${o.name} (${o.code})` : "-";
    const dest = d ? `${d.name} (${d.code})` : "-";
    return `${origin} → ${dest}`;
}

export default function PassengerAccessibilityPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();

    const role = String((session?.user as any)?.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "staff";

    const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
        wheelchair: false,
        womenOnly: false,
        priority: false,
        audio: false,
    });

    const [trips, setTrips] = useState<AccessibleTrip[]>([]);
    const [loadingTrips, setLoadingTrips] = useState(true);
    const [tripsError, setTripsError] = useState<string | null>(null);

    const [summary, setSummary] = useState<Summary | null>(null);

    const [buses, setBuses] = useState<EditableBus[]>([]);
    const [loadingBuses, setLoadingBuses] = useState(false);
    const [busesError, setBusesError] = useState<string | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [draftFlags, setDraftFlags] = useState<Record<string, EditableBus>>(
        {},
    );

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams({ trips: "1" });
        if (filters.wheelchair) params.set("wheelchair", "1");
        if (filters.womenOnly) params.set("womenOnly", "1");
        if (filters.priority) params.set("priority", "1");
        if (filters.audio) params.set("audio", "1");
        return params.toString();
    }, [filters]);

    // Load matching trips whenever filters change.
    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;

        let active = true;
        (async () => {
            try {
                setLoadingTrips(true);
                setTripsError(null);
                const res = await fetch(
                    `/api/accessibility?${buildQuery()}`,
                );
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load trips.");
                }
                const data = (await res.json()) as { trips: AccessibleTrip[] };
                if (!active) return;
                setTrips(data.trips || []);
            } catch (err: any) {
                if (active) {
                    setTripsError(err?.message || "Failed to load trips.");
                }
            } finally {
                if (active) setLoadingTrips(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, router, buildQuery]);

    // Load summary for everyone.
    useEffect(() => {
        if (status !== "authenticated") return;
        let active = true;
        (async () => {
            try {
                const res = await fetch("/api/accessibility?summary=1");
                if (!res.ok) return;
                const data = (await res.json()) as Summary;
                if (active) setSummary(data);
            } catch {
                // non-fatal
            }
        })();
        return () => {
            active = false;
        };
    }, [status]);

    // Load all buses for the admin edit section.
    useEffect(() => {
        if (status !== "authenticated" || !isAdmin) return;
        let active = true;
        (async () => {
            try {
                setLoadingBuses(true);
                setBusesError(null);
                const res = await fetch("/api/accessibility");
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load buses.");
                }
                const data = (await res.json()) as { buses: EditableBus[] };
                if (!active) return;
                setBuses(data.buses || []);
            } catch (err: any) {
                if (active) {
                    setBusesError(err?.message || "Failed to load buses.");
                }
            } finally {
                if (active) setLoadingBuses(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [status, isAdmin]);

    const toggleFilter = (key: FilterKey) => {
        setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const getDraft = (bus: EditableBus): EditableBus =>
        draftFlags[bus.id] ?? bus;

    const toggleBusFlag = (
        bus: EditableBus,
        flag: keyof Pick<
            EditableBus,
            | "wheelchairAccessible"
            | "womenOnly"
            | "hasPrioritySeating"
            | "audioAnnouncements"
        >,
    ) => {
        const current = getDraft(bus);
        setDraftFlags((prev) => ({
            ...prev,
            [bus.id]: { ...current, [flag]: !current[flag] },
        }));
    };

    const saveBus = async (bus: EditableBus) => {
        const draft = getDraft(bus);
        setSavingId(bus.id);
        try {
            const res = await fetch(`/api/accessibility/${bus.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wheelchairAccessible: draft.wheelchairAccessible,
                    womenOnly: draft.womenOnly,
                    hasPrioritySeating: draft.hasPrioritySeating,
                    audioAnnouncements: draft.audioAnnouncements,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to update bus.");
            }
            const data = (await res.json()) as { bus: EditableBus };
            setBuses((prev) =>
                prev.map((b) => (b.id === bus.id ? data.bus : b)),
            );
            setDraftFlags((prev) => {
                const next = { ...prev };
                delete next[bus.id];
                return next;
            });
            toast({
                title: "Accessibility updated",
                description: `Flags saved for bus ${data.bus.plateNumber}.`,
            });
        } catch (err: any) {
            toast({
                title: "Update failed",
                description: err?.message || "Could not update the bus.",
                variant: "destructive",
            });
        } finally {
            setSavingId(null);
        }
    };

    const renderFlagBadges = (bus: TripBus | EditableBus) => {
        const items: { on: boolean; label: string }[] = [
            { on: bus.wheelchairAccessible, label: "Wheelchair" },
            { on: bus.womenOnly, label: "Women-only" },
            { on: bus.hasPrioritySeating, label: "Priority" },
            { on: bus.audioAnnouncements, label: "Audio" },
        ];
        return items
            .filter((i) => i.on)
            .map((i) => (
                <Badge
                    key={i.label}
                    variant="secondary"
                    className="text-[11px]"
                >
                    {i.label}
                </Badge>
            ));
    };

    const anyFilterActive =
        filters.wheelchair ||
        filters.womenOnly ||
        filters.priority ||
        filters.audio;

    return (
        <DashboardShell>
            <div className="w-full px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        <Accessibility className="h-3.5 w-3.5" />
                        Accessibility & Inclusivity
                    </div>
                    <h1
                        className="mt-3 text-2xl font-semibold tracking-tight"
                        style={{
                            fontFamily:
                                '"Space Grotesk", "DM Serif Display", serif',
                        }}
                    >
                        Find accessible trips
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Filter trips by accessibility features such as
                        wheelchair access, women-only service, priority seating
                        and audio announcements.
                    </p>
                </div>

                {/* Summary */}
                {summary && (
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <Card>
                            <CardContent className="py-3">
                                <div className="text-[11px] uppercase text-muted-foreground">
                                    Total buses
                                </div>
                                <div className="text-lg font-semibold">
                                    {summary.totalBuses}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="py-3">
                                <div className="text-[11px] uppercase text-muted-foreground">
                                    Wheelchair
                                </div>
                                <div className="text-lg font-semibold">
                                    {summary.wheelchairAccessible}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="py-3">
                                <div className="text-[11px] uppercase text-muted-foreground">
                                    Women-only
                                </div>
                                <div className="text-lg font-semibold">
                                    {summary.womenOnly}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="py-3">
                                <div className="text-[11px] uppercase text-muted-foreground">
                                    Priority
                                </div>
                                <div className="text-lg font-semibold">
                                    {summary.hasPrioritySeating}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="py-3">
                                <div className="text-[11px] uppercase text-muted-foreground">
                                    Audio
                                </div>
                                <div className="text-lg font-semibold">
                                    {summary.audioAnnouncements}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Filter toggles */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Filter by accessibility</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-3">
                            {FILTERS.map((f) => {
                                const Icon = f.icon;
                                const active = filters[f.key];
                                return (
                                    <button
                                        key={f.key}
                                        type="button"
                                        onClick={() => toggleFilter(f.key)}
                                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                                            active
                                                ? "border-primary bg-primary text-primary-foreground"
                                                : "bg-card text-foreground hover:border-primary/60"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                        {anyFilterActive && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setFilters({
                                            wheelchair: false,
                                            womenOnly: false,
                                            priority: false,
                                            audio: false,
                                        })
                                    }
                                >
                                    Clear filters
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Matching trips */}
                <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                        {anyFilterActive
                            ? "Matching trips"
                            : "All upcoming trips"}
                    </h2>
                </div>

                {loadingTrips && (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                            Loading trips...
                        </CardContent>
                    </Card>
                )}

                {!loadingTrips && tripsError && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {tripsError}
                    </div>
                )}

                {!loadingTrips && !tripsError && trips.length === 0 && (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            No trips match the selected accessibility
                            filters. Try clearing some filters.
                        </CardContent>
                    </Card>
                )}

                {!loadingTrips && !tripsError && trips.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                        {trips.map((trip) => (
                            <Card key={trip.id}>
                                <CardContent className="space-y-3 py-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-sm font-semibold">
                                            {routeLabel(trip.route)}
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="text-[11px]"
                                        >
                                            {trip.status}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <div className="text-[11px] uppercase text-muted-foreground">
                                                Departure
                                            </div>
                                            <div className="font-medium">
                                                {formatDateTime(trip.departAt)}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] uppercase text-muted-foreground">
                                                Arrival
                                            </div>
                                            <div className="font-medium">
                                                {formatDateTime(trip.arriveAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Bus className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">
                                            {trip.bus?.plateNumber || "-"}
                                        </span>
                                        {trip.bus?.model && (
                                            <span className="text-muted-foreground">
                                                · {trip.bus.model}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {trip.bus
                                            ? renderFlagBadges(trip.bus)
                                            : null}
                                        {!trip.bus?.wheelchairAccessible &&
                                            !trip.bus?.womenOnly &&
                                            !trip.bus?.hasPrioritySeating &&
                                            !trip.bus?.audioAnnouncements && (
                                                <span className="text-[11px] text-muted-foreground">
                                                    No accessibility flags
                                                </span>
                                            )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Admin-only edit section */}
                {isAdmin && (
                    <div className="mt-10">
                        <div className="mb-3">
                            <h2 className="text-lg font-semibold">
                                Manage bus accessibility flags
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Toggle accessibility features for each bus.
                                Changes apply immediately to trip filtering.
                            </p>
                        </div>

                        {loadingBuses && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                    Loading buses...
                                </CardContent>
                            </Card>
                        )}

                        {!loadingBuses && busesError && (
                            <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                {busesError}
                            </div>
                        )}

                        {!loadingBuses && !busesError && buses.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                    No buses found.
                                </CardContent>
                            </Card>
                        )}

                        {!loadingBuses && !busesError && buses.length > 0 && (
                            <div className="space-y-3">
                                {buses.map((bus) => {
                                    const draft = getDraft(bus);
                                    const dirty =
                                        !!draftFlags[bus.id];
                                    return (
                                        <Card key={bus.id}>
                                            <CardContent className="space-y-3 py-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                                        <Bus className="h-4 w-4 text-muted-foreground" />
                                                        {bus.plateNumber}
                                                        {bus.model && (
                                                            <span className="font-normal text-muted-foreground">
                                                                · {bus.model}
                                                            </span>
                                                        )}
                                                        {bus.company && (
                                                            <span className="font-normal text-muted-foreground">
                                                                · {bus.company.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[11px]"
                                                    >
                                                        {bus.status}
                                                    </Badge>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(
                                                        [
                                                            [
                                                                "wheelchairAccessible",
                                                                "Wheelchair accessible",
                                                            ],
                                                            [
                                                                "womenOnly",
                                                                "Women-only",
                                                            ],
                                                            [
                                                                "hasPrioritySeating",
                                                                "Priority seating",
                                                            ],
                                                            [
                                                                "audioAnnouncements",
                                                                "Audio announcements",
                                                            ],
                                                        ] as const
                                                    ).map(([flag, label]) => {
                                                        const on =
                                                            draft[flag];
                                                        return (
                                                            <button
                                                                key={flag}
                                                                type="button"
                                                                onClick={() =>
                                                                    toggleBusFlag(
                                                                        bus,
                                                                        flag,
                                                                    )
                                                                }
                                                                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                                                                    on
                                                                        ? "border-primary bg-primary text-primary-foreground"
                                                                        : "bg-card text-foreground hover:border-primary/60"
                                                                }`}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex justify-end">
                                                    <Button
                                                        size="sm"
                                                        onClick={() =>
                                                            saveBus(bus)
                                                        }
                                                        disabled={
                                                            !dirty ||
                                                            savingId ===
                                                                bus.id
                                                        }
                                                    >
                                                        {savingId ===
                                                        bus.id ? (
                                                            <>
                                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                Saving...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Save className="mr-1.5 h-3.5 w-3.5" />
                                                                Save
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
