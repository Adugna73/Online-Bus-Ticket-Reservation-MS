"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Users, MapPin, Clock, UserPlus, CheckCircle, Phone, ArrowLeft } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Passenger = {
  id: string;
  bookingRef: string;
  status: string;
  name: string;
  phone: string | null;
  email: string | null;
  idNumber: string | null;
  seats: string[];
  paymentStatus: string;
  paymentMethod: string | null;
};

type Trip = {
  id: string;
  departAt: string;
  arriveAt: string;
  basePrice: number;
  status: string;
  bus: { plateNumber: string; model: string | null; seatCount: number };
  route: { origin: { name: string } | null; destination: { name: string } | null };
  passengerCount: number;
  passengers: Passenger[];
};

function formatDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function DriverTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [boarded, setBoarded] = useState<Set<string>>(new Set());

  // Add-passenger form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [adding, setAdding] = useState(false);

  const loadTrip = async () => {
    try {
      const res = await fetch("/api/driver/trips", { credentials: "include" });
      const data = await res.json();
      const found = (data.trips || []).find((t: Trip) => t.id === id);
      setTrip(found || null);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") loadTrip();
    else if (status !== "loading") setLoading(false);
  }, [status]);

  const toggleBoarded = (pid: string) => {
    setBoarded((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const handleAddPassenger = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Enter the passenger's full name." });
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/driver/passengers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: id,
          passengerFullName: name.trim(),
          passengerPhone: phone.trim(),
          passengerEmail: email.trim(),
          passengerIdNumber: idNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add passenger");
      toast({
        title: "Passenger added",
        description: `${name} — Seat auto-assigned. Ref ${data.bookingRef}.`,
      });
      setName("");
      setPhone("");
      setEmail("");
      setIdNumber("");
      await loadTrip();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message || "Could not add passenger." });
    } finally {
      setAdding(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      </DashboardShell>
    );
  }

  if (!trip) {
    return (
      <DashboardShell>
        <div className="p-6">
          <p className="text-muted-foreground">Trip not found or not assigned to you.</p>
          <Button variant="outline" className="mt-3" onClick={() => router.push("/driver")}>
            Back to Dashboard
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const checkedIn = boarded.size;
  const total = trip.passengers.length;

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/driver")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {trip.route.origin?.name || "—"} → {trip.route.destination?.name || "—"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {trip.bus.plateNumber} · {formatDateTime(trip.departAt)}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Total Passengers</p>
              <p className="text-2xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Boarded / Audited</p>
              <p className="text-2xl font-bold text-green-600">{checkedIn}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Bus Capacity</p>
              <p className="text-2xl font-bold">{trip.bus.seatCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Passenger list (audit) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Passenger Manifest
            </CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <p className="text-sm text-muted-foreground">No passengers booked yet.</p>
            ) : (
              <div className="space-y-2">
                {trip.passengers.map((p, i) => {
                  const isBoarded = boarded.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                        isBoarded ? "bg-green-50 border-green-200" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleBoarded(p.id)}
                          className={`flex h-6 w-6 items-center justify-center rounded border ${
                            isBoarded
                              ? "bg-green-500 border-green-500 text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {isBoarded && <CheckCircle className="h-4 w-4" />}
                        </button>
                        <div>
                          <p className="font-medium">
                            {i + 1}. {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            {p.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {p.phone}
                              </span>
                            )}
                            {p.idNumber && <span>· ID: {p.idNumber}</span>}
                            {p.seats.length > 0 && <span>· Seat {p.seats.join(", ")}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {p.paymentStatus}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {p.bookingRef.slice(-6)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add walk-up passenger */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" /> Add Walk-up Passenger
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Full Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Passenger name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email (optional)</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="passenger@email.com" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">ID Number</label>
                <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="ID/Passport" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={handleAddPassenger} disabled={adding}>
                {adding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" /> Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" /> Add Passenger (Cash · ETB {trip.basePrice})
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Seat auto-assigned · Booking confirmed & paid (cash)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
