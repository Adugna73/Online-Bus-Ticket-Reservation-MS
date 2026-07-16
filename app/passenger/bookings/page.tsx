"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Ticket, Timer } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export default function PassengerMarketplacePage() {
    const { status } = useSession();
    const router = useRouter();
    const [trips, setTrips] = useState<TripCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);

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

    const handleBook = async (tripId: string) => {
        if (bookingId) return;
        setBookingId(tripId);
        setError(null);
        router.push(`/passenger/book-now/${tripId}`);
    };

    const heroSubtitle = useMemo(
        () =>
            "Pick your trip, see the bus, and confirm your seat in one click.",
        [],
    );

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            <Ticket className="h-3.5 w-3.5" />
                            Passenger Marketplace
                        </div>
                        <h1
                            className="mt-3 text-2xl font-semibold tracking-tight"
                            style={{
                                fontFamily:
                                    '"Space Grotesk", "DM Serif Display", serif',
                            }}
                        >
                            Book your bus the easy way
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {heroSubtitle}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href="/passenger/book-now">
                                My Bookings
                            </Link>
                        </Button>
                    </div>
                </div>

                {loading && (
                    <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading available trips...
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        {trips.map((trip, index) => {
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
                                                disabled={
                                                    available <= 0 ||
                                                    bookingId === trip.id
                                                }
                                                onClick={() =>
                                                    handleBook(trip.id)
                                                }
                                            >
                                                {bookingId === trip.id
                                                    ? "Booking..."
                                                    : available > 0
                                                      ? "Book Now"
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
