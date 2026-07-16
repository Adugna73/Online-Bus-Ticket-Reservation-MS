"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Loader2,
    ShieldCheck,
    Package,
    Hotel,
    Users,
    Plus,
    CheckCircle2,
} from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type TabKey = "insurance" | "cargo" | "hotel" | "group";

type BookingOption = {
    id: string;
    bookingRef: string;
    status: string;
    totalPrice: number;
    trip: {
        id: string;
        departAt: string;
        route: {
            origin: { name: string } | null;
            destination: { name: string } | null;
        } | null;
    } | null;
};

type TripOption = {
    id: string;
    departAt: string;
    basePrice: number;
    route: {
        origin: { name: string } | null;
        destination: { name: string } | null;
    } | null;
    bus: { plateNumber: string } | null;
};

type Insurance = {
    id: string;
    bookingId: string;
    bookingRef: string | null;
    premium: number;
    covered: boolean;
    createdAt: string;
};

type Cargo = {
    id: string;
    tripId: string;
    senderPhone: string;
    description: string | null;
    weightKg: number | null;
    price: number;
    createdAt: string;
};

type Hotel = {
    id: string;
    name: string;
    city: string | null;
    commissionPct: number;
    createdAt: string;
};

type GroupBooking = {
    id: string;
    tripId: string;
    organizerId: string | null;
    seatsCount: number;
    discountPct: number;
    createdAt: string;
};

const TABS: { key: TabKey; label: string; icon: typeof ShieldCheck }[] = [
    { key: "insurance", label: "Travel Insurance", icon: ShieldCheck },
    { key: "cargo", label: "Cargo", icon: Package },
    { key: "hotel", label: "Hotel Partners", icon: Hotel },
    { key: "group", label: "Group Booking", icon: Users },
];

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

function routeLabel(trip: { route: any } | null) {
    if (!trip?.route) return "-";
    const o = trip.route.origin?.name || "?";
    const d = trip.route.destination?.name || "?";
    return `${o} → ${d}`;
}

export default function PassengerServicesPage() {
    const { toast } = useToast();
    const [tab, setTab] = useState<TabKey>("insurance");

    const [bookings, setBookings] = useState<BookingOption[]>([]);
    const [trips, setTrips] = useState<TripOption[]>([]);

    const [insurances, setInsurances] = useState<Insurance[]>([]);
    const [cargos, setCargos] = useState<Cargo[]>([]);
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [groups, setGroups] = useState<GroupBooking[]>([]);

    const [loadingBookings, setLoadingBookings] = useState(true);
    const [loadingTrips, setLoadingTrips] = useState(true);
    const [loadingInsurance, setLoadingInsurance] = useState(true);
    const [loadingCargo, setLoadingCargo] = useState(true);
    const [loadingHotel, setLoadingHotel] = useState(true);
    const [loadingGroup, setLoadingGroup] = useState(true);

    // insurance form
    const [insBookingId, setInsBookingId] = useState("");
    const [insPremium, setInsPremium] = useState("");
    const [insSubmitting, setInsSubmitting] = useState(false);

    // cargo form
    const [cargoTripId, setCargoTripId] = useState("");
    const [cargoPhone, setCargoPhone] = useState("");
    const [cargoDesc, setCargoDesc] = useState("");
    const [cargoWeight, setCargoWeight] = useState("");
    const [cargoPrice, setCargoPrice] = useState("");
    const [cargoSubmitting, setCargoSubmitting] = useState(false);

    // group form
    const [groupTripId, setGroupTripId] = useState("");
    const [groupSeats, setGroupSeats] = useState("");
    const [groupDiscount, setGroupDiscount] = useState("");
    const [groupSubmitting, setGroupSubmitting] = useState(false);

    const loadBookings = useCallback(async () => {
        try {
            setLoadingBookings(true);
            const res = await fetch("/api/bookings", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as BookingOption[];
            setBookings(data || []);
        } catch {
            // bookings optional
        } finally {
            setLoadingBookings(false);
        }
    }, []);

    const loadTrips = useCallback(async () => {
        try {
            setLoadingTrips(true);
            const res = await fetch("/api/trips", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as TripOption[];
            setTrips(data || []);
        } catch {
            // trips optional
        } finally {
            setLoadingTrips(false);
        }
    }, []);

    const loadInsurance = useCallback(async () => {
        try {
            setLoadingInsurance(true);
            const res = await fetch("/api/vas?kind=insurance", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as Insurance[];
            setInsurances(data || []);
        } catch {
            // ignore
        } finally {
            setLoadingInsurance(false);
        }
    }, []);

    const loadCargo = useCallback(async () => {
        try {
            setLoadingCargo(true);
            const res = await fetch("/api/vas?kind=cargo", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as Cargo[];
            setCargos(data || []);
        } catch {
            // ignore
        } finally {
            setLoadingCargo(false);
        }
    }, []);

    const loadHotels = useCallback(async () => {
        try {
            setLoadingHotel(true);
            const res = await fetch("/api/vas?kind=hotel", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as Hotel[];
            setHotels(data || []);
        } catch {
            // ignore
        } finally {
            setLoadingHotel(false);
        }
    }, []);

    const loadGroups = useCallback(async () => {
        try {
            setLoadingGroup(true);
            const res = await fetch("/api/vas?kind=group", { credentials: "include" });
            if (!res.ok) return;
            const data = (await res.json()) as GroupBooking[];
            setGroups(data || []);
        } catch {
            // ignore
        } finally {
            setLoadingGroup(false);
        }
    }, []);

    useEffect(() => {
        loadBookings();
        loadTrips();
        loadInsurance();
        loadCargo();
        loadHotels();
        loadGroups();
    }, [
        loadBookings,
        loadTrips,
        loadInsurance,
        loadCargo,
        loadHotels,
        loadGroups,
    ]);

    const handleBuyInsurance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!insBookingId) {
            toast({
                title: "Booking required",
                description: "Please select a booking to insure.",
                variant: "destructive",
            });
            return;
        }
        const booking = bookings.find((b) => b.id === insBookingId);
        const premium =
            insPremium !== ""
                ? Number(insPremium)
                : Math.round((booking?.totalPrice || 0) * 0.02 * 100) / 100;
        try {
            setInsSubmitting(true);
            const res = await fetch("/api/vas", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind: "insurance",
                    bookingId: insBookingId,
                    premium,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Failed to buy insurance.");
            }
            const created = (await res.json()) as Insurance;
            toast({
                title: "Insurance purchased",
                description: `Premium: ${created.premium} Birr. You are covered.`,
            });
            setInsBookingId("");
            setInsPremium("");
            setInsurances((prev) => [
                { ...created, bookingRef: booking?.bookingRef || null },
                ...prev,
            ]);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to buy insurance.",
                variant: "destructive",
            });
        } finally {
            setInsSubmitting(false);
        }
    };

    const handleCreateCargo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cargoTripId) {
            toast({
                title: "Trip required",
                description: "Please select a trip.",
                variant: "destructive",
            });
            return;
        }
        if (!cargoPhone.trim()) {
            toast({
                title: "Phone required",
                description: "Please enter sender phone number.",
                variant: "destructive",
            });
            return;
        }
        try {
            setCargoSubmitting(true);
            const res = await fetch("/api/vas", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind: "cargo",
                    tripId: cargoTripId,
                    senderPhone: cargoPhone.trim(),
                    description: cargoDesc.trim() || undefined,
                    weightKg: cargoWeight || undefined,
                    price: cargoPrice || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Failed to book cargo.");
            }
            const created = (await res.json()) as Cargo;
            toast({
                title: "Cargo booked",
                description: `Price: ${created.price} Birr.`,
            });
            setCargoTripId("");
            setCargoPhone("");
            setCargoDesc("");
            setCargoWeight("");
            setCargoPrice("");
            setCargos((prev) => [created, ...prev]);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to book cargo.",
                variant: "destructive",
            });
        } finally {
            setCargoSubmitting(false);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!groupTripId) {
            toast({
                title: "Trip required",
                description: "Please select a trip.",
                variant: "destructive",
            });
            return;
        }
        const seats = Number(groupSeats || 0);
        if (!seats || seats < 1) {
            toast({
                title: "Seats required",
                description: "Enter at least 1 seat.",
                variant: "destructive",
            });
            return;
        }
        try {
            setGroupSubmitting(true);
            const res = await fetch("/api/vas", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    kind: "group",
                    tripId: groupTripId,
                    seatsCount: seats,
                    discountPct: groupDiscount || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(
                    data?.error || "Failed to create group booking.",
                );
            }
            const created = (await res.json()) as GroupBooking;
            toast({
                title: "Group booking created",
                description: `${created.seatsCount} seats at ${created.discountPct}% discount.`,
            });
            setGroupTripId("");
            setGroupSeats("");
            setGroupDiscount("");
            setGroups((prev) => [created, ...prev]);
        } catch (err: any) {
            toast({
                title: "Error",
                description:
                    err?.message || "Failed to create group booking.",
                variant: "destructive",
            });
        } finally {
            setGroupSubmitting(false);
        }
    };

    const selectClass =
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Value-Added Services
                    </div>
                    <h1
                        className="mt-3 text-2xl font-semibold tracking-tight"
                        style={{
                            fontFamily:
                                '"Space Grotesk", "DM Serif Display", serif',
                        }}
                    >
                        Travel Services
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Insurance, cargo, hotel partners and group bookings.
                    </p>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex flex-wrap gap-2">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                                    active
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-input bg-card hover:bg-accent"
                                }`}
                            >
                                <Icon className="h-4 w-4" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Insurance tab */}
                {tab === "insurance" && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Buy Travel Insurance</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleBuyInsurance}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Booking
                                        </label>
                                        {loadingBookings ? (
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading bookings...
                                            </div>
                                        ) : bookings.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                You have no bookings to insure.
                                            </p>
                                        ) : (
                                            <select
                                                value={insBookingId}
                                                onChange={(e) =>
                                                    setInsBookingId(
                                                        e.target.value,
                                                    )
                                                }
                                                className={selectClass}
                                            >
                                                <option value="">
                                                    Select a booking
                                                </option>
                                                {bookings.map((b) => (
                                                    <option
                                                        key={b.id}
                                                        value={b.id}
                                                    >
                                                        {b.bookingRef} —{" "}
                                                        {routeLabel(b.trip)} (
                                                        {b.totalPrice} Birr)
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Premium (Birr) — leave blank for 2%
                                            of booking total
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={insPremium}
                                            onChange={(e) =>
                                                setInsPremium(e.target.value)
                                            }
                                            placeholder="Auto (2%)"
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="justify-end">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={
                                            insSubmitting ||
                                            !insBookingId
                                        }
                                    >
                                        {insSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                Buy Insurance
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>

                        <div>
                            <h2 className="mb-3 text-sm font-semibold">
                                Your Insurance Policies
                            </h2>
                            {loadingInsurance && (
                                <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                    Loading policies...
                                </div>
                            )}
                            {!loadingInsurance &&
                                insurances.length === 0 && (
                                    <Card>
                                        <CardContent className="py-10 text-center">
                                            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                            <p className="text-sm font-medium">
                                                No insurance policies yet
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Buy insurance for one of your
                                                bookings above.
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            {!loadingInsurance &&
                                insurances.length > 0 && (
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {insurances.map((ins) => (
                                            <Card key={ins.id}>
                                                <CardHeader>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <CardTitle>
                                                            {ins.bookingRef ||
                                                                "Booking"}
                                                        </CardTitle>
                                                        <Badge
                                                            variant={
                                                                ins.covered
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                            className="text-[11px]"
                                                        >
                                                            {ins.covered
                                                                ? "Covered"
                                                                : "Inactive"}
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="text-xs text-muted-foreground">
                                                    <div>
                                                        Premium:{" "}
                                                        {ins.premium} Birr
                                                    </div>
                                                    <div>
                                                        Purchased:{" "}
                                                        {formatDateTime(
                                                            ins.createdAt,
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </div>
                    </div>
                )}

                {/* Cargo tab */}
                {tab === "cargo" && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Book Cargo</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleCreateCargo}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Trip
                                        </label>
                                        {loadingTrips ? (
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading trips...
                                            </div>
                                        ) : trips.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No trips available.
                                            </p>
                                        ) : (
                                            <select
                                                value={cargoTripId}
                                                onChange={(e) =>
                                                    setCargoTripId(
                                                        e.target.value,
                                                    )
                                                }
                                                className={selectClass}
                                            >
                                                <option value="">
                                                    Select a trip
                                                </option>
                                                {trips.map((t) => (
                                                    <option
                                                        key={t.id}
                                                        value={t.id}
                                                    >
                                                        {routeLabel(t)} —{" "}
                                                        {formatDateTime(
                                                            t.departAt,
                                                        )}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Sender phone
                                        </label>
                                        <Input
                                            value={cargoPhone}
                                            onChange={(e) =>
                                                setCargoPhone(e.target.value)
                                            }
                                            placeholder="09xxxxxxxx"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Description (optional)
                                        </label>
                                        <Input
                                            value={cargoDesc}
                                            onChange={(e) =>
                                                setCargoDesc(e.target.value)
                                            }
                                            placeholder="Package contents"
                                        />
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Weight (kg, optional)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={cargoWeight}
                                                onChange={(e) =>
                                                    setCargoWeight(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Price (Birr, optional — auto
                                                15/kg)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={cargoPrice}
                                                onChange={(e) =>
                                                    setCargoPrice(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Auto"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="justify-end">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={
                                            cargoSubmitting || !cargoTripId
                                        }
                                    >
                                        {cargoSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                Book Cargo
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>

                        <div>
                            <h2 className="mb-3 text-sm font-semibold">
                                Your Cargo Bookings
                            </h2>
                            {loadingCargo && (
                                <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                    Loading cargo...
                                </div>
                            )}
                            {!loadingCargo && cargos.length === 0 && (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">
                                            No cargo bookings yet
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                            {!loadingCargo && cargos.length > 0 && (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {cargos.map((c) => (
                                        <Card key={c.id}>
                                            <CardHeader>
                                                <CardTitle>
                                                    {c.description ||
                                                        "Cargo shipment"}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="text-xs text-muted-foreground">
                                                <div>
                                                    Phone: {c.senderPhone}
                                                </div>
                                                <div>
                                                    Weight:{" "}
                                                    {c.weightKg != null
                                                        ? `${c.weightKg} kg`
                                                        : "-"}
                                                </div>
                                                <div>
                                                    Price: {c.price} Birr
                                                </div>
                                                <div>
                                                    Booked:{" "}
                                                    {formatDateTime(
                                                        c.createdAt,
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Hotel tab */}
                {tab === "hotel" && (
                    <div>
                        <h2 className="mb-3 text-sm font-semibold">
                            Hotel Partners
                        </h2>
                        {loadingHotel && (
                            <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
                                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                Loading hotels...
                            </div>
                        )}
                        {!loadingHotel && hotels.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center">
                                    <Hotel className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm font-medium">
                                        No hotel partners available
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                        {!loadingHotel && hotels.length > 0 && (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {hotels.map((h) => (
                                    <Card key={h.id}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between gap-2">
                                                <CardTitle>{h.name}</CardTitle>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[11px]"
                                                >
                                                    {h.commissionPct}%
                                                    commission
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="text-xs text-muted-foreground">
                                            <div>
                                                City: {h.city || "-"}
                                            </div>
                                            <div>
                                                Partner since:{" "}
                                                {formatDateTime(h.createdAt)}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Group tab */}
                {tab === "group" && (
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Create Group Booking</CardTitle>
                            </CardHeader>
                            <form onSubmit={handleCreateGroup}>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Trip
                                        </label>
                                        {loadingTrips ? (
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Loading trips...
                                            </div>
                                        ) : trips.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                No trips available.
                                            </p>
                                        ) : (
                                            <select
                                                value={groupTripId}
                                                onChange={(e) =>
                                                    setGroupTripId(
                                                        e.target.value,
                                                    )
                                                }
                                                className={selectClass}
                                            >
                                                <option value="">
                                                    Select a trip
                                                </option>
                                                {trips.map((t) => (
                                                    <option
                                                        key={t.id}
                                                        value={t.id}
                                                    >
                                                        {routeLabel(t)} —{" "}
                                                        {formatDateTime(
                                                            t.departAt,
                                                        )}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Seats count
                                            </label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={groupSeats}
                                                onChange={(e) =>
                                                    setGroupSeats(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="5"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">
                                                Discount % (optional — auto 10%
                                                for 5+)
                                            </label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={groupDiscount}
                                                onChange={(e) =>
                                                    setGroupDiscount(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Auto"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="justify-end">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={
                                            groupSubmitting || !groupTripId
                                        }
                                    >
                                        {groupSubmitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Users className="h-4 w-4" />
                                                Create Group Booking
                                            </>
                                        )}
                                    </Button>
                                </CardFooter>
                            </form>
                        </Card>

                        <div>
                            <h2 className="mb-3 text-sm font-semibold">
                                Your Group Bookings
                            </h2>
                            {loadingGroup && (
                                <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
                                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                    Loading group bookings...
                                </div>
                            )}
                            {!loadingGroup && groups.length === 0 && (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">
                                            No group bookings yet
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                            {!loadingGroup && groups.length > 0 && (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {groups.map((g) => (
                                        <Card key={g.id}>
                                            <CardHeader>
                                                <div className="flex items-center justify-between gap-2">
                                                    <CardTitle>
                                                        {g.seatsCount} seats
                                                    </CardTitle>
                                                    <Badge
                                                        variant="default"
                                                        className="text-[11px]"
                                                    >
                                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                                        {g.discountPct}% off
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="text-xs text-muted-foreground">
                                                <div>
                                                    Trip: {g.tripId}
                                                </div>
                                                <div>
                                                    Created:{" "}
                                                    {formatDateTime(
                                                        g.createdAt,
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
