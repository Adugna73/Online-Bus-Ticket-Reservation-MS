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

        const stations = await prisma.station.findMany({
            orderBy: { name: "asc" },
            take: 500,
        });

        const payload = stations.map((station) => ({
            id: station.id,
            name: station.name,
            code: station.code,
        }));

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[stations] fetch failed", error);
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
            name?: string;
            code?: string;
            city?: string;
        };

        const name = String(body?.name || "").trim();
        const code = String(body?.code || "").trim().toUpperCase();
        const city = String(body?.city || name || "").trim();

        if (!name || !code) {
            return NextResponse.json(
                { error: "name_code_required" },
                { status: 400 },
            );
        }

        const existing = await prisma.station.findUnique({
            where: { code },
        });
        if (existing) {
            return NextResponse.json({
                id: existing.id,
                name: existing.name,
                code: existing.code,
            });
        }

        const created = await prisma.station.create({
            data: {
                name,
                code,
                city: city || name,
            },
        });

        return NextResponse.json({
            id: created.id,
            name: created.name,
            code: created.code,
        });
    } catch (error) {
        console.error("[stations] create failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
