import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ChannelKind } from "@prisma/client";
import * as svc from "@/lib/services/channels";

const ADMIN_ROLES = new Set(["admin", "staff", "supervisor", "manager"]);

function isChannelKind(v: string): v is ChannelKind {
  return ["SMS", "USSD", "VOICE", "AGENT", "WEB"].includes(v);
}

// GET: agents + offline tickets + sessions for admin/staff;
// for passengers: their offline tickets only.
export async function GET(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const role = String(session.user.role || "").toLowerCase();
    const isAdmin = ADMIN_ROLES.has(role);

    if (isAdmin) {
      const [agents, offlineTickets, sessions] = await Promise.all([
        svc.listAgents(),
        svc.listOfflineTickets(),
        svc.listSessions(),
      ]);
      return NextResponse.json({ agents, offlineTickets, sessions, isAdmin: true });
    }

    const offlineTickets = await svc.listOfflineTickets({ userId });
    return NextResponse.json({ agents: [], offlineTickets, sessions: [], isAdmin: false });
  } catch (error) {
    console.error("[channels] GET failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST body.action: agent | offline | session | ussd | sms | voice
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const role = String(session.user.role || "").toLowerCase();
    const isAdmin = ADMIN_ROLES.has(role);

    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "agent") {
      if (!isAdmin) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
      const agent = await svc.createAgent({
        agentName: String(body?.agentName || "").trim(),
        phone: body?.phone ?? null,
        location: body?.location ?? null,
        commissionPct: body?.commissionPct ?? null,
      });
      return NextResponse.json({ agent });
    }

    if (action === "offline") {
      const bookingId = String(body?.bookingId || "").trim();
      if (!bookingId) {
        return NextResponse.json({ error: "booking_required" }, { status: 400 });
      }
      const result = await svc.issueOfflineTicket(bookingId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ ticket: result.ticket });
    }

    if (action === "session") {
      const channel = String(body?.channel || "").toUpperCase();
      if (!isChannelKind(channel)) {
        return NextResponse.json({ error: "invalid_channel" }, { status: 400 });
      }
      const msisdn = body?.msisdn ?? null;
      const created = await svc.startSession(channel, msisdn);
      return NextResponse.json({ session: created });
    }

    if (action === "ussd") {
      const sessionId = String(body?.sessionId || "").trim();
      const input = String(body?.input ?? "");
      if (!sessionId) {
        return NextResponse.json({ error: "session_required" }, { status: 400 });
      }
      const result = await svc.simulateUssd(sessionId, input);
      return NextResponse.json(result);
    }

    if (action === "sms") {
      const res = await svc.smsBook(String(body?.msisdn || ""), String(body?.message || ""));
      return NextResponse.json(res);
    }

    if (action === "voice") {
      const res = await svc.voiceBook(
        String(body?.callId || ""),
        String(body?.speech || ""),
        body?.locale || "am",
      );
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    console.error("[channels] POST failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
