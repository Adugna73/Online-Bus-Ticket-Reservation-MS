import { prisma } from "@/lib/prisma";

// GAP 4: Operator Tools — revenue dashboard, dynamic pricing, fraud flags.
// Fully DB-backed (Prisma). No stubs.
//
// Note: DynamicPricingRule.routeId and OperatorFraudFlag.busId are plain
// optional strings without Prisma relations (per schema), so related labels
// are resolved with separate lookups rather than `include`.

export type PricingRule = {
  id: string;
  routeId: string | null;
  minFillPct: number;
  maxFillPct: number;
  multiplier: number;
  active: boolean;
  createdAt: Date;
  route?: { id: string; origin: string; destination: string } | null;
};

export type FraudFlag = {
  id: string;
  busId: string | null;
  conductorId: string | null;
  reason: string;
  severity: string;
  createdAt: Date;
  bus?: { id: string; plateNumber: string } | null;
};

export type RevenueDashboard = {
  totalRevenue: number;
  bookingsCount: number;
  paidBookingsCount: number;
  byRoute: {
    routeId: string;
    origin: string;
    destination: string;
    revenue: number;
    bookings: number;
  }[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type RouteLabel = { id: string; origin: string; destination: string };

async function resolveRouteLabels(routeIds: string[]): Promise<Map<string, RouteLabel>> {
  const map = new Map<string, RouteLabel>();
  const unique = Array.from(new Set(routeIds.filter(Boolean)));
  if (unique.length === 0) return map;
  const routes = await prisma.route.findMany({
    where: { id: { in: unique } },
    include: { originStation: true, destinationStation: true },
  });
  for (const r of routes) {
    map.set(r.id, {
      id: r.id,
      origin: r.originStation?.name ?? "",
      destination: r.destinationStation?.name ?? "",
    });
  }
  return map;
}

async function resolveBusLabels(busIds: string[]): Promise<Map<string, { id: string; plateNumber: string }>> {
  const map = new Map<string, { id: string; plateNumber: string }>();
  const unique = Array.from(new Set(busIds.filter(Boolean)));
  if (unique.length === 0) return map;
  const buses = await prisma.bus.findMany({ where: { id: { in: unique } } });
  for (const b of buses) {
    map.set(b.id, { id: b.id, plateNumber: b.plateNumber });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Dynamic pricing rules
// ---------------------------------------------------------------------------

export async function listPricingRules(): Promise<PricingRule[]> {
  const rules = await prisma.dynamicPricingRule.findMany({
    orderBy: { createdAt: "asc" },
  });
  const labels = await resolveRouteLabels(rules.map((r) => r.routeId || ""));
  return rules.map((r) => ({
    id: r.id,
    routeId: r.routeId,
    minFillPct: r.minFillPct,
    maxFillPct: r.maxFillPct,
    multiplier: r.multiplier,
    active: r.active,
    createdAt: r.createdAt,
    route: r.routeId ? labels.get(r.routeId) ?? null : null,
  }));
}

export async function createRule(data: {
  routeId?: string | null;
  minFillPct?: number;
  maxFillPct?: number;
  multiplier?: number;
  active?: boolean;
}): Promise<PricingRule> {
  const created = await prisma.dynamicPricingRule.create({
    data: {
      routeId: data.routeId ? String(data.routeId) : null,
      minFillPct: Number(data.minFillPct ?? 0),
      maxFillPct: Number(data.maxFillPct ?? 100),
      multiplier: Number(data.multiplier ?? 1.0),
      active: data.active ?? true,
    },
  });
  const labels = await resolveRouteLabels(created.routeId ? [created.routeId] : []);
  return {
    id: created.id,
    routeId: created.routeId,
    minFillPct: created.minFillPct,
    maxFillPct: created.maxFillPct,
    multiplier: created.multiplier,
    active: created.active,
    createdAt: created.createdAt,
    route: created.routeId ? labels.get(created.routeId) ?? null : null,
  };
}

export async function updateRule(
  id: string,
  data: {
    routeId?: string | null;
    minFillPct?: number;
    maxFillPct?: number;
    multiplier?: number;
    active?: boolean;
  },
): Promise<PricingRule> {
  const updateData: {
    routeId?: string | null;
    minFillPct?: number;
    maxFillPct?: number;
    multiplier?: number;
    active?: boolean;
  } = {};
  if (data.routeId !== undefined) {
    updateData.routeId = data.routeId ? String(data.routeId) : null;
  }
  if (data.minFillPct !== undefined) updateData.minFillPct = Number(data.minFillPct);
  if (data.maxFillPct !== undefined) updateData.maxFillPct = Number(data.maxFillPct);
  if (data.multiplier !== undefined) updateData.multiplier = Number(data.multiplier);
  if (data.active !== undefined) updateData.active = Boolean(data.active);

  const updated = await prisma.dynamicPricingRule.update({
    where: { id },
    data: updateData,
  });
  const labels = await resolveRouteLabels(updated.routeId ? [updated.routeId] : []);
  return {
    id: updated.id,
    routeId: updated.routeId,
    minFillPct: updated.minFillPct,
    maxFillPct: updated.maxFillPct,
    multiplier: updated.multiplier,
    active: updated.active,
    createdAt: updated.createdAt,
    route: updated.routeId ? labels.get(updated.routeId) ?? null : null,
  };
}

export async function deleteRule(id: string): Promise<{ id: string }> {
  await prisma.dynamicPricingRule.delete({ where: { id } });
  return { id };
}

// ---------------------------------------------------------------------------
// Price computation
// ---------------------------------------------------------------------------

export async function computePrice(
  tripId: string,
): Promise<{
  tripId: string;
  basePrice: number;
  price: number;
  multiplier: number;
  fillPct: number;
  bookedSeats: number;
  seatCount: number;
  appliedRuleId: string | null;
}> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { bus: true },
  });
  if (!trip) {
    throw new Error("trip_not_found");
  }

  const seatCount = trip.bus?.seatCount ?? 0;

  // Count currently booked seats for this trip (exclude cancelled bookings).
  const bookedSeats = await prisma.bookingSeat.count({
    where: {
      tripId,
      booking: { status: { not: "CANCELLED" } },
    },
  });

  const fillPct = seatCount > 0 ? (bookedSeats / seatCount) * 100 : 0;

  // Active rules: prefer route-specific first, then global (routeId null).
  const rules = await prisma.dynamicPricingRule.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const routeSpecific = rules.filter((r) => r.routeId === trip.routeId);
  const global = rules.filter((r) => r.routeId === null);
  const ordered = [...routeSpecific, ...global];

  const matched = ordered.find(
    (r) => fillPct >= r.minFillPct && fillPct <= r.maxFillPct,
  );

  const multiplier = matched ? matched.multiplier : 1.0;
  const price = round2(trip.basePrice * multiplier);

  return {
    tripId,
    basePrice: trip.basePrice,
    price,
    multiplier,
    fillPct: round2(fillPct),
    bookedSeats,
    seatCount,
    appliedRuleId: matched ? matched.id : null,
  };
}

// ---------------------------------------------------------------------------
// Fraud flags
// ---------------------------------------------------------------------------

export async function listFraudFlags(): Promise<FraudFlag[]> {
  const flags = await prisma.operatorFraudFlag.findMany({
    orderBy: { createdAt: "desc" },
  });
  const labels = await resolveBusLabels(flags.map((f) => f.busId || ""));
  return flags.map((f) => ({
    id: f.id,
    busId: f.busId,
    conductorId: f.conductorId,
    reason: f.reason,
    severity: f.severity,
    createdAt: f.createdAt,
    bus: f.busId ? labels.get(f.busId) ?? null : null,
  }));
}

export async function createFlag(data: {
  busId?: string | null;
  conductorId?: string | null;
  reason: string;
  severity?: string;
}): Promise<FraudFlag> {
  const created = await prisma.operatorFraudFlag.create({
    data: {
      busId: data.busId ? String(data.busId) : null,
      conductorId: data.conductorId ? String(data.conductorId) : null,
      reason: String(data.reason || ""),
      severity: String(data.severity || "low"),
    },
  });
  const labels = await resolveBusLabels(created.busId ? [created.busId] : []);
  return {
    id: created.id,
    busId: created.busId,
    conductorId: created.conductorId,
    reason: created.reason,
    severity: created.severity,
    createdAt: created.createdAt,
    bus: created.busId ? labels.get(created.busId) ?? null : null,
  };
}

// ---------------------------------------------------------------------------
// Revenue dashboard
// ---------------------------------------------------------------------------

export async function revenueDashboard(): Promise<RevenueDashboard> {
  // Paid payments carry the real revenue. Pull them with their booking + trip + route.
  const payments = await prisma.payment.findMany({
    where: { status: "PAID" },
    include: {
      booking: {
        include: {
          trip: {
            include: {
              route: { include: { originStation: true, destinationStation: true } },
            },
          },
        },
      },
    },
  });

  const totalRevenue = round2(
    payments.reduce((sum, p) => sum + (p.amount || 0), 0),
  );

  const bookingsCount = await prisma.booking.count();
  const paidBookingsCount = await prisma.booking.count({
    where: { payment: { status: "PAID" } },
  });

  const byRouteMap = new Map<
    string,
    { routeId: string; origin: string; destination: string; revenue: number; bookings: number }
  >();

  // Count bookings per route (all statuses).
  const bookings = await prisma.booking.findMany({
    include: {
      trip: {
        include: {
          route: { include: { originStation: true, destinationStation: true } },
        },
      },
    },
    take: 5000,
  });

  for (const b of bookings) {
    const route = b.trip?.route;
    if (!route) continue;
    const key = route.id;
    const entry = byRouteMap.get(key) ?? {
      routeId: route.id,
      origin: route.originStation?.name ?? "",
      destination: route.destinationStation?.name ?? "",
      revenue: 0,
      bookings: 0,
    };
    entry.bookings += 1;
    byRouteMap.set(key, entry);
  }

  // Add revenue from paid payments.
  for (const p of payments) {
    const route = p.booking?.trip?.route;
    if (!route) continue;
    const key = route.id;
    const entry = byRouteMap.get(key);
    if (entry) {
      entry.revenue += p.amount || 0;
    }
  }

  const byRoute = Array.from(byRouteMap.values())
    .map((e) => ({ ...e, revenue: round2(e.revenue) }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    bookingsCount,
    paidBookingsCount,
    byRoute,
  };
}
