import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const managerId = params.get('managerId') || undefined;
  const managerEmail = params.get('managerEmail') || undefined;
  const assignedToId = params.get('assignedToId') || undefined;
  const assignedToEmail = params.get('assignedToEmail') || undefined;

  console.log('[counts] params:', { managerId, managerEmail, assignedToId, assignedToEmail });

  // Enforce session scoping: non-manager users only see work orders they created
  const session: any = await getServerSession(authOptions as any);
  const currentUser = session && session.user ? session.user as any : undefined;
  if (!session || !currentUser || !currentUser.id) return NextResponse.json({ all: 0, processing: 0, completed: 0, archived: 0, note: 'unauthorized' });
  const roleKey = String(currentUser?.role || '').toLowerCase();
  const isManager = roleKey === 'manager' || roleKey === 'supervisor';

  // Accept the same filters as the main workorders GET route so counts reflect the same scope
  const type = params.get('type') || undefined;
  const teamId = params.get('teamId') || undefined;
  const statusParam = params.get('status') || undefined;
  const createdById = params.get('createdById') || undefined;

  // Build base filter depending on scope (do NOT include status here because we'll compute counts per-status)
  let baseFilter: any = {};
  if (type) baseFilter.type = type;
  if (teamId) baseFilter.teamId = teamId;
  if (createdById) baseFilter.createdById = createdById;

  if (managerId || managerEmail || isManager) {
    let managerIdToUse = managerId;
    if (!managerIdToUse && managerEmail) {
      const user = await prisma.user.findUnique({ where: { email: managerEmail } });
      managerIdToUse = user?.id;
    }
    // if manager param not provided but the requester is a manager, default to their id
    if (!managerIdToUse && isManager) {
      managerIdToUse = String(currentUser.id);
    }
    if (managerIdToUse) {
      const teams = await prisma.team.findMany({ where: { managerId: managerIdToUse }, select: { id: true } });
      const teamIds = teams.map((t) => t.id);
      // Fetch direct reports for this manager (if any) so we can include assigned/created-by scopes
      const directReports = await prisma.user.findMany({ where: { immediateSupervisorId: managerIdToUse }, select: { id: true, teamId: true } });
      const directIds = directReports.map((u) => u.id);
      const directTeamIds = directReports.map((u) => u.teamId).filter(Boolean) as string[];

      // Resolve manager area sites (assignedRegion/assignedZone)
      let siteIds: string[] = [];
      try {
        const managerUser = await prisma.user.findUnique({
          where: { id: managerIdToUse },
          select: { assignedRegion: true, assignedZone: true },
        });
        if (managerUser) {
          const rawRegions: string[] = Array.isArray((managerUser as any).assignedRegion)
            ? ((managerUser as any).assignedRegion as string[])
            : [];
          const rawZones: string[] = Array.isArray((managerUser as any).assignedZone)
            ? ((managerUser as any).assignedZone as string[])
            : [];
          const hasExplicitRegions = rawRegions.length > 0;

          if (rawRegions.length || rawZones.length) {
            const [regions, zones] = await Promise.all([
              prisma.region.findMany({ select: { id: true, name: true } }),
              prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
            ]);
            const regionByName = new Map(regions.map(r => [String(r.name).toLowerCase(), r.id] as [string, string]));
            const zoneByName = new Map(zones.map(z => [String(z.name).toLowerCase(), z.id] as [string, string]));
            const regionIdSet = new Set(regions.map(r => r.id));
            const zoneIdSet = new Set(zones.map(z => z.id));
            const regionIds: string[] = [];
            const zoneIds: string[] = [];
            for (const v of rawRegions) {
              const name = String(v).trim();
              // Map HQ/Head Quarter to CAAZ internally for area-based scoping
              const normalized = name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq' ? 'caaz' : name.toLowerCase();
              if (regionIdSet.has(name)) regionIds.push(name);
              else if (regionByName.has(normalized)) regionIds.push(regionByName.get(normalized)!);
            }
            for (const v of rawZones) {
              const name = String(v).trim();
              if (zoneIdSet.has(name)) zoneIds.push(name);
              else if (zoneByName.has(name.toLowerCase())) zoneIds.push(zoneByName.get(name.toLowerCase())!);
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
              if (zoneIds.length) {
                orParts.push({ zoneId: { in: zoneIds } });
              }
              if (hasExplicitRegions && regionIds.length) {
                orParts.push({ regionId: { in: regionIds }, zoneId: null });
              }
              if (orParts.length) siteWhere.OR = orParts;
              const areaSites = await prisma.site.findMany({
                where: siteWhere,
                select: { id: true },
              });
              siteIds = areaSites.map(s => s.id);
            }
          }
        }
      } catch (e) {
        console.error('[counts] error resolving manager area sites', e);
      }

      if (teamIds.length > 0) {
        // Manager has DB teams — include work orders belonging to those teams,
        // and also include any work orders assigned to or created by direct reports
        // (covers work orders with null teamId but assigned to a technician).
        const orParts: any[] = [{ teamId: { in: teamIds } }];
        if (directTeamIds.length > 0) orParts.push({ teamId: { in: directTeamIds } });
        if (directIds.length > 0) {
          orParts.push({ assignedToId: { in: directIds } });
          orParts.push({ createdById: { in: directIds } });
        }
        if (siteIds.length > 0) {
          orParts.push({ siteId: { in: siteIds } });
          baseFilter.AND = [ ...(baseFilter.AND || []), { siteId: { in: siteIds } } ];
        }
        baseFilter.OR = orParts;
      } else {
        // Manager has no DB teams. Try direct reports first, but use id-based filters.
        try {
          if (directReports.length > 0) {
            if (directTeamIds.length > 0) {
              baseFilter.OR = [
                { teamId: { in: directTeamIds } },
                { createdById: { in: directIds } },
                { assignedToId: { in: directIds } },
              ];
              console.log('[counts] derived teamIds from direct reports:', directTeamIds.length);
            } else {
              baseFilter.OR = [
                { createdById: { in: directIds } },
                { assignedToId: { in: directIds } },
              ];
              console.log('[counts] using id-scope fallback for direct reports:', directIds.length);
            }
            if (siteIds.length > 0) {
              baseFilter.OR = [
                ...(baseFilter.OR || []),
                { siteId: { in: siteIds } },
              ];
              baseFilter.AND = [ ...(baseFilter.AND || []), { siteId: { in: siteIds } } ];
            }
          } else {
            // If no direct reports found in DB, attempt supervisors.json fallback
            console.log('[counts] no direct reports found, attempting supervisors.json fallback');
            let managerFullName: string | undefined = undefined;
            if (managerEmail) {
              const maybeManager = await prisma.user.findUnique({ where: { email: managerEmail } });
              managerFullName = maybeManager?.fullName ?? undefined;
            } else if (managerIdToUse) {
              const maybeManager = await prisma.user.findUnique({ where: { id: managerIdToUse } });
              managerFullName = maybeManager?.fullName ?? undefined;
            }

            if (managerFullName) {
              const supPath = path.join(process.cwd(), 'supervisors.json');
              const raw = await fs.readFile(supPath, 'utf-8');
              const list = JSON.parse(raw) as Array<any>;
              const emails = list
                .filter((r) => r['Immediate Supervisor'] && typeof r['Immediate Supervisor'] === 'string' && r['Immediate Supervisor'].trim() === managerFullName.trim())
                .map((r) => r['Email'])
                .filter(Boolean);

              if (emails.length > 0) {
                // find matching users in DB to extract teamIds and ids
                const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, teamId: true, email: true } });
                const derivedTeamIds = users.map((u) => u.teamId).filter(Boolean) as string[];
                const derivedIds = users.map((u) => u.id).filter(Boolean) as string[];
                if (derivedTeamIds.length > 0) {
                  baseFilter.OR = [
                    { teamId: { in: derivedTeamIds } },
                    { createdById: { in: derivedIds } },
                    { assignedToId: { in: derivedIds } },
                  ];
                  console.log('[counts] derived teamIds from supervisors.json:', derivedTeamIds.length);
                } else {
                  baseFilter.OR = [
                    { createdById: { in: derivedIds } },
                    { assignedToId: { in: derivedIds } },
                  ];
                  console.log('[counts] using id-scope fallback for supervised emails:', emails.length);
                }
                if (siteIds.length > 0) {
                  baseFilter.OR = [
                    ...(baseFilter.OR || []),
                    { siteId: { in: siteIds } },
                  ];
                  baseFilter.AND = [ ...(baseFilter.AND || []), { siteId: { in: siteIds } } ];
                }
              } else {
                console.log('[counts] supervisors.json did not contain entries for manager:', managerFullName);
                return NextResponse.json({ all: 0, processing: 0, completed: 0, archived: 0, note: 'no teams and no supervisors.json matches' });
              }
            } else {
              return NextResponse.json({ all: 0, processing: 0, completed: 0, archived: 0, note: 'manager name not found' });
            }
          }
        } catch (err) {
          console.error('[counts] direct reports / supervisors.json fallback error', err);
          return NextResponse.json({ all: 0, processing: 0, completed: 0, archived: 0, note: 'fallback error' });
        }
      }
    } else {
      return NextResponse.json({ all: 0, processing: 0, completed: 0, archived: 0 });
    }
  } else if (assignedToId || assignedToEmail) {
    if (!assignedToId && assignedToEmail) {
      const user = await prisma.user.findUnique({ where: { email: assignedToEmail } });
      if (user?.id) baseFilter.assignedToId = user.id;
    } else if (assignedToId) {
      baseFilter.assignedToId = assignedToId;
    }
  }

  // If no manager/assigned scope provided and requester is NOT a manager,
  // restrict counts to work orders created by the requester OR assigned to them.
  if (!managerId && !managerEmail && !assignedToId && !assignedToEmail && !isManager) {
    const me = String(currentUser.id);
    baseFilter.OR = [{ createdById: me }, { assignedToId: me }];
  }

  // Now compute counts for relevant buckets (all/processing/completed/archived)
  // `all` should reflect the baseFilter (no implicit exclusion of completed/archived)
  // Exclude archived/deleted work orders from the live counts.
  const allWhere = { ...baseFilter, archived: false };
  // If this request is scoped to a manager (managerId param or computed managerIdToUse earlier),
  // treat `processing` as the `created` (new/unassigned) bucket so managers see new tasks to assign.
  // Otherwise keep processing as assigned/in_progress for technicians.
  let processingWhere: any;
  const managerScopePresent = Boolean(params.get('managerId') || params.get('managerEmail')) || isManager;
  if (managerScopePresent) {
    processingWhere = { ...baseFilter, status: 'created', archived: false };
  } else {
    processingWhere = { ...baseFilter, status: { in: ['assigned', 'in_progress'] }, archived: false };
  }
  const completedWhere = { ...baseFilter, status: 'completed', archived: false };
  const archivedWhere = { ...baseFilter, archived: true };

  const [allCount, processingCount, completedCount, archivedCount] = await Promise.all([
    prisma.workOrder.count({ where: allWhere }),
    prisma.workOrder.count({ where: processingWhere }),
    prisma.workOrder.count({ where: completedWhere }),
    prisma.workOrder.count({ where: archivedWhere }),
  ]);

  return NextResponse.json({ all: allCount, processing: processingCount, completed: completedCount, archived: archivedCount });
}
