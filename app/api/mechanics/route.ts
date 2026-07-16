import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "bus@12345";

export async function GET(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const role = String(session.user.role || "").toLowerCase();
        const url = new URL(req.url);
        const garageId = url.searchParams.get("garageId");

        if (role === "garage_owner") {
            const garage = await prisma.garage.findFirst({
                where: { ownerId: session.user.id },
            });
            if (!garage) {
                return NextResponse.json([]);
            }
            const mechanics = await prisma.mechanic.findMany({
                where: { garageId: garage.id },
                include: { _count: { select: { maintenances: true } } },
                orderBy: { createdAt: "desc" },
            });
            return NextResponse.json(mechanics);
        }

        if ((role === "admin" || role === "supervisor") && garageId) {
            const mechanics = await prisma.mechanic.findMany({
                where: { garageId },
                include: { _count: { select: { maintenances: true } } },
                orderBy: { createdAt: "desc" },
            });
            return NextResponse.json(mechanics);
        }

        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    } catch (error) {
        console.error("[mechanics] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const role = String(session.user.role || "").toLowerCase();
        if (role !== "garage_owner") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const garage = await prisma.garage.findFirst({
            where: { ownerId: session.user.id },
        });
        if (!garage) {
            return NextResponse.json({ error: "no_garage_assigned" }, { status: 404 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            name?: string;
            phone?: string;
            email?: string;
            position?: string;
        };

        const name = String(body?.name || "").trim();
        if (!name) {
            return NextResponse.json({ error: "name_required" }, { status: 400 });
        }

        const position = String(body?.position || "").trim();
        if (!position) {
            return NextResponse.json({ error: "position_required" }, { status: 400 });
        }

        const email = String(body?.email || "").trim();
        if (!email) {
            return NextResponse.json({ error: "email_required" }, { status: 400 });
        }

        try {
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                return NextResponse.json({ error: "email_already_exists" }, { status: 409 });
            }
        } catch {
            // proceed
        }

        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        const user = await prisma.user.create({
            data: {
                fullName: name,
                email,
                phone: body?.phone || null,
                passwordHash,
                role: "MECHANIC",
            },
        });

        const mechanic = await prisma.mechanic.create({
            data: {
                name,
                phone: body?.phone || null,
                email,
                position,
                garageId: garage.id,
            },
        });

        return NextResponse.json(mechanic);
    } catch (error) {
        console.error("[mechanics] create failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const role = String(session.user.role || "").toLowerCase();
        if (role !== "garage_owner") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const garage = await prisma.garage.findFirst({
            where: { ownerId: session.user.id },
        });
        if (!garage) {
            return NextResponse.json({ error: "no_garage_assigned" }, { status: 404 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            id?: string;
            name?: string;
            phone?: string;
            email?: string;
            position?: string;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        const mechanic = await prisma.mechanic.findFirst({
            where: { id, garageId: garage.id },
        });
        if (!mechanic) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const updated = await prisma.mechanic.update({
            where: { id },
            data: {
                name: body?.name || undefined,
                phone: body?.phone !== undefined ? body.phone : undefined,
                email: body?.email !== undefined ? body.email : undefined,
                position: body?.position || undefined,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[mechanics] update failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const role = String(session.user.role || "").toLowerCase();
        if (role !== "garage_owner") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const garage = await prisma.garage.findFirst({
            where: { ownerId: session.user.id },
        });
        if (!garage) {
            return NextResponse.json({ error: "no_garage_assigned" }, { status: 404 });
        }

        const url = new URL(req.url);
        const id = String(url.searchParams.get("id") || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        const mechanic = await prisma.mechanic.findFirst({
            where: { id, garageId: garage.id },
        });
        if (!mechanic) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        await prisma.mechanic.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[mechanics] delete failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
