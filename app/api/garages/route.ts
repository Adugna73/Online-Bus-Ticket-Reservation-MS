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

        const garages = await prisma.garage.findMany({
            include: {
                buses: {
                    select: {
                        id: true,
                        plateNumber: true,
                        model: true,
                        status: true,
                        driverName: true,
                        seatCount: true,
                    },
                },
                _count: { select: { buses: true, maintenances: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(garages);
    } catch (error) {
        console.error("[garages] fetch failed", error);
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
            name?: string;
            address?: string;
            city?: string;
            contactPhone?: string;
            contactEmail?: string;
            managerName?: string;
        };

        const name = String(body?.name || "").trim();
        if (!name) {
            return NextResponse.json({ error: "name_required" }, { status: 400 });
        }

        const created = await prisma.garage.create({
            data: {
                name,
                address: body?.address || null,
                city: body?.city || null,
                contactPhone: body?.contactPhone || null,
                contactEmail: body?.contactEmail || null,
                managerName: body?.managerName || null,
            },
        });

        return NextResponse.json({ id: created.id });
    } catch (error) {
        console.error("[garages] create failed", error);
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
            name?: string;
            address?: string;
            city?: string;
            contactPhone?: string;
            contactEmail?: string;
            managerName?: string;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        const updated = await prisma.garage.update({
            where: { id },
            data: {
                name: body?.name || undefined,
                address: body?.address || undefined,
                city: body?.city || undefined,
                contactPhone: body?.contactPhone || undefined,
                contactEmail: body?.contactEmail || undefined,
                managerName: body?.managerName || undefined,
            },
        });

        return NextResponse.json({ id: updated.id });
    } catch (error) {
        console.error("[garages] update failed", error);
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

        await prisma.garage.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[garages] delete failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
