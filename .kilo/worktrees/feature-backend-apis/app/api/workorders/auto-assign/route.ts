import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";import { findPreferredManagerForSite } from '../../../../lib/assignment';
function normalizeRegions(rawRegions: string[]): string[] {
    return rawRegions.map((r) => {
        const name = String(r).trim();
        if (name.toLowerCase() === "head quarter" || name.toLowerCase() === "hq")
            return "CAAZ";
        return name;
    });
}

async function resolveAreaIds(user: any) {
    const rawRegions: string[] = Array.isArray(user?.assignedRegion)
        ? user.assignedRegion
        : [];
    const rawZones: string[] = Array.isArray(user?.assignedZone)
        ? user.assignedZone
        : [];
    if (rawRegions.length === 0 && rawZones.length === 0)
        return { regionIds: [], zoneIds: [] };

    const normalizedRegions = normalizeRegions(rawRegions);
    const [regions, zones] = await Promise.all([
        prisma.region.findMany({ select: { id: true, name: true } }),
        prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
    ]);

    const regionByName = new Map(
        regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]),
    );
    const zoneByName = new Map(
        zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]),
    );
    const regionIdSet = new Set(regions.map((r) => r.id));
    const zoneIdSet = new Set(zones.map((z) => z.id));

    const regionIds = new Set<string>();
    const zoneIds = new Set<string>();

    for (const v of normalizedRegions) {
        const raw = String(v || "").trim();
        if (!raw) continue;
        if (regionIdSet.has(raw)) {
            regionIds.add(raw);
            continue;
        }
        const mapped = regionByName.get(raw.toLowerCase());
        if (mapped) regionIds.add(mapped);
    }

    for (const v of rawZones) {
        const raw = String(v || "").trim();
        if (!raw) continue;
        if (zoneIdSet.has(raw)) {
            zoneIds.add(raw);
            continue;
        }
        const mapped = zoneByName.get(raw.toLowerCase());
        if (mapped) zoneIds.add(mapped);
    }

    // HQ managers should also include HQ region and HQ-* zones
    const locCat = String((user as any)?.locationCategory || '').toLowerCase();
    if (locCat.includes('head quarter') || locCat === 'hq') {
        const caazRegion = regions.find((r) => String(r.name).toLowerCase() === 'caaz');
        if (caazRegion?.id) regionIds.add(caazRegion.id);
        zones
            .filter((z) => String(z.name).toLowerCase().startsWith('hq-'))
            .forEach((z) => zoneIds.add(z.id));
    }

    if (zoneIds.size > 0) {
        for (const z of zones) {
            if (zoneIds.has(z.id) && z.regionId) regionIds.add(z.regionId);
        }
    }

    return {
        regionIds: Array.from(regionIds),
        zoneIds: Array.from(zoneIds),
    };
}

async function listScopedSiteIds(user: any) {
    const { regionIds, zoneIds } = await resolveAreaIds(user);
    if (!regionIds.length && !zoneIds.length) return [] as string[];
    const where: any = {};
    if (regionIds.length) where.regionId = { in: regionIds };
    if (zoneIds.length) {
        where.AND = [
            ...(where.AND || []),
            {
                OR: [{ zoneId: { in: zoneIds } }, { zoneId: null }],
            },
        ];
    }
    const sites = await prisma.site.findMany({
        where,
        select: { id: true },
    });
    return sites.map((s) => s.id);
}

export async function POST() {
    const session: any = await getServerSession(authOptions as any);
    const user = session?.user;
    if (!user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const roleKey = String(user?.role?.key || user?.roleKey || user?.role || "").toLowerCase();
    if (roleKey !== "admin" && roleKey !== "manager") {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const dbUser = await prisma.user.findUnique({
        where: { id: String(user.id) },
        include: { role: true },
    });
    if (!dbUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let scopeSiteIds: string[] = [];
    if (roleKey === "manager") {
        scopeSiteIds = await listScopedSiteIds(dbUser);
    }

    const baseWhere: any = {
        archived: false,
        deletedAt: null,
    };

    if (roleKey === "manager") {
        if (scopeSiteIds.length > 0) {
            baseWhere.siteId = { in: scopeSiteIds };
        } else {
            baseWhere.createdById = String(user.id);
        }
    }

    const adminUser = await prisma.user.findFirst({
        where: { role: { key: "admin" } },
        select: { id: true, teamId: true },
    });

    // Admin can fix both unassigned and admin-assigned items; managers can also
    // re-route items currently held by themselves.
    if (roleKey === "admin") {
        baseWhere.OR = [
            { assignedToId: null },
            { assignedToId: adminUser?.id || "__no_admin__" },
        ];
    } else {
        baseWhere.OR = [
            { assignedToId: null },
            { assignedToId: String(user.id) },
        ];
    }

    const workOrders = await prisma.workOrder.findMany({
        where: baseWhere,
        select: {
            id: true,
            siteId: true,
            createdById: true,
            assignedToId: true,
            teamId: true,
            site: { select: { supervisorStationId: true, regionId: true, zoneId: true } },
        },
    });

    if (!workOrders.length) {
        return NextResponse.json({ updated: 0 });
    }

    const [regions, zones, managers] = await Promise.all([
        prisma.region.findMany({ select: { id: true, name: true } }),
        prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
            prisma.user.findMany({
                where: { role: { key: "manager" } },
                select: { id: true, teamId: true, assignedRegion: true, assignedZone: true, locationCategory: true, email: true, fullName: true },
            }),
    ]);

    const regionByName = new Map(
        regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]),
    );
    const zoneByName = new Map(
        zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]),
    );
    const regionIdSet = new Set(regions.map((r) => r.id));
    const zoneIdSet = new Set(zones.map((z) => z.id));

    const managerScopes = managers.map((m) => {
        const regionIds = new Set<string>();
        const zoneIds = new Set<string>();
        const rawRegions: string[] = Array.isArray(m.assignedRegion)
            ? m.assignedRegion
            : [];
        const rawZones: string[] = Array.isArray(m.assignedZone)
            ? m.assignedZone
            : [];

        for (const v of rawRegions) {
            const raw = String(v || "").trim();
            if (!raw) continue;
            const normalized =
                raw.toLowerCase() === "head quarter" ||
                raw.toLowerCase() === "hq"
                    ? "caaz"
                    : raw.toLowerCase();
            if (regionIdSet.has(raw)) {
                regionIds.add(raw);
                continue;
            }
            const mapped = regionByName.get(normalized);
            if (mapped) regionIds.add(mapped);
        }
        for (const v of rawZones) {
            const raw = String(v || "").trim();
            if (!raw) continue;
            if (zoneIdSet.has(raw)) {
                zoneIds.add(raw);
                continue;
            }
            const mapped = zoneByName.get(raw.toLowerCase());
            if (mapped) zoneIds.add(mapped);
        }
        const locCat = String((m as any)?.locationCategory || '').toLowerCase();
        const isHqManager = locCat.includes('head quarter') || locCat === 'hq';

        if (isHqManager) {
            const caazId = regionByName.get('caaz');
            if (caazId) regionIds.add(caazId);
            zones
                .filter((z) => String(z.name).toLowerCase().startsWith('hq-'))
                .forEach((z) => zoneIds.add(z.id));
        }

        return {
            id: m.id,
            teamId: m.teamId || null,
            regionIds: Array.from(regionIds),
            zoneIds: Array.from(zoneIds),
        };
    });

    const assignedToIds = new Set<string>();
    // Do not auto-reassign work orders that are already owned by a team
    // (including Group-* teams). Those should stay with their groups.
    const eligible = workOrders.filter((wo) => !wo.teamId);
    for (const wo of eligible) {
        const siteZoneId = wo.site?.zoneId || undefined;
        const siteRegionId = wo.site?.regionId || undefined;
        const managerForZone = siteZoneId
            ? managerScopes.find((m) => m.zoneIds.includes(siteZoneId))
            : undefined;
        const managerForRegion = !siteZoneId && siteRegionId
            ? managerScopes.find((m) => m.regionIds.includes(siteRegionId))
            : undefined;

        // Prefer HQ/AAZ managers for HQ/AAZ sites (explicit business rule):
        // if the site zone/region name contains 'aaz' or 'hq', pick a manager
        // whose assignedZone/assignedRegion contains AAZ/HQ (otherwise fall back).
        let managerOwner = managerForZone || managerForRegion;
        try {
            const preferred = findPreferredManagerForSite(managers, siteZoneId, siteRegionId, zones, regions);
            if (preferred) {
                managerOwner = { id: preferred.id, teamId: preferred.teamId, regionIds: [], zoneIds: [] } as any;
            }
        } catch (err) {
            // ignore and keep existing managerOwner
        }

        const targetId = wo.site?.supervisorStationId || managerOwner?.id || undefined;
        if (targetId) assignedToIds.add(targetId);
    }

    const users = await prisma.user.findMany({
        where: { id: { in: Array.from(assignedToIds) } },
        select: { id: true, teamId: true },
    });
    const teamByUserId = new Map(users.map((u) => [u.id, u.teamId]));

    let updated = 0;
    for (const wo of eligible) {
        const siteZoneId = wo.site?.zoneId || undefined;
        const siteRegionId = wo.site?.regionId || undefined;
        const managerForZone = siteZoneId
            ? managerScopes.find((m) => m.zoneIds.includes(siteZoneId))
            : undefined;
        const managerForRegion = !siteZoneId && siteRegionId
            ? managerScopes.find((m) => m.regionIds.includes(siteRegionId))
            : undefined;

        // Prefer HQ/AAZ managers for HQ/AAZ sites (explicit business rule)
        let managerOwner = managerForZone || managerForRegion;
        try {
            const z = siteZoneId ? zones.find((zz) => zz.id === siteZoneId) : null;
            const r = siteRegionId ? regions.find((rr) => rr.id === siteRegionId) : null;
            const zname = String(z?.name || '').toLowerCase();
            const rname = String(r?.name || '').toLowerCase();
            const isAazOrHqSite = /aaz/i.test(zname || rname) || zname.startsWith('hq-') || rname === 'hq' || rname === 'caaz';
            if (isAazOrHqSite) {
                const preferredCandidates = managers.filter((m: any) => {
                    const regs = Array.isArray(m.assignedRegion) ? m.assignedRegion : [];
                    const zns = Array.isArray(m.assignedZone) ? m.assignedZone : [];
                    const regNames = regs.map(String).join(' ').toLowerCase();
                    const zoneNames = zns.map(String).join(' ').toLowerCase();
                    const locCat = String((m as any).locationCategory || '').toLowerCase();

                    const explicitMatch = (siteRegionId && regs.includes(siteRegionId)) || (siteZoneId && zns.includes(siteZoneId));
                    const nameMatch = /aaz/i.test(regNames) || /aaz/i.test(zoneNames) || /hq/i.test(regNames) || /hq/i.test(zoneNames);
                    const locMatch = locCat.includes('head quarter') || locCat === 'hq';
                    return explicitMatch || nameMatch || locMatch;
                });

                if (preferredCandidates.length > 0) {
                    preferredCandidates.sort((a: any, b: any) => {
                        const aLoc = String((a as any).locationCategory || '').toLowerCase().includes('head quarter') ? 1 : 0;
                        const bLoc = String((b as any).locationCategory || '').toLowerCase().includes('head quarter') ? 1 : 0;
                        if (aLoc !== bLoc) return bLoc - aLoc;

                        const aZone = Array.isArray(a.assignedZone) && siteZoneId && a.assignedZone.includes(siteZoneId) ? 1 : 0;
                        const bZone = Array.isArray(b.assignedZone) && siteZoneId && b.assignedZone.includes(siteZoneId) ? 1 : 0;
                        if (aZone !== bZone) return bZone - aZone;

                        const aReg = Array.isArray(a.assignedRegion) && siteRegionId && a.assignedRegion.includes(siteRegionId) ? 1 : 0;
                        const bReg = Array.isArray(b.assignedRegion) && siteRegionId && b.assignedRegion.includes(siteRegionId) ? 1 : 0;
                        if (aReg !== bReg) return bReg - aReg;

                        return 0;
                    });

                    const preferred = preferredCandidates[0];
                    managerOwner = { id: preferred.id, teamId: preferred.teamId, regionIds: [], zoneIds: [] } as any;
                }
            }
        } catch (err) {
            // ignore and keep existing managerOwner
        }

        const assignedToId =
            wo.site?.supervisorStationId ||
            managerOwner?.id ||
            undefined;
        const teamId = assignedToId
            ? teamByUserId.get(assignedToId) || managerOwner?.teamId || undefined
            : undefined;
        if (assignedToId && assignedToId !== wo.assignedToId) {
            await prisma.workOrder.update({
                where: { id: wo.id },
                data: {
                    assignedToId,
                    teamId,
                    status: assignedToId ? "assigned" : undefined,
                },
            });
            updated += 1;
        }
    }

    return NextResponse.json({ updated });
}
