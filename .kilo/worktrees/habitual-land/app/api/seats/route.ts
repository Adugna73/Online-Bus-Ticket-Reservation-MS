import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/seats";
import { SeatError } from "@/lib/services/seats";

async function requireUserId() {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) return null;
    return String(session.user.id);
}

function errorResponse(error: unknown) {
    if (error instanceof SeatError) {
        const status =
            error.code === "trip_not_found" || error.code === "hold_not_found"
                ? 404
                : error.code === "seat_booked" ||
                    error.code === "seat_held" ||
                    error.code === "seat_unavailable"
                  ? 409
                  : 400;
        return NextResponse.json({ error: error.code }, { status });
    }
    console.error("[seats] error", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
}

// GET /api/seats?tripId=... → seat map for the trip
export async function GET(req: Request) {
    try {
        const userId = await requireUserId();
        if (!userId)
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );

        const url = new URL(req.url);
        const tripId = url.searchParams.get("tripId");
        if (!tripId)
            return NextResponse.json(
                { error: "tripId_required" },
                { status: 400 },
            );

        const seatMap = await svc.getTripSeats(tripId, userId);
        return NextResponse.json(seatMap);
    } catch (error) {
        return errorResponse(error);
    }
}

// POST /api/seats  { action: "hold"|"release"|"book", ... }
export async function POST(req: Request) {
    try {
        const userId = await requireUserId();
        if (!userId)
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );

        const body = (await req.json().catch(() => ({}))) as {
            action?: string;
            tripId?: string;
            seatId?: string;
            seatIds?: string[];
            holdId?: string;
            passengerFullName?: string;
            passengerPhone?: string;
            passengerEmail?: string;
            passengerIdNumber?: string;
            passengerGender?: string;
            passengerAge?: number;
            emergencyContact?: string;
            notes?: string;
        };

        const action = String(body?.action || "");
        const tripId = String(body?.tripId || "").trim();

        if (action === "hold") {
            const seatId = String(body?.seatId || "").trim();
            if (!tripId || !seatId)
                return NextResponse.json(
                    { error: "tripId_and_seatId_required" },
                    { status: 400 },
                );
            const hold = await svc.holdSeat(tripId, seatId, userId);
            return NextResponse.json({ ok: true, hold });
        }

        if (action === "release") {
            const holdId = String(body?.holdId || "").trim();
            if (!holdId)
                return NextResponse.json(
                    { error: "holdId_required" },
                    { status: 400 },
                );
            const result = await svc.releaseHold(holdId, userId);
            return NextResponse.json({ ok: true, ...result });
        }

        if (action === "book") {
            const seatIds = Array.isArray(body?.seatIds)
                ? body.seatIds.map((s) => String(s).trim()).filter(Boolean)
                : body?.seatId
                  ? [String(body.seatId).trim()]
                  : [];
            if (!tripId || seatIds.length === 0)
                return NextResponse.json(
                    { error: "tripId_and_seatIds_required" },
                    { status: 400 },
                );
            const booking = await svc.bookSeats(tripId, seatIds, userId, {
                passengerFullName: body?.passengerFullName,
                passengerPhone: body?.passengerPhone,
                passengerEmail: body?.passengerEmail,
                passengerIdNumber: body?.passengerIdNumber,
                passengerGender: body?.passengerGender,
                passengerAge: body?.passengerAge,
                emergencyContact: body?.emergencyContact,
                notes: body?.notes,
            });
            return NextResponse.json({ ok: true, booking });
        }

        return NextResponse.json(
            { error: "unknown_action" },
            { status: 400 },
        );
    } catch (error) {
        return errorResponse(error);
    }
}
