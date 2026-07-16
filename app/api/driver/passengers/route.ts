import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  UserRole,
} from "@prisma/client";

// POST: driver adds a walk-up passenger to one of their trips.
// Creates a CONFIRMED + PAID (CASH) booking with an auto-picked seat.
export async function POST(req: Request) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const roleKey = String(session.user.role || "").toLowerCase();
    if (roleKey !== "driver") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      tripId?: string;
      passengerFullName?: string;
      passengerPhone?: string;
      passengerEmail?: string;
      passengerIdNumber?: string;
      seatId?: string;
    };

    const tripId = String(body?.tripId || "").trim();
    const fullName = String(body?.passengerFullName || "").trim();
    const phone = String(body?.passengerPhone || "").trim();
    if (!tripId || !fullName) {
      return NextResponse.json(
        { error: "trip_id_and_name_required" },
        { status: 400 },
      );
    }

    // Verify the trip belongs to a bus this driver is assigned to.
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { bus: true, route: { include: { originStation: true, destinationStation: true } } },
    });
    if (!trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }
    if (trip.bus?.driverId !== session.user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Pick a seat: explicit seatId, else the first available seat for this trip.
    const takenSeatIds = (
      await prisma.bookingSeat.findMany({
        where: { tripId },
        select: { seatId: true },
      })
    ).map((s) => s.seatId);

    let seatId = String(body?.seatId || "").trim();
    if (seatId) {
      if (takenSeatIds.includes(seatId)) {
        return NextResponse.json({ error: "seat_already_taken" }, { status: 409 });
      }
    } else {
      const available = await prisma.seat.findFirst({
        where: { busId: trip.busId, id: { notIn: takenSeatIds }, isActive: true },
        orderBy: { seatNumber: "asc" },
      });
      if (!available) {
        return NextResponse.json({ error: "no_available_seats" }, { status: 409 });
      }
      seatId = available.id;
    }

    // Resolve or create a passenger user account (by phone/email, else guest).
    let userId: string;
    const email = String(body?.passengerEmail || "").trim();
    const existing = await prisma.user.findFirst({
      where: {
        role: UserRole.PASSENGER,
        OR: [
          email ? { email } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true },
    });
    if (existing) {
      userId = existing.id;
    } else {
      const guestEmail = email || `guest_${Date.now()}@bus.local`;
      const passwordHash = await bcrypt.hash(Math.random().toString(36), 10);
      const created = await prisma.user.create({
        data: {
          fullName,
          email: guestEmail,
          phone: phone || null,
          passwordHash,
          role: UserRole.PASSENGER,
        },
      });
      userId = created.id;
    }

    const bookingRef = `BR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const receiptNumber = `RC-${bookingRef}-${Date.now().toString(36).toUpperCase()}`;

    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingRef,
          userId,
          tripId,
          status: BookingStatus.CONFIRMED,
          totalPrice: trip.basePrice,
          passengerFullName: fullName,
          passengerPhone: phone || null,
          passengerEmail: email || null,
          passengerIdNumber: String(body?.passengerIdNumber || "").trim() || null,
        },
      });
      await tx.bookingSeat.create({
        data: { bookingId: created.id, tripId, seatId, fare: trip.basePrice },
      });
      await tx.payment.create({
        data: {
          bookingId: created.id,
          method: PaymentMethod.CASH,
          status: PaymentStatus.PAID,
          amount: trip.basePrice,
          paidAt: new Date(),
        },
      });
      await tx.receipt.create({
        data: { bookingId: created.id, receiptNumber, emailedTo: email || null },
      });
      return created;
    });

    return NextResponse.json({ ok: true, bookingId: booking.id, bookingRef, seatId });
  } catch (error: any) {
    console.error("[driver/passengers] add failed", error);
    return NextResponse.json(
      { error: error?.message || "server_error" },
      { status: 500 },
    );
  }
}
