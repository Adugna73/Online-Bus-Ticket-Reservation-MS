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

        const assignments = await prisma.customerServiceAssignment.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(assignments);
    } catch (error) {
        console.error("[cs-assignments] fetch failed", error);
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
            userId?: string;
            type?: string;
            location?: string;
            routeId?: string;
            description?: string;
        };

        const userId = String(body?.userId || "").trim();
        if (!userId) {
            return NextResponse.json({ error: "user_required" }, { status: 400 });
        }

        const created = await prisma.customerServiceAssignment.create({
            data: {
                userId,
                type: (body?.type as any) || "GENERAL",
                location: body?.location || null,
                routeId: body?.routeId || null,
                description: body?.description || null,
            },
        });

        return NextResponse.json({ id: created.id });
    } catch (error) {
        console.error("[cs-assignments] create failed", error);
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
            type?: string;
            location?: string;
            description?: string;
            active?: boolean;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "id_required" }, { status: 400 });
        }

        const updated = await prisma.customerServiceAssignment.update({
            where: { id },
            data: {
                type: (body?.type as any) || undefined,
                location: body?.location || undefined,
                description: body?.description || undefined,
                active: body?.active ?? undefined,
            },
        });

        return NextResponse.json({ id: updated.id });
    } catch (error) {
        console.error("[cs-assignments] update failed", error);
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

        await prisma.customerServiceAssignment.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[cs-assignments] delete failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
