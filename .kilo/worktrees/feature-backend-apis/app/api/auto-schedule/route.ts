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
import { authOptions } from '../../../lib/auth';
import { prisma } from '../../../lib/prisma';
import { generatePmTaskNumber } from '../../../lib/taskNumber';

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
  // Map HQ synonyms to CAAZ for internal scoping
  const normalizedRegions = rawRegions.map(r => {
    const name = String(r).trim();
    if (name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq') return 'CAAZ';
    return name;
  });
  const [regions, zones] = await Promise.all([
    prisma.region.findMany({ select: { id: true, name: true } }),
    prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
  ]);
  const regionByName = new Map(regions.map(r => [String(r.name).toLowerCase(), r.id] as [string, string]));
  const zoneByName = new Map(zones.map(z => [String(z.name).toLowerCase(), z.id] as [string, string]));
  const regionIdSet = new Set(regions.map(r => r.id));
  const zoneIdSet = new Set(zones.map(z => z.id));
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
    return {
      id: m.id,
      teamId: m.teamId || null,
      regionIds: Array.from(regionIds),
      zoneIds: Array.from(zoneIds),
    };
  });
}

async function listSitesForSupervisor(user: any) {
  const { regionIds, zoneIds } = await resolveAreaIds(user);

  // Safety: if supervisor has no assigned regions/zones, return empty list
  // (prevent accidental broad queries that return ALL sites).
  if ((!regionIds || regionIds.length === 0) && (!zoneIds || zoneIds.length === 0)) {
    return [];
  }

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

// GET: preview counts for current supervisor
export async function GET(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  const user = session?.user;
  if (!user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const dbUser = await prisma.user.findUnique({ where: { id: String(user.id) }, include: { role: true } });
  if (!dbUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const roleKey = String(dbUser.role?.key || user.role || '').toLowerCase();
  if (roleKey !== 'supervisor' && roleKey !== 'manager' && roleKey !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const sites = await listSitesForSupervisor(dbUser);
  let neCount = 0;
  for (const s of sites) {
    const names = Array.isArray(s.allNeNames) && s.allNeNames.length > 0
      ? (s.allNeNames as any[]).filter(Boolean)
      : (s.neNameAndId ? [s.neNameAndId] : []);
    neCount += names.length;
  }
  return NextResponse.json({ siteCount: sites.length, neCount });
}

// POST: generate planned PM work orders for the current supervisor
export async function POST(req: Request) {
  try {
    const session: any = await getServerSession(authOptions as any);
    const user = session?.user;
    if (!user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const dbUser = await prisma.user.findUnique({ where: { id: String(user.id) }, include: { role: true } });
    if (!dbUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const roleKey = String(dbUser.role?.key || user.role || '').toLowerCase();
    if (roleKey !== 'supervisor' && roleKey !== 'manager' && roleKey !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode: Mode = (body.mode as Mode) || 'hourly';
    const forceNextWeek = Boolean(body.forceNextWeek);

    // Determine schedule window
    let startAt: Date;
    let endAt: Date;
    if (mode === 'hourly') {
      startAt = nextHour();
      endAt = addHours(startAt, 1);
    } else {
      startAt = nextThursday();
      endAt = nextWednesdayAfter(startAt);
      if (forceNextWeek) {
        startAt = addDays(startAt, 7);
        endAt = addDays(endAt, 7);
      }
    }

    const sites = await listSitesForSupervisor(dbUser);

    const adminUser = await prisma.user.findFirst({
      where: { role: { key: 'admin' } },
      select: { id: true, teamId: true },
    });

    const [regions, zones, managers] = await Promise.all([
      prisma.region.findMany({ select: { id: true, name: true } }),
      prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
      prisma.user.findMany({
        where: { role: { key: 'manager' } },
        select: { id: true, teamId: true, assignedRegion: true, assignedZone: true },
      }),
    ]);
    const managerScopes = buildManagerScopes(managers, regions, zones);
    const supervisorIds = Array.from(
      new Set(sites.map((s: any) => s.supervisorStationId).filter(Boolean) as string[]),
    );
    const supervisors = supervisorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: supervisorIds } },
          select: { id: true, teamId: true },
        })
      : [];
    const supervisorTeamById = new Map(supervisors.map((s) => [s.id, s.teamId]));

    // Map each siteId to a Group-* team via TeamSites so we can route
    // auto-scheduled work orders for grouped sites directly to the
    // appropriate group team.
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

    // Determine which account should own the auto-scheduled work orders.
    // For supervisors, we want the tasks to appear under their manager's
    // account so supervisors do not see them until a manager explicitly
    // assigns the work orders. For managers/admins, keep ownership on the
    // current user.
    let ownerUserId = String(user.id);
    if (roleKey === 'supervisor') {
      if (dbUser.immediateSupervisorId) {
        ownerUserId = dbUser.immediateSupervisorId;
      } else if (dbUser.managerId) {
        ownerUserId = dbUser.managerId;
      }
    }
    const createdIds: string[] = [];
    for (const s of sites) {
        const neList: string[] = getNeListForSite(s);
      for (const ne of neList) {
        const title = `PM: ${s.name}${ne ? ' - ' + ne : ''}`;
        // basic duplicate guard: avoid creating another planned PM with same title in the window
        const existing = await prisma.workOrder.findFirst({
          where: {
            planned: true,
            siteId: s.id,
            title,
            archived: false,
          },
          select: { id: true },
        });
        if (existing) continue;

        let managerForZone: typeof managerScopes[number] | undefined;
        const zoneId = s.zoneId ?? undefined;
        if (zoneId) {
          managerForZone = managerScopes.find((m) => m.zoneIds.includes(zoneId));
        }
        const managerForRegion = !s.zoneId && s.regionId
          ? managerScopes.find((m) => m.regionIds.includes(s.regionId))
          : undefined;
        let managerOwner = managerForZone || managerForRegion;

        // Prefer HQ/AAZ managers for AAZ/HQ sites (align with global auto-schedule rule)
        try {
          const z = s.zoneId ? zones.find((zz) => zz.id === s.zoneId) : null;
          const r = s.regionId ? regions.find((rr) => rr.id === s.regionId) : null;
          const zname = String(z?.name || '').toLowerCase();
          const rname = String(r?.name || '').toLowerCase();
          const isAazOrHqSite = /aaz/i.test(zname || rname) || zname.startsWith('hq-') || rname === 'hq' || rname === 'caaz';
          if (isAazOrHqSite) {
            const preferred = managers.find((m: any) => {
              const regs = Array.isArray(m.assignedRegion) ? m.assignedRegion : [];
              const zns = Array.isArray(m.assignedZone) ? m.assignedZone : [];
              if (s.regionId && regs.includes(s.regionId)) return true;
              if (s.zoneId && zns.includes(s.zoneId)) return true;
              const regNames = regs.map(String).join(' ').toLowerCase();
              const zoneNames = zns.map(String).join(' ').toLowerCase();
              if (/aaz/i.test(regNames) || /aaz/i.test(zoneNames)) return true;
              if (/hq/i.test(regNames) || /hq/i.test(zoneNames)) return true;
              const locCat = String((m as any).locationCategory || '').toLowerCase();
              if (locCat.includes('head quarter') || locCat === 'hq') return true;
              return false;
            });
            if (preferred) managerOwner = { id: preferred.id, teamId: preferred.teamId, regionIds: [], zoneIds: [] } as any;
          }
        } catch (err) {
          /* ignore */
        }

        const groupTeamId = siteGroupTeamBySiteId.get(s.id);

        // if the slot has an explicit supervisor, honor that first
        const assignedToIdRaw = s.supervisorStationId || undefined;

        // determine owner for site when no supervisor
        let fallbackManager = managerOwner;
        // if managerOwner not found and current user is an AAZ/HQ manager, make them owner
        if (!fallbackManager && roleKey === 'manager') {
            const ar = Array.isArray(dbUser.assignedRegion) ? dbUser.assignedRegion : [];
            const az = Array.isArray(dbUser.assignedZone) ? dbUser.assignedZone : [];
            const locCat = String(dbUser.locationCategory || '').toLowerCase();
            const isAazOrHqManager = ar.some(r=>/aaz|hq/i.test(String(r))) || az.some(z=>/aaz|hq/i.test(String(z))) || locCat.includes('head quarter');
            if (isAazOrHqManager) {
                fallbackManager = { id: dbUser.id, teamId: dbUser.teamId, regionIds: [], zoneIds: [] } as any;
            }
        }

        let finalAssignedTo = assignedToIdRaw || fallbackManager?.id;
        let resolvedTeamId: string | undefined;
        let initialStatus: string | undefined;

        if (groupTeamId) {
          // For grouped sites, create team-owned work orders and let
          // technicians claim them from the Group-* queue.
          resolvedTeamId = groupTeamId;
          finalAssignedTo = undefined;
          initialStatus = undefined;
        } else {
          resolvedTeamId = finalAssignedTo
            ? supervisorTeamById.get(finalAssignedTo) || fallbackManager?.teamId || undefined
            : undefined;
          initialStatus = assignedToIdRaw ? 'assigned' : undefined;
        }

        const created = await prisma.workOrder.create({
          data: {
            title,
            description: `Auto-scheduled PM task (${mode})`,
            type: 'pm',
            siteId: s.id,
            planned: true,
            scheduledStartAt: startAt,
            scheduledEndAt: endAt,
            createdById: ownerUserId,
            assignedToId: finalAssignedTo,
            teamId: resolvedTeamId,
            status: initialStatus,
            checklistScope: 'full',
            taskNumber: generatePmTaskNumber(),
          },
          select: { id: true },
        });
        createdIds.push(created.id);
      }
    }

    return NextResponse.json({ ok: true, count: createdIds.length, startAt, endAt, ids: createdIds });
  } catch (err) {
    console.error('auto-schedule POST error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
