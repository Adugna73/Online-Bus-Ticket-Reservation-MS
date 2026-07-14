import { prisma } from "@/lib/prisma";

// GAP 6: Real-Time Tracking — DB-backed location writes + polling, ETA, SOS alerts.
// No live GPS; location is written via API and polled by clients.

export type BusLocationRecord = {
    id: string;
    busId: string;
    tripId: string | null;
    lat: number;
    lng: number;
    speed: number | null;
    heading: number | null;
    etaMinutes: number | null;
    recordedAt: Date;
};

export type SosAlertRecord = {
    id: string;
    userId: string | null;
    bookingId: string | null;
    busId: string | null;
    lat: number | null;
    lng: number | null;
    resolved: boolean;
    createdAt: Date;
};

export type TripTrackingResult = {
    tripId: string;
    busId: string;
    status: string;
    departAt: Date;
    arriveAt: Date;
    location: BusLocationRecord | null;
    etaMinutes: number | null;
};

// Write a new location sample for a bus (optionally tied to a trip).
export async function updateLocation(
    busId: string,
    tripId: string | null | undefined,
    lat: number,
    lng: number,
    speed?: number | null,
    heading?: number | null,
    etaMinutes?: number | null,
): Promise<BusLocationRecord> {
    const created = await prisma.busLocation.create({
        data: {
            busId,
            tripId: tripId || null,
            lat,
            lng,
            speed: speed ?? null,
            heading: heading ?? null,
            etaMinutes: etaMinutes ?? null,
        },
    });
    return created;
}

// Most recent location sample for a bus.
export async function getLatestLocation(
    busId: string,
): Promise<BusLocationRecord | null> {
    const latest = await prisma.busLocation.findFirst({
        where: { busId },
        orderBy: { recordedAt: "desc" },
    });
    return latest;
}

// Latest location + ETA + trip status for a trip.
export async function getTripTracking(
    tripId: string,
): Promise<TripTrackingResult | null> {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
            id: true,
            busId: true,
            status: true,
            departAt: true,
            arriveAt: true,
        },
    });
    if (!trip) return null;

    const location = await prisma.busLocation.findFirst({
        where: {
            OR: [{ tripId }, { busId: trip.busId }],
        },
        orderBy: { recordedAt: "desc" },
    });

    return {
        tripId: trip.id,
        busId: trip.busId,
        status: trip.status,
        departAt: trip.departAt,
        arriveAt: trip.arriveAt,
        location,
        etaMinutes: location?.etaMinutes ?? null,
    };
}

// Raise an SOS alert.
export async function raiseSos(
    userId: string | null | undefined,
    bookingId?: string | null,
    busId?: string | null,
    lat?: number | null,
    lng?: number | null,
): Promise<SosAlertRecord> {
    const created = await prisma.sosAlert.create({
        data: {
            userId: userId || null,
            bookingId: bookingId || null,
            busId: busId || null,
            lat: lat ?? null,
            lng: lng ?? null,
        },
    });
    return created;
}

// List SOS alerts: admin/staff see all, passengers see only their own.
export async function listSos(
    role: string,
    userId?: string | null,
): Promise<SosAlertRecord[]> {
    const roleKey = String(role || "").toLowerCase();
    const where: { userId?: string } = {};
    if (roleKey !== "admin" && roleKey !== "staff") {
        where.userId = userId || undefined;
    }
    const alerts = await prisma.sosAlert.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
    });
    return alerts;
}

// Mark an SOS alert as resolved.
export async function resolveSos(id: string): Promise<SosAlertRecord | null> {
    const updated = await prisma.sosAlert.update({
        where: { id },
        data: { resolved: true },
    });
    return updated;
}
