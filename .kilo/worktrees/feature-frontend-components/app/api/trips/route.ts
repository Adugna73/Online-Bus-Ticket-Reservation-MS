import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const trips = await prisma.trip.findMany({
            include: {
                bus: true,
                route: {
                    include: {
                        originStation: true,
                        destinationStation: true,
                    },
                },
                _count: { select: { bookingSeats: true } },
            },
            orderBy: { departAt: "asc" },
            take: 200,
        });

        const payload = trips.map((trip) => {
            const seatCount = trip.bus?.seatCount || 0;
            const bookedSeats = trip._count?.bookingSeats || 0;
            return {
                id: trip.id,
                departAt: trip.departAt,
                arriveAt: trip.arriveAt,
                basePrice: trip.basePrice,
                status: trip.status,
                route: trip.route
                    ? {
                          origin: trip.route.originStation
                              ? {
                                    name: trip.route.originStation.name,
                                    code: trip.route.originStation.code,
                                }
                              : null,
                          destination: trip.route.destinationStation
                              ? {
                                    name: trip.route.destinationStation.name,
                                    code: trip.route.destinationStation.code,
                                }
                              : null,
                      }
                    : null,
                bus: trip.bus
                    ? {
                          plateNumber: trip.bus.plateNumber,
                          model: trip.bus.model,
                          seatCount: trip.bus.seatCount,
                                                    level: trip.bus.level,
                                                    driverName: trip.bus.driverName,
                                                    imageUrl: trip.bus.imageUrl,
                                                    amenities: trip.bus.amenities,
                                                    safetyChecklist: trip.bus.safetyChecklist,
                                                    seatLayout: trip.bus.seatLayout,
                      }
                    : null,
                bookedSeats,
                availableSeats: Math.max(0, seatCount - bookedSeats),
            };
        });

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[trips] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey !== "admin" && roleKey !== "supervisor") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            routeId?: string;
            busId?: string;
            departAt?: string;
            arriveAt?: string;
            basePrice?: number | string;
            status?: string;
        };

        const routeId = String(body?.routeId || "").trim();
        const busId = String(body?.busId || "").trim();
        const departAt = body?.departAt ? new Date(body.departAt) : null;
        const arriveAt = body?.arriveAt ? new Date(body.arriveAt) : null;
        const basePrice =
            body?.basePrice !== undefined && body?.basePrice !== null
                ? Number(body.basePrice)
                : NaN;
        const status = String(body?.status || "SCHEDULED").toUpperCase();

        if (!routeId || !busId || !departAt || !arriveAt || isNaN(basePrice)) {
            return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
        }

        const trip = await prisma.trip.create({
            data: {
                routeId,
                busId,
                departAt,
                arriveAt,
                basePrice,
                status: status as any,
            },
        });

        return NextResponse.json({ id: trip.id });
    } catch (error) {
        console.error("[trips] create failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
