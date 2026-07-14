import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const busId = url.searchParams.get("busId");
        const garageId = url.searchParams.get("garageId");
        const status = url.searchParams.get("status");

        const where: any = {};
        if (busId) where.busId = busId;
        if (garageId) where.garageId = garageId;
        if (status) where.status = status;

        const maintenances = await prisma.vehicleMaintenance.findMany({
            where,
            include: {
                bus: {
                    select: {
                        id: true,
                        plateNumber: true,
                        model: true,
                        status: true,
                        driverName: true,
                        seatCount: true,
                    },
                },
                garage: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        contactPhone: true,
                        contactEmail: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 300,
        });

        return NextResponse.json(maintenances);
    } catch (error) {
        console.error("[vehicle-maintenance] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            busId?: string;
            garageId?: string;
            status?: string;
            partsNeedingMaintenance?: string;
            description?: string;
            mechanicNotes?: string;
            scheduledDate?: string;
            completedDate?: string;
            ownerPickupDate?: string;
            ownerDropoffDate?: string;
            estimatedCost?: number;
            actualCost?: number;
        };

        const busId = String(body?.busId || "").trim();
        const garageId = String(body?.garageId || "").trim();
        if (!busId || !garageId) {
            return NextResponse.json(
                { error: "bus_and_garage_required" },
                { status: 400 },
            );
        }

        const created = await prisma.vehicleMaintenance.create({
            data: {
                busId,
                garageId,
                status: (body?.status as any) || "SCHEDULED",
                partsNeedingMaintenance: body?.partsNeedingMaintenance || null,
                description: body?.description || null,
                mechanicNotes: body?.mechanicNotes || null,
                scheduledDate: body?.scheduledDate
                    ? new Date(body.scheduledDate)
                    : null,
                completedDate: body?.completedDate
                    ? new Date(body.completedDate)
                    : null,
                ownerPickupDate: body?.ownerPickupDate
                    ? new Date(body.ownerPickupDate)
                    : null,
                ownerDropoffDate: body?.ownerDropoffDate
                    ? new Date(body.ownerDropoffDate)
                    : null,
                estimatedCost: body?.estimatedCost
                    ? Number(body.estimatedCost)
                    : null,
                actualCost: body?.actualCost ? Number(body.actualCost) : null,
                updatedBy: session.user.id,
            },
        });

        return NextResponse.json({ id: created.id });
    } catch (error) {
        console.error("[vehicle-maintenance] create failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            id?: string;
            status?: string;
            partsNeedingMaintenance?: string;
            description?: string;
            mechanicNotes?: string;
            scheduledDate?: string | null;
            completedDate?: string | null;
            ownerPickupDate?: string | null;
            ownerDropoffDate?: string | null;
            estimatedCost?: number | null;
            actualCost?: number | null;
            busStatus?: string;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        const updated = await prisma.vehicleMaintenance.update({
            where: { id },
            data: {
                status: (body?.status as any) || undefined,
                partsNeedingMaintenance: body?.partsNeedingMaintenance || undefined,
                description: body?.description || undefined,
                mechanicNotes: body?.mechanicNotes || undefined,
                scheduledDate:
                    body?.scheduledDate !== undefined
                        ? body.scheduledDate
                            ? new Date(body.scheduledDate)
                            : null
                        : undefined,
                completedDate:
                    body?.completedDate !== undefined
                        ? body.completedDate
                            ? new Date(body.completedDate)
                            : null
                        : undefined,
                ownerPickupDate:
                    body?.ownerPickupDate !== undefined
                        ? body.ownerPickupDate
                            ? new Date(body.ownerPickupDate)
                            : null
                        : undefined,
                ownerDropoffDate:
                    body?.ownerDropoffDate !== undefined
                        ? body.ownerDropoffDate
                            ? new Date(body.ownerDropoffDate)
                            : null
                        : undefined,
                estimatedCost:
                    body?.estimatedCost !== undefined
                        ? body.estimatedCost === null
                            ? null
                            : Number(body.estimatedCost)
                        : undefined,
                actualCost:
                    body?.actualCost !== undefined
                        ? body.actualCost === null
                            ? null
                            : Number(body.actualCost)
                        : undefined,
                updatedBy: session.user.id,
            },
        });

        if (body?.busStatus) {
            await prisma.bus.update({
                where: { id: updated.busId },
                data: { status: body.busStatus },
            });
        }

        return NextResponse.json({ id: updated.id });
    } catch (error) {
        console.error("[vehicle-maintenance] update failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const id = String(url.searchParams.get("id") || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        await prisma.vehicleMaintenance.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[vehicle-maintenance] delete failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
