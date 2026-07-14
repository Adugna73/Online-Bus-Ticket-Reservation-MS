"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type BookingsByDay = { date: string; count: number };
type TopRoute = {
  routeId: string;
  origin: string;
  destination: string;
  bookings: number;
  revenue: number;
};
type HeatmapCell = { originCity: string; destCity: string; intensity: number };
type HeatmapRow = {
  id: string;
  routeId: string | null;
  originCity: string | null;
  destCity: string | null;
  intensity: number;
  bucket: string;
};
type Dashboard = {
  totalBookings: number;
  revenue: number;
  bookingsByDay: BookingsByDay[];
  topRoutes: TopRoute[];
  heatmap: HeatmapCell[];
};

function formatCurrency(n: number): string {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Birr`;
}

function BarChart({ data }: { data: BookingsByDay[] }) {
  const width = 520;
  const height = 160;
  const pad = 28;
  const max = Math.max(1, ...data.map((d) => d.count));
  const barW = data.length > 0 ? (width - pad * 2) / data.length : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Bookings by day bar chart"
    >
      <line
        x1={pad}
        y1={height - pad}
        x2={width - pad}
        y2={height - pad}
        stroke="currentColor"
        className="text-muted-foreground"
        strokeWidth={1}
      />
      {data.map((d, i) => {
        const h = ((height - pad * 2) * d.count) / max;
        const x = pad + i * barW;
        const y = height - pad - h;
        return (
          <g key={d.date}>
            <rect
              x={x + 1}
              y={y}
              width={Math.max(1, barW - 2)}
              height={h}
              className="fill-primary"
              rx={2}
            >
              <title>{`${d.date}: ${d.count} bookings`}</title>
            </rect>
            {i % 2 === 0 && (
              <text
                x={x + barW / 2}
                y={height - pad + 12}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 8 }}
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <text
        x={pad}
        y={12}
        className="fill-muted-foreground"
        style={{ fontSize: 9 }}
      >
        max {max}
      </text>
    </svg>
  );
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/analytics", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setDashboard(json.dashboard ?? null);
      setHeatmap(Array.isArray(json.heatmap) ? json.heatmap : []);
    } catch (e: any) {
      toast({
        title: "Failed to load analytics",
        description: String(e?.message || e),
        variant: "destructive",
      });
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const recompute = async () => {
    setRecomputing(true);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recompute" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      toast({
        title: "Heatmap recomputed",
        description: `${json?.count ?? 0} route cells stored`,
      });
      await fetchData();
    } catch (e: any) {
      toast({
        title: "Recompute failed",
        description: String(e?.message || e),
        variant: "destructive",
      });
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-7xl space-y-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">Analytics &amp; BI</h1>
            <p className="text-xs text-muted-foreground">
              Bookings, revenue and demand heatmap insights.
            </p>
          </div>
          <Button onClick={recompute} disabled={recomputing || loading}>
            {recomputing ? "Recomputing..." : "Recompute heatmap"}
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Loading analytics...
            </CardContent>
          </Card>
        ) : !dashboard ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No analytics data available.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {dashboard.totalBookings.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue (paid)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatCurrency(dashboard.revenue)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top routes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {dashboard.topRoutes.length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Heatmap cells</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {dashboard.heatmap.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bookings by day */}
            <Card>
              <CardHeader>
                <CardTitle>Bookings by day (last 14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.bookingsByDay.every((d) => d.count === 0) ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No bookings in the last 14 days.
                  </div>
                ) : (
                  <BarChart data={dashboard.bookingsByDay} />
                )}
              </CardContent>
            </Card>

            {/* Top routes */}
            <Card>
              <CardHeader>
                <CardTitle>Top routes by bookings</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.topRoutes.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No route data yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Route</th>
                          <th className="py-2 pr-3 font-medium">Bookings</th>
                          <th className="py-2 pr-3 font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.topRoutes.map((r) => (
                          <tr key={r.routeId} className="border-b last:border-0">
                            <td className="py-2 pr-3">
                              {r.origin} → {r.destination}
                            </td>
                            <td className="py-2 pr-3">{r.bookings}</td>
                            <td className="py-2 pr-3">
                              {formatCurrency(r.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Demand heatmap (live from bookings) */}
            <Card>
              <CardHeader>
                <CardTitle>Demand heatmap (by city)</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.heatmap.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No demand data yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Origin city</th>
                          <th className="py-2 pr-3 font-medium">
                            Destination city
                          </th>
                          <th className="py-2 pr-3 font-medium">Intensity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.heatmap.map((c, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-2 pr-3">{c.originCity}</td>
                            <td className="py-2 pr-3">{c.destCity}</td>
                            <td className="py-2 pr-3">
                              <Badge variant="secondary">{c.intensity}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Persisted heatmap rows */}
            <Card>
              <CardHeader>
                <CardTitle>Persisted route heatmap</CardTitle>
              </CardHeader>
              <CardContent>
                {heatmap.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No persisted heatmap rows. Click &quot;Recompute heatmap&quot;
                    to generate.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">Origin</th>
                          <th className="py-2 pr-3 font-medium">Destination</th>
                          <th className="py-2 pr-3 font-medium">Intensity</th>
                          <th className="py-2 pr-3 font-medium">Bucket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatmap.map((r) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="py-2 pr-3">
                              {r.originCity ?? "—"}
                            </td>
                            <td className="py-2 pr-3">{r.destCity ?? "—"}</td>
                            <td className="py-2 pr-3">
                              <Badge variant="secondary">{r.intensity}</Badge>
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">
                              {new Date(r.bucket).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
