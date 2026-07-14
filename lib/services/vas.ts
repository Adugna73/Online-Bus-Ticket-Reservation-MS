import { prisma } from "@/lib/prisma";

// GAP 8: Value-Added Services — fully DB-backed.
// Travel insurance, cargo booking, hotel partners, group booking.

const SEED_HOTELS: { name: string; city: string; commissionPct: number }[] = [
    { name: "Addis Ababa Hilton", city: "Addis Ababa", commissionPct: 8 },
    { name: "Bahir Dar Lakeside Resort", city: "Bahir Dar", commissionPct: 7 },
    { name: "Hawassa Grand Hotel", city: "Hawassa", commissionPct: 6 },
];

// ---- Travel Insurance ----

export async function buyInsurance(bookingId: string, premium: number) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, totalPrice: true },
    });
    if (!booking) {
        throw new Error("booking_not_found");
    }

    const premiumValue =
        Number.isFinite(premium) && premium > 0 ? premium : 2;

    const insurance = await prisma.travelInsurance.create({
        data: {
            bookingId,
            premium: premiumValue,
            covered: true,
        },
    });
    return insurance;
}

export async function listInsurance(userId: string) {
    const bookings = await prisma.booking.findMany({
        where: { userId },
        select: { id: true, bookingRef: true, totalPrice: true },
    });
    const bookingIds = bookings.map((b) => b.id);
    if (bookingIds.length === 0) return [];

    const insurances = await prisma.travelInsurance.findMany({
        where: { bookingId: { in: bookingIds } },
        orderBy: { createdAt: "desc" },
    });

    const refById = new Map(bookings.map((b) => [b.id, b]));
    return insurances.map((ins) => ({
        id: ins.id,
        bookingId: ins.bookingId,
        bookingRef: refById.get(ins.bookingId)?.bookingRef || null,
        premium: ins.premium,
        covered: ins.covered,
        createdAt: ins.createdAt,
    }));
}

// ---- Cargo Booking ----

export async function createCargo(
    tripId: string,
    senderPhone: string,
    description?: string | null,
    weightKg?: number | null,
    price?: number | null,
) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true, basePrice: true },
    });
    if (!trip) {
        throw new Error("trip_not_found");
    }

    const weight = Number(weightKg);
    const priceValue =
        Number.isFinite(Number(price)) && Number(price) > 0
            ? Number(price)
            : Math.round((Number.isFinite(weight) ? weight : 0) * 15 * 100) /
              100;

    const cargo = await prisma.cargoBooking.create({
        data: {
            tripId,
            senderPhone: String(senderPhone || "").trim(),
            description: description
                ? String(description).trim()
                : null,
            weightKg: Number.isFinite(weight) ? weight : null,
            price: priceValue,
        },
    });
    return cargo;
}

export async function listCargo(userId?: string, role?: string) {
    const roleKey = String(role || "").toLowerCase();
    let where: any = {};

    if (roleKey !== "staff" && roleKey !== "admin" && userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { phone: true },
        });
        where = { senderPhone: user?.phone || "__none__" };
    }

    const cargo = await prisma.cargoBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    return cargo;
}

// ---- Hotel Partners ----

export async function listHotels() {
    const count = await prisma.hotelPartner.count();
    if (count === 0) {
        await Promise.all(
            SEED_HOTELS.map((h) =>
                prisma.hotelPartner.upsert({
                    where: { name: h.name },
                    create: {
                        name: h.name,
                        city: h.city,
                        commissionPct: h.commissionPct,
                    },
                    update: {},
                }),
            ),
        );
    }

    const hotels = await prisma.hotelPartner.findMany({
        orderBy: { name: "asc" },
    });
    return hotels;
}

export async function createHotel(
    name: string,
    city?: string | null,
    commissionPct?: number | null,
) {
    const hotel = await prisma.hotelPartner.create({
        data: {
            name: String(name || "").trim(),
            city: city ? String(city).trim() : null,
            commissionPct:
                Number.isFinite(Number(commissionPct)) &&
                Number(commissionPct) >= 0
                    ? Number(commissionPct)
                    : 0,
        },
    });
    return hotel;
}

// ---- Group Booking ----

export async function createGroupBooking(
    tripId: string,
    organizerId: string,
    seatsCount: number,
    discountPct?: number | null,
) {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { id: true },
    });
    if (!trip) {
        throw new Error("trip_not_found");
    }

    const seats = Math.max(1, Math.floor(Number(seatsCount) || 0));
    const discount =
        Number.isFinite(Number(discountPct)) && Number(discountPct) >= 0
            ? Number(discountPct)
            : seats >= 5
              ? 10
              : 0;

    const group = await prisma.groupBooking.create({
        data: {
            tripId,
            organizerId,
            seatsCount: seats,
            discountPct: discount,
        },
    });
    return group;
}

export async function listGroupBookings(userId?: string, role?: string) {
    const roleKey = String(role || "").toLowerCase();
    const where: any = {};
    if (roleKey !== "staff" && roleKey !== "admin" && userId) {
        where.organizerId = userId;
    }

    const groups = await prisma.groupBooking.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    return groups;
}
