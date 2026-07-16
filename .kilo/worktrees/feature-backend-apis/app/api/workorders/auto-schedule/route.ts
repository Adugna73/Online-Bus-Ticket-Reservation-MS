function getNeListForSite(site: any): string[] {
  const rawList: string[] = Array.isArray(site.allNeNames) && (site.allNeNames as any[]).length > 0
    ? ((site.allNeNames as any[]).filter(Boolean) as string[])
    : site.neNameAndId
    ? [String(site.neNameAndId)]
    : [];

  const siteToken = String(site.name || '').toLowerCase().replace(/\s+/g, '');
  const filtered = rawList.filter((ne) => {
    const slug = String(ne || '').toLowerCase().replace(/\s+/g, '');
    return siteToken && slug.includes(siteToken);
  });

  if (filtered.length) return filtered;
  if (site.neNameAndId) return [String(site.neNameAndId)];
  return rawList;
}
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { Prisma } from '@prisma/client';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { findPreferredManagerForSite } from '../../../../lib/assignment';
import { generatePmTaskNumber } from '../../../../lib/taskNumber';

// This route exposes the weekly auto-scheduling logic (similar to
// scripts/auto-schedule-weekly.ts) so that an admin can trigger it
// from the UI.

type Mode = 'hourly' | 'weekly';

function nextHour(start?: Date) {
  const d = new Date(start ?? Date.now());
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function addHours(d: Date, hours: number) {
  const n = new Date(d.getTime());
  n.setHours(n.getHours() + hours);
  return n;
}

function addDays(d: Date, days: number) {
  const n = new Date(d.getTime());
  n.setDate(n.getDate() + days);
  return n;
}

function nextThursday(start?: Date) {
  const d = new Date(start ?? Date.now());
  const day = d.getDay(); // 0=Sun, 4=Thu
  const diff = (4 - day + 7) % 7; // days until Thursday
  d.setDate(d.getDate() + diff);
  d.setHours(9, 0, 0, 0); // release at 09:00 local
  return d;
}

function nextWednesdayAfter(thursday: Date) {
  const d = new Date(thursday.getTime());
  d.setDate(d.getDate() + 6); // Thu -> Wed
  d.setHours(17, 0, 0, 0); // due at 17:00 local
  return d;
}

function normalizeRegions(rawRegions: string[]): string[] {
  return rawRegions.map((r) => {
    const name = String(r).trim();
    if (name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq') return 'CAAZ';
    return name;
  });
}

async function resolveAreaIds(user: any) {
  const rawRegions: string[] = Array.isArray(user?.assignedRegion) ? user.assignedRegion : [];
  const rawZones: string[] = Array.isArray(user?.assignedZone) ? user.assignedZone : [];
  if (rawRegions.length === 0 && rawZones.length === 0) return { regionIds: [], zoneIds: [] };
  const normalizedRegions = normalizeRegions(rawRegions);
  const [regions, zones] = await Promise.all([
    prisma.region.findMany({ select: { id: true, name: true } }),
    prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
  ]);
  const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]));
  const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]));
  const regionIdSet = new Set(regions.map((r) => r.id));
  const zoneIdSet = new Set(zones.map((z) => z.id));
  const regionIds = new Set<string>();
  const zoneIds = new Set<string>();

  for (const v of normalizedRegions) {
    const raw = String(v || '').trim();
    if (!raw) continue;
    if (regionIdSet.has(raw)) {
      regionIds.add(raw);
      continue;
    }
    const mapped = regionByName.get(raw.toLowerCase());
    if (mapped) regionIds.add(mapped);
  }
  for (const v of rawZones) {
    const raw = String(v || '').trim();
    if (!raw) continue;
    if (zoneIdSet.has(raw)) {
      zoneIds.add(raw);
      continue;
    }
    const mapped = zoneByName.get(raw.toLowerCase());
    if (mapped) zoneIds.add(mapped);
  }

  if (zoneIds.size > 0) {
    for (const z of zones) {
      if (zoneIds.has(z.id) && z.regionId) regionIds.add(z.regionId);
    }
  }

  return { regionIds: Array.from(regionIds), zoneIds: Array.from(zoneIds) };
}

function buildManagerScopes(managers: any[], regions: any[], zones: any[]) {
  const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]));
  const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]));
  const regionIdSet = new Set(regions.map((r) => r.id));
  const zoneIdSet = new Set(zones.map((z) => z.id));

  return managers.map((m) => {
    const regionIds = new Set<string>();
    const zoneIds = new Set<string>();
    const rawRegions: string[] = Array.isArray(m.assignedRegion) ? m.assignedRegion : [];
    const rawZones: string[] = Array.isArray(m.assignedZone) ? m.assignedZone : [];

    for (const v of normalizeRegions(rawRegions)) {
      const raw = String(v || '').trim();
      if (!raw) continue;
      if (regionIdSet.has(raw)) {
        regionIds.add(raw);
        continue;
      }
      const mapped = regionByName.get(raw.toLowerCase());
      if (mapped) regionIds.add(mapped);
    }
    for (const v of rawZones) {
      const raw = String(v || '').trim();
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
      const aazId = regionByName.get('aaz');
      if (caazId) regionIds.add(caazId);
      if (aazId) regionIds.add(aazId);
      zones
        .filter((z) => {
          const zn = String(z.name).toLowerCase();
          return zn.startsWith('hq-') || zn.includes('aaz');
        })
        .forEach((z) => zoneIds.add(z.id));
    }
    return {
      id: m.id,
      teamId: m.teamId || null,
      regionIds: Array.from(regionIds),
      zoneIds: Array.from(zoneIds),
    };
  });
}

async function listSitesForUser(user: any) {
  const { regionIds, zoneIds } = await resolveAreaIds(user);
  const where: any = {};
  const orParts: any[] = [];
  if (zoneIds.length > 0) {
    orParts.push({ zoneId: { in: zoneIds } });
  }
  if (regionIds.length > 0) {
    orParts.push({ regionId: { in: regionIds }, zoneId: null });
  }
  if (orParts.length) where.OR = orParts;
  const sites = await prisma.site.findMany({
    where,
    select: { id: true, name: true, neNameAndId: true, allNeNames: true, supervisorStationId: true, regionId: true, zoneId: true },
  });
  return sites;
}

async function computeWeeklyCapacityForUser(user: any): Promise<number> {
  const tasksPerTech = Number(process.env.PM_TASKS_PER_TECH_WEEK || '4');
  const fallbackCapacity = Number(process.env.PM_DEFAULT_WEEKLY_CAPACITY || '4');

  const techCount = await prisma.user.count({
    where: {
      immediateSupervisorId: user.id,
      role: { key: 'tech' },
    },
  });

  if (techCount > 0) {
    return techCount * tasksPerTech;
  }

  return fallbackCapacity;
}

async function scheduleForUser(user: any, mode: Mode, now: Date, opts?: { forceNextWeek?: boolean }) {
  const roleKey = String(user.role?.key || '').toLowerCase();
  let startAt: Date;
  let endAt: Date;
  if (mode === 'hourly') {
    startAt = nextHour(now);
    endAt = addHours(startAt, 1);
  } else {
    startAt = nextThursday(now);
    endAt = nextWednesdayAfter(startAt);
    if (opts?.forceNextWeek) {
      startAt = addDays(startAt, 7);
      endAt = addDays(endAt, 7);
    }
  }

  let sites = await listSitesForUser(user);
  // Restrict HQ users to HQ-specific sites only (prevent HQ users from auto-creating
  // work orders across unrelated regions). Muhaba/Head-Quarter users should not
  // auto-schedule for arbitrary regional sites unless explicitly configured.
  const locCat = String(user.locationCategory || '').toLowerCase();
  const isHqUser = locCat.includes('head quarter') || locCat === 'hq';
  if (isHqUser && sites.length) {
    const allRegions = await prisma.region.findMany({ select: { id: true, name: true } });
    const allZones = await prisma.zone.findMany({ select: { id: true, name: true } });
    const regionById = new Map(allRegions.map((r) => [r.id, String(r.name || '').toLowerCase()]));
    const zoneById = new Map(allZones.map((z) => [z.id, String(z.name || '').toLowerCase()]));
    const caazId = allRegions.find((r) => String(r.name || '').toLowerCase() === 'caaz')?.id || null;
    const aazId = allRegions.find((r) => String(r.name || '').toLowerCase() === 'aaz')?.id || null;
    sites = sites.filter((s) => {
      const rname = regionById.get(s.regionId || '') || '';
      const zname = zoneById.get(s.zoneId || '') || '';
      // Allow CAAX/CAAZ, AAZ and HQ-related zones; keep other sites only if they were returned
      // by listSitesForUser (which already respects assignedRegion/assignedZone).
      return (
        (caazId && s.regionId === caazId) ||
        (aazId && s.regionId === aazId) ||
        /aaz/i.test(rname) ||
        /aaz/i.test(zname) ||
        zname.startsWith('hq-') ||
        rname === 'hq' ||
        rname === 'caaz'
      );
    });
  }
  if (!sites.length) return { createdCount: 0, startAt, endAt };

  const adminUser = await prisma.user.findFirst({
    where: { role: { key: 'admin' } },
    select: { id: true, teamId: true },
  });

  const [regions, zones, managers] = await Promise.all([
    prisma.region.findMany({ select: { id: true, name: true } }),
    prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
    prisma.user.findMany({
      where: { role: { key: 'manager' } },
      select: { id: true, teamId: true, assignedRegion: true, assignedZone: true, locationCategory: true, email: true, fullName: true },
    }),
  ]);
  const managerScopes = buildManagerScopes(managers, regions, zones);

  // Map each siteId to a Group-* team (if any) via TeamSites relation.
  // A site can only belong to a single Group-* team at a time.
  const siteIds = Array.from(new Set(sites.map((s) => s.id)));
  const groupTeams = siteIds.length
    ? await prisma.team.findMany({
        where: {
          name: { startsWith: 'Group-' },
          sites: { some: { id: { in: siteIds } } },
        },
        select: {
          id: true,
          sites: { select: { id: true } },
        },
      })
    : [];
  const siteGroupTeamBySiteId = new Map<string, string>();
  for (const t of groupTeams) {
    for (const s of t.sites) {
      siteGroupTeamBySiteId.set(s.id, t.id);
    }
  }

  const siteSupervisorById = new Map(
    sites.map((s) => [s.id, s.supervisorStationId || null] as [string, string | null]),
  );
  const supervisorIds = Array.from(
    new Set(sites.map((s) => s.supervisorStationId).filter(Boolean) as string[]),
  );
  const supervisors = supervisorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: supervisorIds } },
        select: { id: true, teamId: true, assignedRegion: true, assignedZone: true, locationCategory: true },
      })
    : [];
  const supervisorTeamById = new Map(supervisors.map((s) => [s.id, s.teamId]));
  const supervisorById = new Map(supervisors.map((s) => [s.id, s] as [string, any]));

  type Combo = { siteId: string; siteName: string; ne: string; title: string };
  const combos: Combo[] = [];

  for (const s of sites) {
    const neList: string[] = getNeListForSite(s);

    if (!neList.length) {
      const title = `PM: ${s.name}`;
      combos.push({ siteId: s.id, siteName: s.name, ne: '', title });
      continue;
    }

    for (const ne of neList) {
      const title = `PM: ${s.name}${ne ? ' - ' + ne : ''}`;
      combos.push({ siteId: s.id, siteName: s.name, ne, title });
    }
  }

  if (!combos.length) return { createdCount: 0, startAt, endAt };

  // Prioritize least recently served combos; we no longer cap at 4/year.
    // Simple deterministic order: by site then NE to cover all combos; no yearly cap.
    const candidates = combos
      .map((c) => ({ combo: c }))
      .sort((a, b) => {
        if (a.combo.siteName !== b.combo.siteName) return a.combo.siteName.localeCompare(b.combo.siteName);
        return a.combo.ne.localeCompare(b.combo.ne);
      });

    const capacity = Math.max(await computeWeeklyCapacityForUser(user), 4);
    let createdCount = 0;

    for (const { combo } of candidates) {
      if (createdCount >= capacity) break;

      const existing = await prisma.workOrder.findFirst({
        where: {
          planned: true,
          type: 'pm',
          siteId: combo.siteId,
          title: combo.title,
          archived: false,
        },
        select: { id: true },
      });
      if (existing) continue;

      const site = sites.find((s) => s.id === combo.siteId);
      const siteZoneId = site?.zoneId || null;
      const siteRegionId = site?.regionId || null;
      // if the current user is an AAZ/HQ manager we want them to receive all
      // auto-scheduled tasks regardless of the site's own zone/region. this
      // ensures Muhaba (AAZ/HQ manager) keeps Bole orders instead of them falling
      // to the ER manager.
      const ar = Array.isArray(user.assignedRegion) ? user.assignedRegion : [];
      const az = Array.isArray(user.assignedZone) ? user.assignedZone : [];
      const locCat = String(user.locationCategory || '').toLowerCase();
      const isAazOrHqManager =
        ar.some((r: any) => /aaz|hq/i.test(String(r))) ||
        az.some((z: any) => /aaz|hq/i.test(String(z))) ||
        locCat.includes('head quarter');

      // if current user is AAZ/HQ manager, they own all sites unconditionally
      let managerOwner;
      if (roleKey === 'manager' && isAazOrHqManager) {
        managerOwner = { id: user.id, teamId: user.teamId, regionIds: [], zoneIds: [] } as any;
      } else {
        const managerForZone = siteZoneId
          ? managerScopes.find((m) => m.zoneIds.includes(siteZoneId))
          : undefined;
        const managerForRegion = !siteZoneId && siteRegionId
          ? managerScopes.find((m) => m.regionIds.includes(siteRegionId))
          : undefined;

        // Prefer HQ/AAZ managers for HQ/AAZ sites (explicit business rule):
        // if the site zone/region name contains 'aaz' or 'hq', pick a manager
        // whose assignedZone/assignedRegion contains AAZ/HQ (otherwise fall back).
        managerOwner = managerForZone || managerForRegion;
      }
      try {
        const preferred = findPreferredManagerForSite(managers, siteZoneId, siteRegionId, zones, regions);
        if (preferred) {
          managerOwner = { id: preferred.id, teamId: preferred.teamId, regionIds: [], zoneIds: [] } as any;
        }
      } catch (err) {
        // ignore and keep existing managerOwner
      }

      // Prefer Group-* team ownership when the site is attached to a group.
      const groupTeamId = siteGroupTeamBySiteId.get(combo.siteId);

      let assignedToId =
        siteSupervisorById.get(combo.siteId) ||
        managerOwner?.id ||
        undefined;

      // Validate assignedToId does not cross regions: the assignee must be allowed
      // to receive work orders for the site's region. If not allowed, leave unassigned
      if (assignedToId) {
        let assigneeAllowed = true;
        const assigneeSup = supervisorById.get(assignedToId);
        if (assigneeSup) {
          const assigneeRegions = Array.isArray(assigneeSup.assignedRegion) ? assigneeSup.assignedRegion : [];
          if (assigneeRegions.length > 0 && siteRegionId && !assigneeRegions.includes(siteRegionId)) {
            assigneeAllowed = false;
          }
        } else {
          // check managerOwner (from managerScopes) which may be used as fallback
          if (managerOwner && managerOwner.id === assignedToId) {
            const mo = managers.find((m) => m.id === managerOwner.id as string) as any | undefined;
            const moRegions = Array.isArray(mo?.assignedRegion) ? mo.assignedRegion : [];
            if (moRegions.length > 0 && siteRegionId && !moRegions.includes(siteRegionId)) assigneeAllowed = false;
          }
        }

        if (!assigneeAllowed) {
          // don't assign across-region to a user; leave unassigned instead of using an admin fallback
          assignedToId = undefined;
        }
      }

      // Compute final team and status. If the site belongs to a Group-* team,
      // assign the work order to that team and leave assignedToId empty so
      // technicians in the group can claim it. Otherwise, fall back to
      // supervisor/manager-based assignment.
      let finalTeamId: string | undefined;
      let initialStatus: string | undefined;
      if (groupTeamId) {
        finalTeamId = groupTeamId;
        assignedToId = undefined;
        initialStatus = undefined;
      } else {
        const resolvedTeamId = assignedToId
          ? supervisorTeamById.get(assignedToId) || managerOwner?.teamId || undefined
          : undefined;
        finalTeamId = resolvedTeamId;
        initialStatus = assignedToId ? 'assigned' : undefined;
      }

      let attempt = 0;
      let created = false;
      while (attempt < 7 && !created) {
        const candidate = generatePmTaskNumber(new Date(Date.now() + attempt));
        try {
          await prisma.workOrder.create({
            data: {
              title: combo.title,
              description: `Auto-scheduled PM task (${mode})`,
              type: 'pm',
              siteId: combo.siteId,
              planned: true,
              scheduledStartAt: startAt,
              scheduledEndAt: endAt,
              createdById: user.id,
              assignedToId,
              teamId: finalTeamId,
              status: initialStatus,
              checklistScope: 'full',
              taskNumber: candidate,
            },
          });
          created = true;
        } catch (err: any) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            attempt += 1;
            continue;
          }
          throw err;
        }
      }
      if (created) createdCount += 1;
    }

    return { createdCount, startAt, endAt };
}

export async function POST(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const roleLower = String(session.user.role || '').toLowerCase();
  if (roleLower !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let mode: Mode = 'weekly';
  let forceNextWeek = false;
  try {
    const body = await req.json().catch(() => null);
    if (body && (body.mode === 'weekly' || body.mode === 'hourly')) {
      mode = body.mode;
    }
    forceNextWeek = Boolean(body?.forceNextWeek);
  } catch (e) {
    // ignore body parse errors and keep default mode
  }

  const now = new Date();

  const users = await prisma.user.findMany({
    where: {
      enabled: true,
      OR: [
        { assignedRegion: { isEmpty: false } },
        { assignedZone: { isEmpty: false } },
      ],
    },
    include: { role: true },
  });

  async function runAuto(force: boolean) {
    let total = 0;
    const per: Array<{ id: string; fullName: string | null; email: string | null; createdCount: number }> = [];
    for (const user of users) {
      const roleKey = String(user.role?.key || '').toLowerCase();
      // only run auto-schedule for actual managers (exclude admin accounts)
      if (roleKey !== 'manager') continue;
      const { createdCount } = await scheduleForUser(user, mode, now, { forceNextWeek: force });
      if (createdCount > 0) {
        per.push({
          id: user.id,
          fullName: user.fullName || null,
          email: user.email || null,
          createdCount,
        });
      }
      total += createdCount;
    }
    return { total, per };
  }

  let forcedNextWeekApplied = false;
  let { total: totalCreated, per: perUser } = await runAuto(forceNextWeek);

  // If nothing new was created for the current week and caller did not force next week,
  // try the next window so admins can generate fresh orders without a manual flag.
  if (mode === 'weekly' && !forceNextWeek && totalCreated === 0) {
    const fallback = await runAuto(true);
    if (fallback.total > 0) {
      forcedNextWeekApplied = true;
      totalCreated = fallback.total;
      perUser = fallback.per;
    }
  }

  return NextResponse.json({ ok: true, mode, totalCreated, perUser, forcedNextWeekApplied });
}
