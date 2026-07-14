import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import {
  revenueDashboard,
  listPricingRules,
  listFraudFlags,
  createRule,
  createFlag,
  computePrice,
} from "@/lib/services/operator";

async function requireManager() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return { status: 401, error: "unauthorized" } as const;
  }
  const role = String(session.user.role || "").toLowerCase();
  if (role !== "admin" && role !== "manager" && role !== "supervisor") {
    return { status: 403, error: "forbidden" } as const;
  }
  return { status: 200, session } as const;
}

// GET: dashboard summary + pricing rules + fraud flags.
export async function GET(req: Request) {
  try {
    const auth = await requireManager();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const computeTripId = url.searchParams.get("computePrice") || "";

    const [dashboard, rules, flags] = await Promise.all([
      revenueDashboard(),
      listPricingRules(),
      listFraudFlags(),
    ]);

    const price =
      computeTripId.trim().length > 0
        ? await computePrice(computeTripId.trim()).catch(() => null)
        : null;

    return NextResponse.json({ dashboard, rules, flags, price });
  } catch (error) {
    console.error("[operator] GET failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST: create a pricing rule (kind="rule") or a fraud flag (kind="flag").
export async function POST(req: Request) {
  try {
    const auth = await requireManager();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const kind = String(body?.kind || "").toLowerCase();

    if (kind === "rule") {
      const rule = await createRule({
        routeId: body.routeId ? String(body.routeId) : null,
        minFillPct: Number(body.minFillPct ?? 0),
        maxFillPct: Number(body.maxFillPct ?? 100),
        multiplier: Number(body.multiplier ?? 1.0),
        active: body.active ?? true,
      });
      return NextResponse.json({ rule });
    }

    if (kind === "flag") {
      const reason = String(body?.reason || "").trim();
      if (!reason) {
        return NextResponse.json({ error: "reason_required" }, { status: 400 });
      }
      const flag = await createFlag({
        busId: body.busId ? String(body.busId) : null,
        conductorId: body.conductorId ? String(body.conductorId) : null,
        reason,
        severity: String(body.severity || "low"),
      });
      return NextResponse.json({ flag });
    }

    return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
  } catch (error) {
    console.error("[operator] POST failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
