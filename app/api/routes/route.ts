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

        const routes = await prisma.route.findMany({
            include: {
                originStation: true,
                destinationStation: true,
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });

        const payload = routes.map((route) => ({
            id: route.id,
            origin: route.originStation
                ? {
                      name: route.originStation.name,
                      code: route.originStation.code,
                  }
                : null,
            destination: route.destinationStation
                ? {
                      name: route.destinationStation.name,
                      code: route.destinationStation.code,
                  }
                : null,
            distanceKm: route.distanceKm,
            defaultPrice: route.defaultPrice,
            hasInverse: routes.some(
                (r) =>
                    r.id !== route.id &&
                    r.originStationId === route.destinationStationId &&
                    r.destinationStationId === route.originStationId,
            ),
        }));

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[routes] fetch failed", error);
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
            originStationId?: string;
            destinationStationId?: string;
            distanceKm?: number | string;
            defaultPrice?: number | string;
            createInverse?: boolean;
            inverseOfRouteId?: string;
        };

        // Action: add the inverse (return) route for an existing route, so
        // admin/staff can enable bidirectional booking on demand.
        if (body?.inverseOfRouteId) {
            const source = await prisma.route.findUnique({
                where: { id: String(body.inverseOfRouteId).trim() },
            });
            if (!source) {
                return NextResponse.json(
                    { error: "route_not_found" },
                    { status: 404 },
                );
            }
            if (source.originStationId === source.destinationStationId) {
                return NextResponse.json(
                    { error: "self_inverse" },
                    { status: 400 },
                );
            }
            const existing = await prisma.route.findUnique({
                where: {
                    originStationId_destinationStationId: {
                        originStationId: source.destinationStationId,
                        destinationStationId: source.originStationId,
                    },
                },
            });
            if (existing) {
                return NextResponse.json({
                    id: existing.id,
                    inverseCreated: false,
                });
            }
            const inverse = await prisma.route.create({
                data: {
                    originStationId: source.destinationStationId,
                    destinationStationId: source.originStationId,
                    distanceKm: source.distanceKm,
                    defaultPrice: source.defaultPrice,
                },
            });
            return NextResponse.json({
                id: inverse.id,
                inverseCreated: true,
            });
        }

        const originStationId = String(body?.originStationId || "").trim();
        const destinationStationId = String(
            body?.destinationStationId || "",
        ).trim();
        if (!originStationId || !destinationStationId) {
            return NextResponse.json(
                { error: "station_required" },
                { status: 400 },
            );
        }

        const distanceKm =
            body?.distanceKm !== undefined && body?.distanceKm !== null
                ? Number(body.distanceKm)
                : null;
        const defaultPrice =
            body?.defaultPrice !== undefined && body?.defaultPrice !== null
                ? Number(body.defaultPrice)
                : null;

        const created = await prisma.route.create({
            data: {
                originStationId,
                destinationStationId,
                distanceKm,
                defaultPrice,
            },
        });

        // Auto-create the inverse (return) route so passengers can book both
        // directions. Skips if the inverse already exists or the route is a
        // self-loop. Disable with createInverse: false.
        let inverseId: string | undefined;
        const wantInverse = body?.createInverse !== false;
        if (
            wantInverse &&
            originStationId !== destinationStationId
        ) {
            const existingInverse = await prisma.route.findUnique({
                where: {
                    originStationId_destinationStationId: {
                        originStationId: destinationStationId,
                        destinationStationId: originStationId,
                    },
                },
            });
            if (existingInverse) {
                inverseId = existingInverse.id;
            } else {
                const inverse = await prisma.route.create({
                    data: {
                        originStationId: destinationStationId,
                        destinationStationId: originStationId,
                        distanceKm,
                        defaultPrice,
                    },
                });
                inverseId = inverse.id;
            }
        }

        return NextResponse.json({ id: created.id, inverseId });
    } catch (error) {
        console.error("[routes] create failed", error);
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
            originStationId?: string;
            destinationStationId?: string;
            distanceKm?: number | string | null;
            defaultPrice?: number | string | null;
        };

        const id = String(body?.id || "").trim();
        if (!id) {
            return NextResponse.json({ error: "route_id_required" }, { status: 400 });
        }

        const updated = await prisma.route.update({
            where: { id },
            data: {
                originStationId: body?.originStationId || undefined,
                destinationStationId: body?.destinationStationId || undefined,
                distanceKm:
                    body?.distanceKm !== undefined
                        ? body.distanceKm === null
                            ? null
                            : Number(body.distanceKm)
                        : undefined,
                defaultPrice:
                    body?.defaultPrice !== undefined
                        ? body.defaultPrice === null
                            ? null
                            : Number(body.defaultPrice)
                        : undefined,
            },
        });

        return NextResponse.json({ id: updated.id });
    } catch (error) {
        console.error("[routes] update failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey !== "admin" && roleKey !== "supervisor") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const url = new URL(req.url);
        const id = String(url.searchParams.get("id") || "").trim();
        if (!id) {
            return NextResponse.json({ error: "route_id_required" }, { status: 400 });
        }

        await prisma.route.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[routes] delete failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
