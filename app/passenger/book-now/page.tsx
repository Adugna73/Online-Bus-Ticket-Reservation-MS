"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Ticket, Timer, Search, MapPin } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
} from "@/components/ui/card";

type TripCard = {
    id: string;
    departAt: string;
    arriveAt: string;
    basePrice: number;
    status: string;
    route: {
        origin: { name: string; code: string } | null;
        destination: { name: string; code: string } | null;
    } | null;
    bus: {
        plateNumber: string;
        model?: string | null;
        seatCount: number;
        imageUrl?: string | null;
    } | null;
    bookedSeats: number;
    availableSeats: number;
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

export default function BookNowPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [trips, setTrips] = useState<TripCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const role = (session?.user?.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "supervisor" || role === "staff";

    const [originFilter, setOriginFilter] = useState("");
    const [destinationFilter, setDestinationFilter] = useState("");
    const [dateFilter, setDateFilter] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;

        let active = true;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch("/api/trips", { credentials: "include" });
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load trips.");
                }
                const data = (await res.json()) as TripCard[];
                if (active) setTrips(data || []);
            } catch (err: any) {
                if (active) setError(err?.message || "Failed to load trips.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, router]);

    const upcoming = useMemo(
        () =>
            trips.filter((t) => {
                const depart = new Date(t.departAt).getTime();
                return Number.isFinite(depart) && depart >= Date.now();
            }),
        [trips],
    );

    const origins = useMemo(() => {
        const set = new Map<string, string>();
        for (const t of upcoming) {
            if (t.route?.origin) {
                set.set(t.route.origin.name, t.route.origin.code || "");
            }
        }
        return Array.from(set.entries()).map(([name, code]) => ({ name, code }));
    }, [upcoming]);

    const destinations = useMemo(() => {
        const set = new Map<string, string>();
        for (const t of upcoming) {
            if (t.route?.destination) {
                set.set(t.route.destination.name, t.route.destination.code || "");
            }
        }
        return Array.from(set.entries()).map(([name, code]) => ({ name, code }));
    }, [upcoming]);

    const filtered = useMemo(() => {
        return upcoming.filter((t) => {
            if (originFilter && t.route?.origin?.name !== originFilter)
                return false;
            if (
                destinationFilter &&
                t.route?.destination?.name !== destinationFilter
            )
                return false;
            if (dateFilter) {
                const tripDate = new Date(t.departAt).toISOString().split("T")[0];
                if (tripDate !== dateFilter) return false;
            }
            return true;
        });
    }, [upcoming, originFilter, destinationFilter, dateFilter]);

    const hasFilters = originFilter || destinationFilter || dateFilter;

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            <Ticket className="h-3.5 w-3.5" />
                            Seat Availability
                        </div>
                        <h1
                            className="mt-3 text-2xl font-semibold tracking-tight"
                            style={{
                                fontFamily:
                                    '"Space Grotesk", "DM Serif Display", serif',
                            }}
                        >
                            {isStaff ? "Book for Passenger" : "Book your seat"}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {isStaff
                                ? "Search routes and book seats for a passenger."
                                : "Pick an upcoming trip, then choose your seats on the live seat map."}
                        </p>
                    </div>
                </div>

                {/* Route search filters */}
                {!loading && !error && upcoming.length > 0 && (
                    <div className="mb-6 rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">
                                Search Routes
                            </span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-4">
                            <div>
                                <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                    <MapPin className="h-3 w-3" /> From
                                </label>
                                <select
                                    className="h-10 w-full rounded border px-3 text-sm bg-background"
                                    value={originFilter}
                                    onChange={(e) =>
                                        setOriginFilter(e.target.value)
                                    }
                                >
                                    <option value="">All origins</option>
                                    {origins.map((o) => (
                                        <option key={o.name} value={o.name}>
                                            {o.name} {o.code && `(${o.code})`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                    <MapPin className="h-3 w-3" /> To
                                </label>
                                <select
                                    className="h-10 w-full rounded border px-3 text-sm bg-background"
                                    value={destinationFilter}
                                    onChange={(e) =>
                                        setDestinationFilter(e.target.value)
                                    }
                                >
                                    <option value="">All destinations</option>
                                    {destinations.map((d) => (
                                        <option key={d.name} value={d.name}>
                                            {d.name} {d.code && `(${d.code})`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground mb-1 block">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    className="h-10 w-full rounded border px-3 text-sm bg-background"
                                    value={dateFilter}
                                    onChange={(e) =>
                                        setDateFilter(e.target.value)
                                    }
                                />
                            </div>
                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    disabled={!hasFilters}
                                    onClick={() => {
                                        setOriginFilter("");
                                        setDestinationFilter("");
                                        setDateFilter("");
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        </div>
                        {hasFilters && (
                            <p className="mt-2 text-xs text-muted-foreground">
                                Showing {filtered.length} of {upcoming.length} trips
                            </p>
                        )}
                    </div>
                )}

                {loading && (
                    <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading upcoming trips...
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            {hasFilters
                                ? "No trips match your search. Try clearing filters."
                                : "No upcoming trips are available right now. Please check back later."}
                        </CardContent>
                    </Card>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {filtered.map((trip, index) => {
                            const imageSrc =
                                trip.bus?.imageUrl ||
                                (index % 2 === 0
                                    ? "/images/bus-card-1.svg"
                                    : "/images/bus-card-2.svg");
                            const origin = trip.route?.origin
                                ? `${trip.route.origin.name} (${trip.route.origin.code})`
                                : "-";
                            const destination = trip.route?.destination
                                ? `${trip.route.destination.name} (${trip.route.destination.code})`
                                : "-";
                            const available = trip.availableSeats;
                            return (
                                <div
                                    key={trip.id}
                                    className="group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                                >
                                    <div className="relative h-56 w-full bg-neutral-950">
                                        <Image
                                            src={imageSrc}
                                            alt="Bus"
                                            fill
                                            className="object-contain"
                                            loading={
                                                index === 0 ? "eager" : "lazy"
                                            }
                                            priority={index === 0}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white">
                                            <Badge className="bg-white/20 text-white">
                                                {trip.bus?.model || "Coach"}
                                            </Badge>
                                            <Badge className="bg-emerald-500/80 text-white">
                                                {trip.bus?.plateNumber || "-"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold">
                                                {origin} → {destination}
                                            </div>
                                            <div className="text-sm font-semibold text-emerald-600">
                                                {trip.basePrice.toFixed(2)} ETB
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                            <Timer className="h-3.5 w-3.5" />
                                            {formatDateTime(trip.departAt)}
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className="text-[11px]"
                                            >
                                                Seats: {available} left
                                            </Badge>
                                            <Badge
                                                variant="outline"
                                                className="text-[11px]"
                                            >
                                                Total:{" "}
                                                {trip.bus?.seatCount || 0}
                                            </Badge>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <div className="text-xs text-muted-foreground">
                                                {trip.status}
                                            </div>
                                            <Button
                                                size="sm"
                                                disabled={available <= 0}
                                                onClick={() =>
                                                    router.push(
                                                        `/passenger/book-now/${trip.id}`,
                                                    )
                                                }
                                            >
                                                {available > 0
                                                    ? "Select Seats"
                                                    : "Sold Out"}
                                            </Button>
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
