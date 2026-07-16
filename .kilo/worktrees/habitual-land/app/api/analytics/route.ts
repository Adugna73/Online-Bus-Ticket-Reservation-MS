import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/analytics";

// GAP 10: Analytics & BI — fully DB-backed.

async function requireManager() {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return { status: 401, error: "unauthorized" } as const;
  }
  const role = String(session.user.role || "").toLowerCase();
  if (role !== "admin" && role !== "manager") {
    return { status: 403, error: "forbidden" } as const;
  }
  return { status: 200, session } as const;
}

// GET: dashboard summary + persisted heatmap rows.
export async function GET(req: Request) {
  try {
    const auth = await requireManager();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");

    if (kind === "heatmap") {
      const rows = await svc.listHeatmap(
        Number(url.searchParams.get("limit") || 50),
      );
      return NextResponse.json({ heatmap: rows });
    }

    const [dashboard, heatmap] = await Promise.all([
      svc.dashboard(),
      svc.listHeatmap(50),
    ]);
    return NextResponse.json({ dashboard, heatmap });
  } catch (error) {
    console.error("[analytics] GET failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST: track an event (action="track") or recompute heatmap (action="recompute").
export async function POST(req: Request) {
  try {
    const auth = await requireManager();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const action = String(body?.action || "").toLowerCase();

    if (action === "track") {
      const kind = String(body?.kind || "").trim();
      if (!kind) {
        return NextResponse.json({ error: "kind_required" }, { status: 400 });
      }
      const result = await svc.trackEvent(
        kind,
        body?.userId ? String(body.userId) : undefined,
        body?.meta,
      );
      return NextResponse.json(result);
    }

    if (action === "recompute") {
      const result = await svc.computeHeatmap();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    console.error("[analytics] POST failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
