import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/channels";

const ADMIN_ROLES = new Set(["admin", "staff", "supervisor", "manager"]);

// PATCH /api/channels/[id] — update an agent booking channel.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const role = String(session.user.role || "").toLowerCase();
    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const agent = await svc.updateAgent(id, {
      agentName: body?.agentName,
      phone: body?.phone,
      location: body?.location,
      commissionPct: body?.commissionPct,
    });
    return NextResponse.json({ agent });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    }
    console.error("[channels][id] PATCH failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
