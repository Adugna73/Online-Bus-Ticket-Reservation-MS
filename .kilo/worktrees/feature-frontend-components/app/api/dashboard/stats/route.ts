import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isDevBypass = process.env.NODE_ENV === 'development' && url.searchParams.get('dev') === '1';

  // Optional dashboard filters (drives dynamic KPIs and "Sites Visited (Top)")
  const yearParam = url.searchParams.get('year');
  const monthParam = url.searchParams.get('month');
  const weekParam = url.searchParams.get('week');
  const statusesParam = url.searchParams.get('statuses');
  const frequenciesParam = url.searchParams.get('frequencies');

  const selectedYear = yearParam ? Number(yearParam) : null;
  const selectedMonth = monthParam !== null && monthParam !== undefined && monthParam !== '' ? Number(monthParam) : null;
  const selectedWeek = weekParam !== null && weekParam !== undefined && weekParam !== '' ? Number(weekParam) : null;
  const selectedStatuses = new Set(
    (statusesParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const selectedFrequencies = new Set(
    (frequenciesParam || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const hasValidYear = Number.isFinite(selectedYear as any) && !!selectedYear && selectedYear >= 1970 && selectedYear <= 2100;
  const hasValidMonth = Number.isFinite(selectedMonth as any) && selectedMonth !== null && selectedMonth >= 0 && selectedMonth <= 11;
  const hasValidWeek = Number.isFinite(selectedWeek as any) && selectedWeek !== null && selectedWeek >= 1 && selectedWeek <= 4;

  let session = null as any;
  if (!isDevBypass) {
    session = (await getServerSession(authOptions as any)) as { user?: { id?: string } } | null;
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let userId: string | null = null;
  let user: any = null;
  if (isDevBypass) {
    // In development, allow a debug fetch to see payloads: allow selecting a user by query
    const devEmail = url.searchParams.get('devUserEmail');
    const devName = url.searchParams.get('devUserName');
    const devId = url.searchParams.get('devUserId');
    if (devId) {
      user = await prisma.user.findUnique({ where: { id: devId }, include: { role: true } });
    } else if (devEmail) {
      user = await prisma.user.findUnique({ where: { email: devEmail }, include: { role: true } });
    } else if (devName) {
      user = await prisma.user.findFirst({ where: { fullName: devName }, include: { role: true } });
    } else {
      // fallback: pick the first user as scope
      user = await prisma.user.findFirst({ include: { role: true } });
    }
    if (!user) return NextResponse.json({ error: 'no-users' }, { status: 500 });
    userId = user.id;
  } else {
    userId = String(session.user.id);
    user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const roleKey = (user.role?.key || '').toLowerCase();
  let regionIds = (user.assignedRegion || []) as string[];
  let zoneIds = (user.assignedZone || []) as string[];
  let managerSiteIds: string[] = [];

  // Build a base filter depending on role
  const baseOr: any[] = [];
  let teams: any[] = [];
  let subordinateCount = 0;
  let subordinateIds: string[] = [];
  let supervisorAreaRegions: Array<{ id: string; name: string }> = [];
  let supervisorAreaZones: Array<{ id: string; name: string }> = [];
  let managerScopeRegions: Array<{ id: string; name: string }> = [];
  let managerScopeZones: Array<{ id: string; name: string }> = [];
  // Keep track of team ids that define this manager/supervisor's scope so we can
  // reuse them later when computing technician lists, even when no work orders exist.
  let teamIdsForScope: string[] = [];

  // Admins should see a full-system picture with no work-order scoping.
  if (roleKey === 'admin') {
    // Intentionally leave baseOr empty so baseFilter becomes {} later.
  } else if (roleKey === 'manager') {
    // Manager geographic scope: assignedRegion/assignedZone may be stored as
    // either IDs or human-readable names. Normalize them to Region/Zone IDs
    // so downstream scoping (sites, work orders) is consistent.
    try {
      const rawRegions: string[] = Array.isArray(user?.assignedRegion) ? user.assignedRegion : [];
      const rawZones: string[] = Array.isArray(user?.assignedZone) ? user.assignedZone : [];
      const locCat = String((user as any)?.locationCategory || '').toLowerCase();
      const isHqManager = locCat.includes('head quarter') || locCat === 'hq';
      if (rawRegions.length || rawZones.length || isHqManager) {
        const [regions, zones] = await Promise.all([
          prisma.region.findMany({ select: { id: true, name: true } }),
          prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
        ]);
        const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]));
        const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]));
        const regionNameById = new Map(regions.map((r) => [r.id, r.name] as [string, string]));
        const zoneNameById = new Map(zones.map((z) => [z.id, z.name] as [string, string]));

        const resolvedRegionIds: string[] = [];
        const resolvedZoneIds: string[] = [];
        for (const v of rawRegions) {
          const val = String(v).trim();
          const lower = val.toLowerCase();
          // If value already matches a Region ID, keep it as-is.
          const byId = regions.find((r) => r.id === val);
          if (byId) {
            resolvedRegionIds.push(byId.id);
            continue;
          }
          // Otherwise treat it as a name/short code.
          const normalized = lower === 'head quarter' || lower === 'hq' ? 'caaz' : lower;
          if (regionByName.has(normalized)) resolvedRegionIds.push(regionByName.get(normalized)!);
        }
        for (const v of rawZones) {
          const nm = String(v).trim();
          const lower = nm.toLowerCase();
          // If value already matches a Zone ID, keep it as-is.
          const byId = zones.find((z) => z.id === nm);
          if (byId) {
            resolvedZoneIds.push(byId.id);
            continue;
          }
          // Otherwise treat it as a name.
          if (zoneByName.has(lower)) resolvedZoneIds.push(zoneByName.get(lower)!);
        }

        if (isHqManager) {
          const caazId = regionByName.get('caaz');
          const aazId = regionByName.get('aaz');
          if (caazId && !resolvedRegionIds.includes(caazId)) resolvedRegionIds.push(caazId);
          if (aazId && !resolvedRegionIds.includes(aazId)) resolvedRegionIds.push(aazId);
          zones
            .filter((z) => {
              const zn = String(z.name).toLowerCase();
              return zn.startsWith('hq-') || zn.includes('aaz');
            })
            .forEach((z) => {
              if (!resolvedZoneIds.includes(z.id)) resolvedZoneIds.push(z.id);
            });
        }

        managerScopeRegions = Array.from(new Set(resolvedRegionIds)).map((id) => ({ id, name: regionNameById.get(id) || id }));
        managerScopeZones = Array.from(new Set(resolvedZoneIds)).map((id) => ({ id, name: zoneNameById.get(id) || id }));

        // Replace raw assignedRegion/assignedZone with resolved IDs for downstream scoping
        regionIds = Array.from(new Set(resolvedRegionIds));
        zoneIds = Array.from(new Set(resolvedZoneIds));

        if (resolvedRegionIds.length || resolvedZoneIds.length) {
          const siteWhere: any = {};
          const orParts: any[] = [];
          if (resolvedZoneIds.length) orParts.push({ zoneId: { in: resolvedZoneIds } });
          if (resolvedRegionIds.length) orParts.push({ regionId: { in: resolvedRegionIds }, zoneId: null });
          if (orParts.length) siteWhere.OR = orParts;
          const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
          managerSiteIds = areaSites.map((s) => s.id).filter(Boolean) as string[];
          // Include site-based scoping for managers, but also include AAZ/HQ sites for all managers
          if (managerSiteIds.length) baseOr.push({ siteId: { in: managerSiteIds } });
          
          // Include AAZ/HQ sites that are within the manager's assigned regions/zones
          try {
            const hqSiteWhere: any = {
              OR: [
                { region: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                { zone: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                { region: { name: { contains: 'Head Quarter', mode: 'insensitive' } } },
                { zone: { name: { contains: 'HQ', mode: 'insensitive' } } }
              ]
            };
            
            // Only include AAZ/HQ sites that are in the manager's assigned areas
            const hqAreaFilter: any = {};
            const hqOrParts: any[] = [];
            if (resolvedZoneIds.length) hqOrParts.push({ zoneId: { in: resolvedZoneIds } });
            if (resolvedRegionIds.length) hqOrParts.push({ regionId: { in: resolvedRegionIds }, zoneId: null });
            if (hqOrParts.length) hqAreaFilter.OR = hqOrParts;
            
            const hqSites = await prisma.site.findMany({ 
              where: {
                AND: [
                  hqSiteWhere,
                  hqAreaFilter
                ]
              }, 
              select: { id: true } 
            });
            const hqSiteIds = hqSites.map((s) => s.id).filter(Boolean) as string[];
            if (hqSiteIds.length) baseOr.push({ siteId: { in: hqSiteIds } });
          } catch (err) {
            console.error('[dashboard/stats] HQ/AAZ site scoping error', err);
          }
        }
        // if no explicit site ids but user is AAZ/HQ manager, take all AAZ/HQ
        if (managerSiteIds.length === 0 && roleKey === 'manager') {
          const ar = Array.isArray(user.assignedRegion) ? user.assignedRegion : [];
          const az = Array.isArray(user.assignedZone) ? user.assignedZone : [];
          const locCat = String(user.locationCategory || '').toLowerCase();
          const isAazOrHqManager =
            ar.some((r:any)=>/aaz|hq/i.test(String(r))) ||
            az.some((z:any)=>/aaz|hq/i.test(String(z))) ||
            locCat.includes('head quarter');
          if (isAazOrHqManager) {
            try {
              const hqSites = await prisma.site.findMany({
                where: {
                  OR: [
                    { region: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                    { zone: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                    { region: { name: { contains: 'Head Quarter', mode: 'insensitive' } } },
                    { zone: { name: { contains: 'HQ', mode: 'insensitive' } } }
                  ],
                },
                select: { id: true },
              });
              const hqIds = hqSites.map((s) => s.id);
              if (hqIds.length) baseOr.push({ siteId: { in: hqIds } });
            } catch (e) {
              console.error('[dashboard/stats] AAZ/HQ fallback error', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('[dashboard/stats] manager area scope resolution error', err);
    }

    const mgrTeams = await prisma.team.findMany({ where: { managerId: user.id }, include: { members: true } });
    teams = mgrTeams;
    if (mgrTeams.length && managerSiteIds.length) {
      const ids = mgrTeams.map((t) => t.id);
      teamIdsForScope = ids;
      // Only include work orders where team is managed AND site is in assigned areas
      baseOr.push({
        AND: [
          { teamId: { in: ids } },
          { siteId: { in: managerSiteIds } }
        ]
      });
    }

    // All work orders created by supervisors who report to this manager (within their sites)
    const subordinates = await prisma.user.findMany({
      where: { immediateSupervisorId: user.id },
      select: { id: true },
    });
    subordinateIds = subordinates.map((s) => s.id);
    if (subordinateIds.length && managerSiteIds.length) {
      baseOr.push({
        AND: [
          { createdById: { in: subordinateIds } },
          { siteId: { in: managerSiteIds } }
        ]
      });
    }

    subordinateCount = await prisma.user.count({ where: { immediateSupervisorId: user.id } });
  } else if (roleKey === 'supervisor') {
    // Prefer the user's teamId (single team membership) otherwise teams they manage
    let teamIds: string[] = [];
    if (user.teamId) {
      teamIds = [user.teamId];
      teams = await prisma.team.findMany({ where: { id: user.teamId }, include: { members: true } });
    } else {
      const mgrTeams = await prisma.team.findMany({ where: { managerId: user.id }, include: { members: true } });
      teams = mgrTeams;
      teamIds = mgrTeams.map((t) => t.id);
    }

    // Assigned area is display-only for supervisors; handled work is assignment-based.
    // Normalize assignedRegion/assignedZone so they can be stored as IDs or names
    // (mirroring /api/sites scoping) and expose friendly names in the payload.
    try {
      const [regions, zones] = await Promise.all([
        prisma.region.findMany({ select: { id: true, name: true } }),
        prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
      ]);

      const regionNameById = new Map(regions.map((r) => [r.id, r.name] as [string, string]));
      const zoneNameById = new Map(zones.map((z) => [z.id, z.name] as [string, string]));

      const normalizedRegionIds: string[] = [];
      const normalizedZoneIds: string[] = [];

      const matchRegionId = (raw: any): string | undefined => {
        if (!raw) return undefined;
        const v = String(raw).trim();
        const lower = v.toLowerCase();
        const byId = regions.find((r) => r.id === v);
        if (byId) return byId.id;
        const byName = regions.find((r) => r.name.toLowerCase() === lower);
        return byName?.id;
      };

      const matchZoneId = (raw: any): string | undefined => {
        if (!raw) return undefined;
        const v = String(raw).trim();
        const lower = v.toLowerCase();
        const byId = zones.find((z) => z.id === v);
        if (byId) return byId.id;
        const byName = zones.find((z) => z.name.toLowerCase() === lower);
        return byName?.id;
      };

      const rawRegions: string[] = Array.isArray(user?.assignedRegion) ? user.assignedRegion : [];
      const rawZones: string[] = Array.isArray(user?.assignedZone) ? user.assignedZone : [];

      for (const r of rawRegions) {
        const id = matchRegionId(r);
        if (id) normalizedRegionIds.push(id);
      }
      for (const z of rawZones) {
        const id = matchZoneId(z);
        if (id) normalizedZoneIds.push(id);
      }

      if (normalizedRegionIds.length || normalizedZoneIds.length) {
        regionIds = Array.from(new Set(normalizedRegionIds));
        zoneIds = Array.from(new Set(normalizedZoneIds));
      }

      if (regionIds.length) {
        supervisorAreaRegions = (regionIds as string[]).map((id) => ({ id, name: regionNameById.get(id) || id }));
      }
      if (zoneIds.length) {
        supervisorAreaZones = (zoneIds as string[]).map((id) => ({ id, name: zoneNameById.get(id) || id }));
      }
    } catch (err) {
      console.error('[dashboard/stats] supervisor area normalization error', err);
    }

    // If no teams found in DB, attempt supervisors.json fallback to derive supervised users -> teamIds or emails
    if (teamIds.length === 0) {
      try {
        // Try multiple possible fallback files in order of preference.
        const candidates = [
          path.join(process.cwd(), 'supervisors.json'),
          path.join(process.cwd(), 'supervisors.normalized.json'),
          path.join(process.cwd(), 'data', 'supervisors.master.json'),
          path.join(process.cwd(), 'data', 'supervisors.json'),
        ];

        let raw: string | null = null;
        let usedPath: string | null = null;
        for (const c of candidates) {
          try {
            raw = await fs.readFile(c, 'utf-8');
            usedPath = c;
            break;
          } catch (e) {
            // continue to next candidate
          }
        }

        if (!raw) {
          // No fallback file found; skip derived teamIds
          // Log a single warning to aid debugging without noisy stack traces
          console.warn('[dashboard/stats] no supervisors fallback file found, looked at:', candidates);
        } else {
          if (usedPath) console.info('[dashboard/stats] using supervisors fallback file:', usedPath);
          const list = JSON.parse(raw) as Array<any>;
          const managerFullName = user.fullName;
          const emails = list
            .filter(
              (r) =>
                r['Immediate Supervisor'] &&
                typeof r['Immediate Supervisor'] === 'string' &&
                r['Immediate Supervisor'].trim() === String(managerFullName).trim()
            )
            .map((r) => r['Email'])
            .filter(Boolean);
          if (emails.length > 0) {
            const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { teamId: true } });
            const derived = users.map((u) => u.teamId).filter(Boolean) as string[];
            if (derived.length > 0) {
              teamIds = derived;
              teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, include: { members: true } });
              // supervisors: include assignments to supervised technicians only
              baseOr.push({ assignedTo: { email: { in: emails } } });
            } else {
              baseOr.push({ assignedTo: { email: { in: emails } } });
            }
          }
        }
      } catch (err) {
        console.error('[dashboard/stats] supervisors.json fallback error', err);
      }
    }

    if (teamIds.length > 0) {
      teamIdsForScope = teamIds;
    }

    // Supervisors should see only work orders that are assigned to
    // them or to their direct-report technicians.
    baseOr.push({ assignedToId: user.id });
    const directReports = await prisma.user.findMany({
      where: { immediateSupervisorId: user.id },
      select: { id: true },
    });
    const directIds = directReports.map((s) => s.id);
    if (directIds.length) {
      baseOr.push({ assignedToId: { in: directIds } });
    }

    subordinateCount = directIds.length;
  } else {
    // Technicians and others: show work orders completed by them (per requirement)
    baseOr.push({ completedById: user.id });
    baseOr.push({ assignedToId: user.id });
    baseOr.push({ createdById: user.id });
  }

  // Expand manager/supervisor scope to include work orders related to team members
  try {
    const teamIdsScoped = teamIdsForScope.length
      ? teamIdsForScope
      : teams && teams.length
      ? teams.map((t) => t.id)
      : [];
    if (teamIdsScoped.length) {
      const members = await prisma.user.findMany({ where: { teamId: { in: teamIdsScoped } }, select: { id: true } });
      const memberIds = members.map((m) => m.id).filter(Boolean);
      if (memberIds.length) {
        if (roleKey === 'manager') {
          baseOr.push({ assignedToId: { in: memberIds } });
          baseOr.push({ createdById: { in: memberIds } });
          baseOr.push({ completedById: { in: memberIds } });
        } else if (roleKey === 'supervisor') {
          // For supervisors, only widen scope to include work orders
          // assigned to team members (technicians), not those merely
          // created by them.
          baseOr.push({ assignedToId: { in: memberIds } });
        } else if (roleKey === 'technician') {
          // For technicians, include work orders assigned to team members
          baseOr.push({ assignedToId: { in: memberIds } });
        } else {
          baseOr.push({ assignedToId: { in: memberIds } });
          baseOr.push({ createdById: { in: memberIds } });
          baseOr.push({ completedById: { in: memberIds } });
        }
      }
    }
  } catch (err) {
    console.error('[dashboard/stats] expanding team member scope error', err);
  }

  // Always include work orders created by or assigned to the current user
  // For managers with an assigned area, restrict "createdBy" to the manager's sites
  if (roleKey === 'manager' && managerSiteIds.length) {
    baseOr.push({ AND: [{ createdById: user.id }, { siteId: { in: managerSiteIds } }] });
  } else {
    baseOr.push({ createdById: user.id });
  }
  baseOr.push({ assignedToId: user.id });

  // If nothing else was added to the filter (e.g., manager without scope), that's still fine.
  // For admins, we override this below to keep baseOr empty so they see system-wide statistics.
  if (roleKey === 'admin') {
    baseOr.length = 0; // Clear for admins
  }

  const baseFilter = baseOr.length ? { OR: baseOr } : {};
  const allFilter = { ...baseFilter };
  // Active filter excludes archived (deleted/retired) work orders so dashboard
  // metrics do not count items that were removed from circulation.
  const activeFilter = { ...baseFilter, archived: false };

  // Apply optional time/status/frequency filters on top of the role-based filter.
  // These filters must affect KPIs and site visit summaries.
  const timeWindowOr: any[] = [];
  if (hasValidYear) {
    let start = hasValidMonth
      ? new Date(Date.UTC(selectedYear as number, selectedMonth as number, 1, 0, 0, 0))
      : new Date(Date.UTC(selectedYear as number, 0, 1, 0, 0, 0));
    let end = hasValidMonth
      ? new Date(Date.UTC(selectedYear as number, (selectedMonth as number) + 1, 1, 0, 0, 0))
      : new Date(Date.UTC((selectedYear as number) + 1, 0, 1, 0, 0, 0));

    // Optional month week buckets (W1=days 1-7, W2=8-14, W3=15-21, W4=22-end)
    if (hasValidMonth && hasValidWeek) {
      const monthStart = new Date(Date.UTC(selectedYear as number, selectedMonth as number, 1, 0, 0, 0));
      const monthEnd = new Date(Date.UTC(selectedYear as number, (selectedMonth as number) + 1, 1, 0, 0, 0));
      const weekStartDay = (selectedWeek as number) === 1 ? 1 : (selectedWeek as number) === 2 ? 8 : (selectedWeek as number) === 3 ? 15 : 22;
      const weekStart = new Date(Date.UTC(selectedYear as number, selectedMonth as number, weekStartDay, 0, 0, 0));
      const weekEnd = (selectedWeek as number) === 4
        ? monthEnd
        : new Date(Date.UTC(selectedYear as number, selectedMonth as number, weekStartDay + 7, 0, 0, 0));
      start = weekStart < monthStart ? monthStart : weekStart;
      end = weekEnd > monthEnd ? monthEnd : weekEnd;
    }

    // Filter by scheduled date when present (planned/auto-scheduled work orders).
    // Fall back to createdAt only when the work order has no scheduledStartAt.
    // This ensures selecting 2025/Jan shows work orders scheduled for that window even if they were created later.
    timeWindowOr.push({ scheduledStartAt: { gte: start, lt: end } });
    timeWindowOr.push({ scheduledStartAt: null, createdAt: { gte: start, lt: end } });
  }
  const timeFilter = timeWindowOr.length ? { OR: timeWindowOr } : {};

  // Status filter (supports UI alias: "scheduled" => planned work orders)
  const statusOr: any[] = [];
  if (selectedStatuses.size) {
    const statusValues = Array.from(selectedStatuses)
      .map((s) => s.replace(/\s+/g, '_'))
      .filter(Boolean);
    const wantsScheduled = statusValues.includes('scheduled');
    const concreteStatuses = statusValues.filter((s) => s !== 'scheduled');
    if (concreteStatuses.length) statusOr.push({ status: { in: concreteStatuses } });
    if (wantsScheduled) statusOr.push({ planned: true });
  }
  const statusFilter = statusOr.length ? { OR: statusOr } : {};

  // Frequency filter (disabled - templates not in database)
  const frequencyFilter = {}; // Templates not seeded into database

  // IMPORTANT: don't spread OR filters into one object (OR keys overwrite each other).
  // Instead, combine optional filters via AND so time/status/frequency all apply.
  const scopedAnd: any[] = [];
  if (timeWindowOr.length) scopedAnd.push({ OR: timeWindowOr });
  if (statusOr.length) scopedAnd.push({ OR: statusOr });

  const scopedActiveFilter = scopedAnd.length
    ? { ...activeFilter, AND: scopedAnd }
    : activeFilter;
  const scopedAllFilter = scopedAnd.length
    ? { ...allFilter, AND: scopedAnd }
    : allFilter;
  const scopedArchivedFilter = scopedAnd.length
    ? { ...baseFilter, archived: true, AND: scopedAnd }
    : { ...baseFilter, archived: true };

  // Basic metrics (scoped by baseFilter)
  const totalWorkOrders = await prisma.workOrder.count({ where: scopedActiveFilter });
  const plannedCount = await prisma.workOrder.count({ where: { ...scopedActiveFilter, planned: true } });
  const unplannedCount = await prisma.workOrder.count({ where: { ...scopedActiveFilter, planned: false } });

  // Status-specific counts to drive dashboard task cards
  const createdCount = await prisma.workOrder.count({ where: { ...scopedActiveFilter, status: 'created' } });
  const assignedCount = await prisma.workOrder.count({ where: { ...scopedActiveFilter, status: 'assigned' } });
  const inProgressCount = await prisma.workOrder.count({ where: { ...scopedActiveFilter, status: 'in_progress' } });
  const completedCount = await prisma.workOrder.count({ where: { ...scopedActiveFilter, status: 'completed' } });

  const archivedTotalWorkOrders = await prisma.workOrder.count({ where: scopedArchivedFilter });
  const archivedPlannedCount = await prisma.workOrder.count({ where: { ...scopedArchivedFilter, planned: true } });
  const archivedCompletedCount = await prisma.workOrder.count({ where: { ...scopedArchivedFilter, status: 'completed' } });

  const archivedComparison = {
    ongoing: {
      total: totalWorkOrders,
      scheduled: plannedCount,
      completed: completedCount,
    },
    archived: {
      total: archivedTotalWorkOrders,
      scheduled: archivedPlannedCount,
      completed: archivedCompletedCount,
    },
  };

  // Compute completed-on-time vs delayed (completed within 3 days of scheduled end/start/reference)
  let completedOnTimeCount = 0;
  let delayedCount = 0;
  try {
    const completedWOs = await prisma.workOrder.findMany({
      where: { ...scopedActiveFilter, status: 'completed' },
      select: { id: true, scheduledEndAt: true, scheduledStartAt: true, createdAt: true, completedAt: true },
    });
    for (const wo of completedWOs) {
      if (!wo.completedAt) continue;
      const refDate = wo.scheduledEndAt || wo.scheduledStartAt || wo.createdAt;
      if (!refDate) {
        // If no schedule info, treat as on-time if completedAt exists (conservative)
        completedOnTimeCount++;
        continue;
      }
      const diffMs = new Date(wo.completedAt).getTime() - new Date(refDate).getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 3) completedOnTimeCount++; else delayedCount++;
    }
  } catch (err) {
    console.error('[dashboard/stats] completed on-time calc error', err);
    completedOnTimeCount = 0;
    delayedCount = 0;
  }


  // Director: show region-level counts
  let regionStats: any = null;
  if (user.role?.key === 'Director') {
    // assume assignedRegion contains region ID(s)
    if (user.assignedRegion && user.assignedRegion.length) {
      const regionId = user.assignedRegion[0];
      const teamIds = (await prisma.team.findMany({ where: { /* regionId: regionId */ } })).map((t) => t.id);
      regionStats = {
        workOrders: await prisma.workOrder.count({ where: { teamId: { in: teamIds } } }),
      };
    }
  }

  // Add per-team work order counts and recent work orders if teams were found
  const teamCounts = [] as any[];
  const recentWorkOrders = [] as any[];
  if (teams.length) {
    for (const t of teams) {
      const count = await prisma.workOrder.count({ where: { ...scopedActiveFilter, teamId: t.id } });
      teamCounts.push({ teamId: t.id, teamName: t.name, workOrderCount: count });
    }
  }
  // recent work orders should be scoped by activeFilter as well
  const rawRecentWorkOrders = await prisma.workOrder.findMany({ 
    where: scopedActiveFilter,
    orderBy: { createdAt: 'desc' }, 
    take: 5,
    include: {
      site: { select: { id: true, name: true, siteCode: true } },
      team: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, fullName: true, username: true, email: true } },
      createdBy: { select: { id: true, fullName: true, username: true, email: true } },
      parts: { include: { part: true } },
      attachments: { select: { id: true, estimatedCost: true, actualCost: true } }
    }
  });
  recentWorkOrders.push(...rawRecentWorkOrders.map(wo => ({
    ...wo,
    isAutoCreated: /^Auto-scheduled PM task/.test(wo.description || ''),
  })));

  // Provide lists of work orders grouped by status for the dashboard UI.
  // Limit per-status fetch to a reasonable cap to avoid huge payloads.
  const STATUS_LIST_LIMIT = 200;
  const statuses = ['created', 'assigned', 'in_progress', 'completed'];
  const workOrdersByStatus: Record<string, any[]> = {};
  for (const st of statuses) {
    try {
      const rawWorkOrders = await prisma.workOrder.findMany({
        where: { ...scopedActiveFilter, status: st },
        orderBy: { createdAt: 'desc' },
        take: STATUS_LIST_LIMIT,
          include: {
            site: { select: { id: true, name: true, siteCode: true } },
            team: { select: { id: true, name: true } },
            assignedTo: { select: { id: true, fullName: true, username: true, email: true } },
            createdBy: { select: { id: true, fullName: true, username: true, email: true } },
            parts: { include: { part: true } },
            attachments: { select: { id: true, estimatedCost: true, actualCost: true } }
          }
      });
      workOrdersByStatus[st] = rawWorkOrders.map(wo => ({
        ...wo,
        isAutoCreated: /^Auto-scheduled PM task/.test(wo.description || ''),
      }));
    } catch (err) {
      console.error('[dashboard/stats] error fetching status list', st, err);
      workOrdersByStatus[st] = [];
    }
  }

  // Add frequency buckets (daily/weekly/monthly/quarterly/yearly) derived from template interval when available.
  const frequencyBuckets: Record<string, any[]> = { daily: [], monthly: [], weekly: [], quarterly: [], yearly: [] };
  try {
    const freqWOs = await prisma.workOrder.findMany({
      // exclude archived/deleted so frequency buckets match the active totals
      where: { ...scopedActiveFilter },
      take: 1000,
      include: {
        site: true,
        team: true,
        assignedTo: true,
        createdBy: true,
        parts: { include: { part: true } },
        attachments: { select: { id: true, estimatedCost: true, actualCost: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const wo of freqWOs) {
      // default: attempt to classify by template interval
      const tmpl = (wo as any).template;
      let placed = false;
      if (tmpl && tmpl.intervalType === 'time-based' && typeof tmpl.intervalValue === 'number') {
        const v = tmpl.intervalValue;
        if (v <= 1) {
          frequencyBuckets.daily.push(wo);
          placed = true;
        } else if (v <= 7) {
          frequencyBuckets.weekly.push(wo);
          placed = true;
        } else if (v <= 31) {
          frequencyBuckets.monthly.push(wo);
          placed = true;
        } else if (v <= 120) {
          frequencyBuckets.quarterly.push(wo);
          placed = true;
        } else if (v >= 365) {
          frequencyBuckets.yearly.push(wo);
          placed = true;
        }
      }
      if (!placed) {
        // fallback: use scheduledStartAt spacing heuristic
        if (wo.scheduledStartAt) {
          const s = new Date(wo.scheduledStartAt).getTime();
          const e = wo.scheduledEndAt ? new Date(wo.scheduledEndAt).getTime() : s;
          const diffDays = Math.max(1, Math.round(Math.abs(e - s) / (1000 * 60 * 60 * 24)));
          if (diffDays <= 1) frequencyBuckets.daily.push(wo);
          else if (diffDays <= 7) frequencyBuckets.weekly.push(wo);
          else if (diffDays <= 31) frequencyBuckets.monthly.push(wo);
          else if (diffDays <= 120) frequencyBuckets.quarterly.push(wo);
          else frequencyBuckets.yearly.push(wo);
        } else {
          // put unclassified into monthly as a safe default
          frequencyBuckets.monthly.push(wo);
        }
      }
    }
  } catch (err) {
    console.error('[dashboard/stats] frequency bucket error', err);
  }

  // merge frequency buckets into workOrdersByStatus so frontend can read lists.monthly etc.
  workOrdersByStatus.daily = frequencyBuckets.daily;
  workOrdersByStatus.monthly = frequencyBuckets.monthly;
  workOrdersByStatus.weekly = frequencyBuckets.weekly;
  workOrdersByStatus.quarterly = frequencyBuckets.quarterly;
  workOrdersByStatus.yearly = frequencyBuckets.yearly;

  // Server-side monthly cost series (default: last 6 months; if year selected: 12 months)
  const monthlyCostSeries: Array<{ month: string; cost: number }> = [];
  try {
    const months: { start: Date; end: Date; label: string }[] = [];
    const now = new Date();
    const monthLabel = (d: Date) => d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
    if (hasValidYear) {
      for (let m = 0; m < 12; m++) {
        const dt = new Date(Date.UTC(selectedYear as number, m, 1));
        months.push({
          start: new Date(Date.UTC(selectedYear as number, m, 1)),
          end: new Date(Date.UTC(selectedYear as number, m + 1, 1)),
          label: monthLabel(dt),
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ start: new Date(dt.getFullYear(), dt.getMonth(), 1), end: new Date(dt.getFullYear(), dt.getMonth() + 1, 1), label: monthLabel(dt) });
      }
    }

    for (const m of months) {
      // fetch work orders in month in scope
      const wos = await prisma.workOrder.findMany({
        where: { ...scopedActiveFilter, scheduledStartAt: { gte: m.start, lt: m.end } },
        include: { attachments: { select: { actualCost: true, estimatedCost: true } }, parts: { include: { part: true } } },
      });
      let cost = 0;
      for (const wo of wos) {
        for (const a of wo.attachments || []) cost += Number(a.actualCost || a.estimatedCost || 0);
        for (const p of wo.parts || []) cost += (p.part?.unitCost || 0) * (p.quantity || 0);
      }
      monthlyCostSeries.push({ month: m.label, cost: Math.round(cost) });
    }
  } catch (err) {
    console.error('[dashboard/stats] monthly cost aggregation error', err);
  }

  // Server-side overdue by checklist type aggregation
  let overdueByTypeServer: Array<{ name: string; overdue: number; total: number; overduePct: number }> = [];
  try {
    const allScoped = await prisma.workOrder.findMany({ where: { ...scopedActiveFilter } });

    // normalize checklist/template content into canonical categories for the UI
    const normalizeChecklistCategory = (ctRaw: any, templateName?: string) => {
      try {
        let text = '';
        if (ctRaw) {
          if (typeof ctRaw === 'string') text = ctRaw;
          else if (typeof ctRaw === 'object') text = JSON.stringify(ctRaw);
        }
        if (!text && templateName) text = String(templateName);
        text = String(text || '').toLowerCase();

        const hasRoom = /\b(room|environment|env|space|room\b)\b/.test(text);
        const hasEquipment = /\b(equip|equipment|asset|device|filter|fan|motor|pump)\b/.test(text);

        if (hasRoom && hasEquipment) return 'Room & Equipment';
        if (hasRoom) return 'Room';
        if (hasEquipment) return 'Equipment';

        // fallback checks on templateName content
        const tn = String(templateName || '').toLowerCase();
        if (tn.includes('room') || tn.includes('environment') || tn.includes('site')) return 'Room';
        if (tn.includes('equipment') || tn.includes('filter') || tn.includes('asset')) return 'Equipment';

        return 'Other';
      } catch (e) {
        return 'Other';
      }
    };

    const map: Record<string, { total: number; overdue: number }> = {};
    for (const wo of allScoped) {
      const category = 'Other'; // Templates not available in database
      if (!map[category]) map[category] = { total: 0, overdue: 0 };
      map[category].total += 1;
      if (((wo as any).status || '').toLowerCase() === 'overdue') map[category].overdue += 1;
    }

    const entries = Object.entries(map).map(([name, v]) => ({ name, overdue: v.overdue, total: v.total, overduePct: v.total ? Math.round((v.overdue / v.total) * 10000) / 100 : 0 }));
    // compute overall totals and prepend an "All" summary entry
    const totalCount = Object.values(map).reduce((s: number, x: any) => s + (x.total || 0), 0);
    const totalOverdue = Object.values(map).reduce((s: number, x: any) => s + (x.overdue || 0), 0);
    const overallPct = totalCount ? Math.round((totalOverdue / totalCount) * 10000) / 100 : 0;
    const sorted = entries.sort((a, b) => b.overduePct - a.overduePct);
    overdueByTypeServer = [{ name: 'All', overdue: totalOverdue, total: totalCount, overduePct: overallPct }, ...sorted];
  } catch (err) {
    console.error('[dashboard/stats] overdue by type aggregation error', err);
  }

  // Performance snapshots for managers/supervisors: best teams and individuals within scope
  const teamPerformanceRaw = await prisma.workOrder.groupBy({
    by: ['teamId'],
    where: { ...scopedActiveFilter, status: 'completed', teamId: { not: null } },
    _count: { _all: true },
  });

  const teamIdsForPerf = teamPerformanceRaw.map((t) => t.teamId).filter(Boolean) as string[];
  const teamLookup = teamIdsForPerf.length
    ? await prisma.team.findMany({ where: { id: { in: teamIdsForPerf } }, select: { id: true, name: true } })
    : [];
  const teamLookupMap = Object.fromEntries(teamLookup.map((t) => [t.id, t.name]));
  const topTeams = teamPerformanceRaw
    .map((t) => ({
      teamId: t.teamId,
      teamName: teamLookupMap[t.teamId as string] || 'Unknown team',
      completed: t._count._all,
    }))
    .sort((a, b) => b.completed - a.completed);

  const bestTeam = topTeams[0] || null;

  const individualPerfRaw = await prisma.workOrder.groupBy({
    by: ['assignedToId'],
    where: { ...scopedActiveFilter, status: 'completed', assignedToId: { not: null } },
    _count: { _all: true },
  });

  const performerIds = individualPerfRaw.map((i) => i.assignedToId).filter(Boolean) as string[];
  const performers = performerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: performerIds } },
        select: { id: true, fullName: true, username: true, role: { select: { key: true } } },
      })
    : [];

  const performerMap = Object.fromEntries(
    performers.map((p) => [p.id, { name: p.fullName || p.username, role: p.role?.key || '' }])
  );

  const topIndividuals = individualPerfRaw
    .map((p) => {
      const meta = performerMap[p.assignedToId as string] || { name: 'Unknown', role: '' };
      return {
        userId: p.assignedToId,
        name: meta.name,
        role: meta.role,
        completed: p._count._all,
      };
    })
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10);

  const bestSupervisor = topIndividuals.find((p) => (p.role || '').toLowerCase() === 'supervisor') || null;

  // Technicians: list of assigned users in scope
  const technicianRaw = await prisma.workOrder.groupBy({
    by: ['assignedToId'],
    where: { ...scopedActiveFilter, assignedToId: { not: null } },
    _count: { _all: true },
  });
  const technicianIds = technicianRaw.map((t) => t.assignedToId).filter(Boolean) as string[];
  let technicians = technicianIds.length
    ? await prisma.user.findMany({ where: { id: { in: technicianIds } }, select: { id: true, fullName: true, email: true } })
    : [];

  // Fallback for managers/supervisors when there are no work orders yet:
  // derive technicians from team membership and direct supervisor relationships
  // within the manager/supervisor's area (assigned regions/zones).
  if (!technicians.length && (roleKey === 'manager' || roleKey === 'supervisor')) {
    const techMap = new Map<string, { id: string; fullName: string; email: string }>();

    // Technicians from teams in scope
    if (teamIdsForScope.length) {
      const teamTechs = await prisma.user.findMany({
        where: {
          teamId: { in: teamIdsForScope },
          role: { key: 'Technician' },
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          assignedRegion: true,
          assignedZone: true,
        },
      });

      for (const t of teamTechs) {
        // If supervisor/manager has explicit area assignment, restrict to that area
        if (regionIds.length || zoneIds.length) {
          const hasRegion = regionIds.length
            ? (t.assignedRegion || []).some((r) => regionIds.includes(r))
            : true;
          const hasZone = zoneIds.length
            ? (t.assignedZone || []).some((z) => zoneIds.includes(z))
            : true;
          if (!hasRegion && !hasZone) continue;
        }
        techMap.set(t.id, { id: t.id, fullName: t.fullName || '', email: t.email || '' });
      }
    }

    // Direct-report technicians (immediateSupervisorId -> current user)
    const directTechs = await prisma.user.findMany({
      where: {
        immediateSupervisorId: user.id,
        role: { key: 'Technician' },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        assignedRegion: true,
        assignedZone: true,
      },
    });

    for (const t of directTechs) {
      if (regionIds.length || zoneIds.length) {
        const hasRegion = regionIds.length
          ? (t.assignedRegion || []).some((r) => regionIds.includes(r))
          : true;
        const hasZone = zoneIds.length
          ? (t.assignedZone || []).some((z) => zoneIds.includes(z))
          : true;
        if (!hasRegion && !hasZone) continue;
      }
      techMap.set(t.id, { id: t.id, fullName: t.fullName || '', email: t.email || '' });
    }

    technicians = Array.from(techMap.values());
  }

  // Determine scoped site universe for counts and site-visit summaries
  // (must be initialized before any asset/NE scoping that relies on scopedSites)
  let scopedSites: Array<{
    id: string;
    name: string | null;
    siteCode: string | null;
    regionId: string | null;
    zoneId: string | null;
    neNameAndId?: string | null;
    allNeNames?: string[] | null;
  }> = [];
  try {
    if (roleKey === 'admin') {
      scopedSites = (await prisma.site.findMany({
        select: { id: true, name: true, siteCode: true, regionId: true, zoneId: true, neNameAndId: true, allNeNames: true },
      })).map(site => ({
        ...site,
        allNeNames: Array.isArray(site.allNeNames)
          ? site.allNeNames as string[]
          : (typeof site.allNeNames === 'string' ? [site.allNeNames] : null),
      }));
    } else if (regionIds.length || zoneIds.length) {
      const siteWhere: any = {};
      const orParts: any[] = [];
      if (zoneIds.length) orParts.push({ zoneId: { in: zoneIds } });
      if (regionIds.length) orParts.push({ regionId: { in: regionIds }, zoneId: null });
      if (orParts.length) siteWhere.OR = orParts;
      scopedSites = (await prisma.site.findMany({
        where: siteWhere,
        select: { id: true, name: true, siteCode: true, regionId: true, zoneId: true, neNameAndId: true, allNeNames: true },
      })).map(site => ({
        ...site,
        allNeNames: Array.isArray(site.allNeNames)
          ? site.allNeNames as string[]
          : (typeof site.allNeNames === 'string' ? [site.allNeNames] : null),
      }));
    }
  } catch (err) {
    console.error('[dashboard/stats] scoped site lookup failed', err);
  }

  // Fallback: if no scoped sites yet but there are work orders, derive sites from work orders in scope
  try {
    if (!scopedSites.length) {
      const scopedSiteIds = (
        await prisma.workOrder.findMany({ where: scopedActiveFilter, select: { siteId: true }, take: 1000 })
      )
        .map((w) => w.siteId)
        .filter(Boolean) as string[];
      if (scopedSiteIds.length) {
        scopedSites = (await prisma.site.findMany({
          where: { id: { in: Array.from(new Set(scopedSiteIds)) } },
          select: { id: true, name: true, siteCode: true, regionId: true, zoneId: true, neNameAndId: true, allNeNames: true },
        })).map(site => ({
          ...site,
          allNeNames: Array.isArray(site.allNeNames)
            ? site.allNeNames as string[]
            : (typeof site.allNeNames === 'string' ? [site.allNeNames] : null),
        }));
      }
    }
  } catch (err) {
    console.error('[dashboard/stats] scoped site fallback failed', err);
  }

  // Additional totals expected by the preventive maintenance UI
  let scopedSiteIdsForAssets: string[] = [];
  try {
    scopedSiteIdsForAssets = scopedSites.map((s) => s.id).filter(Boolean);
    if (!scopedSiteIdsForAssets.length) {
      // fallback to sites seen in work orders within scope so asset scoping is at least aligned to WO visibility
      const scopedSiteIds = (
        await prisma.workOrder.findMany({ where: scopedAllFilter, select: { siteId: true }, take: 1000 })
      )
        .map((w) => w.siteId)
        .filter(Boolean) as string[];
      scopedSiteIdsForAssets = Array.from(new Set(scopedSiteIds));
    }
  } catch (err) {
    console.error('[dashboard/stats] scoped site ids for assets failed', err);
  }

  let equipmentCount = 0;
  try {
    if (scopedSiteIdsForAssets.length) {
      equipmentCount = await prisma.asset.count({ where: { siteId: { in: scopedSiteIdsForAssets } } });
    } else {
      equipmentCount = await prisma.asset.count();
    }
  } catch (err) {
    console.error('[dashboard/stats] asset/NE count error', err);
    equipmentCount = 0;
  }
  const maintenanceCount = totalWorkOrders;
  const scheduledPct = totalWorkOrders ? Math.round((plannedCount / totalWorkOrders) * 10000) / 100 : 0;

  // Align completion % with reports (which include both active and archived completed work orders).
  const totalForCompletion = totalWorkOrders + archivedTotalWorkOrders;
  const completedForCompletion = completedCount + archivedCompletedCount;
  const completedPct = totalForCompletion
    ? Math.round((completedForCompletion / totalForCompletion) * 10000) / 100
    : 0;

  // Compute costs using new fields on WorkOrder and Part.unitCost
  let totalCost = 0;
  try {
    // Gather work order IDs in scope
    const woIds = (await prisma.workOrder.findMany({ where: scopedActiveFilter, select: { id: true } })).map((w) => w.id);

    // Sum costs stored on attachments (if present) for scoped work orders
    let sumActual = 0;
    let sumEstimated = 0;
    if (woIds.length) {
      const attachAgg = await prisma.workOrderAttachment.aggregate({
        where: { workOrderId: { in: woIds } },
        _sum: { actualCost: true, estimatedCost: true },
      });
      sumActual = Number(attachAgg._sum.actualCost || 0);
      sumEstimated = Number(attachAgg._sum.estimatedCost || 0);
    }

    // Sum part costs for work orders in scope
    let partsCost = 0;
    if (woIds.length) {
      const workOrderParts = await prisma.workOrderPart.findMany({
        where: { workOrderId: { in: woIds } },
        include: { part: true },
      });
      for (const p of workOrderParts) {
        const unit = (p as any).part?.unitCost || 0;
        partsCost += (unit || 0) * (p.quantity || 0);
      }
    }

    totalCost = sumActual || sumEstimated || 0;
    totalCost = totalCost + partsCost;
  } catch (err) {
    console.error('[dashboard/stats] cost aggregation error', err);
    totalCost = 0;
  }

  const avgCost = totalWorkOrders ? Math.round((totalCost / totalWorkOrders) * 100) / 100 : 0;

  // For admin users, compute a few global overview metrics (not scoped by baseFilter)
  let adminSummary: any = null;
  if (roleKey === 'admin') {
    try {
      const [siteCountRaw, userCount, regionCountRaw, zoneCountRaw, aazZoneCount, technicianCount] = await Promise.all([
        prisma.site.count(),
        prisma.user.count(),
        prisma.region.count(),
        prisma.zone.count(),
        prisma.zone.count({
          where: {
            name: {
              endsWith: 'AAZ',
              mode: 'insensitive',
            },
          },
        }),
        prisma.user.count({
          where: {
            role: {
              key: {
                equals: 'technician',
                mode: 'insensitive',
              },
            },
          },
        }),
      ]);

      const aazZones = await prisma.zone.findMany({
        where: {
          name: {
            endsWith: 'AAZ',
            mode: 'insensitive',
          },
        },
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      const allRegions = await prisma.region.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
      });

      adminSummary = {
        siteCount: siteCountRaw,
        userCount,
        regionCount: regionCountRaw,
        regionNames: allRegions.map((r) => r.name),
        zoneCount: aazZoneCount,
        zoneCountAll: zoneCountRaw,
        zoneNames: aazZones.map((z) => z.name),
        technicianCount,
      };
    } catch (err) {
      console.error('[dashboard/stats] admin global summary error', err);
      adminSummary = null;
    }
  }

  // Track sites that have NEs (assets) within scope so we can flag sites with NE but no work orders
  let assetSiteIds = new Set<string>();
  let derivedNeCount = 0;
  let siteRowCount = 0;
  try {
    let assetScopeIds = scopedSites.map((s) => s.id).filter(Boolean);
    if (!assetScopeIds.length) {
      const scopedSiteIds = (
        await prisma.workOrder.findMany({ where: scopedAllFilter, select: { siteId: true }, take: 1000 })
      )
        .map((w) => w.siteId)
        .filter(Boolean) as string[];
      assetScopeIds = Array.from(new Set(scopedSiteIds));
    }

    const assetRows = await prisma.asset.findMany({
      where: assetScopeIds.length ? { siteId: { in: assetScopeIds } } : {},
      select: { siteId: true },
      take: 2000,
    });
    assetSiteIds = new Set(
      assetRows
        .map((a) => a.siteId)
        .filter((id) => typeof id === 'string' && id)
    );
  } catch (err) {
    console.error('[dashboard/stats] asset site lookup failed', err);
  }

  // Site visit summaries (visited vs never visited, plus top visited list)
  let siteVisitSummary: { visited: number; total: number; neverVisited: number; topVisited: Array<{ id: string; name: string; siteCode: string | null; visits: number }>; neSitesNoWorkOrders?: number } = {
    visited: 0,
    total: scopedSites.length,
    neverVisited: 0,
    topVisited: [],
    neSitesNoWorkOrders: 0,
  };
  let visitedSet = new Set<string>();
  let siteUniverseIdsAll: string[] = [];
  try {
    const visitGroups = await prisma.workOrder.groupBy({
      by: ['siteId'],
      where: scopedActiveFilter,
      _count: { _all: true },
    });

    const siteLookup = new Map(scopedSites.map((s) => [s.id, s]));

    const topVisited = visitGroups
      .filter((g) => g.siteId)
      .map((g) => {
        const meta = siteLookup.get(g.siteId as string);
        visitedSet.add(g.siteId as string);
        return {
          id: g.siteId as string,
          name: meta?.name || meta?.siteCode || 'Unknown site',
          siteCode: meta?.siteCode || null,
          visits: g._count._all,
        };
      })
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 8);

    // If we had no scoped sites but visited sites exist, pull their meta for counts
    if (!scopedSites.length && topVisited.length) {
      scopedSites = topVisited.map((t) => ({ id: t.id, name: t.name, siteCode: t.siteCode, regionId: null, zoneId: null, neNameAndId: null, allNeNames: [] }));
    }

    // Universe = scoped sites ∪ sites that have NE assets
    const assetSiteUniverse = Array.from(assetSiteIds);
    const siteUniverseIds = new Set<string>([
      ...scopedSites.map((s) => s.id),
      ...assetSiteUniverse,
      ...Array.from(visitedSet),
    ]);
    siteUniverseIdsAll = Array.from(siteUniverseIds);
    const neverVisited = siteUniverseIdsAll.filter((id) => !visitedSet.has(id)).length;
    const neSitesNoWorkOrders = assetSiteUniverse.filter((id) => !visitedSet.has(id)).length;

    siteVisitSummary = {
      visited: visitedSet.size,
      total: siteUniverseIdsAll.length,
      neverVisited,
      topVisited,
      neSitesNoWorkOrders,
    };
  } catch (err) {
    console.error('[dashboard/stats] site visit summary error', err);
  }

  // Recompute NE and site-row counts over the full "universe" of sites
  // (scoped sites ∪ NE sites ∪ visited sites) so supervisor/manager
  // dashboards align with the Sites / NE page even when some sites
  // are only visible via work orders or assets.
  try {
    if (siteUniverseIdsAll.length) {
      const scopedById = new Map(scopedSites.map((s) => [s.id, s as any]));
      const missingIds = siteUniverseIdsAll.filter((id) => !scopedById.has(id));

      let extraSites: Array<{ id: string; neNameAndId: string | null; allNeNames: string[] | null }> = [];
      if (missingIds.length) {
        const rawExtra = await prisma.site.findMany({
          where: { id: { in: missingIds } },
          select: { id: true, neNameAndId: true, allNeNames: true },
        });
        extraSites = rawExtra.map((site) => ({
          id: site.id,
          neNameAndId: site.neNameAndId,
          allNeNames: Array.isArray(site.allNeNames)
            ? (site.allNeNames as string[])
            : typeof site.allNeNames === 'string'
            ? [site.allNeNames]
            : [],
        }));
      }

      const allSitesForNe: Array<{ id: string; neNameAndId?: string | null; allNeNames?: string[] | null }> = [
        ...scopedSites,
        ...extraSites,
      ];

      const neSet = new Set<string>();
      let rows = 0;
      for (const s of allSitesForNe) {
        const perSiteNeSet = new Set<string>();

        if ((s as any).neNameAndId) {
          const v = String((s as any).neNameAndId);
          neSet.add(v);
          perSiteNeSet.add(v);
        }

        if (Array.isArray((s as any).allNeNames)) {
          for (const ne of ((s as any).allNeNames as any[]).filter(Boolean)) {
            const v = String(ne);
            neSet.add(v);
            perSiteNeSet.add(v);
          }
        }

        // For site row counts (to match Sites page semantics),
        // treat each unique NE per site as a row; if a site has
        // no NE at all, it still contributes one row.
        rows += perSiteNeSet.size || 1;
      }

      derivedNeCount = neSet.size;
      siteRowCount = rows;
    }
  } catch (err) {
    console.error('[dashboard/stats] NE/site-row recompute error', err);
  }

  // Derive region/zone counts with fallbacks when DB tables are empty or zero
  const derivedZoneSet = new Set(
    scopedSites
      .map((s) => s.zoneId)
      .filter((z) => typeof z === 'string' && z.trim())
  );
  const derivedRegionSet = new Set(
    scopedSites
      .map((s) => s.regionId)
      .filter((r) => typeof r === 'string' && r.trim())
  );

  // Look up region names so we can infer zones from region codes when zone table is empty (e.g., AAZ variations stored as region)
  let regionNameMap = new Map<string, string>();
  try {
    if (derivedRegionSet.size) {
      const regionIds = Array.from(derivedRegionSet).filter((id): id is string => typeof id === 'string');
      const regionsMeta = await prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } });
      regionNameMap = new Map(regionsMeta.map((r) => [r.id, r.name]));
    }
  } catch (err) {
    console.error('[dashboard/stats] region name lookup failed', err);
  }

  const zoneLikeRegionIds = new Set(
    Array.from(regionNameMap.entries())
      .filter(([, name]) => typeof name === 'string' && /(AAZ|ZONE)/i.test(name as string))
      .map(([id]) => id)
  );

  const derivedRegionCount = Math.max(0, derivedRegionSet.size - zoneLikeRegionIds.size);

  // For admin dashboard counts, exclude region rows that are actually zone-like codes (AAZ/ZONE)
  let adminRegionCountAdjusted: number | null = null;
  if (roleKey === 'admin') {
    try {
      adminRegionCountAdjusted = await prisma.region.count({
        where: {
          NOT: [
            { name: { contains: 'AAZ', mode: 'insensitive' } },
            { name: { contains: 'ZONE', mode: 'insensitive' } },
          ],
        },
      });
    } catch (err) {
      console.error('[dashboard/stats] admin adjusted region count failed', err);
      adminRegionCountAdjusted = null;
    }
  }

  // If user is scoped to specific regions/zones, prefer counts from those scopes even when sites are missing
  let scopedZoneCount: number | null = null;
  let scopedRegionCount: number | null = null;
  try {
    if (zoneIds.length) scopedZoneCount = zoneIds.length;
    else if (regionIds.length) {
      scopedZoneCount = await prisma.zone.count({ where: { regionId: { in: regionIds } } });
    }

    if (regionIds.length) scopedRegionCount = regionIds.length;
  } catch (err) {
    console.error('[dashboard/stats] scoped region/zone count error', err);
  }

  // Creation source buckets (manual / auto scheduler); pool removed per requirement
  let creationSourceCounts: { autoScheduler: number; manual: number } = { autoScheduler: 0, manual: 0 };
  try {
    const sourceRows = await prisma.workOrder.findMany({
      where: scopedActiveFilter,
      select: { type: true, planned: true, description: true, createdById: true },
      take: 3000,
    });
    for (const row of sourceRows) {
      const desc = (row.description || '');
      const isAuto = /^Auto-scheduled PM task/.test(desc);
      if (isAuto) creationSourceCounts.autoScheduler += 1;
      else creationSourceCounts.manual += 1;
    }
  } catch (err) {
    console.error('[dashboard/stats] creation source aggregation error', err);
  }

  // Completion attribution card removed (per-request); keep zeroed structure for UI compatibility
  const completionByRole = { supervisor: 0, technician: 0, other: 0 };

  let zoneCount = adminSummary?.zoneCount || scopedZoneCount || derivedZoneSet.size;

  let regionCount =
    roleKey === 'admin'
      ? adminRegionCountAdjusted || derivedRegionCount || derivedRegionSet.size
      : scopedRegionCount || derivedRegionCount || derivedRegionSet.size;

  // Fallback for Addis Ababa zones (names containing "AAZ") when zone count is zero
  if (!zoneCount) {
    const aaZones = new Set(
      scopedSites
        .map((s) => s.zoneId)
        .filter((z) => typeof z === 'string' && /(AAZ|CAAZ|SAAZ)/i.test(z as string))
    );

    // Infer zones from region names when zone table or site.zoneId is empty (e.g., NAAZ/EAAZ/WAAZ/CAAZ/SAAZ stored as regions)
    const zoneLikeFromRegions = new Set(
      Array.from(derivedRegionSet)
        .map((rid) => rid ? regionNameMap.get(rid) : undefined)
        .filter((name) => typeof name === 'string' && /(AAZ|ZONE)/i.test(name as string))
    );

    const derivedZones = derivedZoneSet.size;
    zoneCount = derivedZones || aaZones.size || zoneLikeFromRegions.size;
  }

  // Fallback for regions with codes ending with 'R' when region count is zero
  if (!regionCount) {
    const suffixR = new Set(
      scopedSites
        .map((s) => s.regionId)
        .filter((r) => typeof r === 'string' && /R$/i.test(r as string))
    );
    const derivedRegions = derivedRegionCount || derivedRegionSet.size;
    regionCount = derivedRegions || suffixR.size;
  }

  const siteCountScoped = siteRowCount || adminSummary?.siteCount || siteVisitSummary?.total || scopedSites.length || 0;

  // Avoid adminSummary overriding computed geo counts; drop region/zone/site counts from adminSummary
  const adminSummarySafe = adminSummary
    ? (() => {
        const { regionCount: _rc, zoneCount: _zc, siteCount: _sc, ...rest } = adminSummary;
        return rest;
      })()
    : null;

  return NextResponse.json({
    user: { id: user.id, name: user.fullName, role: user.role?.key },
    totals: {
      totalWorkOrders,
      plannedCount,
      unplannedCount,
      createdCount,
      assignedCount,
      inProgressCount,
      completedCount,
      completedOnTimeCount,
      delayedCount,
      equipmentCount,
      neCount: derivedNeCount || equipmentCount,
      maintenanceCount,
      scheduledPct,
      completedPct,
      totalCost,
      avgCost,
      siteCount: siteCountScoped,
      regionCount,
      zoneCount,
      siteVisitSummary,
      creationSourceCounts,
      completionByRole,
      ...(adminSummarySafe || {}),
    },
    teams,
    subordinateCount,
    regionStats,
    teamCounts,
    recentWorkOrders,
    workOrdersByStatus,
    monthlyCostSeries,
    overdueByTypeServer,
    area: { regions: supervisorAreaRegions, zones: supervisorAreaZones },
    managerScope: { regions: managerScopeRegions, zones: managerScopeZones },
    archivedComparison,
    topTeams,
    bestTeam,
    topIndividuals,
    bestSupervisor,
    technicians,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
