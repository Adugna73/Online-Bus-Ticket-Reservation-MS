import { prisma } from "@/lib/prisma";

// GAP 10: Analytics & BI — fully DB-backed (Prisma).
// Event tracking, dashboard KPIs, bookings-by-day, top routes, demand heatmap.

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Event tracking
// ---------------------------------------------------------------------------

export async function trackEvent(
  kind: string,
  userId?: string,
  meta?: Record<string, unknown>,
): Promise<{ id: string; tracked: true }> {
  const created = await prisma.analyticsEvent.create({
    data: {
      kind: String(kind || ""),
      userId: userId ? String(userId) : null,
      meta: (meta ?? undefined) as any,
    },
  });
  return { id: created.id, tracked: true };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type BookingsByDay = { date: string; count: number };

export type TopRoute = {
  routeId: string;
  origin: string;
  destination: string;
  bookings: number;
  revenue: number;
};

export type HeatmapCell = {
  originCity: string;
  destCity: string;
  intensity: number;
};

export type AnalyticsDashboard = {
  totalBookings: number;
  revenue: number;
  bookingsByDay: BookingsByDay[];
  topRoutes: TopRoute[];
  heatmap: HeatmapCell[];
};

export async function dashboard(): Promise<AnalyticsDashboard> {
  const now = new Date();
  const since = startOfDay(now);
  since.setUTCDate(since.getUTCDate() - 13); // last 14 days including today

  const [totalBookings, paidPayments, bookings] = await Promise.all([
    prisma.booking.count(),
    prisma.payment.findMany({
      where: { status: "PAID" },
      include: {
        booking: {
          include: {
            trip: {
              include: {
                route: {
                  include: { originStation: true, destinationStation: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: since } },
      include: {
        trip: {
          include: {
            route: {
              include: { originStation: true, destinationStation: true },
            },
          },
        },
      },
      take: 5000,
    }),
  ]);

  const revenue = round2(
    paidPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
  );

  // Bookings by day (last 14 days).
  const dayMap = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    dayMap.set(dayKey(d), 0);
  }
  for (const b of bookings) {
    const key = dayKey(b.createdAt);
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }
  const bookingsByDay: BookingsByDay[] = Array.from(dayMap.entries()).map(
    ([date, count]) => ({ date, count }),
  );

  // Top routes by booking count (from all bookings fetched) + revenue from paid payments.
  const routeMap = new Map<
    string,
    {
      routeId: string;
      origin: string;
      destination: string;
      originCity: string;
      destCity: string;
      bookings: number;
      revenue: number;
    }
  >();

  for (const b of bookings) {
    const route = b.trip?.route;
    if (!route) continue;
    const key = route.id;
    const entry = routeMap.get(key) ?? {
      routeId: route.id,
      origin: route.originStation?.name ?? "",
      destination: route.destinationStation?.name ?? "",
      originCity: route.originStation?.city ?? "",
      destCity: route.destinationStation?.city ?? "",
      bookings: 0,
      revenue: 0,
    };
    entry.bookings += 1;
    routeMap.set(key, entry);
  }

  for (const p of paidPayments) {
    const route = p.booking?.trip?.route;
    if (!route) continue;
    const entry = routeMap.get(route.id);
    if (entry) entry.revenue += p.amount || 0;
  }

  const topRoutes: TopRoute[] = Array.from(routeMap.values())
    .map((e) => ({ ...e, revenue: round2(e.revenue) }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);

  // Demand heatmap: group bookings by route origin/dest city.
  const heatMap = new Map<string, HeatmapCell>();
  for (const b of bookings) {
    const route = b.trip?.route;
    if (!route) continue;
    const originCity = route.originStation?.city ?? "Unknown";
    const destCity = route.destinationStation?.city ?? "Unknown";
    const key = `${originCity}__${destCity}`;
    const cell = heatMap.get(key) ?? { originCity, destCity, intensity: 0 };
    cell.intensity += 1;
    heatMap.set(key, cell);
  }
  const heatmap: HeatmapCell[] = Array.from(heatMap.values()).sort(
    (a, b) => b.intensity - a.intensity,
  );

  return {
    totalBookings,
    revenue,
    bookingsByDay,
    topRoutes,
    heatmap,
  };
}

// ---------------------------------------------------------------------------
// Route heatmap persistence
// ---------------------------------------------------------------------------

export type RouteHeatmapRow = {
  id: string;
  routeId: string | null;
  originCity: string | null;
  destCity: string | null;
  intensity: number;
  bucket: Date;
};

function hourBucket(d: Date): Date {
  const out = new Date(d);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

export async function computeHeatmap(): Promise<{ bucket: Date; count: number }> {
  const bucket = hourBucket(new Date());

  const bookings = await prisma.booking.findMany({
    include: {
      trip: {
        include: {
          route: {
            include: { originStation: true, destinationStation: true },
          },
        },
      },
    },
    take: 5000,
  });

  const heatMap = new Map<
    string,
    {
      routeId: string | null;
      originCity: string | null;
      destCity: string | null;
      intensity: number;
    }
  >();

  for (const b of bookings) {
    const route = b.trip?.route;
    const routeId = route?.id ?? null;
    const originCity = route?.originStation?.city ?? null;
    const destCity = route?.destinationStation?.city ?? null;
    const key = `${routeId ?? "?"}__${originCity ?? "?"}__${destCity ?? "?"}`;
    const cell = heatMap.get(key) ?? { routeId, originCity, destCity, intensity: 0 };
    cell.intensity += 1;
    heatMap.set(key, cell);
  }

  // Replace any rows already stored for this bucket to keep it idempotent.
  await prisma.routeHeatmap.deleteMany({ where: { bucket } });

  const rows = Array.from(heatMap.values());
  if (rows.length > 0) {
    await prisma.routeHeatmap.createMany({
      data: rows.map((r) => ({
        routeId: r.routeId,
        originCity: r.originCity,
        destCity: r.destCity,
        intensity: r.intensity,
        bucket,
      })),
    });
  }

  return { bucket, count: rows.length };
}

export async function listHeatmap(limit = 50): Promise<RouteHeatmapRow[]> {
  const rows = await prisma.routeHeatmap.findMany({
    orderBy: { intensity: "desc" },
    take: Math.max(1, Math.min(200, Number(limit) || 50)),
  });
  return rows.map((r) => ({
    id: r.id,
    routeId: r.routeId,
    originCity: r.originCity,
    destCity: r.destCity,
    intensity: r.intensity,
    bucket: r.bucket,
  }));
}
