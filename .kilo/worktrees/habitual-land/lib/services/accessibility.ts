import { prisma } from "@/lib/prisma";

// GAP 12: Accessibility & inclusivity — DB-backed filtering of buses/trips by
// accessibility flags and management of those flags on the Bus model.

export type AccessibilityFlags = {
    wheelchairAccessible?: boolean;
    womenOnly?: boolean;
    hasPrioritySeating?: boolean;
    audioAnnouncements?: boolean;
};

export type AccessibilityFilter = AccessibilityFlags;

export type AccessibleBus = {
    id: string;
    plateNumber: string;
    model: string | null;
    seatCount: number;
    status: string;
    wheelchairAccessible: boolean;
    womenOnly: boolean;
    hasPrioritySeating: boolean;
    audioAnnouncements: boolean;
    company: { id: string; name: string } | null;
};

export type AccessibleTrip = {
    id: string;
    departAt: Date;
    arriveAt: Date;
    basePrice: number;
    status: string;
    bus: {
        id: string;
        plateNumber: string;
        model: string | null;
        seatCount: number;
        wheelchairAccessible: boolean;
        womenOnly: boolean;
        hasPrioritySeating: boolean;
        audioAnnouncements: boolean;
    } | null;
    route: {
        id: string;
        origin: { name: string; code: string } | null;
        destination: { name: string; code: string } | null;
    } | null;
};

export type AccessibilitySummary = {
    totalBuses: number;
    wheelchairAccessible: number;
    womenOnly: number;
    hasPrioritySeating: number;
    audioAnnouncements: number;
};

function buildWhere(filters: AccessibilityFilter) {
    const where: {
        wheelchairAccessible?: boolean;
        womenOnly?: boolean;
        hasPrioritySeating?: boolean;
        audioAnnouncements?: boolean;
    } = {};
    if (filters.wheelchairAccessible === true)
        where.wheelchairAccessible = true;
    if (filters.womenOnly === true) where.womenOnly = true;
    if (filters.hasPrioritySeating === true)
        where.hasPrioritySeating = true;
    if (filters.audioAnnouncements === true)
        where.audioAnnouncements = true;
    return where;
}

// List buses matching the given accessibility filters.
export async function listAccessibleBuses(
    filters: AccessibilityFilter = {},
): Promise<AccessibleBus[]> {
    const buses = await prisma.bus.findMany({
        where: buildWhere(filters),
        select: {
            id: true,
            plateNumber: true,
            model: true,
            seatCount: true,
            status: true,
            wheelchairAccessible: true,
            womenOnly: true,
            hasPrioritySeating: true,
            audioAnnouncements: true,
            company: { select: { id: true, name: true } },
        },
        orderBy: { plateNumber: "asc" },
        take: 500,
    });
    return buses;
}

// List trips whose bus matches the given accessibility filters, including the
// bus, route and origin/destination stations.
export async function listAccessibleTrips(
    filters: AccessibilityFilter = {},
): Promise<AccessibleTrip[]> {
    const trips = await prisma.trip.findMany({
        where: {
            bus: buildWhere(filters),
            status: "SCHEDULED",
        },
        select: {
            id: true,
            departAt: true,
            arriveAt: true,
            basePrice: true,
            status: true,
            bus: {
                select: {
                    id: true,
                    plateNumber: true,
                    model: true,
                    seatCount: true,
                    wheelchairAccessible: true,
                    womenOnly: true,
                    hasPrioritySeating: true,
                    audioAnnouncements: true,
                },
            },
            route: {
                select: {
                    id: true,
                    originStation: { select: { name: true, code: true } },
                    destinationStation: {
                        select: { name: true, code: true },
                    },
                },
            },
        },
        orderBy: { departAt: "asc" },
        take: 200,
    });

    return trips.map((trip) => ({
        id: trip.id,
        departAt: trip.departAt,
        arriveAt: trip.arriveAt,
        basePrice: trip.basePrice,
        status: trip.status,
        bus: trip.bus
            ? {
                  id: trip.bus.id,
                  plateNumber: trip.bus.plateNumber,
                  model: trip.bus.model,
                  seatCount: trip.bus.seatCount,
                  wheelchairAccessible: trip.bus.wheelchairAccessible,
                  womenOnly: trip.bus.womenOnly,
                  hasPrioritySeating: trip.bus.hasPrioritySeating,
                  audioAnnouncements: trip.bus.audioAnnouncements,
              }
            : null,
        route: trip.route
            ? {
                  id: trip.route.id,
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
    }));
}

// Update accessibility flags on a bus. Caller is responsible for authorization
// (admin/staff only). Returns the updated bus or null if not found.
export async function updateBusAccessibility(
    busId: string,
    flags: AccessibilityFlags,
): Promise<AccessibleBus | null> {
    const data: {
        wheelchairAccessible?: boolean;
        womenOnly?: boolean;
        hasPrioritySeating?: boolean;
        audioAnnouncements?: boolean;
    } = {};
    if (typeof flags.wheelchairAccessible === "boolean")
        data.wheelchairAccessible = flags.wheelchairAccessible;
    if (typeof flags.womenOnly === "boolean") data.womenOnly = flags.womenOnly;
    if (typeof flags.hasPrioritySeating === "boolean")
        data.hasPrioritySeating = flags.hasPrioritySeating;
    if (typeof flags.audioAnnouncements === "boolean")
        data.audioAnnouncements = flags.audioAnnouncements;

    if (Object.keys(data).length === 0) {
        // Nothing to update; return the current bus.
        const existing = await prisma.bus.findUnique({
            where: { id: busId },
            select: {
                id: true,
                plateNumber: true,
                model: true,
                seatCount: true,
                status: true,
                wheelchairAccessible: true,
                womenOnly: true,
                hasPrioritySeating: true,
                audioAnnouncements: true,
                company: { select: { id: true, name: true } },
            },
        });
        return existing;
    }

    const updated = await prisma.bus.update({
        where: { id: busId },
        data,
        select: {
            id: true,
            plateNumber: true,
            model: true,
            seatCount: true,
            status: true,
            wheelchairAccessible: true,
            womenOnly: true,
            hasPrioritySeating: true,
            audioAnnouncements: true,
            company: { select: { id: true, name: true } },
        },
    });
    return updated;
}

// Summary counts of buses per accessibility flag.
export async function getAccessibilitySummary(): Promise<AccessibilitySummary> {
    const [
        totalBuses,
        wheelchairAccessible,
        womenOnly,
        hasPrioritySeating,
        audioAnnouncements,
    ] = await Promise.all([
        prisma.bus.count(),
        prisma.bus.count({ where: { wheelchairAccessible: true } }),
        prisma.bus.count({ where: { womenOnly: true } }),
        prisma.bus.count({ where: { hasPrioritySeating: true } }),
        prisma.bus.count({ where: { audioAnnouncements: true } }),
    ]);
    return {
        totalBuses,
        wheelchairAccessible,
        womenOnly,
        hasPrioritySeating,
        audioAnnouncements,
    };
}
