"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Bus, Users, MapPin, Clock, Calendar, CheckCircle } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Trip = {
  id: string;
  departAt: string;
  arriveAt: string;
  basePrice: number;
  status: string;
  bus: { id: string; plateNumber: string; model: string | null; level: string | null; seatCount: number };
  route: { origin: { name: string; city: string } | null; destination: { name: string; city: string } | null };
  passengerCount: number;
  passengers: any[];
};

type AssignedBus = {
  id: string;
  plateNumber: string;
  model: string | null;
  level: string | null;
  seatCount: number;
  status: string | null;
};

function formatDateTime(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 border-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-300",
  COMPLETED: "bg-green-100 text-green-700 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
};

export default function DriverDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [assignedBuses, setAssignedBuses] = useState<AssignedBus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "driver") {
      fetch("/api/driver/trips", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          setTrips(data.trips || []);
          setAssignedBuses(data.assignedBuses || []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (status === "authenticated") {
      setLoading(false);
    }
  }, [status, session]);

  if (status === "loading" || loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      </DashboardShell>
    );
  }

  if (session?.user?.role !== "driver") {
    return (
      <DashboardShell>
        <div className="p-6 text-muted-foreground">This page is for drivers only.</div>
      </DashboardShell>
    );
  }

  const bus = assignedBuses[0] || trips[0]?.bus;
  const upcoming = trips.filter((t) => new Date(t.departAt) >= new Date(Date.now() - 3600000));
  const past = trips.filter((t) => new Date(t.departAt) < new Date(Date.now() - 3600000));

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold">Driver Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Welcome, {session?.user?.name}
          </p>
        </div>

        {/* Assigned bus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bus className="h-4 w-4" /> My Bus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bus ? (
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="font-medium">{bus.plateNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {bus.model || "—"} · {bus.level || "—"} · {bus.seatCount} seats
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/driver/bus")}>
                  Bus Pickup / Maintenance
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No bus assigned yet. After maintenance, pick up your bus from the{" "}
                <button className="underline" onClick={() => router.push("/driver/bus")}>
                  Bus Pickup
                </button>{" "}
                page.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming trips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" /> Upcoming Trips
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming trips scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 cursor-pointer"
                    onClick={() => router.push(`/driver/trips/${t.id}`)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <MapPin className="h-3 w-3" />
                        {t.route.origin?.name || "—"} → {t.route.destination?.name || "—"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(t.departAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={STATUS_COLORS[t.status] || ""}>
                        {t.status}
                      </Badge>
                      <span className="flex items-center gap-1 text-sm">
                        <Users className="h-3 w-3" /> {t.passengerCount}
                      </span>
                      <Button size="sm" variant="default">
                        Audit Passengers
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past trips */}
        {past.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4" /> Past Trips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {past.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded border p-2 text-sm cursor-pointer hover:bg-muted/30"
                    onClick={() => router.push(`/driver/trips/${t.id}`)}
                  >
                    <span>
                      {t.route.origin?.name} → {t.route.destination?.name}
                    </span>
                    <span className="text-muted-foreground">{formatDateTime(t.departAt)}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {t.passengerCount}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
