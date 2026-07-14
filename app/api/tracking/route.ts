import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/tracking";

// GAP 6: Real-Time Tracking (DB-backed)
export async function GET(req: Request) {
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

        const url = new URL(req.url);
        const tripId = url.searchParams.get("tripId");
        const busId = url.searchParams.get("busId");
        const sos = url.searchParams.get("sos");

        if (sos === "1") {
            const alerts = await svc.listSos(role, userId);
            return NextResponse.json({ alerts });
        }
        if (tripId) {
            const tracking = await svc.getTripTracking(tripId);
            if (!tracking) {
                return NextResponse.json(
                    { error: "trip_not_found" },
                    { status: 404 },
                );
            }
            return NextResponse.json(tracking);
        }
        if (busId) {
            const location = await svc.getLatestLocation(busId);
            return NextResponse.json({ location });
        }
        return NextResponse.json(
            { error: "tripId_or_busId_required" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[tracking] GET failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

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

        if (action === "location") {
            // Only staff/admin may write bus location samples.
            if (role !== "staff" && role !== "admin") {
                return NextResponse.json(
                    { error: "forbidden" },
                    { status: 403 },
                );
            }
            const busId = String(body?.busId || "").trim();
            if (!busId) {
                return NextResponse.json(
                    { error: "busId_required" },
                    { status: 400 },
                );
            }
            const lat = Number(body?.lat);
            const lng = Number(body?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return NextResponse.json(
                    { error: "invalid_coordinates" },
                    { status: 400 },
                );
            }
            const location = await svc.updateLocation(
                busId,
                body?.tripId,
                lat,
                lng,
                body?.speed,
                body?.heading,
                body?.etaMinutes,
            );
            return NextResponse.json({ location });
        }

        if (action === "sos") {
            const alert = await svc.raiseSos(
                userId,
                body?.bookingId,
                body?.busId,
                body?.lat,
                body?.lng,
            );
            return NextResponse.json({ alert });
        }

        return NextResponse.json(
            { error: "unknown_action" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[tracking] POST failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
