import { prisma } from "@/lib/prisma";
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  SeatEventKind,
  SeatHoldStatus,
} from "@prisma/client";

// GAP 2: Seat Availability — DB-backed atomic holds, event sourcing, status.

const HOLD_TTL_MIN = 15;
// Unpaid PENDING bookings are auto-cancelled after this many minutes, which
// releases their seats back to the pool for other passengers to book.
const BOOKING_TTL_MIN = 15;

export type SeatState = "available" | "held" | "booked";

export type TripSeat = {
  id: string;
  seatNumber: string;
  seatType: string;
  isActive: boolean;
  status: SeatState;
  heldByMe: boolean;
  holdId: string | null;
  expiresAt: string | null;
};

export type TripSeatMapResult = {
  trip: {
    id: string;
    departAt: string;
    arriveAt: string;
    basePrice: number;
    status: string;
    route: {
      origin: { name: string; code: string } | null;
      destination: { name: string; code: string } | null;
    } | null;
    bus: {
      id: string;
      plateNumber: string;
      model: string | null;
      seatCount: number;
      seatLayout: unknown;
    } | null;
  };
  seats: TripSeat[];
};

export type PassengerInfo = {
  passengerFullName?: string;
  passengerPhone?: string;
  passengerEmail?: string;
  passengerIdNumber?: string;
  passengerGender?: string;
  passengerAge?: number;
  emergencyContact?: string;
  notes?: string;
};

class SeatError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SeatError";
  }
}

function seatErr(code: string): SeatError {
  const messages: Record<string, string> = {
    trip_not_found: "Trip not found.",
    seat_invalid: "Seat is not valid for this trip.",
    seat_booked: "Seat is already booked.",
    seat_held: "Seat is currently held by another user.",
    seat_unavailable: "One or more seats are no longer available.",
    hold_not_found: "Hold not found or already released.",
    no_seats: "No seats selected.",
  };
  return new SeatError(code, messages[code] || code);
}

// Mark holds whose TTL has passed as RELEASED and emit RELEASE events.
// The SeatHold @@unique[tripId, seatId, status] means at most one RELEASED
// row per seat, so we clear any stale RELEASED row before flipping HELD.
async function expireStaleHolds(tripId?: string): Promise<void> {
  const now = new Date();
  const stale = await prisma.seatHold.findMany({
    where: {
      status: SeatHoldStatus.HELD,
      expiresAt: { lt: now },
      ...(tripId ? { tripId } : {}),
    },
    select: { id: true, tripId: true, seatId: true, userId: true },
  });
  if (stale.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const h of stale) {
      await tx.seatHold.deleteMany({
        where: {
          tripId: h.tripId,
          seatId: h.seatId,
          status: SeatHoldStatus.RELEASED,
        },
      });
      try {
        await tx.seatHold.update({
          where: { id: h.id },
          data: { status: SeatHoldStatus.RELEASED },
        });
      } catch {
        // row may have been concurrently modified; ignore
      }
      await tx.seatEvent.create({
        data: {
          tripId: h.tripId,
          seatId: h.seatId,
          kind: SeatEventKind.RELEASE,
          userId: h.userId,
          meta: { reason: "expired" },
        },
      });
    }
  });
}

// Natural/numeric comparator for seat numbers so "2" < "10" < "11".
// Falls back to localeCompare for non-numeric labels (e.g. "VIP-1").
export function compareSeatNumbers(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (!isNaN(na) && !isNaN(nb)) {
    if (na !== nb) return na - nb;
    return a.localeCompare(b);
  }
  if (!isNaN(na)) return -1;
  if (!isNaN(nb)) return 1;
  return a.localeCompare(b);
}

// Cancel PENDING bookings that were never paid within BOOKING_TTL_MIN minutes.
// Deleting their BookingSeat rows releases the seats for others to book. Any
// related SeatHold is marked RELEASED and an UNBOOK SeatEvent is recorded.
export async function expireStaleBookings(): Promise<{
  cancelled: number;
  seatsReleased: number;
}> {
  const deadline = new Date(Date.now() - BOOKING_TTL_MIN * 60_000);

  const staleBookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.PENDING,
      createdAt: { lt: deadline },
      OR: [
        { payment: null },
        { payment: { status: { not: PaymentStatus.PAID } } },
      ],
    },
    select: {
      id: true,
      tripId: true,
      seats: { select: { id: true, seatId: true } },
    },
  });

  if (staleBookings.length === 0) return { cancelled: 0, seatsReleased: 0 };

  let seatsReleased = 0;

  await prisma.$transaction(async (tx) => {
    for (const b of staleBookings) {
      await tx.bookingSeat.deleteMany({ where: { bookingId: b.id } });

      await tx.payment.deleteMany({ where: { bookingId: b.id } });

      await tx.booking.update({
        where: { id: b.id },
        data: { status: BookingStatus.CANCELLED },
      });

      for (const bs of b.seats) {
        seatsReleased += 1;
        await tx.seatHold.deleteMany({
          where: {
            tripId: b.tripId,
            seatId: bs.seatId,
            status: SeatHoldStatus.RELEASED,
          },
        });
        const hold = await tx.seatHold.findFirst({
          where: {
            tripId: b.tripId,
            seatId: bs.seatId,
            status: SeatHoldStatus.HELD,
          },
        });
        if (hold) {
          await tx.seatHold.update({
            where: { id: hold.id },
            data: { status: SeatHoldStatus.RELEASED },
          });
        }
        await tx.seatEvent.create({
          data: {
            tripId: b.tripId,
            seatId: bs.seatId,
            kind: SeatEventKind.UNBOOK,
            meta: { reason: "booking_expired", bookingId: b.id },
          },
        });
      }
    }
  });

  return { cancelled: staleBookings.length, seatsReleased };
}

// Compute the full seat map for a trip, including live availability status.
export async function getTripSeats(
  tripId: string,
  userId?: string,
): Promise<TripSeatMapResult> {
  await expireStaleHolds(tripId);
  await expireStaleBookings();

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      bus: true,
      route: {
        include: { originStation: true, destinationStation: true },
      },
      bookingSeats: { select: { seatId: true } },
    },
  });
  if (!trip) throw seatErr("trip_not_found");

  const seats = await prisma.seat.findMany({
    where: { busId: trip.busId },
  });

  seats.sort((a, b) => compareSeatNumbers(a.seatNumber, b.seatNumber));

  const bookedSet = new Set(trip.bookingSeats.map((b) => b.seatId));

  const holds = await prisma.seatHold.findMany({
    where: { tripId, status: SeatHoldStatus.HELD },
    select: { id: true, seatId: true, userId: true, expiresAt: true },
  });
  const holdMap = new Map(holds.map((h) => [h.seatId, h]));
  const now = new Date();

  const seatRows: TripSeat[] = seats.map((seat) => {
    const booked = bookedSet.has(seat.id);
    const hold = holdMap.get(seat.id);
    const held = !!hold && hold.expiresAt > now;
    let status: SeatState = "available";
    if (booked) status = "booked";
    else if (held) status = "held";
    return {
      id: seat.id,
      seatNumber: seat.seatNumber,
      seatType: seat.seatType,
      isActive: seat.isActive,
      status,
      heldByMe: held && !!userId && hold!.userId === userId,
      holdId: held ? hold!.id : null,
      expiresAt: held ? hold!.expiresAt.toISOString() : null,
    };
  });

  return {
    trip: {
      id: trip.id,
      departAt: trip.departAt.toISOString(),
      arriveAt: trip.arriveAt.toISOString(),
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
            seatLayout: trip.bus.seatLayout,
          }
        : null,
    },
    seats: seatRows,
  };
}

// Place a 10-minute hold on a seat. Guards against booked/already-held seats.
export async function holdSeat(
  tripId: string,
  seatId: string,
  userId: string,
): Promise<{ id: string; expiresAt: string; ttlMin: number }> {
  await expireStaleHolds(tripId);
  await expireStaleBookings();

  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat || !seat.isActive) throw seatErr("seat_invalid");

  const booked = await prisma.bookingSeat.findUnique({
    where: { tripId_seatId: { tripId, seatId } },
  });
  if (booked) throw seatErr("seat_booked");

  const expiresAt = new Date(Date.now() + HOLD_TTL_MIN * 60_000);

  try {
    const hold = await prisma.seatHold.create({
      data: {
        tripId,
        seatId,
        userId,
        expiresAt,
        status: SeatHoldStatus.HELD,
      },
    });
    await prisma.seatEvent.create({
      data: {
        tripId,
        seatId,
        kind: SeatEventKind.HOLD,
        userId,
        meta: { holdId: hold.id, expiresAt: expiresAt.toISOString() },
      },
    });
    return {
      id: hold.id,
      expiresAt: hold.expiresAt.toISOString(),
      ttlMin: HOLD_TTL_MIN,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw seatErr("seat_held");
    }
    throw error;
  }
}

// Release a held seat by its hold id.
export async function releaseHold(
  holdId: string,
  userId?: string,
): Promise<{ released: true }> {
  const hold = await prisma.seatHold.findUnique({ where: { id: holdId } });
  if (!hold || hold.status !== SeatHoldStatus.HELD)
    throw seatErr("hold_not_found");

  await prisma.$transaction(async (tx) => {
    await tx.seatHold.deleteMany({
      where: {
        tripId: hold.tripId,
        seatId: hold.seatId,
        status: SeatHoldStatus.RELEASED,
      },
    });
    await tx.seatHold.update({
      where: { id: holdId },
      data: { status: SeatHoldStatus.RELEASED },
    });
    await tx.seatEvent.create({
      data: {
        tripId: hold.tripId,
        seatId: hold.seatId,
        kind: SeatEventKind.RELEASE,
        userId: userId ?? hold.userId ?? null,
        meta: { holdId },
      },
    });
  });

  return { released: true };
}

// Book one or more seats atomically. Converts any active holds by this user
// and creates a Booking with BookingSeat rows. Returns the new booking.
export async function bookSeats(
  tripId: string,
  seatIds: string[],
  userId: string,
  passenger: PassengerInfo = {},
): Promise<{ id: string; bookingRef: string; totalPrice: number }> {
  if (seatIds.length === 0) throw seatErr("no_seats");

  await expireStaleHolds(tripId);
  await expireStaleBookings();

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) throw seatErr("trip_not_found");

  // Pre-check: none of the seats may already be booked.
  const alreadyBooked = await prisma.bookingSeat.findMany({
    where: { tripId, seatId: { in: seatIds } },
    select: { seatId: true },
  });
  if (alreadyBooked.length > 0) throw seatErr("seat_booked");

  const bookingRef = `BR-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const totalPrice = trip.basePrice * seatIds.length;

  const passengerData = {
    passengerFullName: passenger.passengerFullName?.trim() || null,
    passengerPhone: passenger.passengerPhone?.trim() || null,
    passengerEmail: passenger.passengerEmail?.trim() || null,
    passengerIdNumber: passenger.passengerIdNumber?.trim() || null,
    passengerGender: passenger.passengerGender?.trim() || null,
    passengerAge:
      passenger.passengerAge !== undefined && passenger.passengerAge !== null
        ? Number(passenger.passengerAge)
        : null,
    emergencyContact: passenger.emergencyContact?.trim() || null,
    notes: passenger.notes?.trim() || null,
  };

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingRef,
          userId,
          tripId,
          status: BookingStatus.PENDING,
          totalPrice,
          ...passengerData,
        },
      });

      for (const seatId of seatIds) {
        await tx.bookingSeat.create({
          data: {
            bookingId: created.id,
            tripId,
            seatId,
            fare: trip.basePrice,
          },
        });

        // Convert any active hold on this seat to CONVERTED.
        await tx.seatHold.deleteMany({
          where: {
            tripId,
            seatId,
            status: SeatHoldStatus.CONVERTED,
          },
        });
        const existingHold = await tx.seatHold.findFirst({
          where: { tripId, seatId, status: SeatHoldStatus.HELD },
        });
        if (existingHold) {
          await tx.seatHold.update({
            where: { id: existingHold.id },
            data: { status: SeatHoldStatus.CONVERTED },
          });
        }

        await tx.seatEvent.create({
          data: {
            tripId,
            seatId,
            kind: SeatEventKind.BOOK,
            userId,
            meta: { bookingId: created.id },
          },
        });
      }

      return created;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw seatErr("seat_unavailable");
    }
    throw error;
  }

  return {
    id: booking.id,
    bookingRef: booking.bookingRef,
    totalPrice: booking.totalPrice,
  };
}

export { SeatError };
