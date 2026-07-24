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

        const role = String(session.user.role || "").toLowerCase();
        const url = new URL(req.url);
        const busId = url.searchParams.get("busId");
        const garageId = url.searchParams.get("garageId");
        const status = url.searchParams.get("status");

        const where: any = {};
        if (busId) where.busId = busId;

        if (role === "garage_owner") {
            const garage = await prisma.garage.findFirst({
                where: { ownerId: session.user.id },
                select: { id: true },
            });
            if (!garage) {
                return NextResponse.json([]);
            }
            where.garageId = garage.id;
        } else if (role === "driver") {
            // A driver sees maintenance tasks for buses they are assigned to,
            // whether via the maintenance record's driverId or the bus's own
            // driverId. This stays correct even if the record's driverId was
            // not explicitly set during release.
            where.OR = [
                { driverId: session.user.id },
                { bus: { driverId: session.user.id } },
            ];
        } else if (garageId) {
            where.garageId = garageId;
        }

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
                        driverId: true,
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
                requestedBy: {
                    select: { id: true, fullName: true, email: true },
                },
                assignedMechanic: {
                    select: { id: true, name: true, position: true, phone: true },
                },
                driver: {
                    select: { id: true, fullName: true, email: true },
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
                status: "REQUESTED",
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
                requestedById: session.user.id,
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
            assignedMechanicId?: string | null;
            acceptedAt?: string | null;
            rejectionReason?: string | null;
            costRejectedReason?: string | null;
            paymentTxRef?: string | null;
            telebirrRef?: string | null;
            telebirrAmount?: number | null;
            driverAcceptedAt?: string | null;
            busReleasedAt?: string | null;
            adminConfirmedAt?: string | null;
            driverId?: string | null;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        const role = String(session.user.role || "").toLowerCase();

        // Fetch the current record to validate status transitions.
        const existing = await (prisma.vehicleMaintenance as any).findUnique({
            where: { id },
            select: { id: true, status: true, busId: true, driverId: true },
        });
        if (!existing) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        // Only the assigned driver can accept the bus (BUS_READY → DRIVER_ACCEPTED).
        // Admin/staff/garage_owner must NOT be able to mark the driver as accepted
        // on the driver's behalf — the driver must accept it themselves.
        if (body?.status === "DRIVER_ACCEPTED") {
            if (role !== "driver") {
                return NextResponse.json(
                    { error: "only_driver_can_accept_bus" },
                    { status: 403 },
                );
            }
            if (existing.status !== "BUS_READY") {
                return NextResponse.json(
                    { error: "bus_not_ready_for_acceptance" },
                    { status: 400 },
                );
            }
            // Driver accepted — update bus status to active.
            body.busStatus = "active";
        }

        // Admin can only confirm handover (→ COMPLETED) after the driver has
        // accepted the bus (status must be DRIVER_ACCEPTED).
        if (body?.status === "COMPLETED" && role !== "driver") {
            if (existing.status !== "DRIVER_ACCEPTED") {
                return NextResponse.json(
                    { error: "driver_must_accept_first" },
                    { status: 400 },
                );
            }
            // Ensure bus is active upon final completion.
            body.busStatus = "active";
        }

        const updateData: any = {
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
        };

        if (body?.assignedMechanicId !== undefined) {
            updateData.assignedMechanicId = body.assignedMechanicId || null;
        }

        if (body?.acceptedAt !== undefined) {
            updateData.acceptedAt = body.acceptedAt ? new Date(body.acceptedAt) : null;
        }

        if (body?.rejectionReason !== undefined) {
            updateData.rejectionReason = body.rejectionReason || null;
        }

        if (body?.costRejectedReason !== undefined) {
            updateData.costRejectedReason = body.costRejectedReason || null;
        }

        if (body?.paymentTxRef !== undefined) {
            updateData.paymentTxRef = body.paymentTxRef || null;
        }

        if (body?.telebirrRef !== undefined) {
            updateData.telebirrRef = body.telebirrRef || null;
        }

        if (body?.telebirrAmount !== undefined) {
            updateData.telebirrAmount = body.telebirrAmount ?? null;
        }

        if (body?.driverAcceptedAt !== undefined) {
            updateData.driverAcceptedAt = body.driverAcceptedAt ? new Date(body.driverAcceptedAt) : null;
        }

        if (body?.busReleasedAt !== undefined) {
            updateData.busReleasedAt = body.busReleasedAt ? new Date(body.busReleasedAt) : null;
        }

        if (body?.adminConfirmedAt !== undefined) {
            updateData.adminConfirmedAt = body.adminConfirmedAt ? new Date(body.adminConfirmedAt) : null;
        }

        if (body?.driverId !== undefined) {
            updateData.driverId = body.driverId || null;
        }

        const updated = await (prisma.vehicleMaintenance as any).update({
            where: { id },
            data: updateData as any,
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
