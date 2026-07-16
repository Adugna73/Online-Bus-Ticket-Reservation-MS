import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { updateRule, deleteRule } from "@/lib/services/operator";

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

// PATCH: update a dynamic pricing rule.
export async function PATCH(
  req: Request,
  context: { params: { id: string } },
) {
  try {
    const auth = await requireManager();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const id = String(params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "rule_id_required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as any;

    const rule = await updateRule(id, {
      routeId: body.routeId !== undefined ? (body.routeId ? String(body.routeId) : null) : undefined,
      minFillPct: body.minFillPct !== undefined ? Number(body.minFillPct) : undefined,
      maxFillPct: body.maxFillPct !== undefined ? Number(body.maxFillPct) : undefined,
      multiplier: body.multiplier !== undefined ? Number(body.multiplier) : undefined,
      active: body.active !== undefined ? Boolean(body.active) : undefined,
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("[operator] PATCH failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE: remove a dynamic pricing rule.
export async function DELETE(
  _req: Request,
  context: { params: { id: string } },
) {
  try {
    const auth = await requireManager();
    if (auth.status !== 200) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const id = String(params?.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "rule_id_required" }, { status: 400 });
    }

    await deleteRule(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[operator] DELETE failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
