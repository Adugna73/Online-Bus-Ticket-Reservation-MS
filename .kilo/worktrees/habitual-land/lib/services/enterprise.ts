import { prisma } from "@/lib/prisma";

// GAP 9: Enterprise & Government — corporate accounts, government tax reports,
// and NGO bulk bookings. Fully DB-backed (Prisma). No stubs.

export type CorporateAccount = {
  id: string;
  name: string;
  billingEmail: string | null;
  creditLimit: number;
  createdAt: Date;
};

export type GovernmentReport = {
  id: string;
  period: string;
  taxCollected: number;
  payload: unknown;
  generatedAt: Date;
};

export type NgoBulkBooking = {
  id: string;
  ngoName: string;
  tripId: string;
  seatsCount: number;
  specialPricing: number | null;
  createdAt: Date;
  trip?: { id: string; departAt: Date } | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Corporate accounts
// ---------------------------------------------------------------------------

export async function listCorporates(): Promise<CorporateAccount[]> {
  const rows = await prisma.corporateAccount.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    billingEmail: r.billingEmail,
    creditLimit: r.creditLimit,
    createdAt: r.createdAt,
  }));
}

export async function createCorporate(data: {
  name: string;
  billingEmail?: string | null;
  creditLimit?: number;
}): Promise<CorporateAccount> {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("name_required");
  const created = await prisma.corporateAccount.create({
    data: {
      name,
      billingEmail: data.billingEmail ? String(data.billingEmail).trim() : null,
      creditLimit: Number(data.creditLimit ?? 0),
    },
  });
  return {
    id: created.id,
    name: created.name,
    billingEmail: created.billingEmail,
    creditLimit: created.creditLimit,
    createdAt: created.createdAt,
  };
}

export async function updateCorporate(
  id: string,
  data: {
    name?: string;
    billingEmail?: string | null;
    creditLimit?: number;
  },
): Promise<CorporateAccount> {
  const updateData: {
    name?: string;
    billingEmail?: string | null;
    creditLimit?: number;
  } = {};
  if (data.name !== undefined) {
    const name = String(data.name).trim();
    if (!name) throw new Error("name_required");
    updateData.name = name;
  }
  if (data.billingEmail !== undefined) {
    updateData.billingEmail = data.billingEmail ? String(data.billingEmail).trim() : null;
  }
  if (data.creditLimit !== undefined) {
    updateData.creditLimit = Number(data.creditLimit);
  }
  const updated = await prisma.corporateAccount.update({
    where: { id },
    data: updateData,
  });
  return {
    id: updated.id,
    name: updated.name,
    billingEmail: updated.billingEmail,
    creditLimit: updated.creditLimit,
    createdAt: updated.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Government reports
// ---------------------------------------------------------------------------

// Parse a "YYYY-MM" period into the inclusive [start, end) UTC bounds.
function periodBounds(period: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export async function generateGovReport(period: string): Promise<GovernmentReport> {
  const bounds = periodBounds(period);
  if (!bounds) throw new Error("invalid_period");

  // Sum amounts of PAID payments whose paidAt (fallback createdAt) falls in period.
  const payments = await prisma.payment.findMany({
    where: { status: "PAID" },
    select: { amount: true, paidAt: true, createdAt: true },
  });

  let total = 0;
  let count = 0;
  for (const p of payments) {
    const when = p.paidAt ?? p.createdAt;
    if (when >= bounds.start && when < bounds.end) {
      total += p.amount || 0;
      count += 1;
    }
  }

  const taxCollected = round2(total * 0.15);

  const created = await prisma.governmentReport.create({
    data: {
      period: String(period).trim(),
      taxCollected,
      payload: {
        period: String(period).trim(),
        paidPaymentsCount: count,
        grossRevenue: round2(total),
        taxRate: 0.15,
        generatedAt: new Date().toISOString(),
      },
    },
  });

  return {
    id: created.id,
    period: created.period,
    taxCollected: created.taxCollected,
    payload: created.payload,
    generatedAt: created.generatedAt,
  };
}

export async function listGovReports(): Promise<GovernmentReport[]> {
  const rows = await prisma.governmentReport.findMany({
    orderBy: { generatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    taxCollected: r.taxCollected,
    payload: r.payload,
    generatedAt: r.generatedAt,
  }));
}

// ---------------------------------------------------------------------------
// NGO bulk bookings
// ---------------------------------------------------------------------------

export async function createNgoBulkBooking(data: {
  ngoName: string;
  tripId: string;
  seatsCount: number;
  specialPricing?: number | null;
}): Promise<NgoBulkBooking> {
  const ngoName = String(data.ngoName || "").trim();
  const tripId = String(data.tripId || "").trim();
  if (!ngoName) throw new Error("ngo_name_required");
  if (!tripId) throw new Error("trip_id_required");
  const seatsCount = Math.max(0, Math.floor(Number(data.seatsCount || 0)));

  const created = await prisma.ngoBulkBooking.create({
    data: {
      ngoName,
      tripId,
      seatsCount,
      specialPricing:
        data.specialPricing === undefined || data.specialPricing === null
          ? null
          : Number(data.specialPricing),
    },
  });

  const trip = await prisma.trip.findUnique({
    where: { id: created.tripId },
    select: { id: true, departAt: true },
  });

  return {
    id: created.id,
    ngoName: created.ngoName,
    tripId: created.tripId,
    seatsCount: created.seatsCount,
    specialPricing: created.specialPricing,
    createdAt: created.createdAt,
    trip: trip ? { id: trip.id, departAt: trip.departAt } : null,
  };
}

export async function listNgoBookings(): Promise<NgoBulkBooking[]> {
  const rows = await prisma.ngoBulkBooking.findMany({
    orderBy: { createdAt: "desc" },
  });
  const tripIds = Array.from(new Set(rows.map((r) => r.tripId).filter(Boolean)));
  const trips =
    tripIds.length > 0
      ? await prisma.trip.findMany({
          where: { id: { in: tripIds } },
          select: { id: true, departAt: true },
        })
      : [];
  const tripMap = new Map(trips.map((t) => [t.id, t]));
  return rows.map((r) => ({
    id: r.id,
    ngoName: r.ngoName,
    tripId: r.tripId,
    seatsCount: r.seatsCount,
    specialPricing: r.specialPricing,
    createdAt: r.createdAt,
    trip: tripMap.get(r.tripId) ?? null,
  }));
}
