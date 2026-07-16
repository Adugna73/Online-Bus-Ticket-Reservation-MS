"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardShell from "@/components/DashboardShell";

type TripDetail = {
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
        id: string;
        plateNumber: string;
        model?: string | null;
        seatCount: number;
        level?: string | null;
        driverName?: string | null;
        imageUrl?: string | null;
        amenities?: any;
        safetyChecklist?: any;
        seatLayout?: any;
    } | null;
    seats: Array<{
        id: string;
        seatNumber: string;
        seatType: string;
        isActive: boolean;
        isBooked: boolean;
    }>;
};

const PAYMENT_METHODS = [
    { value: "TELEBIRR", label: "Telebirr" },
    { value: "CBE_BIRR", label: "CBE Birr" },
    { value: "M_BIRR", label: "M-Birr" },
    { value: "CASH", label: "Cash" },
];

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

export default function PassengerBookingFormPage() {
    const { status, data: session } = useSession();
    const router = useRouter();
    const params = useParams();
    const tripId = String(params?.id || "");

    const [trip, setTrip] = useState<TripDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [idNumber, setIdNumber] = useState("");
    const [gender, setGender] = useState("");
    const [age, setAge] = useState("");
    const [emergencyContact, setEmergencyContact] = useState("");
    const [notes, setNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("TELEBIRR");

    useEffect(() => {
        if (!session?.user) return;
        if (!fullName) {
            setFullName(String((session.user as any)?.name || "").trim());
        }
        if (!email) {
            setEmail(String((session.user as any)?.email || "").trim());
        }
        if (!phone) {
            setPhone(String((session.user as any)?.phone || "").trim());
        }
    }, [session, fullName, email, phone]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
            return;
        }
        if (status !== "authenticated") return;
        if (!tripId) return;

        let active = true;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/trips/${tripId}`);
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load trip.");
                }
                const data = (await res.json()) as TripDetail;
                if (active) setTrip(data);
            } catch (err: any) {
                if (active) setError(err?.message || "Failed to load trip.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, tripId, router]);

    const availableSeats = useMemo(() => {
        return (trip?.seats || []).filter(
            (seat) => seat.isActive && !seat.isBooked,
        );
    }, [trip]);

    const handleSubmit = async () => {
        if (!trip) return;
        if (!selectedSeat) {
            setError("Please select a seat.");
            return;
        }
        if (!fullName || !phone || !email || !idNumber || !gender || !age) {
            setError("Please fill all required fields.");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tripId: trip.id,
                    seatId: selectedSeat,
                    paymentMethod,
                    passengerFullName: fullName,
                    passengerPhone: phone,
                    passengerEmail: email,
                    passengerIdNumber: idNumber,
                    passengerGender: gender,
                    passengerAge: Number(age),
                    emergencyContact,
                    notes,
                }),
            });

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                const message = text || "Booking failed.";
                if (message.includes("seat_occupied")) {
                    throw new Error("That seat is already booked.");
                }
                throw new Error(message);
            }

            const data = (await res.json()) as { id?: string };
            const createdId = String(data?.id || "").trim();
            if (!createdId) {
                throw new Error("Booking created but id is missing.");
            }
            router.push(`/passenger/bookings/${createdId}`);
        } catch (err: any) {
            setError(err?.message || "Booking failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const imageSrc = trip?.bus?.imageUrl || "/images/bus-card-1.svg";
    const origin = trip?.route?.origin
        ? `${trip.route.origin.name} (${trip.route.origin.code})`
        : "-";
    const destination = trip?.route?.destination
        ? `${trip.route.destination.name} (${trip.route.destination.code})`
        : "-";

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-4 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                            Book this Trip
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Fill your passenger details and select a seat.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.back()}
                    >
                        Back
                    </Button>
                </div>

                {loading && (
                    <div className="mt-4 rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        Loading trip details...
                    </div>
                )}

                {!loading && error && (
                    <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && trip && (
                    <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                        <div className="rounded-2xl border bg-card overflow-hidden">
                            <div className="relative h-56 w-full bg-neutral-950">
                                <Image
                                    src={imageSrc}
                                    alt="Bus"
                                    fill
                                    className="object-contain"
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
                                <div className="text-sm font-semibold">
                                    {origin} → {destination}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Departure: {formatDateTime(trip.departAt)}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    Arrival: {formatDateTime(trip.arriveAt)}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge
                                        variant="outline"
                                        className="text-[11px]"
                                    >
                                        Level: {trip.bus?.level || "-"}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="text-[11px]"
                                    >
                                        Driver: {trip.bus?.driverName || "-"}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="text-[11px]"
                                    >
                                        Seats: {availableSeats.length} left
                                    </Badge>
                                </div>
                                {availableSeats.length === 0 && (
                                    <div className="mt-2 text-xs text-destructive">
                                        All seats are currently booked for this
                                        trip.
                                    </div>
                                )}
                                <div className="mt-3 text-sm font-semibold text-emerald-600">
                                    {trip.basePrice.toFixed(2)} ETB
                                </div>
                                <div className="mt-3">
                                    <div className="text-[11px] text-muted-foreground">
                                        Amenities
                                    </div>
                                    <div className="text-sm">
                                        {Array.isArray(trip.bus?.amenities)
                                            ? trip.bus?.amenities.join(", ")
                                            : "-"}
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <div className="text-[11px] text-muted-foreground">
                                        Safety Checklist
                                    </div>
                                    <div className="text-sm">
                                        {Array.isArray(
                                            trip.bus?.safetyChecklist,
                                        )
                                            ? trip.bus?.safetyChecklist.join(
                                                  ", ",
                                              )
                                            : "-"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border bg-card p-4">
                            <h3 className="text-sm font-semibold">
                                Passenger Information
                            </h3>
                            <div className="mt-3 grid gap-3">
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Full name"
                                    value={fullName}
                                    onChange={(e) =>
                                        setFullName(e.target.value)
                                    }
                                />
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                />
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="ID number"
                                    value={idNumber}
                                    onChange={(e) =>
                                        setIdNumber(e.target.value)
                                    }
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        className="h-10 w-full rounded border px-3 text-sm"
                                        placeholder="Gender"
                                        value={gender}
                                        onChange={(e) =>
                                            setGender(e.target.value)
                                        }
                                    />
                                    <input
                                        className="h-10 w-full rounded border px-3 text-sm"
                                        placeholder="Age"
                                        value={age}
                                        onChange={(e) => setAge(e.target.value)}
                                    />
                                </div>
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Emergency contact"
                                    value={emergencyContact}
                                    onChange={(e) =>
                                        setEmergencyContact(e.target.value)
                                    }
                                />
                                <textarea
                                    className="min-h-[80px] w-full rounded border px-3 py-2 text-sm"
                                    placeholder="Notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div className="mt-4">
                                <h3 className="text-sm font-semibold">
                                    Choose Seat (2D map)
                                </h3>
                                <div className="mt-2 grid grid-cols-4 gap-2">
                                    {(trip.seats || []).map((seat) => (
                                        <button
                                            key={seat.id}
                                            type="button"
                                            disabled={
                                                seat.isBooked || !seat.isActive
                                            }
                                            onClick={() =>
                                                setSelectedSeat(seat.id)
                                            }
                                            className={`h-10 rounded border text-xs transition ${
                                                seat.isBooked || !seat.isActive
                                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                                    : selectedSeat === seat.id
                                                      ? "bg-emerald-600 text-white"
                                                      : "bg-background hover:bg-muted"
                                            }`}
                                            title={
                                                seat.isBooked
                                                    ? "Booked by another passenger"
                                                    : !seat.isActive
                                                      ? "Seat is unavailable"
                                                      : "Available"
                                            }
                                        >
                                            {seat.seatNumber}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-2 text-[11px] text-muted-foreground">
                                    Disabled seats show the reason on hover.
                                </div>
                            </div>

                            <div className="mt-4">
                                <div className="text-[11px] text-muted-foreground">
                                    Payment Method
                                </div>
                                <select
                                    className="mt-2 h-10 w-full rounded border px-3 text-sm"
                                    value={paymentMethod}
                                    onChange={(e) =>
                                        setPaymentMethod(e.target.value)
                                    }
                                >
                                    {PAYMENT_METHODS.map((method) => (
                                        <option
                                            key={method.value}
                                            value={method.value}
                                        >
                                            {method.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Button
                                className="mt-4 w-full"
                                disabled={submitting}
                                onClick={handleSubmit}
                            >
                                {submitting
                                    ? "Submitting..."
                                    : "Confirm Booking"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
