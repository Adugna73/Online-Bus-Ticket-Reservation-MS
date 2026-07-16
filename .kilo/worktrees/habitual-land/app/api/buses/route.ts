import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const buses = await prisma.bus.findMany({
            include: { company: true },
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        const payload = buses.map((bus) => ({
            id: bus.id,
            companyId: bus.companyId,
            plateNumber: bus.plateNumber,
            sideNumber: bus.sideNumber,
            model: bus.model,
            seatCount: bus.seatCount,
            status: bus.status,
            level: bus.level,
            driverName: bus.driverName,
            imageUrl: bus.imageUrl,
            amenities: bus.amenities,
            safetyChecklist: bus.safetyChecklist,
            seatLayout: bus.seatLayout,
            companyName: bus.company?.name || null,
        }));

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[buses] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey !== "admin" && roleKey !== "supervisor") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            plateNumber?: string;
            sideNumber?: string;
            model?: string;
            seatCount?: number | string;
            status?: string;
            level?: string;
            driverName?: string;
            imageUrl?: string;
            amenities?: string[];
            safetyChecklist?: string[];
            seatLayout?: any;
            companyId?: string;
        };

        const plateNumber = String(body?.plateNumber || "").trim();
        if (!plateNumber) {
            return NextResponse.json(
                { error: "plate_required" },
                { status: 400 },
            );
        }

        const seatCount =
            body?.seatCount !== undefined && body?.seatCount !== null
                ? Number(body.seatCount)
                : NaN;
        if (!Number.isFinite(seatCount) || seatCount <= 0) {
            return NextResponse.json(
                { error: "seat_count_required" },
                { status: 400 },
            );
        }

        const companyId = String(body?.companyId || "").trim();
        let resolvedCompanyId = companyId;
        if (!resolvedCompanyId) {
            const company = await prisma.busCompany.findFirst({
                orderBy: { createdAt: "asc" },
            });
            if (!company) {
                return NextResponse.json(
                    { error: "company_required" },
                    { status: 400 },
                );
            }
            resolvedCompanyId = company.id;
        }

        const created = await prisma.$transaction(async (tx) => {
            const bus = await tx.bus.create({
                data: {
                    companyId: resolvedCompanyId,
                    plateNumber,
                    sideNumber: String(body?.sideNumber || "").trim() || null,
                    model: String(body?.model || "").trim() || null,
                    seatCount: Number(seatCount),
                    status:
                        String(body?.status || "active").trim() || "active",
                    level: String(body?.level || "").trim() || null,
                    driverName: String(body?.driverName || "").trim() || null,
                    imageUrl: String(body?.imageUrl || "").trim() || null,
                    amenities: Array.isArray(body?.amenities)
                        ? body?.amenities
                        : undefined,
                    safetyChecklist: Array.isArray(body?.safetyChecklist)
                        ? body?.safetyChecklist
                        : undefined,
                    seatLayout:
                        body?.seatLayout !== undefined
                            ? body?.seatLayout
                            : undefined,
                },
            });

            const seats = Array.from({ length: Number(seatCount) }, (_, i) => ({
                busId: bus.id,
                seatNumber: String(i + 1),
            }));
            if (seats.length) {
                await tx.seat.createMany({ data: seats, skipDuplicates: true });
            }

            return bus;
        });

        return NextResponse.json({ id: created.id });
    } catch (error) {
        console.error("[buses] create failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey !== "admin" && roleKey !== "supervisor") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            id?: string;
            plateNumber?: string;
            sideNumber?: string;
            model?: string;
            seatCount?: number | string;
            status?: string;
            level?: string;
            driverName?: string;
            imageUrl?: string;
            amenities?: string[];
            safetyChecklist?: string[];
            seatLayout?: any;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "bus_id_required" }, { status: 400 });
        }

        const seatCount =
            body?.seatCount !== undefined && body?.seatCount !== null
                ? Number(body.seatCount)
                : undefined;

        const updated = await prisma.$transaction(async (tx) => {
            const bus = await tx.bus.update({
                where: { id },
                data: {
                    plateNumber: body?.plateNumber || undefined,
                    sideNumber: body?.sideNumber || undefined,
                    model: body?.model || undefined,
                    seatCount: Number.isFinite(seatCount)
                        ? seatCount
                        : undefined,
                    status: body?.status || undefined,
                    level: body?.level || undefined,
                    driverName: body?.driverName || undefined,
                    imageUrl: body?.imageUrl || undefined,
                    amenities: Array.isArray(body?.amenities)
                        ? body?.amenities
                        : undefined,
                    safetyChecklist: Array.isArray(body?.safetyChecklist)
                        ? body?.safetyChecklist
                        : undefined,
                    seatLayout:
                        body?.seatLayout !== undefined
                            ? body?.seatLayout
                            : undefined,
                },
            });

            if (Number.isFinite(seatCount) && seatCount! > 0) {
                const existing = await tx.seat.findMany({
                    where: { busId: id },
                    select: { seatNumber: true },
                });
                const existingSet = new Set(
                    existing.map((s) => String(s.seatNumber)),
                );
                const seats = Array.from(
                    { length: Number(seatCount) },
                    (_, i) => String(i + 1),
                ).filter((num) => !existingSet.has(num));
                if (seats.length) {
                    await tx.seat.createMany({
                        data: seats.map((num) => ({
                            busId: id,
                            seatNumber: num,
                        })),
                        skipDuplicates: true,
                    });
                }
            }

            return bus;
        });

        return NextResponse.json({ id: updated.id });
    } catch (error) {
        console.error("[buses] update failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
