import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

type Bucket = {
    key: string;
    label: string;
    ongoing: number;
    completed: number;
    total: number;
    completionPct: number;
    le3?: number;
    le5?: number;
    gt5?: number;
    w1?: number;
    w2?: number;
    w3?: number;
    w4?: number;
};

type WorkOrderDetail = {
    id: string;
    taskNumber: string | null;
    title: string;
    description: string | null;
    type: string;
    status: string;
    planned: boolean;
    priority: number | null;
    siteName: string;
    siteCode: string | null;
    region: string | null;
    zone: string | null;
    neName: string | null;
    assetTag: string | null;
    assetType: string | null;
    template: string | null;
    checklistScope: string | null;
    scheduledStartAt: Date | null;
    scheduledEndAt: Date | null;
    actualStartAt: Date | null;
    actualEndAt: Date | null;
    completedAt: Date | null;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date | null;
    createdBy: string | null;
    assignedTo: string | null;
    completedBy: string | null;
    team: string | null;
};
function buildWindow(searchParams: URLSearchParams) {
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");
    const now = new Date();
    const start = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const end = endParam ? new Date(endParam) : now;
    return { start, end };
}

export async function GET(req: Request) {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const roleKey = String(session.user.role || "").toLowerCase();
    const isManagerRole = roleKey === 'manager';
    const userId = String(session.user.id);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") === "ongoing" ? "ongoing" : "completed";
    const { start, end } = buildWindow(url.searchParams);
    const includeDetails = url.searchParams.get("includeDetails") === "1";

    const assignedToFilter = url.searchParams.get("assignedToId");
    const statusFilter = url.searchParams.get("status");
    const delayFilter = url.searchParams.get("delay");

    const baseWhere: any = {
        deletedAt: null,
    };
    if (assignedToFilter) {
        baseWhere.assignedToId = assignedToFilter;
    }
    if (statusFilter) {
        // allow special alias 'processing' to mean not completed (maintained by client)
        if (statusFilter === "processing") {
            baseWhere.status = { not: "completed" };
            baseWhere.archived = false;
        } else {
            baseWhere.status = statusFilter;
        }
    }

    // restrict by site region/zone for managers/supervisors
    let visibleSiteIds: string[] | null = null;
    if (roleKey === "manager" || roleKey === "supervisor") {
        const managerUser = await prisma.user.findUnique({ where: { id: userId }, select: { assignedRegion: true, assignedZone: true, locationCategory: true } });
        if (managerUser) {
            const rawRegions: string[] = Array.isArray(managerUser.assignedRegion) ? (managerUser.assignedRegion as string[]) : [];
            const rawZones: string[] = Array.isArray(managerUser.assignedZone) ? (managerUser.assignedZone as string[]) : [];
            const locCat = String(managerUser.locationCategory || "").toLowerCase();
            const isHq = locCat.includes("head quarter") || locCat === "hq";

            const [regions, zones] = await Promise.all([
                prisma.region.findMany({ select: { id: true, name: true } }),
                prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
            ]);
            const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]));
            const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]));

            const regionIds: string[] = [];
            const zoneIds: string[] = [];
            for (const v of rawRegions) {
                const name = String(v).trim();
                const normalized = name.toLowerCase() === "head quarter" || name.toLowerCase() === "hq" ? "caaz" : name.toLowerCase();
                if (regionByName.has(normalized)) regionIds.push(regionByName.get(normalized)!);
            }
            for (const v of rawZones) {
                const nm = String(v).trim();
                if (zoneByName.has(nm.toLowerCase())) zoneIds.push(zoneByName.get(nm.toLowerCase())!);
            }
            if (isHq) {
                const caaz = regionByName.get("caaz");
                if (caaz && !regionIds.includes(caaz)) regionIds.push(caaz);
                zones.filter((z) => String(z.name).toLowerCase().startsWith("hq-")).forEach((z) => {
                    if (!zoneIds.includes(z.id)) zoneIds.push(z.id);
                });
            }

            if (regionIds.length || zoneIds.length) {
                const siteWhere: any = {};
                const orParts: any[] = [];
                if (zoneIds.length) orParts.push({ zoneId: { in: zoneIds } });
                if (regionIds.length) orParts.push({ regionId: { in: regionIds }, zoneId: null });
                if (orParts.length) siteWhere.OR = orParts;
                const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
                visibleSiteIds = areaSites.map((s) => s.id);
            }
            // fallback: if no assignments but user is an AAZ/HQ manager, include all AAZ/HQ sites
            const ar = Array.isArray(managerUser.assignedRegion) ? managerUser.assignedRegion : [];
            const az = Array.isArray(managerUser.assignedZone) ? managerUser.assignedZone : [];
            const locCat2 = String(managerUser.locationCategory || "").toLowerCase();
            const isAazOrHqManager =
                ar.some((r) => /aaz|hq/i.test(String(r))) ||
                az.some((z) => /aaz|hq/i.test(String(z))) ||
                locCat2.includes("head quarter");
            if ((!visibleSiteIds || visibleSiteIds.length === 0) && isAazOrHqManager) {
                try {
                    const hqSites = await prisma.site.findMany({
                        where: {
                            OR: [
                                { region: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                                { zone: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                                { region: { name: { contains: 'Head Quarter', mode: 'insensitive' } } },
                                { zone: { name: { contains: 'HQ', mode: 'insensitive' } } },
                            ],
                        },
                        select: { id: true },
                    });
                    visibleSiteIds = hqSites.map((s) => s.id);
                } catch (e) {
                    console.error('[reports/analysis] AAZ/HQ fallback error', e);
                }
            }
        }
        if (visibleSiteIds && visibleSiteIds.length) {
            baseWhere.siteId = { in: visibleSiteIds };
        }
    }
    if (kind === "completed") {
        baseWhere.AND = [
            {
                OR: [
                    { completedAt: { gte: start, lte: end } },
                    { archivedAt: { gte: start, lte: end } },
                ],
            },
            {
                OR: [
                    { archived: true },
                    { status: "completed" },
                    { completedAt: { not: null } },
                ],
            },
        ];
    } else {
        // ongoing: live view, exclude completed/archived
        baseWhere.archived = false;
        baseWhere.status = { not: "completed" };
        baseWhere.completedAt = null;
    }

    const buckets: Bucket[] = [];
    const details: WorkOrderDetail[] = [];

    const shapeDetail = (wo: any): WorkOrderDetail => ({
        id: wo.id,
        taskNumber: wo.taskNumber,
        title: wo.title,
        description: wo.description,
        type: wo.type,
        status: wo.status,
        planned: Boolean(wo.planned),
        priority: wo.priority,
        siteName: wo.site?.name || "",
        siteCode: wo.site?.siteCode || null,
        // region column reflects handler assignment, not site
        region: wo.assignedTo?.assignedRegion?.[0]
            ? String(wo.assignedTo.assignedRegion[0])
            : wo.assignedTo?.assignedZone?.[0]
            ? "-"
            : null,
        zone: wo.site?.zone?.name || null,
        neName: (wo.site?.neNameAndId as any) || (Array.isArray(wo.site?.allNeNames) ? (wo.site?.allNeNames as any[]).join(", ") : null),
        assetTag: wo.asset?.assetTag || null,
        assetType: wo.asset?.assetType || wo.asset?.model || null,
        template: null,
        checklistScope: wo.checklistScope || null,
        scheduledStartAt: wo.scheduledStartAt,
        scheduledEndAt: wo.scheduledEndAt,
        actualStartAt: wo.actualStartAt,
        actualEndAt: wo.actualEndAt,
        completedAt: wo.completedAt,
        archivedAt: wo.archivedAt,
        createdAt: wo.createdAt,
        updatedAt: wo.updatedAt,
        createdBy: (wo.planned && /auto-?scheduled/i.test(String(wo.description || ''))) ? 'System (auto-scheduler)' : (wo.createdBy?.fullName || null),
        assignedTo: wo.assignedTo?.fullName || null,
        completedBy: wo.completedBy?.fullName || null,
        team: wo.team?.name || null,
    });

    if (roleKey === "admin") {
        let wos = await prisma.workOrder.findMany({
            where: baseWhere,
            include: {
                site: { select: { name: true, siteCode: true, neNameAndId: true, allNeNames: true, region: { select: { id: true, name: true } }, zone: { select: { id: true, name: true } } } },
                asset: { select: { assetTag: true, assetType: true, model: true } },
                assignedTo: { select: { id: true, fullName: true, immediateSupervisorId: true, assignedRegion: true, assignedZone: true, role: { select: { key: true } } } },
                createdBy: { select: { fullName: true } },
                completedBy: { select: { fullName: true } },
                team: { select: { name: true } },
            },
        });
        // strip orders assigned to other managers first (only relevant for managers)
        // if the current user is a manager we apply this filter; using a precomputed
        // boolean avoids narrowing the type of roleKey inside this admin block.
        if (isManagerRole) {
            wos = wos.filter((wo) => {
                const at = wo.assignedTo;
                return !(at?.role?.key === 'manager' && at.id !== userId);
            });
        }
        // apply delay filter server-side if provided
        if (delayFilter) {
            wos = wos.filter((wo) => {
                const st = String(wo.status || "").toLowerCase();
                const isDone = st === "completed" || Boolean(wo.archived);
                const startClock = wo.actualStartAt || wo.createdAt;
                const endClock = isDone
                    ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date())
                    : new Date();
                const days =
                    startClock && endClock
                        ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000
                        : 0;
                if (delayFilter === "le3") return days <= 3;
                if (delayFilter === "le5") return days <= 5;
                if (delayFilter === "gt5") return days > 5;
                return true;
            });
        }
        const map = new Map<string, Bucket>();
        for (const wo of wos) {
            // For certain zones like SAAZ, group by zone instead of region
            const zoneName = wo.site?.zone?.name || "";
            let groupKey = wo.site?.region?.name || "Unassigned Region";
            let groupLabel = groupKey;
            
            if (zoneName.toUpperCase().includes('SAAZ') || zoneName.toUpperCase().includes('AAZ')) {
                groupKey = zoneName;
                groupLabel = zoneName;
            }
            
            if (!map.has(groupKey)) {
                map.set(groupKey, { key: groupKey, label: groupLabel, ongoing: 0, completed: 0, total: 0, completionPct: 0, le3: 0, le5: 0, gt5: 0, w1: 0, w2: 0, w3: 0, w4: 0 });
            }
            const bucket = map.get(groupKey)!;
            const st = String(wo.status || "").toLowerCase();
            const isDone = st === "completed" || Boolean(wo.archived);
            const startClock = wo.actualStartAt || wo.createdAt;
            const endClock = isDone ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date()) : new Date();
            const days = startClock && endClock ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000 : 0;

            // Always include this work order in the bucket total count
            bucket.total += 1;

            if (isDone) {
                bucket.completed += 1;
                const weekIdx = endClock ? Math.min(Math.ceil(new Date(endClock).getDate() / 7), 4) : null;
                if (weekIdx) {
                    const prop = `w${weekIdx}` as "w1" | "w2" | "w3" | "w4";
                    bucket[prop] = (bucket[prop] || 0) + 1;
                }
            } else {
                bucket.ongoing += 1;
            }
            if (days <= 3) bucket.le3 = (bucket.le3 || 0) + 1;
            else if (days <= 5) bucket.le5 = (bucket.le5 || 0) + 1;
            else bucket.gt5 = (bucket.gt5 || 0) + 1;
        }
        for (const b of map.values()) {
            b.completionPct = b.total ? Math.round((b.completed / b.total) * 10000) / 100 : 0;
            buckets.push(b);
        }
        if (includeDetails) {
            for (const wo of wos) details.push(shapeDetail(wo));
        }
    } else if (roleKey === "manager" || roleKey === "admin") {
        // Managers: mirror workorders list scope (teams, direct reports, area sites) and bucket by supervisor (who manages the technician)
        const managerId = userId;
        const teams = await prisma.team.findMany({ where: { managerId }, select: { id: true } });
        const teamIds = teams.map((t) => t.id);
        const directReports = await prisma.user.findMany({ where: { immediateSupervisorId: managerId }, select: { id: true, fullName: true, teamId: true } });
        const directIds = directReports.map((u) => u.id);
        const directTeamIds = directReports.map((u) => u.teamId).filter(Boolean) as string[];

        let siteIds: string[] = [];
        try {
            const managerUser = await prisma.user.findUnique({ where: { id: managerId }, select: { assignedRegion: true, assignedZone: true, locationCategory: true } });
            if (managerUser) {
                const rawRegions: string[] = Array.isArray((managerUser as any).assignedRegion) ? ((managerUser as any).assignedRegion as string[]) : [];
                const rawZones: string[] = Array.isArray((managerUser as any).assignedZone) ? ((managerUser as any).assignedZone as string[]) : [];
                const locCat = String((managerUser as any)?.locationCategory || "").toLowerCase();
                const isHqManager = locCat.includes("head quarter") || locCat === "hq";
                const hasExplicitRegions = rawRegions.length > 0 || isHqManager;
                if (rawRegions.length || rawZones.length || isHqManager) {
                    const [regions, zones] = await Promise.all([
                        prisma.region.findMany({ select: { id: true, name: true } }),
                        prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
                    ]);
                    const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]));
                    const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]));
                    const regionIdSet = new Set(regions.map((r) => r.id));
                    const zoneIdSet = new Set(zones.map((z) => z.id));
                    const regionIds: string[] = [];
                    const zoneIds: string[] = [];
                    for (const v of rawRegions) {
                        const name = String(v).trim();
                        const normalized = name.toLowerCase() === "head quarter" || name.toLowerCase() === "hq" ? "caaz" : name.toLowerCase();
                        if (regionIdSet.has(name)) regionIds.push(name);
                        else if (regionByName.has(normalized)) regionIds.push(regionByName.get(normalized)!);
                    }
                    for (const v of rawZones) {
                        const name = String(v).trim();
                        if (zoneIdSet.has(name)) zoneIds.push(name);
                        else if (zoneByName.has(name.toLowerCase())) zoneIds.push(zoneByName.get(name.toLowerCase())!);
                    }
                    if (isHqManager) {
                        const caazId = regionByName.get("caaz");
                        if (caazId && !regionIds.includes(caazId)) regionIds.push(caazId);
                        zones
                            .filter((z) => String(z.name).toLowerCase().startsWith("hq-"))
                            .forEach((z) => {
                                if (!zoneIds.includes(z.id)) zoneIds.push(z.id);
                            });
                    }
                    if (zoneIds.length && hasExplicitRegions) {
                        for (const z of zones) {
                            if (zoneIds.includes(z.id) && z.regionId && !regionIds.includes(z.regionId)) {
                                regionIds.push(z.regionId);
                            }
                        }
                    }
                    if (regionIds.length || zoneIds.length) {
                        const siteWhere: any = {};
                        const orParts: any[] = [];
                        if (zoneIds.length) orParts.push({ zoneId: { in: zoneIds } });
                        if (hasExplicitRegions && regionIds.length) {
                            orParts.push({ regionId: { in: regionIds }, zoneId: null });
                        }
                        if (orParts.length) siteWhere.OR = orParts;
                        const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
                        siteIds = areaSites.map((s) => s.id);
                    }
                }
            }
        } catch (e) {
            // ignore site resolution errors
        }

        // Restrict manager view to manager's own staff only (direct reports + team members).
        const teamMembers = teamIds.length
            ? await prisma.user.findMany({ where: { teamId: { in: teamIds } }, select: { id: true, fullName: true } })
            : [];
        const teamMemberIds = teamMembers.map((m) => m.id);
        // always include the manager themself so reports cover orders assigned/created by them
        const allowedUserIds = Array.from(new Set([userId, ...directIds, ...teamMemberIds]));

        const where: any = { ...baseWhere };
        const orParts: any[] = [];

        if (siteIds.length) {
            // always include manager's own orders even if site is outside their area
            orParts.push({ assignedToId: userId });
            orParts.push({ createdById: userId });

            // restrict other relevant users to the manager's sites
            if (allowedUserIds.length) {
                orParts.push({ AND: [{ assignedToId: { in: allowedUserIds } }, { siteId: { in: siteIds } }] });
                orParts.push({ AND: [{ createdById: { in: allowedUserIds } }, { siteId: { in: siteIds } }] });
            }
            if (teamIds.length) {
                orParts.push({ AND: [{ teamId: { in: teamIds } }, { siteId: { in: siteIds } }] });
            }
        } else {
            // if manager has no area defined, only include their own orders
            orParts.push({ assignedToId: userId });
            orParts.push({ createdById: userId });
        }

        // If no allowed users or teams found, force empty result to avoid including other managers
        if (orParts.length === 0) {
            where.AND = [...(where.AND || []), { OR: [{ id: '__no_results__' }] }];
        } else {
            where.OR = orParts;
        }

        let wos = await prisma.workOrder.findMany({
            where,
            include: {
                assignedTo: { select: { id: true, fullName: true, immediateSupervisorId: true, assignedRegion: true, assignedZone: true, role: { select: { key: true } } } },
                site: { select: { name: true, siteCode: true, neNameAndId: true, allNeNames: true, region: { select: { name: true } }, zone: { select: { name: true } } } },
                asset: { select: { assetTag: true, assetType: true, model: true } },
                createdBy: { select: { fullName: true } },
                completedBy: { select: { fullName: true } },
                team: { select: { name: true } },
            },
        });
        if (delayFilter) {
            wos = wos.filter((wo) => {
                const st = String(wo.status || "").toLowerCase();
                const isDone = st === "completed" || Boolean(wo.archived);
                const startClock = wo.actualStartAt || wo.createdAt;
                const endClock = isDone
                    ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date())
                    : new Date();
                const days =
                    startClock && endClock
                        ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000
                        : 0;
                if (delayFilter === "le3") return days <= 3;
                if (delayFilter === "le5") return days <= 5;
                if (delayFilter === "gt5") return days > 5;
                return true;
            });
        }
        const map = new Map<string, Bucket>();
        for (const wo of wos) {
            const handlerId = wo.assignedTo?.id || "unassigned";
            const label = wo.assignedTo?.fullName || "Unassigned";
            const key = handlerId;
            if (!map.has(key)) map.set(key, { key, label, ongoing: 0, completed: 0, total: 0, completionPct: 0, le3: 0, le5: 0, gt5: 0, w1: 0, w2: 0, w3: 0, w4: 0 });
            const bucket = map.get(key)!;
            bucket.total += 1;
            const st = String(wo.status || "").toLowerCase();
            const isDone = st === "completed" || Boolean(wo.archived);
            const startClock = wo.actualStartAt || wo.createdAt;
            const endClock = isDone ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date()) : new Date();
            const days = startClock && endClock ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000 : 0;
            if (isDone) {
                bucket.completed += 1;
                const weekIdx = endClock ? Math.min(Math.ceil(new Date(endClock).getDate() / 7), 4) : null;
                if (weekIdx) {
                    const prop = `w${weekIdx}` as "w1" | "w2" | "w3" | "w4";
                    bucket[prop] = (bucket[prop] || 0) + 1;
                }
            } else {
                bucket.ongoing += 1;
            }
            if (days <= 3) bucket.le3 = (bucket.le3 || 0) + 1;
            else if (days <= 5) bucket.le5 = (bucket.le5 || 0) + 1;
            else bucket.gt5 = (bucket.gt5 || 0) + 1;
        }
        for (const b of map.values()) {
            b.completionPct = b.total ? Math.round((b.completed / b.total) * 10000) / 100 : 0;
            buckets.push(b);
        }
        if (includeDetails) {
            for (const wo of wos) details.push(shapeDetail(wo));
        }
    } else if (roleKey === "supervisor") {
        const techs = await prisma.user.findMany({ where: { immediateSupervisorId: userId }, select: { id: true, fullName: true } });
        const techIds = techs.map((t) => t.id);
        const where: any = { ...baseWhere };
        if (techIds.length) where.OR = [{ assignedToId: { in: techIds } }, { assignedToId: userId }];

        let wos = await prisma.workOrder.findMany({
            where,
            include: {
                assignedTo: { select: { id: true, fullName: true, assignedRegion: true, assignedZone: true, role: { select: { key: true } } } },
                site: { select: { name: true, siteCode: true, neNameAndId: true, allNeNames: true, region: { select: { name: true } }, zone: { select: { name: true } } } },
                asset: { select: { assetTag: true, assetType: true, model: true } },
                createdBy: { select: { fullName: true } },
                completedBy: { select: { fullName: true } },
                team: { select: { name: true } },
            },
        });
        if (delayFilter) {
            wos = wos.filter((wo) => {
                const st = String(wo.status || "").toLowerCase();
                const isDone = st === "completed" || Boolean(wo.archived);
                const startClock = wo.actualStartAt || wo.createdAt;
                const endClock = isDone
                    ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date())
                    : new Date();
                const days =
                    startClock && endClock
                        ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000
                        : 0;
                if (delayFilter === "le3") return days <= 3;
                if (delayFilter === "le5") return days <= 5;
                if (delayFilter === "gt5") return days > 5;
                return true;
            });
        }
        if (delayFilter) {
            wos = wos.filter((wo) => {
                const st = String(wo.status || "").toLowerCase();
                const isDone = st === "completed" || Boolean(wo.archived);
                const startClock = wo.actualStartAt || wo.createdAt;
                const endClock = isDone
                    ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date())
                    : new Date();
                const days =
                    startClock && endClock
                        ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000
                        : 0;
                if (delayFilter === "le3") return days <= 3;
                if (delayFilter === "le5") return days <= 5;
                if (delayFilter === "gt5") return days > 5;
                return true;
            });
        }
        const map = new Map<string, Bucket>();
        const techName = Object.fromEntries(techs.map((t) => [t.id, t.fullName || "Technician"]));
        for (const wo of wos) {
            const techId = wo.assignedToId || userId || "unassigned";
            const label = techName[techId] || wo.assignedTo?.fullName || "Unassigned";
            if (!map.has(techId)) map.set(techId, { key: techId, label, ongoing: 0, completed: 0, total: 0, completionPct: 0, le3: 0, le5: 0, gt5: 0, w1: 0, w2: 0, w3: 0, w4: 0 });
            const bucket = map.get(techId)!;
            bucket.total += 1;
            const st = String(wo.status || "").toLowerCase();
            const isDone = st === "completed" || Boolean(wo.archived);
            const startClock = wo.actualStartAt || wo.createdAt;
            const endClock = isDone ? (wo.completedAt || wo.archivedAt || wo.updatedAt || new Date()) : new Date();
            const days = startClock && endClock ? (new Date(endClock).getTime() - new Date(startClock).getTime()) / 86400000 : 0;
            if (isDone) {
                bucket.completed += 1;
                const weekIdx = endClock ? Math.min(Math.ceil(new Date(endClock).getDate() / 7), 4) : null;
                if (weekIdx) {
                    const prop = `w${weekIdx}` as "w1" | "w2" | "w3" | "w4";
                    bucket[prop] = (bucket[prop] || 0) + 1;
                }
            } else {
                bucket.ongoing += 1;
            }
            if (days <= 3) bucket.le3 = (bucket.le3 || 0) + 1;
            else if (days <= 5) bucket.le5 = (bucket.le5 || 0) + 1;
            else bucket.gt5 = (bucket.gt5 || 0) + 1;
        }
        for (const b of map.values()) {
            b.completionPct = b.total ? Math.round((b.completed / b.total) * 10000) / 100 : 0;
            buckets.push(b);
        }
        if (includeDetails) {
            for (const wo of wos) details.push(shapeDetail(wo));
        }
    } else {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    buckets.sort((a, b) => b.completionPct - a.completionPct || b.total - a.total);

    return NextResponse.json({ buckets, window: { start, end }, details: includeDetails ? details : undefined });
}