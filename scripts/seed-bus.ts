import "dotenv/config";
import {
    PrismaClient,
    PaymentMethod,
    PaymentStatus,
    SeatType,
    TripStatus,
    UserRole,
    BookingStatus,
    VehicleMaintenanceStatus,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const STATIONS = [
    { name: "Autobus Tera", city: "Addis Ababa", code: "AUT" },
    { name: "Asko Main Station", city: "Addis Ababa", code: "ASK" },
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
    { name: "Dembi Dolo Station", city: "Dembi Dolo", code: "DDL" },
    { name: "Ghimbi Terminal", city: "Ghimbi", code: "GHB" },
    { name: "Nedjo Station", city: "Nedjo", code: "NDJ" },
    { name: "Mendi Terminal", city: "Mendi", code: "MND" },
    { name: "Shambu Station", city: "Shambu", code: "SHB" },
    { name: "Gida Ayana Terminal", city: "Gida Ayana", code: "GAY" },
    { name: "Asosa Station", city: "Asosa", code: "ASO" },
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
    {
        plateNumber: "AA-10015", model: "Scania Interlink", level: "Luxury",
        driverName: "Dawit Haile", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 0,
    },
    {
        plateNumber: "AA-10016", model: "Volvo B9R", level: "Standard",
        driverName: "Yohannes Berhe", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "TV", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "Seat Belts"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 1,
    },
    {
        plateNumber: "AA-10017", model: "Yutong ZK6120", level: "VIP",
        driverName: "Mesfin Tadesse", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights", "Blanket"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "VIP_2x1", companyIndex: 2,
    },
    {
        plateNumber: "AA-10018", model: "Scania K410", level: "Luxury",
        driverName: "Getachew Alemu", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 3,
    },
    {
        plateNumber: "AA-10019", model: "Hyundai Universe", level: "Standard",
        driverName: "Bekele Nega", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "First Aid"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 4,
    },
    {
        plateNumber: "AA-10020", model: "Volvo 9700", level: "Luxury",
        driverName: "Tilahun Gessesse", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "MIXED_2x2", companyIndex: 5,
    },
    {
        plateNumber: "AA-10021", model: "DAEWOO BH116", level: "VIP",
        driverName: "Solomon Girma", imageUrl: "/images/bus-card-1.svg",
        amenities: ["AC", "WiFi", "USB Charging", "Reclining Seats", "Reading Lights", "Blanket", "Snack Service"],
        safetyChecklist: ["Brakes", "Tires", "First Aid", "Fire Extinguisher", "Seat Belts"],
        seatLayoutKey: "VIP_2x1", companyIndex: 6,
    },
    {
        plateNumber: "AA-10022", model: "Scania K310", level: "Standard",
        driverName: "Hailemariam Desalegn", imageUrl: "/images/bus-card-2.svg",
        amenities: ["AC", "TV", "USB Charging"],
        safetyChecklist: ["Brakes", "Tires", "Seat Belts"],
        seatLayoutKey: "STANDARD_2x2", companyIndex: 0,
    },
];

type RouteDef = {
    originCode: string;
    destinationCode: string;
    distanceKm: number;
    defaultPrice: number;
};

// Each route is listed once in one direction; the inverse (return) route is
// auto-generated so passengers can always book both ways (e.g. Asko→Nekemte
// and Nekemte→Asko). Expansion preserves ordering as [forward, inverse] pairs,
// keeping TRIP_SCHEDULES route indices stable.
const FORWARD_ROUTES: RouteDef[] = [
    { originCode: "AUT", destinationCode: "DDW", distanceKm: 340, defaultPrice: 650 },
    { originCode: "AUT", destinationCode: "BDR", distanceKm: 560, defaultPrice: 1100 },
    { originCode: "AUT", destinationCode: "HWS", distanceKm: 275, defaultPrice: 480 },
    { originCode: "AUT", destinationCode: "JMA", distanceKm: 350, defaultPrice: 600 },
    { originCode: "AUT", destinationCode: "MKL", distanceKm: 780, defaultPrice: 1500 },
    { originCode: "AUT", destinationCode: "GDR", distanceKm: 660, defaultPrice: 1300 },
    { originCode: "AUT", destinationCode: "DSI", distanceKm: 400, defaultPrice: 750 },
    { originCode: "AUT", destinationCode: "NKT", distanceKm: 330, defaultPrice: 580 },
    { originCode: "AUT", destinationCode: "AMB", distanceKm: 455, defaultPrice: 900 },
    { originCode: "BDR", destinationCode: "GDR", distanceKm: 180, defaultPrice: 350 },
    { originCode: "DDW", destinationCode: "DSI", distanceKm: 470, defaultPrice: 850 },
    { originCode: "HWS", destinationCode: "AMB", distanceKm: 280, defaultPrice: 450 },
    { originCode: "ASK", destinationCode: "NKT", distanceKm: 328, defaultPrice: 600 },
    { originCode: "ASK", destinationCode: "DDL", distanceKm: 450, defaultPrice: 820 },
    { originCode: "ASK", destinationCode: "GHB", distanceKm: 520, defaultPrice: 950 },
    { originCode: "ASK", destinationCode: "NDJ", distanceKm: 580, defaultPrice: 1050 },
    { originCode: "ASK", destinationCode: "MND", distanceKm: 620, defaultPrice: 1120 },
    { originCode: "ASK", destinationCode: "SHB", distanceKm: 280, defaultPrice: 520 },
    { originCode: "ASK", destinationCode: "GAY", distanceKm: 340, defaultPrice: 620 },
    { originCode: "ASK", destinationCode: "ASO", distanceKm: 660, defaultPrice: 1200 },
];

const inverseRoute = (r: RouteDef): RouteDef => ({
    originCode: r.destinationCode,
    destinationCode: r.originCode,
    distanceKm: r.distanceKm,
    defaultPrice: r.defaultPrice,
});

const ROUTE_DEFINITIONS: RouteDef[] = FORWARD_ROUTES.flatMap((r) => [
    r,
    inverseRoute(r),
]);

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
    { routeIndex: 24, busIndex: 14, departHour: 6, departMinute: 0, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 26, busIndex: 15, departHour: 6, departMinute: 30, durationHours: 8, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 28, busIndex: 16, departHour: 6, departMinute: 0, durationHours: 9, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 30, busIndex: 17, departHour: 5, departMinute: 30, durationHours: 10, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 32, busIndex: 18, departHour: 6, departMinute: 0, durationHours: 11, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 34, busIndex: 19, departHour: 7, departMinute: 0, durationHours: 5, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 36, busIndex: 20, departHour: 6, departMinute: 30, durationHours: 6, durationMinutes: 0, priceMultiplier: 1.0 },
    { routeIndex: 38, busIndex: 21, departHour: 5, departMinute: 0, durationHours: 12, durationMinutes: 0, priceMultiplier: 1.0 },
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
    await prisma.vehicleMaintenance.deleteMany();
    await prisma.mechanic.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.bus.deleteMany();
    await prisma.garage.deleteMany();
    await prisma.route.deleteMany();
    await prisma.station.deleteMany();
    await prisma.busCompany.deleteMany();
    // NOTE: do not delete users here — registered passengers must survive
    // re-seeding. Demo accounts are upserted below instead of recreated.
}

// Demo accounts guaranteed on every seed run. All share DEMO_PASSWORD.
const DEMO_PASSWORD = "bus@12345";

type DemoUserDef = {
    key: "admin" | "staff" | "passenger" | "garage";
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    needsStation?: boolean;
};

const DEMO_USERS: DemoUserDef[] = [
    { key: "admin", fullName: "System Admin", email: "admin@bus.et", phone: "+251-91-000-0001", role: UserRole.ADMIN },
    { key: "staff", fullName: "Station Staff", email: "staff@bus.et", phone: "+251-91-000-0002", role: UserRole.STAFF, needsStation: true },
    { key: "passenger", fullName: "Passenger Demo", email: "passenger@bus.et", phone: "+251-91-000-0003", role: UserRole.PASSENGER },
    { key: "garage", fullName: "Garage Owner Demo", email: "garage@bus.et", phone: "+251-91-000-0004", role: UserRole.GARAGE_OWNER },
];

async function ensureDemoUsers(passwordHash: string, autStationId: string) {
    const byKey: Record<string, { id: string; email: string }> = {};
    for (const u of DEMO_USERS) {
        const stationId = u.needsStation ? autStationId : undefined;
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                fullName: u.fullName,
                phone: u.phone,
                passwordHash,
                role: u.role,
                ...(stationId ? { stationId } : {}),
            },
            create: {
                fullName: u.fullName,
                email: u.email,
                phone: u.phone,
                passwordHash,
                role: u.role,
                ...(stationId ? { stationId } : {}),
            },
        });
        byKey[u.key] = user;
    }
    return {
        adminUser: byKey.admin,
        staffUser: byKey.staff,
        passenger: byKey.passenger,
        garageOwner: byKey.garage,
    };
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
    const driverPasswordHash = await bcrypt.hash("bus@12345", 10);
    for (const def of BUS_DEFINITIONS) {
        // Create a DRIVER user account for this bus so the driver can log in
        // (e.g. "Tesfaye Bekele" -> tesfayebekele@gmail.com / bus@12345).
        const driverEmail =
            def.driverName
                ?.toLowerCase()
                .replace(/[^a-z]+/g, "")
                .slice(0, 24) + "@gmail.com";
        let driverUserId: string | undefined;
        if (def.driverName && driverEmail) {
            const driverUser = await prisma.user.upsert({
                where: { email: driverEmail },
                update: {
                    fullName: def.driverName,
                    passwordHash: driverPasswordHash,
                    role: UserRole.DRIVER,
                },
                create: {
                    fullName: def.driverName,
                    email: driverEmail,
                    passwordHash: driverPasswordHash,
                    role: UserRole.DRIVER,
                },
            });
            driverUserId = driverUser.id;
        }

        const bus = await prisma.bus.create({
            data: {
                companyId: companies[def.companyIndex].id,
                plateNumber: def.plateNumber,
                model: def.model,
                level: def.level,
                driverName: def.driverName,
                driverId: driverUserId,
                imageUrl: def.imageUrl,
                amenities: def.amenities,
                safetyChecklist: def.safetyChecklist,
                seatCount: SEAT_LAYOUTS[def.seatLayoutKey].seatCount,
                seatLayout: buildSeatLayoutJson(def.seatLayoutKey),
            },
        });
        buses.push(bus);
    }
    console.log(
        `[seed] Created ${BUS_DEFINITIONS.length} buses with DRIVER accounts (email=<firstname><lastname>@gmail.com, password=bus@12345)`,
    );

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

    // One bus per calendar day: track which buses are already booked each day
    // and skip any schedule that would double-book a bus on the same day.
    const dayKey = (busId: string, date: Date) =>
        `${busId}-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const usedBusDay = new Set<string>();
    // Reserve buses[0] tomorrow for the demo booking trip created below.
    const demoTripDate = new Date(tomorrow);
    demoTripDate.setHours(6, 0, 0, 0);
    usedBusDay.add(dayKey(buses[0].id, demoTripDate));

    let seededTrips = 0;
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
            const key = dayKey(bus.id, departAt);
            if (usedBusDay.has(key)) {
                console.warn(
                    `[seed] Skipping trip for bus ${bus.plateNumber} on ${key} — already assigned that day`,
                );
                continue;
            }
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
            usedBusDay.add(key);
            seededTrips++;
        }
    }

    const { passenger, garageOwner } = await ensureDemoUsers(
        passwordHash,
        stationByCode.get("AUT")!.id,
    );

    const demoGarage = await prisma.garage.create({
        data: {
            name: "Addis Auto Garage",
            address: "Bole Road, Addis Ababa",
            city: "Addis Ababa",
            contactPhone: "+251-91-000-0004",
            contactEmail: "garage@bus.et",
            managerName: "Garage Owner Demo",
            ownerId: garageOwner.id,
        },
    });

    await prisma.mechanic.createMany({
        data: [
            { name: "Tesfaye Wolde", position: "General Mechanic", phone: "+251-91-111-0001", email: "tesfaye@bus.et", garageId: demoGarage.id },
            { name: "Alem Tsegaye", position: "Electrician", phone: "+251-91-111-0002", email: "alem@bus.et", garageId: demoGarage.id },
            { name: "Binyam Desta", position: "Brake Specialist", phone: "+251-91-111-0003", email: "binyam@bus.et", garageId: demoGarage.id },
        ],
    });

    const mechanicPasswordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const mechanicUsers = [
        { fullName: "Tesfaye Wolde", email: "tesfaye@bus.et", phone: "+251-91-111-0001" },
        { fullName: "Alem Tsegaye", email: "alem@bus.et", phone: "+251-91-111-0002" },
        { fullName: "Binyam Desta", email: "binyam@bus.et", phone: "+251-91-111-0003" },
    ];
    for (const m of mechanicUsers) {
        await prisma.user.upsert({
            where: { email: m.email },
            update: { fullName: m.fullName, phone: m.phone, passwordHash: mechanicPasswordHash, role: UserRole.MECHANIC },
            create: { fullName: m.fullName, email: m.email, phone: m.phone, passwordHash: mechanicPasswordHash, role: UserRole.MECHANIC },
        });
    }

    // ---- Vehicle maintenance: link some buses to the demo garage and create
    // maintenance records across varied statuses so the maintenance page has
    // data to display. ----
    const garageMechanics = await prisma.mechanic.findMany({
        where: { garageId: demoGarage.id },
    });
    const maintBusIds = buses.slice(0, 6).map((b) => b.id);
    await prisma.bus.updateMany({
        where: { id: { in: maintBusIds } },
        data: { garageId: demoGarage.id },
    });

    const maintenanceDefs: Array<{
        busIdx: number;
        status: VehicleMaintenanceStatus;
        parts: string;
        desc: string;
        mechIdx: number | null;
        est: number;
        actual?: number;
        scheduled?: boolean;
        completed?: boolean;
    }> = [
        { busIdx: 0, status: VehicleMaintenanceStatus.REQUESTED, parts: "Brake pads (front)", desc: "Front brakes squeaking under load", mechIdx: null, est: 1200 },
        { busIdx: 1, status: VehicleMaintenanceStatus.ACCEPTED, parts: "Oil & filter change", desc: "Routine 10k km service", mechIdx: 0, est: 800 },
        { busIdx: 2, status: VehicleMaintenanceStatus.IN_PROGRESS, parts: "Clutch assembly", desc: "Clutch slipping on inclines", mechIdx: 1, est: 4500, scheduled: true },
        { busIdx: 3, status: VehicleMaintenanceStatus.REPAIR_DONE, parts: "Alternator", desc: "Battery not charging", mechIdx: 2, est: 3000, actual: 3200, completed: true },
        { busIdx: 4, status: VehicleMaintenanceStatus.COMPLETED, parts: "Tire rotation & alignment", desc: "Regular maintenance", mechIdx: 0, est: 500, actual: 500, completed: true },
        { busIdx: 5, status: VehicleMaintenanceStatus.SCHEDULED, parts: "AC system service", desc: "AC not cooling cabin", mechIdx: 1, est: 2000, scheduled: true },
    ];

    const nowMaint = new Date();
    for (const d of maintenanceDefs) {
        const bus = buses[d.busIdx];
        await prisma.vehicleMaintenance.create({
            data: {
                busId: bus.id,
                garageId: demoGarage.id,
                status: d.status,
                partsNeedingMaintenance: d.parts,
                description: d.desc,
                estimatedCost: d.est,
                actualCost: d.actual ?? null,
                assignedMechanicId:
                    d.mechIdx != null ? garageMechanics[d.mechIdx]?.id : null,
                driverId: bus.driverId ?? null,
                requestedById: garageOwner.id,
                scheduledDate: d.scheduled
                    ? new Date(nowMaint.getTime() + 2 * 86400000)
                    : null,
                completedDate: d.completed
                    ? new Date(nowMaint.getTime() - 86400000)
                    : null,
                acceptedAt:
                    d.status !== VehicleMaintenanceStatus.REQUESTED
                        ? new Date(nowMaint.getTime() - 2 * 86400000)
                        : null,
            },
        });
    }
    console.log(
        `[seed] Created ${maintenanceDefs.length} vehicle maintenance records`,
    );

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
    console.log(`Trips: ${seededTrips + 1} (one bus per day, incl. demo)`);
    console.log(`Maintenance records: ${maintenanceDefs.length}`);
    console.log("--- Demo accounts (always seeded) ---");
    for (const u of DEMO_USERS) {
        console.log(`  ${u.role.padEnd(12)} ${u.email}`);
    }
    console.log(`  MECHANIC     tesfaye@bus.et, alem@bus.et, binyam@bus.et`);
    const driverCount = BUS_DEFINITIONS.filter((d) => d.driverName).length;
    console.log(
        `  DRIVER       ${driverCount} accounts (<firstname><lastname>@gmail.com)`,
    );
    console.log(`Default password: ${DEMO_PASSWORD}`);
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
