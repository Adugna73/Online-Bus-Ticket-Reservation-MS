import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import * as svc from "@/lib/services/vas";

// GAP 8: Value-Added Services — fully DB-backed.
// GET  ?kind=insurance|cargo|hotel|group
// POST body.kind=insurance|cargo|hotel|group
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
        const kind = url.searchParams.get("kind") || "";

        if (kind === "insurance") {
            return NextResponse.json(await svc.listInsurance(userId));
        }
        if (kind === "cargo") {
            return NextResponse.json(await svc.listCargo(userId, role));
        }
        if (kind === "hotel") {
            return NextResponse.json(await svc.listHotels());
        }
        if (kind === "group") {
            return NextResponse.json(
                await svc.listGroupBookings(userId, role),
            );
        }
        return NextResponse.json(
            { error: "unknown_kind" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[vas] list failed", error);
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
        const kind = String(body?.kind || "").toLowerCase();

        if (kind === "insurance") {
            const bookingId = String(body?.bookingId || "").trim();
            if (!bookingId) {
                return NextResponse.json(
                    { error: "bookingId_required" },
                    { status: 400 },
                );
            }
            const premium = Number(body?.premium);
            try {
                const insurance = await svc.buyInsurance(bookingId, premium);
                return NextResponse.json(insurance);
            } catch (err: any) {
                if (
                    err instanceof Prisma.PrismaClientKnownRequestError &&
                    err.code === "P2002"
                ) {
                    return NextResponse.json(
                        { error: "insurance_already_exists" },
                        { status: 409 },
                    );
                }
                if (err?.message === "booking_not_found") {
                    return NextResponse.json(
                        { error: "booking_not_found" },
                        { status: 404 },
                    );
                }
                throw err;
            }
        }

        if (kind === "cargo") {
            const tripId = String(body?.tripId || "").trim();
            const senderPhone = String(body?.senderPhone || "").trim();
            if (!tripId) {
                return NextResponse.json(
                    { error: "tripId_required" },
                    { status: 400 },
                );
            }
            if (!senderPhone) {
                return NextResponse.json(
                    { error: "senderPhone_required" },
                    { status: 400 },
                );
            }
            try {
                const cargo = await svc.createCargo(
                    tripId,
                    senderPhone,
                    body?.description,
                    body?.weightKg,
                    body?.price,
                );
                return NextResponse.json(cargo);
            } catch (err: any) {
                if (err?.message === "trip_not_found") {
                    return NextResponse.json(
                        { error: "trip_not_found" },
                        { status: 404 },
                    );
                }
                throw err;
            }
        }

        if (kind === "hotel") {
            if (role !== "admin") {
                return NextResponse.json(
                    { error: "forbidden" },
                    { status: 403 },
                );
            }
            const name = String(body?.name || "").trim();
            if (!name) {
                return NextResponse.json(
                    { error: "name_required" },
                    { status: 400 },
                );
            }
            try {
                const hotel = await svc.createHotel(
                    name,
                    body?.city,
                    body?.commissionPct,
                );
                return NextResponse.json(hotel);
            } catch (err: any) {
                if (
                    err instanceof Prisma.PrismaClientKnownRequestError &&
                    err.code === "P2002"
                ) {
                    return NextResponse.json(
                        { error: "hotel_already_exists" },
                        { status: 409 },
                    );
                }
                throw err;
            }
        }

        if (kind === "group") {
            const tripId = String(body?.tripId || "").trim();
            const seatsCount = Number(body?.seatsCount || 0);
            if (!tripId) {
                return NextResponse.json(
                    { error: "tripId_required" },
                    { status: 400 },
                );
            }
            if (!seatsCount || seatsCount < 1) {
                return NextResponse.json(
                    { error: "seatsCount_required" },
                    { status: 400 },
                );
            }
            try {
                const group = await svc.createGroupBooking(
                    tripId,
                    userId,
                    seatsCount,
                    body?.discountPct,
                );
                return NextResponse.json(group);
            } catch (err: any) {
                if (err?.message === "trip_not_found") {
                    return NextResponse.json(
                        { error: "trip_not_found" },
                        { status: 404 },
                    );
                }
                throw err;
            }
        }

        return NextResponse.json(
            { error: "unknown_kind" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[vas] action failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
