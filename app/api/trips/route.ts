import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VehicleMaintenanceStatus, TripStatus } from "@prisma/client";

// Maintenance statuses that mean the bus is back in service. Any other status
// means the bus is still under maintenance and must not be offered for booking.
const MAINTENANCE_TERMINAL_STATUSES = [
    VehicleMaintenanceStatus.COMPLETED,
    VehicleMaintenanceStatus.CANCELLED,
    VehicleMaintenanceStatus.NOT_FIXABLE,
];

export async function GET() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const trips = await prisma.trip.findMany({
            where: {
                // Hide trips whose bus is currently under maintenance. A bus is
                // bookable only when it has no maintenance record outside the
                // terminal statuses (COMPLETED/CANCELLED/NOT_FIXABLE).
                bus: {
                    maintenances: {
                        every: {
                            status: { in: MAINTENANCE_TERMINAL_STATUSES },
                        },
                    },
                },
            },
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

        // A bus can only be assigned to one trip per calendar day. Block
        // double-booking and tell the admin/staff which trip already holds it.
        const dayStart = new Date(departAt);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const conflict = await prisma.trip.findFirst({
            where: {
                busId,
                departAt: { gte: dayStart, lt: dayEnd },
                status: { notIn: [TripStatus.CANCELLED, TripStatus.COMPLETED] },
            },
            include: {
                bus: { select: { plateNumber: true } },
                route: {
                    include: {
                        originStation: { select: { name: true } },
                        destinationStation: { select: { name: true } },
                    },
                },
            },
        });
        if (conflict) {
            const routeLabel = conflict.route
                ? `${conflict.route.originStation?.name ?? ""} → ${conflict.route.destinationStation?.name ?? ""}`
                : "another trip";
            return NextResponse.json(
                {
                    error: "bus_already_assigned",
                    message: `Bus ${conflict.bus?.plateNumber ?? ""} is already assigned to ${routeLabel} on ${new Date(conflict.departAt).toLocaleString()}.`,
                },
                { status: 409 },
            );
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
