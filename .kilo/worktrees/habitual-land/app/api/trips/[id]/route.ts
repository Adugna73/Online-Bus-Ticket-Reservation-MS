import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    _req: Request,
    context: { params: { id: string } },
) {
    try {
        const params = await context.params;
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const tripId = String(params?.id || "").trim();
        if (!tripId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
            include: {
                bus: true,
                route: {
                    include: {
                        originStation: true,
                        destinationStation: true,
                    },
                },
            },
        });

        if (!trip) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const seats = await prisma.seat.findMany({
            where: { busId: trip.busId, isActive: true },
            orderBy: { seatNumber: "asc" },
        });

        const booked = await prisma.bookingSeat.findMany({
            where: { tripId: trip.id },
            select: { seatId: true },
        });
        const bookedSet = new Set(booked.map((b) => b.seatId));

        const payload = {
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
                      id: trip.bus.id,
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
            seats: seats
                .slice()
                .sort((a, b) => {
                    const aNum = Number(a.seatNumber);
                    const bNum = Number(b.seatNumber);
                    if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
                        return aNum - bNum;
                    }
                    return String(a.seatNumber).localeCompare(
                        String(b.seatNumber),
                        undefined,
                        { numeric: true, sensitivity: "base" },
                    );
                })
                .map((seat) => ({
                id: seat.id,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                isActive: seat.isActive,
                isBooked: bookedSet.has(seat.id),
            })),
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[trips:id] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
