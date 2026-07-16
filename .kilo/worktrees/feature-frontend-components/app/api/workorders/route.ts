import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Session } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions) as any;
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user details including role
    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true }
    });
    if (!userDetails) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const roleKey = (userDetails.role?.key || '').toLowerCase();

    const url = new URL(req.url);
    const params = url.searchParams;

    const take = parseInt(params.get('take') || '50');
    const skip = parseInt(params.get('skip') || '0');
    const archivedParam = params.get('archived');
    // archived=true => archived only
    // archived=false => non-archived only
    // archived=all => both archived and non-archived
    // missing (undefined) => default to non-archived
    let archived: boolean | null = false;
    if (archivedParam === 'true') archived = true;
    else if (archivedParam === 'false') archived = false;
    else if (archivedParam === 'all') archived = null;

    const status = params.get('status');
    const type = params.get('type');
    const teamId = params.get('teamId');
    const assignedToId = params.get('assignedToId');
    const handlerId = params.get('handlerId');
    const createdById = params.get('createdById');
    const managerIdRaw = params.get('managerId');
    const managerEmail = params.get('managerEmail');
    let regionName = params.get('regionName');
    let zoneName = params.get('zoneName');

    let where: any = {};
    if (archived !== null) {
      where.archived = archived;
    } else {
      // if archived=all or explicitly set to 'all', do not filter by archived status
    }

    if (status) where.status = status;
    if (type) where.type = type;
    if (teamId) where.teamId = teamId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (createdById) where.createdById = createdById;

    // Apply handlerId if it matches a known user (e.g., supervisor/manager report buckets).
    // If the handlerId corresponds to a user, we treat it like assignedToId and skip region/zone filters.
    let handlerMatchesUser = false;
    if (handlerId) {
      try {
        const handlerUser = await prisma.user.findUnique({
          where: { id: handlerId },
          select: { id: true },
        });
        if (handlerUser) {
          handlerMatchesUser = true;
          // If the query explicitly specified assignedToId, it takes precedence.
          if (!assignedToId) {
            where.assignedToId = handlerId;
          }
        }
      } catch (err) {
        // ignore
      }
    }

    // apply region/zone filter if requested (case-insensitive match)
    // (if handlerId refers to a user, ignore these filters to avoid overly restrictive AND logic)
    if (!handlerMatchesUser) {
      if (regionName) {
        where.site = where.site || {};
        where.site.region = { name: { contains: regionName, mode: 'insensitive' } };
      }
      if (zoneName) {
        where.site = where.site || {};
        where.site.zone = { name: { contains: zoneName, mode: 'insensitive' } };
      }
    }

    // Apply user-based scoping unless it's an admin or explicit manager request, or specific filters are provided
    const hasSpecificFilters = !!(teamId || assignedToId || createdById);
    if (roleKey !== 'admin' && !(managerIdRaw || managerEmail) && !hasSpecificFilters) {
      // Always include work orders created by or assigned to the current user
      const userOr: any[] = [
        { createdById: user.id },
        { assignedToId: user.id },
      ];

      if (roleKey === 'manager') {
        // Get manager's assigned regions/zones first
        let resolvedRegionIds: string[] = [];
        let resolvedZoneIds: string[] = [];
        try {
          const rawRegions: string[] = Array.isArray(userDetails.assignedRegion) ? userDetails.assignedRegion : [];
          const rawZones: string[] = Array.isArray(userDetails.assignedZone) ? userDetails.assignedZone : [];
          const locCat = String(userDetails.locationCategory || '').toLowerCase();
          const isHqManager = locCat.includes('head quarter') || locCat === 'hq';

          if (rawRegions.length || rawZones.length || isHqManager) {
            const [regions, zones] = await Promise.all([
              prisma.region.findMany({ select: { id: true, name: true } }),
              prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
            ]);
            const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id]));
            const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id]));

            for (const v of rawRegions) {
              const name = String(v).trim();
              const normalized = name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq' ? 'caaz' : name.toLowerCase();
              if (regionByName.has(normalized)) resolvedRegionIds.push(regionByName.get(normalized)!);
            }
            for (const v of rawZones) {
              const nm = String(v).trim();
              if (zoneByName.has(nm.toLowerCase())) resolvedZoneIds.push(zoneByName.get(nm.toLowerCase())!);
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
          }
        } catch (err) {
          console.error('[workorders] manager area resolution error', err);
        }

        // Get sites within manager's assigned regions/zones
        let managerSiteIds: string[] = [];
        if (resolvedRegionIds.length || resolvedZoneIds.length) {
          const siteWhere: any = {};
          const orParts: any[] = [];
          if (resolvedZoneIds.length) orParts.push({ zoneId: { in: resolvedZoneIds } });
          if (resolvedRegionIds.length) orParts.push({ regionId: { in: resolvedRegionIds }, zoneId: null });
          if (orParts.length) siteWhere.OR = orParts;
          const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
          managerSiteIds = areaSites.map((s) => s.id).filter(Boolean) as string[];
        }
        // fallback for AAZ/HQ managers with no explicit areas
        const ar = Array.isArray(userDetails.assignedRegion) ? userDetails.assignedRegion : [];
        const az = Array.isArray(userDetails.assignedZone) ? userDetails.assignedZone : [];
        const locCat2 = String(userDetails.locationCategory || '').toLowerCase();
        const isAazOrHqManager =
          ar.some((r) => /aaz|hq/i.test(String(r))) ||
          az.some((z) => /aaz|hq/i.test(String(z))) ||
          locCat2.includes('head quarter');
        if (managerSiteIds.length === 0 && isAazOrHqManager) {
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
            managerSiteIds = hqSites.map((s) => s.id).filter(Boolean) as string[];
          } catch (e) {
            console.error('[workorders] AAZ/HQ fallback error', e);
          }
        }

        // Get managed teams
        const teams = await prisma.team.findMany({ where: { managerId: user.id }, select: { id: true } });
        const teamIds = teams.map(t => t.id);

        // For managers, include work orders in their managed teams AND within their assigned sites
        if (managerSiteIds.length) {
          if (teamIds.length) {
            // Only include work orders where team is managed AND site is in assigned areas
            userOr.push({
              AND: [
                { teamId: { in: teamIds } },
                { siteId: { in: managerSiteIds } }
              ]
            });
          }

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
            if (hqSiteIds.length) userOr.push({ siteId: { in: hqSiteIds } });
          } catch (err) {
            console.error('[workorders] HQ/AAZ site scoping error', err);
          }
        }

        // Include work orders created by subordinates (within manager's sites and managed teams)
        if (managerSiteIds.length && teamIds.length) {
          const subordinates = await prisma.user.findMany({
            where: { immediateSupervisorId: user.id },
            select: { id: true },
          });
          const subordinateIds = subordinates.map((s) => s.id);
          if (subordinateIds.length) {
            userOr.push({
              AND: [
                {
                  OR: [
                    { assignedToId: { in: subordinateIds } },
                    { createdById: { in: subordinateIds } }
                  ]
                },
                { siteId: { in: managerSiteIds } },
                { teamId: { in: teamIds } }
              ]
            });
          }
        }
      } else if (roleKey === 'supervisor') {
        // For supervisors, include work orders assigned to their supervisees —
        // but only within the supervisor's assigned regions/zones (if any).
        const supervisees = await prisma.user.findMany({
          where: { immediateSupervisorId: user.id },
          select: { id: true },
        });
        const superviseeIds = supervisees.map((s) => s.id);

        // Resolve supervisor's assigned area (regions/zones) to siteIds
        let supervisorSiteIds: string[] = [];
        try {
          const rawRegions: string[] = Array.isArray(userDetails.assignedRegion)
            ? userDetails.assignedRegion
            : [];
          const rawZones: string[] = Array.isArray(userDetails.assignedZone)
            ? userDetails.assignedZone
            : [];
          const locCat = String(userDetails.locationCategory || '').toLowerCase();
          const isHq = locCat.includes('head quarter') || locCat === 'hq';

          if (rawRegions.length || rawZones.length || isHq) {
            const [regions, zones] = await Promise.all([
              prisma.region.findMany({ select: { id: true, name: true } }),
              prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
            ]);
            const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id]));
            const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id]));

            const resolvedRegionIds: string[] = [];
            const resolvedZoneIds: string[] = [];

            for (const v of rawRegions) {
              const name = String(v).trim();
              const normalized = name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq' ? 'caaz' : name.toLowerCase();
              if (regionByName.has(normalized)) resolvedRegionIds.push(regionByName.get(normalized)!);
            }
            for (const v of rawZones) {
              const nm = String(v).trim();
              if (zoneByName.has(nm.toLowerCase())) resolvedZoneIds.push(zoneByName.get(nm.toLowerCase())!);
            }

            if (isHq) {
              const caazId = regionByName.get('caaz');
              if (caazId && !resolvedRegionIds.includes(caazId)) resolvedRegionIds.push(caazId);
              zones
                .filter((z) => String(z.name).toLowerCase().startsWith('hq-'))
                .forEach((z) => {
                  if (!resolvedZoneIds.includes(z.id)) resolvedZoneIds.push(z.id);
                });
            }

            if (resolvedRegionIds.length || resolvedZoneIds.length) {
              const siteWhere: any = {};
              const orParts: any[] = [];
              if (resolvedZoneIds.length) orParts.push({ zoneId: { in: resolvedZoneIds } });
              if (resolvedRegionIds.length) orParts.push({ regionId: { in: resolvedRegionIds }, zoneId: null });
              if (orParts.length) siteWhere.OR = orParts;
              const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
              supervisorSiteIds = areaSites.map((s) => s.id).filter(Boolean) as string[];
            }
          }
        } catch (err) {
          console.error('[workorders] supervisor area resolution error', err);
        }

        if (superviseeIds.length) {
          if (supervisorSiteIds.length) {
            // restrict supervisee work orders to supervisor's area
            userOr.push({
              AND: [
                { assignedToId: { in: superviseeIds } },
                { siteId: { in: supervisorSiteIds } },
              ],
            });
          } else {
            // no assigned area -> keep existing behavior
            userOr.push({ assignedToId: { in: superviseeIds } });
          }
        }
      } else if (roleKey === 'technician') {
        // For technicians, include work orders in their team (if they have one)
        if (userDetails.teamId) {
          userOr.push({ teamId: userDetails.teamId });
        }
      }

      // Apply the user scoping
      if (userOr.length > 0) {
        where.OR = userOr;
      }
    }

    // Manager scoping (when explicitly requested) - add to existing filters
    const managerId: string | null = typeof managerIdRaw === 'string' ? managerIdRaw : null;
    if (managerId || managerEmail) {
      let managerIdToUse = managerId;
      if (!managerIdToUse && managerEmail) {
        const mgr = await prisma.user.findUnique({ where: { email: managerEmail } });
        managerIdToUse = typeof mgr?.id === 'string' ? mgr.id : null;
      }
      if (managerIdToUse) {
        // Get manager's assigned sites
        let managerSiteIds: string[] = [];
        try {
          const managerUser = await prisma.user.findUnique({
            where: { id: managerIdToUse },
            select: { assignedRegion: true, assignedZone: true, locationCategory: true }
          });
          if (managerUser) {
            const rawRegions: string[] = Array.isArray((managerUser as any).assignedRegion) ? (managerUser as any).assignedRegion : [];
            const rawZones: string[] = Array.isArray((managerUser as any).assignedZone) ? (managerUser as any).assignedZone : [];
            const locCat = String((managerUser as any)?.locationCategory || '').toLowerCase();
            const isHqManager = locCat.includes('head quarter') || locCat === 'hq';

            if (rawRegions.length || rawZones.length || isHqManager) {
              const [regions, zones] = await Promise.all([
                prisma.region.findMany({ select: { id: true, name: true } }),
                prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
              ]);
              const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id]));
              const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id]));

              const resolvedRegionIds: string[] = [];
              const resolvedZoneIds: string[] = [];

              for (const v of rawRegions) {
                const name = String(v).trim();
                const normalized = name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq' ? 'caaz' : name.toLowerCase();
                if (regionByName.has(normalized)) resolvedRegionIds.push(regionByName.get(normalized)!);
              }
              for (const v of rawZones) {
                const nm = String(v).trim();
                if (zoneByName.has(nm.toLowerCase())) resolvedZoneIds.push(zoneByName.get(nm.toLowerCase())!);
              }

              if (isHqManager) {
                const caazId = regionByName.get('caaz');
                if (caazId && !resolvedRegionIds.includes(caazId)) resolvedRegionIds.push(caazId);
                zones
                  .filter((z) => String(z.name).toLowerCase().startsWith('hq-'))
                  .forEach((z) => {
                    if (!resolvedZoneIds.includes(z.id)) resolvedZoneIds.push(z.id);
                  });
              }

              if (resolvedRegionIds.length || resolvedZoneIds.length) {
                const siteWhere: any = {};
                const orParts: any[] = [];
                if (resolvedZoneIds.length) orParts.push({ zoneId: { in: resolvedZoneIds } });
                if (resolvedRegionIds.length) orParts.push({ regionId: { in: resolvedRegionIds }, zoneId: null });
                if (orParts.length) siteWhere.OR = orParts;
                const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
                managerSiteIds = areaSites.map((s) => s.id).filter(Boolean) as string[];
              }
            }
          }
        } catch (err) {
          console.error('[workorders] explicit manager area resolution error', err);
        }

        // Build scoping conditions
        const scopingConditions: any[] = [];

        // 1. Work orders created by this manager — restrict to manager's assigned sites when available
        if (managerSiteIds.length) {
          scopingConditions.push({
            AND: [
              { createdById: managerIdToUse },
              { siteId: { in: managerSiteIds } }
            ]
          });
        } else {
          // fallback to previous behavior when manager has no assigned area configured
          scopingConditions.push({ createdById: managerIdToUse });
        }

        // 2. Work orders assigned to this manager
        scopingConditions.push({ assignedToId: managerIdToUse });

        // 3. Work orders in teams managed by this manager (restricted to manager's sites)
        const teams = await prisma.team.findMany({ where: { managerId: managerIdToUse }, select: { id: true } });
        const teamIds = teams.map(t => t.id);
        if (teamIds.length && managerSiteIds.length) {
          scopingConditions.push({
            AND: [
              { teamId: { in: teamIds } },
              { siteId: { in: managerSiteIds } }
            ]
          });
        }

        // 4. Work orders assigned to or created by subordinates (restricted to manager's sites and managed teams)
        const subordinates = await prisma.user.findMany({
          where: { immediateSupervisorId: managerIdToUse },
          select: { id: true }
        });
        const subordinateIds = subordinates.map(s => s.id);
        if (subordinateIds.length && managerSiteIds.length && teamIds.length) {
          scopingConditions.push({
            AND: [
              {
                OR: [
                  { assignedToId: { in: subordinateIds } },
                  { createdById: { in: subordinateIds } }
                ]
              },
              { siteId: { in: managerSiteIds } },
              { teamId: { in: teamIds } }
            ]
          });
        }

        // Apply the scoping
        if (scopingConditions.length > 0) {
          if (where.OR) {
            where.AND = where.AND || [];
            where.AND.push({ OR: where.OR });
            where.AND.push({ OR: scopingConditions });
            delete where.OR;
          } else {
            where.OR = scopingConditions;
          }
        }
      }
    }

    // If the client only wants a count, return it without fetching full records
    if (params.get('count') === 'true') {
      const total = await prisma.workOrder.count({ where });
      return NextResponse.json({ count: total });
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        site: { include: { region: true, zone: true } },
        team: true,
        assignedTo: { include: { role: true } },
        createdBy: { include: { role: true } },
      },
    });

    // if manager browsing, strip out orders that are assigned to other managers
    let filteredOrders = workOrders;
    if (roleKey === 'manager') {
      filteredOrders = filteredOrders.filter((wo) => {
        const at = wo.assignedTo;
        return !(at?.role?.key === 'manager' && at.id !== user.id);
      });
    }

    // Add computed fields
    const workOrdersWithComputed = workOrders.map(wo => ({
      ...wo,
      isAutoCreated: /^Auto-scheduled PM task/.test(wo.description || ''),
    }));

    return NextResponse.json(workOrdersWithComputed);
  } catch (err) {
    console.error('[workorders] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions) as any;
    const user = session?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      type,
      siteId,
      planned,
      teamId,
      assignedToId,
      templateId,
      checklistScope,
      scheduledStartAt,
      scheduledEndAt,
      taskNumber,
    } = body;

    const workOrder = await prisma.workOrder.create({
      data: {
        title,
        description,
        type,
        siteId,
        planned: planned || false,
        teamId,
        assignedToId,
        createdById: user.id,
        checklistScope,
        scheduledStartAt: scheduledStartAt ? new Date(scheduledStartAt) : null,
        scheduledEndAt: scheduledEndAt ? new Date(scheduledEndAt) : null,
        taskNumber,
      },
      include: {
        site: { include: { region: true, zone: true } },
        team: true,
        assignedTo: { include: { role: true } },
        createdBy: { include: { role: true } },
      },
    });

    return NextResponse.json(workOrder);
  } catch (err) {
    console.error('[workorders] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
