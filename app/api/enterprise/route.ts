import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  listCorporates,
  createCorporate,
  listGovReports,
  generateGovReport,
  listNgoBookings,
  createNgoBulkBooking,
} from "@/lib/services/enterprise";

async function requireAdmin() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return { status: 401, error: "unauthorized" } as const;
  }
  const role = String(session.user.role || "").toLowerCase();
  if (role !== "admin") {
    return { status: 403, error: "forbidden" } as const;
  }
  return { status: 200, session } as const;
}

// GET ?kind=corporate|gov|ngo
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const kind = String(url.searchParams.get("kind") || "").toLowerCase();

    if (kind === "corporate") {
      return NextResponse.json({ corporates: await listCorporates() });
    }
    if (kind === "gov") {
      return NextResponse.json({ reports: await listGovReports() });
    }
    if (kind === "ngo") {
      return NextResponse.json({ bookings: await listNgoBookings() });
    }
    return NextResponse.json({ error: "kind_required" }, { status: 400 });
  } catch (error) {
    console.error("[enterprise] GET failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST body.kind = "corporate" | "gov" | "ngo"
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const kind = String(body?.kind || "").toLowerCase();

    if (kind === "corporate") {
      const name = String(body?.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "name_required" }, { status: 400 });
      }
      const corporate = await createCorporate({
        name,
        billingEmail: body.billingEmail ?? null,
        creditLimit: Number(body.creditLimit ?? 0),
      });
      return NextResponse.json({ corporate });
    }

    if (kind === "gov") {
      const period = String(body?.period || "").trim();
      if (!period) {
        return NextResponse.json({ error: "period_required" }, { status: 400 });
      }
      try {
        const report = await generateGovReport(period);
        return NextResponse.json({ report });
      } catch (e: any) {
        if (String(e?.message || "") === "invalid_period") {
          return NextResponse.json({ error: "invalid_period" }, { status: 400 });
        }
        throw e;
      }
    }

    if (kind === "ngo") {
      const ngoName = String(body?.ngoName || "").trim();
      const tripId = String(body?.tripId || "").trim();
      if (!ngoName) {
        return NextResponse.json({ error: "ngo_name_required" }, { status: 400 });
      }
      if (!tripId) {
        return NextResponse.json({ error: "trip_id_required" }, { status: 400 });
      }
      const booking = await createNgoBulkBooking({
        ngoName,
        tripId,
        seatsCount: Number(body.seatsCount ?? 0),
        specialPricing:
          body.specialPricing === undefined || body.specialPricing === null
            ? null
            : Number(body.specialPricing),
      });
      return NextResponse.json({ booking });
    }

    return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
  } catch (error) {
    console.error("[enterprise] POST failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
