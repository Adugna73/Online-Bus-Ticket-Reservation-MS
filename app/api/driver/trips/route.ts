import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET trips for the logged-in driver's assigned bus(es).
// The driver is linked to a Bus via Bus.driverId -> User.id.
export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const roleKey = String(session.user.role || "").toLowerCase();
    if (roleKey !== "driver") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const buses = await prisma.bus.findMany({
      where: { driverId: session.user.id },
      select: {
        id: true,
        plateNumber: true,
        model: true,
        level: true,
        seatCount: true,
        status: true,
      },
    });
    const assignedBuses = buses.map((b) => ({
      id: b.id,
      plateNumber: b.plateNumber,
      model: b.model,
      level: b.level,
      seatCount: b.seatCount,
      status: b.status,
    }));
    if (!buses.length) {
      return NextResponse.json({ buses: [], assignedBuses: [], trips: [] });
    }
    const busIds = buses.map((b) => b.id);

    const trips = await prisma.trip.findMany({
      where: { busId: { in: busIds } },
      include: {
        bus: { select: { id: true, plateNumber: true, model: true, level: true, seatCount: true } },
        route: {
          include: {
            originStation: { select: { id: true, name: true, city: true } },
            destinationStation: { select: { id: true, name: true, city: true } },
          },
        },
        bookings: {
          where: { status: { in: ["CONFIRMED", "PENDING"] } },
          select: {
            id: true,
            bookingRef: true,
            status: true,
            passengerFullName: true,
            passengerPhone: true,
            passengerEmail: true,
            passengerIdNumber: true,
            seats: { select: { seat: { select: { seatNumber: true } } } },
            payment: { select: { status: true, method: true } },
          },
        },
      },
      orderBy: { departAt: "asc" },
    });

    const payload = trips.map((t) => ({
      id: t.id,
      departAt: t.departAt,
      arriveAt: t.arriveAt,
      basePrice: t.basePrice,
      status: t.status,
      bus: t.bus,
      route: {
        origin: t.route?.originStation,
        destination: t.route?.destinationStation,
      },
      passengerCount: t.bookings.length,
      passengers: t.bookings.map((b) => ({
        id: b.id,
        bookingRef: b.bookingRef,
        status: b.status,
        name: b.passengerFullName || "Unknown",
        phone: b.passengerPhone,
        email: b.passengerEmail,
        idNumber: b.passengerIdNumber,
        seats: b.seats.map((s) => s.seat?.seatNumber).filter(Boolean),
        paymentStatus: b.payment?.status || "PENDING",
        paymentMethod: b.payment?.method || null,
      })),
    }));

    return NextResponse.json({
      buses: busIds,
      assignedBuses,
      trips: payload,
    });
  } catch (error) {
    console.error("[driver/trips] failed", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
