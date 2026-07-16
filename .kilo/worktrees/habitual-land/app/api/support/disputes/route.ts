import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/support";

// GAP 3: Disputes — fully DB-backed.
// GET: list disputes (staff/admin see all, passengers see own).
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

        const disputes = await svc.listDisputes(userId, role);
        return NextResponse.json(disputes);
    } catch (error) {
        console.error("[support:disputes] list failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

// POST: create dispute.
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

        const body = await req.json().catch(() => ({}));
        const bookingId = String(body?.bookingId || "").trim();
        const reason = String(body?.reason || "").trim();
        if (!bookingId) {
            return NextResponse.json(
                { error: "bookingId_required" },
                { status: 400 },
            );
        }
        if (!reason) {
            return NextResponse.json(
                { error: "reason_required" },
                { status: 400 },
            );
        }
        const dispute = await svc.createDispute(bookingId, userId, reason);
        return NextResponse.json(dispute);
    } catch (error) {
        console.error("[support:disputes] create failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
