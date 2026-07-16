"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";

type Trip = {
    id: string;
    departAt: string;
    arriveAt: string;
    basePrice: number;
    route: {
        origin: { name: string; code: string } | null;
        destination: { name: string; code: string } | null;
    } | null;
    bus: {
        plateNumber: string;
        model?: string | null;
    } | null;
};

type TripDetail = {
    id: string;
    departAt: string;
    arriveAt: string;
    basePrice: number;
    seats: Array<{
        id: string;
        seatNumber: string;
        isBooked: boolean;
        isActive: boolean;
    }>;
};

const PAYMENT_METHODS = [
    { value: "CASH", label: "Cash" },
    { value: "TELEBIRR", label: "Telebirr" },
    { value: "CBE_BIRR", label: "CBE Birr" },
    { value: "M_BIRR", label: "M-Birr" },
];

export default function AdminCreateBookingPage() {
    const { status } = useSession();
    const router = useRouter();
    const [trips, setTrips] = useState<Trip[]>([]);
    const [tripId, setTripId] = useState("");
    const [seatId, setSeatId] = useState("");
    const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [idNumber, setIdNumber] = useState("");
    const [gender, setGender] = useState("");
    const [age, setAge] = useState("");
    const [emergencyContact, setEmergencyContact] = useState("");
    const [notes, setNotes] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("CASH");
    const [markPaid, setMarkPaid] = useState(true);
    const [transactionRef, setTransactionRef] = useState("");

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
                const res = await fetch("/api/trips");
                if (!res.ok) throw new Error("Failed to load trips.");
                const data = (await res.json()) as Trip[];
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

    useEffect(() => {
        if (!tripId) {
            setTripDetail(null);
            setSeatId("");
            return;
        }
        let active = true;
        (async () => {
            try {
                const res = await fetch(`/api/trips/${tripId}`);
                if (!res.ok) throw new Error("Failed to load trip seats.");
                const data = (await res.json()) as TripDetail;
                if (active) setTripDetail(data);
            } catch (err: any) {
                if (active)
                    setError(err?.message || "Failed to load trip seats.");
            }
        })();
        return () => {
            active = false;
        };
    }, [tripId]);

    const tripOptions = useMemo(() => {
        return trips.map((trip) => ({
            id: trip.id,
            label: `${trip.route?.origin?.name || "-"} (${trip.route?.origin?.code || ""}) → ${
                trip.route?.destination?.name || "-"
            } (${trip.route?.destination?.code || ""}) • ${
                trip.bus?.plateNumber || "-"
            }`,
        }));
    }, [trips]);

    const handleSubmit = async () => {
        setError(null);
        if (!tripId || !seatId) {
            setError("Select trip and seat.");
            return;
        }
        if (!fullName || !phone || !idNumber) {
            setError("Full name, phone, and ID number are required.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tripId,
                    seatId,
                    paymentMethod,
                    markPaid,
                    transactionRef: transactionRef.trim() || undefined,
                    passengerFullName: fullName,
                    passengerPhone: phone,
                    passengerEmail: email,
                    passengerIdNumber: idNumber,
                    passengerGender: gender,
                    passengerAge: age ? Number(age) : undefined,
                    emergencyContact,
                    notes,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to create booking.");
            }
            const data = (await res.json()) as { id?: string };
            if (data?.id) {
                router.push(`/admin/bookings/${data.id}`);
            }
        } catch (err: any) {
            setError(err?.message || "Failed to create booking.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <DashboardShell>
                <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
                    Loading trips...
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="mx-auto w-full max-w-6xl px-6 py-8">
                <div className="mb-4">
                    <h1 className="text-xl font-semibold">
                        Create Booking (Admin/Staff)
                    </h1>
                    <p className="text-xs text-muted-foreground">
                        Book seats for passengers and accept cash or transfer.
                    </p>
                </div>

                {error && (
                    <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="rounded border bg-card p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <select
                            className="h-10 rounded border px-3 text-sm"
                            value={tripId}
                            onChange={(e) => setTripId(e.target.value)}
                        >
                            <option value="">Select trip</option>
                            {tripOptions.map((trip) => (
                                <option key={trip.id} value={trip.id}>
                                    {trip.label}
                                </option>
                            ))}
                        </select>
                        <select
                            className="h-10 rounded border px-3 text-sm"
                            value={seatId}
                            onChange={(e) => setSeatId(e.target.value)}
                            disabled={!tripDetail}
                        >
                            <option value="">Select seat</option>
                            {(tripDetail?.seats || [])
                                .filter((seat) => seat.isActive)
                                .map((seat) => (
                                    <option
                                        key={seat.id}
                                        value={seat.id}
                                        disabled={seat.isBooked}
                                    >
                                        {seat.seatNumber}
                                        {seat.isBooked ? " (booked)" : ""}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="ID number"
                            value={idNumber}
                            onChange={(e) => setIdNumber(e.target.value)}
                        />
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Gender"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                        />
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Age"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                        />
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Emergency contact"
                            value={emergencyContact}
                            onChange={(e) =>
                                setEmergencyContact(e.target.value)
                            }
                        />
                        <textarea
                            className="min-h-[70px] rounded border px-3 py-2 text-sm md:col-span-2"
                            placeholder="Notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <select
                            className="h-10 rounded border px-3 text-sm"
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                        >
                            {PAYMENT_METHODS.map((method) => (
                                <option key={method.value} value={method.value}>
                                    {method.label}
                                </option>
                            ))}
                        </select>
                        <input
                            className="h-10 rounded border px-3 text-sm"
                            placeholder="Transaction reference"
                            value={transactionRef}
                            onChange={(e) => setTransactionRef(e.target.value)}
                        />
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={markPaid}
                                onChange={(e) => setMarkPaid(e.target.checked)}
                            />
                            Mark as paid
                        </label>
                    </div>

                    <Button
                        className="mt-4"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "Creating..." : "Create Booking"}
                    </Button>
                </div>
            </div>
        </DashboardShell>
    );
}
