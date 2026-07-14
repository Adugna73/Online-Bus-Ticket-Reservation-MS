import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/support";

// GAP 3: Support & Disputes — fully DB-backed.
// GET: list tickets (staff/admin see all, passengers see own).
export async function GET() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;
        const role = String(session.user.role || "").toLowerCase();

        const tickets = await svc.listTickets(userId, role);
        return NextResponse.json(tickets);
    } catch (error) {
        console.error("[support] list failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

// POST: create ticket (action="ticket") or add message (action="message").
export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;
        const role = String(session.user.role || "").toLowerCase();

        const body = await req.json().catch(() => ({}));
        const action = body?.action;

        if (action === "ticket") {
            const subject = String(body?.subject || "").trim();
            if (!subject) {
                return NextResponse.json(
                    { error: "subject_required" },
                    { status: 400 },
                );
            }
            const ticket = await svc.createTicket(
                userId,
                subject,
                body?.priority,
                body?.bookingId,
                body?.language,
            );
            return NextResponse.json(ticket);
        }

        if (action === "message") {
            const ticketId = String(body?.ticketId || "").trim();
            const content = String(body?.content || "").trim();
            if (!ticketId) {
                return NextResponse.json(
                    { error: "ticketId_required" },
                    { status: 400 },
                );
            }
            if (!content) {
                return NextResponse.json(
                    { error: "content_required" },
                    { status: 400 },
                );
            }
            // Ensure passenger owns the ticket (staff/admin may reply).
            if (role !== "staff" && role !== "admin") {
                const ticket = await svc.getTicket(ticketId, userId, role);
                if (!ticket) {
                    return NextResponse.json(
                        { error: "not_found" },
                        { status: 404 },
                    );
                }
            }
            const sender = String(body?.sender || "user");
            const result = await svc.addMessage(
                ticketId,
                sender,
                content,
                body?.locale,
            );
            return NextResponse.json(result);
        }

        return NextResponse.json(
            { error: "unknown_action" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[support] action failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
