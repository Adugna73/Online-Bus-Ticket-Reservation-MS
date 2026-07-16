import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/support";

// GET: ticket + messages.
export async function GET(
    _req: Request,
    context: { params: { id: string } },
) {
    try {
        const params = await context.params;
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;
        const role = String(session.user.role || "").toLowerCase();
        const ticketId = String(params?.id || "");
        if (!ticketId) {
            return NextResponse.json(
                { error: "invalid_id" },
                { status: 400 },
            );
        }

        const ticket = await svc.getTicket(ticketId, userId, role);
        if (!ticket) {
            return NextResponse.json(
                { error: "not_found" },
                { status: 404 },
            );
        }
        return NextResponse.json(ticket);
    } catch (error) {
        console.error("[support:id] fetch failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

// PATCH: update ticket status (staff/admin only).
export async function PATCH(
    req: Request,
    context: { params: { id: string } },
) {
    try {
        const params = await context.params;
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const role = String(session.user.role || "").toLowerCase();
        if (role !== "staff" && role !== "admin") {
            return NextResponse.json(
                { error: "forbidden" },
                { status: 403 },
            );
        }
        const ticketId = String(params?.id || "");
        if (!ticketId) {
            return NextResponse.json(
                { error: "invalid_id" },
                { status: 400 },
            );
        }
        const body = await req.json().catch(() => ({}));
        const status = String(body?.status || "").trim();
        if (!status) {
            return NextResponse.json(
                { error: "status_required" },
                { status: 400 },
            );
        }
        const ticket = await svc.updateTicketStatus(ticketId, status);
        return NextResponse.json(ticket);
    } catch (error) {
        console.error("[support:id] update failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
