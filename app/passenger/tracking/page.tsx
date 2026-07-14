"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, MapPin, AlertTriangle, Navigation, Clock } from "lucide-react";

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

type BookingTrip = {
    id: string;
    bookingRef: string;
    status: string;
    trip: {
        id: string;
        departAt: string;
        arriveAt: string;
        status: string;
        bus: {
            id: string;
            plateNumber: string;
            model?: string | null;
        } | null;
        route: {
            origin: { name: string; code: string } | null;
            destination: { name: string; code: string } | null;
        } | null;
    } | null;
};

type TripTracking = {
    tripId: string;
    busId: string;
    status: string;
    departAt: string;
    arriveAt: string;
    location: {
        id: string;
        lat: number;
        lng: number;
        speed: number | null;
        heading: number | null;
        etaMinutes: number | null;
        recordedAt: string;
    } | null;
    etaMinutes: number | null;
};

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

function formatTimeAgo(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const diff = Math.max(0, Date.now() - date.getTime());
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
}

export default function PassengerTrackingPage() {
    const { status } = useSession();
    const router = useRouter();
    const { toast } = useToast();

    const [bookings, setBookings] = useState<BookingTrip[]>([]);
    const [loadingBookings, setLoadingBookings] = useState(true);
    const [bookingsError, setBookingsError] = useState<string | null>(null);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tracking, setTracking] = useState<TripTracking | null>(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState<string | null>(null);

    const [sendingSos, setSendingSos] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load the user's bookings, then keep upcoming trips.
    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;

        let active = true;
        (async () => {
            try {
                setLoadingBookings(true);
                const res = await fetch("/api/bookings");
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load bookings.");
                }
                const data = (await res.json()) as BookingTrip[];
                if (!active) return;
                const now = Date.now();
                const upcoming = (data || []).filter((b) => {
                    if (!b.trip) return false;
                    if (
                        b.status === "CANCELLED" ||
                        b.status === "COMPLETED"
                    ) {
                        return false;
                    }
                    if (
                        b.trip.status === "CANCELLED" ||
                        b.trip.status === "COMPLETED"
                    ) {
                        return false;
                    }
                    return new Date(b.trip.departAt).getTime() >= now;
                });
                setBookings(upcoming);
            } catch (err: any) {
                if (active) {
                    setBookingsError(
                        err?.message || "Failed to load bookings.",
                    );
                }
            } finally {
                if (active) setLoadingBookings(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, router]);

    const selectedBooking = bookings.find(
        (b) => b.trip?.id === selectedId,
    );

    // Fetch tracking for the selected trip.
    const fetchTracking = async (tripId: string) => {
        try {
            setTrackingError(null);
            const res = await fetch(`/api/tracking?tripId=${tripId}`);
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to load tracking data.");
            }
            const data = (await res.json()) as TripTracking;
            setTracking(data);
        } catch (err: any) {
            setTrackingError(err?.message || "Failed to load tracking data.");
        }
    };

    // When selection changes, fetch immediately then poll every 10s.
    useEffect(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
        if (!selectedId) {
            setTracking(null);
            setTrackingError(null);
            return;
        }

        let active = true;
        (async () => {
            setTrackingLoading(true);
            await fetchTracking(selectedId);
            if (active) setTrackingLoading(false);
        })();

        pollRef.current = setInterval(() => {
            fetchTracking(selectedId);
        }, 10000);

        return () => {
            active = false;
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const handleSos = async () => {
        if (!selectedBooking?.trip) return;
        setSendingSos(true);
        try {
            const res = await fetch("/api/tracking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "sos",
                    bookingId: selectedBooking.id,
                    busId: selectedBooking.trip.bus?.id || null,
                    lat: tracking?.location?.lat ?? null,
                    lng: tracking?.location?.lng ?? null,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to send SOS alert.");
            }
            toast({
                title: "SOS alert sent",
                description:
                    "Your emergency alert has been raised. Help is on the way.",
            });
        } catch (err: any) {
            toast({
                title: "SOS failed",
                description:
                    err?.message || "Could not send the SOS alert.",
                variant: "destructive",
            });
        } finally {
            setSendingSos(false);
        }
    };

    const routeLabel = (b: BookingTrip) => {
        const o = b.trip?.route?.origin;
        const d = b.trip?.route?.destination;
        const origin = o ? `${o.name} (${o.code})` : "-";
        const dest = d ? `${d.name} (${d.code})` : "-";
        return `${origin} → ${dest}`;
    };

    return (
        <DashboardShell>
            <div className="w-full px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        <MapPin className="h-3.5 w-3.5" />
                        Live Tracking
                    </div>
                    <h1
                        className="mt-3 text-2xl font-semibold tracking-tight"
                        style={{
                            fontFamily:
                                '"Space Grotesk", "DM Serif Display", serif',
                        }}
                    >
                        Track your bus in real time
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Select an upcoming trip to view the latest bus
                        location, speed and estimated arrival.
                    </p>
                </div>

                {loadingBookings && (
                    <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading your trips...
                    </div>
                )}

                {!loadingBookings && bookingsError && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {bookingsError}
                    </div>
                )}

                {!loadingBookings &&
                    !bookingsError &&
                    bookings.length === 0 && (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                You have no upcoming trips to track. Book a
                                trip to see live tracking here.
                            </CardContent>
                        </Card>
                    )}

                {!loadingBookings &&
                    !bookingsError &&
                    bookings.length > 0 && (
                        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                            {/* Trip list */}
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold text-muted-foreground">
                                    Upcoming trips
                                </h2>
                                {bookings.map((b) => {
                                    const isSelected =
                                        b.trip?.id === selectedId;
                                    return (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() =>
                                                setSelectedId(b.trip?.id || null)
                                            }
                                            className={`w-full rounded-lg border bg-card p-3 text-left transition hover:border-primary/60 ${
                                                isSelected
                                                    ? "border-primary ring-1 ring-primary"
                                                    : ""
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-semibold">
                                                    {routeLabel(b)}
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[11px]"
                                                >
                                                    {b.trip?.bus?.plateNumber ||
                                                        "-"}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="h-3.5 w-3.5" />
                                                {formatDateTime(
                                                    b.trip?.departAt,
                                                )}
                                            </div>
                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                Ref: {b.bookingRef}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Tracking detail */}
                            <div>
                                {!selectedId && (
                                    <Card>
                                        <CardContent className="py-16 text-center text-sm text-muted-foreground">
                                            Select a trip on the left to start
                                            tracking.
                                        </CardContent>
                                    </Card>
                                )}

                                {selectedId && (
                                    <div className="space-y-4">
                                        {trackingLoading && !tracking && (
                                            <Card>
                                                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                                    Loading tracking data...
                                                </CardContent>
                                            </Card>
                                        )}

                                        {trackingError && (
                                            <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                                {trackingError}
                                            </div>
                                        )}

                                        {tracking && (
                                            <>
                                                <Card>
                                                    <CardHeader className="flex flex-row items-center justify-between">
                                                        <CardTitle>
                                                            {selectedBooking
                                                                ? routeLabel(
                                                                      selectedBooking,
                                                                  )
                                                                : "Trip"}
                                                        </CardTitle>
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-[11px]"
                                                        >
                                                            {tracking.status}
                                                        </Badge>
                                                    </CardHeader>
                                                    <CardContent className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <div className="text-[11px] uppercase text-muted-foreground">
                                                                    Departure
                                                                </div>
                                                                <div className="font-medium">
                                                                    {formatDateTime(
                                                                        tracking.departAt,
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[11px] uppercase text-muted-foreground">
                                                                    Arrival
                                                                </div>
                                                                <div className="font-medium">
                                                                    {formatDateTime(
                                                                        tracking.arriveAt,
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>

                                                <Card>
                                                    <CardHeader>
                                                        <CardTitle>
                                                            Bus location
                                                        </CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-4">
                                                        {tracking.location ? (
                                                            <>
                                                                {/* Map placeholder */}
                                                                <div className="relative h-56 w-full overflow-hidden rounded-lg border bg-[#e8eef5]">
                                                                    <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#c7d6e5 1px, transparent 1px), linear-gradient(90deg, #c7d6e5 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
                                                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                                                                        <div className="flex flex-col items-center">
                                                                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                                                                                <Navigation className="h-4 w-4" />
                                                                            </div>
                                                                            <div className="mt-1 rounded bg-background/90 px-2 py-0.5 text-[10px] font-medium shadow-sm">
                                                                                {selectedBooking?.trip?.bus?.plateNumber ||
                                                                                    "Bus"}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm">
                                                                        Map preview
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                                                    <div>
                                                                        <div className="text-[11px] uppercase text-muted-foreground">
                                                                            Latitude
                                                                        </div>
                                                                        <div className="font-medium">
                                                                            {tracking.location.lat.toFixed(
                                                                                5,
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[11px] uppercase text-muted-foreground">
                                                                            Longitude
                                                                        </div>
                                                                        <div className="font-medium">
                                                                            {tracking.location.lng.toFixed(
                                                                                5,
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[11px] uppercase text-muted-foreground">
                                                                            Speed
                                                                        </div>
                                                                        <div className="font-medium">
                                                                            {tracking.location.speed !=
                                                                            null
                                                                                ? `${tracking.location.speed.toFixed(
                                                                                      0,
                                                                                  )} km/h`
                                                                                : "-"}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[11px] uppercase text-muted-foreground">
                                                                            ETA
                                                                        </div>
                                                                        <div className="font-medium">
                                                                            {tracking.etaMinutes !=
                                                                            null
                                                                                ? `${tracking.etaMinutes} min`
                                                                                : "-"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                                    <Clock className="h-3.5 w-3.5" />
                                                                    Last
                                                                    updated{" "}
                                                                    {formatTimeAgo(
                                                                        tracking
                                                                            .location
                                                                            .recordedAt,
                                                                    )}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <div className="py-6 text-center text-sm text-muted-foreground">
                                                                No location
                                                                data has been
                                                                reported for
                                                                this bus yet.
                                                            </div>
                                                        )}
                                                    </CardContent>
                                                </Card>

                                                <Card>
                                                    <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <AlertTriangle className="h-4 w-4 text-destructive" />
                                                            <span>
                                                                In an
                                                                emergency,
                                                                raise an SOS
                                                                alert to
                                                                notify
                                                                operators.
                                                            </span>
                                                        </div>
                                                        <Button
                                                            variant="destructive"
                                                            onClick={
                                                                handleSos
                                                            }
                                                            disabled={
                                                                sendingSos
                                                            }
                                                        >
                                                            {sendingSos
                                                                ? "Sending..."
                                                                : "Send SOS"}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
            </div>
        </DashboardShell>
    );
}
