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
    { name: "Meskel Square", city: "Addis Ababa", code: "MSQ" },
    { name: "Dire Dawa Station", city: "Dire Dawa", code: "DDW" },
    { name: "Bahir Dar Terminal", city: "Bahir Dar", code: "BDR" },
    { name: "Hawassa Bus Station", city: "Hawassa", code: "HWS" },
    { name: "Jimma Terminal", city: "Jimma", code: "JMA" },
    { name: "Mekelle Station", city: "Mekelle", code: "MKL" },
    { name: "Gondar Terminal", city: "Gondar", code: "GDR" },
    { name: "Dessie Station", city: "Dessie", code: "DSI" },
    { name: "Nekemte Terminal", city: "Nekemte", code: "NKT" },
    { name: "Arbaminch Station", city: "Arbaminch", code: "AMB" },
];

const BUS_COMPANIES = [
    { name: "Selam Bus", contactEmail: "info@selambus.et", contactPhone: "+251-11-551-2345" },
    { name: "Sky Bus", contactEmail: "info@skybus.et", contactPhone: "+251-11-553-6789" },
    { name: "Abay Bus", contactEmail: "info@abaybus.et", contactPhone: "+251-11-555-1234" },
    { name: "Lalle Bus", contactEmail: "info@lallebus.et", contactPhone: "+251-11-557-5678" },
    { name: "Inter City Bus", contactEmail: "info@intercitybus.et", contactPhone: "+251-11-559-9012" },
    { name: "Geda Bus", contactEmail: "info@gedabus.et", contactPhone: "+251-11-561-3456" },
    { name: "Addis Ababa Bus Enterprise", contactEmail: "info@aabebus.et", contactPhone: "+251-11-123-4567" },
];

type SeatLayoutConfig = {
    seatCount: number;
    layout: string;
    vipRows: number;
    seatsPerRow: number;
};

const SEAT_LAYOUTS: Record<string, SeatLayoutConfig> = {
    STANDARD_2x2: { seatCount: 40, layout: "2+2", vipRows: 0, seatsPerRow: 4 },
    VIP_2x1: { seatCount: 27, layout: "2+1", vipRows: 9, seatsPerRow: 3 },
    MIXED_2x2: { seatCount: 40, layout: "2+2", vipRows: 2, seatsPerRow: 4 },
};

type BusDef = {
    plateNumber: string;
    model: string;
    level: string;
    driverName: string;
    imageUrl: string;
    amenities: string[];
    safetyChecklist: string[];
    seatLayoutKey: keyof typeof SEAT_LAYOUTS;
    companyIndex: number;
};

const BUS_DEFINITIONS: BusDef[] = [
    {
        plateNumber: "AA-10001", model: "Scania Interlink", level: "Luxury",
        driverName: "Tesfaye Bekele", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 0,
    },
    {
        plateNumber: "AA-10002", model: "Volvo B9R", level: "Standard",
        driverName: "Hana Mekonnen", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "TV", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "Seat Belts"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 0,
    },
    {
        plateNumber: "AA-10003", model: "Yutong ZK6120", level: "VIP",
        driverName: "Abebe Dinkesa", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights", "Blanket"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "VIP_2x1", companyIndex: 1,
    },
    {
        plateNumber: "AA-10004", model: "Scania K410", level: "Luxury",
        driverName: "Dereje Worku", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 1,
    },
    {
        plateNumber: "AA-10005", model: "Hyundai Universe", level: "Standard",
        driverName: "Mulugeta Ayalew", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "First Aid"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 2,
    },
    {
        plateNumber: "AA-10006", model: "Volvo 9700", level: "Luxury",
        driverName: "Tadesse Gebre", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 2,
    },
    {
        plateNumber: "AA-10007", model: "DAEWOO BH116", level: "VIP",
        driverName: "Solomon Tadesse", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights", "Blanket", "Snack Service"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "VIP_2x1", companyIndex: 3,
    },
    {
        plateNumber: "AA-10008", model: "Scania Interlink", level: "Standard",
        driverName: "Fikadu Tesema", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "TV", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "Seat Belts"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 3,
    },
    {
        plateNumber: "AA-10009", model: "Yutong ZK6129", level: "Luxury",
        driverName: "Kebede Engida", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 4,
    },
    {
        plateNumber: "AA-10010", model: "Hyundai Universe", level: "Standard",
        driverName: "Yidnekachew Messele", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "First Aid"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 4,
    },
    {
        plateNumber: "AA-10011", model: "Volvo B11R", level: "VIP",
        driverName: "Birhanu Jembere", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights", "Blanket"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "VIP_2x1", companyIndex: 5,
    },
    {
        plateNumber: "AA-10012", model: "Scania K310", level: "Standard",
        driverName: "Shimelis Tolla", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "TV", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "Seat Belts"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 5,
    },
    {
        plateNumber: "AA-10013", model: "DAEWOO BH120", level: "Luxury",
        driverName: "Wondimu Gashaw", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 6,
    },
    {
        plateNumber: "AA-10014", model: "Yutong ZK6119", level: "Standard",
        driverName: "Assefa Mamo", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "First Aid"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 6,
    },
];

type RouteDef = {
    originCode: string;
    destinationCode: string;
    distanceKm: number;
    defaultPrice: number;
};

const ROUTE_DEFINITIONS: RouteDef[] = [
    { originCode: "AUT", destinationCode: "DDW", distanceKm: 340, defaultPrice: 650 },
    { originCode: "DDW", destinationCode: "AUT", distanceKm: 340, defaultPrice: 650 },
    { originCode: "AUT", destinationCode: "BDR", distanceKm: 560, defaultPrice: 1100 },
    { originCode: "BDR", destinationCode: "AUT", distanceKm: 560, defaultPrice: 1100 },
    { originCode: "AUT", destinationCode: "HWS", distanceKm: 275, defaultPrice: 480 },
    { originCode: "HWS", destinationCode: "AUT", distanceKm: 275, defaultPrice: 480 },
    { originCode: "AUT", destinationCode: "JMA", distanceKm: 350, defaultPrice: 600 },
    { originCode: "JMA", destinationCode: "AUT", distanceKm: 350, defaultPrice: 600 },
    { originCode: "AUT", destinationCode: "MKL", distanceKm: 780, defaultPrice: 1500 },
    { originCode: "MKL", destinationCode: "AUT", distanceKm: 780, defaultPrice: 1500 },
    { originCode: "AUT", destinationCode: "GDR", distanceKm: 660, defaultPrice: 1300 },
    { originCode: "GDR", destinationCode: "AUT", distanceKm: 660, defaultPrice: 1300 },
    { originCode: "AUT", destinationCode: "DSI", distanceKm: 400, defaultPrice: 750 },
    { originCode: "DSI", destinationCode: "AUT", distanceKm: 400, defaultPrice: 750 },
    { originCode: "AUT", destinationCode: "NKT", distanceKm: 330, defaultPrice: 580 },
    { originCode: "NKT", destinationCode: "AUT", distanceKm: 330, defaultPrice: 580 },
    { originCode: "AUT", destinationCode: "AMB", distanceKm: 455, defaultPrice: 900 },
    { originCode: "AMB", destinationCode: "AUT", distanceKm: 455, defaultPrice: 900 },
    { originCode: "BDR", destinationCode: "GDR", distanceKm: 180, defaultPrice: 350 },
    { originCode: "GDR", destinationCode: "BDR", distanceKm: 180, defaultPrice: 350 },
    { originCode: "DDW", destinationCode: "DSI", distanceKm: 470, defaultPrice: 850 },
    { originCode: "DSI", destinationCode: "DDW", distanceKm: 470, defaultPrice: 850 },
    { originCode: "HWS", destinationCode: "AMB", distanceKm: 280, defaultPrice: 450 },
    { originCode: "AMB", destinationCode: "HWS", distanceKm: 280, defaultPrice: 450 },
];

type TripSchedule = {
    routeIndex: number;
    busIndex: number;
    departHour: number;
    departMinute: number;
    durationHours: number;
    durationMinutes: number;
    priceMultiplier: number;
};

const TRIP_SCHEDULES: TripSchedule[] = [
    { routeIndex: 0, busIndex: 0, departHour: 6, departMinute: 0, durationHours: 6, durationMinutes: 30, priceMultiplier: 1.0 },
    { routeIndex: 0, busIndex: 2, departHour: 12, departMinute: 0, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.1 },
    { routeIndex: 1, busIndex: 1, departHour: 7, departMinute: 0, durationHours: 6, durationMinutes: 30, priceMultiplier: 1.0 },
    { routeIndex: 2, busIndex: 3, departHour: 5, departMinute: 30, durationHours: 9, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 2, busIndex: 5, departHour: 14, departMinute: 0, durationHours: 8, durationMinutes: 30, priceMultiplier: 1.15 },
    { routeIndex: 3, busIndex: 4, departHour: 6, departMinute: 0, durationHours: 9, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 4, busIndex: 6, departHour: 7, departMinute: 30, durationHours: 5, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 4, busIndex: 0, departHour: 15, departMinute: 0, durationHours: 4, durationMinutes: 45, priceMultiplier: 1.1 },
    { routeIndex: 5, busIndex: 7, departHour: 8, departMinute: 0, durationHours: 5, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 6, busIndex: 8, departHour: 6, departMinute: 0, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 6, busIndex: 2, departHour: 18, departMinute: 0, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 7, busIndex: 9, departHour: 7, departMinute: 0, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 8, busIndex: 10, departHour: 5, departMinute: 0, durationHours: 12, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 8, busIndex: 3, departHour: 20, departMinute: 0, durationHours: 12, durationMinutes: 0, priceMultiplier: 1.2 },
    { routeIndex: 9, busIndex: 11, departHour: 6, departMinute: 30, durationHours: 12, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 10, busIndex: 12, departHour: 5, departMinute: 30, durationHours: 10, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 10, busIndex: 5, departHour: 18, departMinute: 0, durationHours: 10, durationMinutes: 0, priceMultiplier: 1.15 },
    { routeIndex: 11, busIndex: 4, departHour: 7, departMinute: 0, durationHours: 10, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 12, busIndex: 6, departHour: 6, departMinute: 0, durationHours: 7, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 12, busIndex: 8, departHour: 14, departMinute: 0, durationHours: 7, durationMinutes: 0, priceMultiplier: 1.1 },
    { routeIndex: 13, busIndex: 9, departHour: 7, departMinute: 30, durationHours: 7, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 14, busIndex: 0, departHour: 6, departMinute: 30, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 15, busIndex: 1, departHour: 8, departMinute: 0, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 16, busIndex: 10, departHour: 6, departMinute: 0, durationHours: 8, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 16, busIndex: 12, departHour: 16, departMinute: 0, durationHours: 8, durationMinutes: 0, priceMultiplier: 1.1 },
    { routeIndex: 17, busIndex: 11, departHour: 7, departMinute: 0, durationHours: 8, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 18, busIndex: 3, departHour: 8, departMinute: 0, durationHours: 3, durationMinutes: 30, priceMultiplier: 1.0 },
    { routeIndex: 19, busIndex: 7, departHour: 9, departMinute: 0, durationHours: 3, durationMinutes: 30, priceMultiplier: 1.0 },
    { routeIndex: 20, busIndex: 5, departHour: 6, departMinute: 0, durationHours: 8, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 21, busIndex: 4, departHour: 7, departMinute: 0, durationHours: 8, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 22, busIndex: 6, departHour: 8, departMinute: 0, durationHours: 5, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 23, busIndex: 9, departHour: 9, departMinute: 0, durationHours: 5, durationMinutes: 0, priceMultiplier: 1.0 },
];

function buildSeatNumber(index: number) {
    return `${index}`;
}

function buildSeatsForBus(busId: string, layoutKey: keyof typeof SEAT_LAYOUTS) {
    const config = SEAT_LAYOUTS[layoutKey];
    const vipSeatCount = config.vipRows * config.seatsPerRow;
    return Array.from({ length: config.seatCount }, (_, index) => ({
        busId,
        seatNumber: buildSeatNumber(index + 1),
        seatType: index < vipSeatCount ? SeatType.VIP : SeatType.STANDARD,
    }));
}

function buildSeatLayoutJson(layoutKey: keyof typeof SEAT_LAYOUTS) {
    const config = SEAT_LAYOUTS[layoutKey];
    return {
        layout: config.layout,
        seatsPerRow: config.seatsPerRow,
        totalSeats: config.seatCount,
        vipRows: config.vipRows,
    };
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
    // NOTE: do not delete users here — registered passengers must survive
    // re-seeding. Demo accounts are upserted below instead of recreated.
}

async function main() {
    await resetData();

    const passwordHash = await bcrypt.hash("bus@12345", 10);

    await prisma.station.createMany({ data: STATIONS });

    const allStations = await prisma.station.findMany();
    const stationByCode = new Map(
        allStations.map((station) => [station.code, station]),
    );

    const companies = await Promise.all(
        BUS_COMPANIES.map((c) => prisma.busCompany.create({ data: c })),
    );

    const buses: Awaited<ReturnType<typeof prisma.bus.create>>[] = [];
    for (const def of BUS_DEFINITIONS) {
        const bus = await prisma.bus.create({
            data: {
                companyId: companies[def.companyIndex].id,
                plateNumber: def.plateNumber,
                model: def.model,
                level: def.level,
                driverName: def.driverName,
                imageUrl: def.imageUrl,
                amenities: def.amenities,
                safetyChecklist: def.safetyChecklist,
                seatCount: SEAT_LAYOUTS[def.seatLayoutKey].seatCount,
                seatLayout: buildSeatLayoutJson(def.seatLayoutKey),
            },
        });
        buses.push(bus);
    }

    const allSeatsData = buses.flatMap((bus) => {
        const def = BUS_DEFINITIONS[buses.indexOf(bus)];
        return buildSeatsForBus(bus.id, def.seatLayoutKey);
    });
    await prisma.seat.createMany({ data: allSeatsData });

    const routes: Awaited<ReturnType<typeof prisma.route.create>>[] = [];
    for (const rd of ROUTE_DEFINITIONS) {
        const origin = stationByCode.get(rd.originCode);
        const destination = stationByCode.get(rd.destinationCode);
        if (!origin || !destination) {
            console.warn(`Skipping route ${rd.originCode}->${rd.destinationCode}: station not found`);
            continue;
        }
        const route = await prisma.route.create({
            data: {
                originStationId: origin.id,
                destinationStationId: destination.id,
                distanceKm: rd.distanceKm,
                defaultPrice: rd.defaultPrice,
            },
        });
        routes.push(route);
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    for (const sched of TRIP_SCHEDULES) {
        if (sched.routeIndex >= routes.length) continue;
        if (sched.busIndex >= buses.length) continue;

        const route = routes[sched.routeIndex];
        const bus = buses[sched.busIndex];
        const basePrice = Math.round(route.defaultPrice * sched.priceMultiplier);

        for (const dayOffset of [0, 1]) {
            const tripDate = new Date(now.getTime() + (dayOffset + 1) * 24 * 60 * 60 * 1000);
            const departAt = new Date(tripDate);
            departAt.setHours(sched.departHour, sched.departMinute, 0, 0);
            const arriveAt = new Date(departAt.getTime() + (sched.durationHours * 60 + sched.durationMinutes) * 60 * 1000);

            await prisma.trip.create({
                data: {
                    routeId: route.id,
                    busId: bus.id,
                    departAt,
                    arriveAt,
                    basePrice,
                    status: TripStatus.SCHEDULED,
                },
            });
        }
    }

    const adminUser = await prisma.user.upsert({
        where: { email: "admin@bus.et" },
        update: { fullName: "System Admin", phone: "+251-91-000-0001", passwordHash, role: UserRole.ADMIN },
        create: {
            fullName: "System Admin",
            email: "admin@bus.et",
            phone: "+251-91-000-0001",
            passwordHash,
            role: UserRole.ADMIN,
        },
    });

    await prisma.user.upsert({
        where: { email: "staff@bus.et" },
        update: { fullName: "Station Staff", phone: "+251-91-000-0002", passwordHash, role: UserRole.STAFF, stationId: stationByCode.get("AUT")!.id },
        create: {
            fullName: "Station Staff",
            email: "staff@bus.et",
            phone: "+251-91-000-0002",
            passwordHash,
            role: UserRole.STAFF,
            stationId: stationByCode.get("AUT")!.id,
        },
    });

    const passenger = await prisma.user.upsert({
        where: { email: "passenger@bus.et" },
        update: { fullName: "Passenger Demo", phone: "+251-91-000-0003", passwordHash, role: UserRole.PASSENGER },
        create: {
            fullName: "Passenger Demo",
            email: "passenger@bus.et",
            phone: "+251-91-000-0003",
            passwordHash,
            role: UserRole.PASSENGER,
        },
    });

    const firstRoute = routes[0];
    const firstBus = buses[0];
    const firstTripDepart = new Date(tomorrow);
    firstTripDepart.setHours(6, 0, 0, 0);
    const firstTripArrive = new Date(firstTripDepart.getTime() + 6 * 60 * 60 * 1000 + 30 * 60 * 1000);

    const trip1 = await prisma.trip.create({
        data: {
            routeId: firstRoute.id,
            busId: firstBus.id,
            departAt: firstTripDepart,
            arriveAt: firstTripArrive,
            basePrice: firstRoute.defaultPrice,
            status: TripStatus.SCHEDULED,
        },
    });

    const seatForBooking = await prisma.seat.findFirstOrThrow({
        where: {
            busId: firstBus.id,
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
    console.log(`Stations: ${STATIONS.length}`);
    console.log(`Bus Companies: ${companies.length}`);
    console.log(`Buses: ${buses.length}`);
    console.log(`Routes: ${routes.length}`);
    console.log(`Trip Schedules: ${TRIP_SCHEDULES.length * 2} (across 2 days)`);
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
