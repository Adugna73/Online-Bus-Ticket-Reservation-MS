import "dotenv/config";
import {
    PrismaClient,
    PaymentMethod,
    PaymentStatus,
    SeatType,
    TripStatus,
    UserRole,
    BookingStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const STATIONS = [
    { name: "Autobus Tera", city: "Addis Ababa", code: "AUT" },
    { name: "Asko", city: "Addis Ababa", code: "ASK" },
    { name: "Lamberet", city: "Addis Ababa", code: "LAM" },
    { name: "Zenebe Werk", city: "Addis Ababa", code: "ZNW" },
];

function buildSeatNumber(index: number) {
    return `${index}`;
}

async function resetData() {
    await prisma.receipt.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.bookingSeat.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.trip.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.bus.deleteMany();
    await prisma.route.deleteMany();
    await prisma.station.deleteMany();
    await prisma.busCompany.deleteMany();
    await prisma.user.deleteMany();
}

async function main() {
    await resetData();

    const passwordHash = await bcrypt.hash("bus@12345", 10);

    const stations = await prisma.station.createMany({
        data: STATIONS,
    });

    const allStations = await prisma.station.findMany();
    const stationByCode = new Map(
        allStations.map((station) => [station.code, station]),
    );

    const company = await prisma.busCompany.create({
        data: {
            name: "Addis Ababa Bus Enterprise",
            contactEmail: "info@aabebus.et",
            contactPhone: "+251-11-123-4567",
        },
    });

    const bus1 = await prisma.bus.create({
        data: {
            companyId: company.id,
            plateNumber: "AA-12345",
            model: "Scania Interlink",
            level: "Luxury",
            driverName: "Tesfaye Bekele",
            imageUrl: "/images/bus-card-1.svg",
            amenities: ["AC", "Wi-Fi", "USB Charging", "Recliner"],
            safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
            seatCount: 40,
        },
    });

    const bus2 = await prisma.bus.create({
        data: {
            companyId: company.id,
            plateNumber: "AA-67890",
            model: "Volvo B9R",
            level: "Standard",
            driverName: "Hana Mekonnen",
            imageUrl: "/images/bus-card-2.svg",
            amenities: ["AC", "TV", "USB Charging"],
            safetyChecklist: ["Brakes", "Tires", "Seat Belts"],
            seatCount: 45,
        },
    });

    const seatsBus1 = Array.from({ length: bus1.seatCount }, (_, index) => ({
        busId: bus1.id,
        seatNumber: buildSeatNumber(index + 1),
        seatType: index < 4 ? SeatType.VIP : SeatType.STANDARD,
    }));

    const seatsBus2 = Array.from({ length: bus2.seatCount }, (_, index) => ({
        busId: bus2.id,
        seatNumber: buildSeatNumber(index + 1),
        seatType: index < 4 ? SeatType.VIP : SeatType.STANDARD,
    }));

    await prisma.seat.createMany({ data: [...seatsBus1, ...seatsBus2] });

    const route1 = await prisma.route.create({
        data: {
            originStationId: stationByCode.get("AUT")!.id,
            destinationStationId: stationByCode.get("ASK")!.id,
            distanceKm: 385,
            defaultPrice: 600,
        },
    });

    const route2 = await prisma.route.create({
        data: {
            originStationId: stationByCode.get("ASK")!.id,
            destinationStationId: stationByCode.get("LAM")!.id,
            distanceKm: 460,
            defaultPrice: 750,
        },
    });

    const route3 = await prisma.route.create({
        data: {
            originStationId: stationByCode.get("LAM")!.id,
            destinationStationId: stationByCode.get("ZNW")!.id,
            distanceKm: 540,
            defaultPrice: 820,
        },
    });

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const trip1 = await prisma.trip.create({
        data: {
            routeId: route1.id,
            busId: bus1.id,
            departAt: new Date(tomorrow.setHours(8, 0, 0, 0)),
            arriveAt: new Date(tomorrow.setHours(16, 30, 0, 0)),
            basePrice: 600,
            status: TripStatus.SCHEDULED,
        },
    });

    const trip2 = await prisma.trip.create({
        data: {
            routeId: route2.id,
            busId: bus2.id,
            departAt: new Date(dayAfter.setHours(7, 30, 0, 0)),
            arriveAt: new Date(dayAfter.setHours(18, 15, 0, 0)),
            basePrice: 750,
            status: TripStatus.SCHEDULED,
        },
    });

    await prisma.trip.create({
        data: {
            routeId: route3.id,
            busId: bus1.id,
            departAt: new Date(dayAfter.setHours(9, 0, 0, 0)),
            arriveAt: new Date(dayAfter.setHours(20, 0, 0, 0)),
            basePrice: 820,
            status: TripStatus.SCHEDULED,
        },
    });

    const adminUser = await prisma.user.create({
        data: {
            fullName: "System Admin",
            email: "admin@bus.et",
            phone: "+251-91-000-0001",
            passwordHash,
            role: UserRole.ADMIN,
        },
    });

    await prisma.user.create({
        data: {
            fullName: "Station Staff",
            email: "staff@bus.et",
            phone: "+251-91-000-0002",
            passwordHash,
            role: UserRole.STAFF,
            stationId: stationByCode.get("AUT")!.id,
        },
    });

    const passenger = await prisma.user.create({
        data: {
            fullName: "Passenger Demo",
            email: "passenger@bus.et",
            phone: "+251-91-000-0003",
            passwordHash,
            role: UserRole.PASSENGER,
        },
    });

    const seatForBooking = await prisma.seat.findFirstOrThrow({
        where: {
            busId: bus1.id,
            seatNumber: "1",
        },
    });

    const booking = await prisma.booking.create({
        data: {
            bookingRef: "BR-0001",
            userId: passenger.id,
            tripId: trip1.id,
            status: BookingStatus.CONFIRMED,
            totalPrice: trip1.basePrice,
        },
    });

    await prisma.bookingSeat.create({
        data: {
            bookingId: booking.id,
            tripId: trip1.id,
            seatId: seatForBooking.id,
            fare: trip1.basePrice,
        },
    });

    await prisma.payment.create({
        data: {
            bookingId: booking.id,
            method: PaymentMethod.TELEBIRR,
            status: PaymentStatus.PAID,
            amount: trip1.basePrice,
            transactionRef: "TXN-10001",
            paidAt: new Date(),
        },
    });

    await prisma.receipt.create({
        data: {
            bookingId: booking.id,
            receiptNumber: "RC-0001",
            pdfUrl: "https://example.com/receipt/RC-0001.pdf",
            emailedTo: passenger.email,
        },
    });

    console.log("Seed completed.");
    console.log(`Stations: ${stations.count}`);
    console.log(`Admin user: ${adminUser.email}`);
    console.log(`Passenger user: ${passenger.email}`);
    console.log("Default password: bus@12345");
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
