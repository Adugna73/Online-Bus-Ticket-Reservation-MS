
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const user = (session && typeof session === 'object' && 'user' in session) ? (session as any).user : null;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let { name, siteCode, neNameAndId, regionId, zoneId, supervisorStationId, latitude, longitude } = body;

    if (!regionId && zoneId) {
      const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { regionId: true } });
      if (zone?.regionId) regionId = zone.regionId;
    }

    // Fallback: use manager's assignedRegion if regionId is not provided
    if (!regionId && Array.isArray(user.assignedRegion) && user.assignedRegion.length > 0) {
      regionId = user.assignedRegion[0];
    }

    if (!name || !siteCode || !regionId) {
      return NextResponse.json({ error: 'Missing required fields (name, siteCode, regionId)' }, { status: 400 });
    }

    // Allow managers/admins to add sites for any region/zone.
    // Additionally allow HQ supervisors to create sites (so they can set latitude/longitude)
    const role = (user.role || user.roleKey || '').toLowerCase();

    if (role === 'manager' || role === 'admin') {
      // full access
    } else if (role === 'supervisor') {
      // Permit only HQ supervisors to use this manager-style endpoint.
      const rawAllowedRegions = Array.isArray(user.assignedRegion) ? user.assignedRegion : [];
      const rawAllowedZones = Array.isArray(user.assignedZone) ? user.assignedZone : [];
      const isHeadQuarterSupervisor =
        rawAllowedRegions.some((r: any) => String(r || '').toLowerCase().includes('head quarter') || String(r || '').toLowerCase() === 'hq') ||
        rawAllowedZones.some((z: any) => String(z || '').toLowerCase().startsWith('hq-')) ||
        String((user as any).locationCategory || '').toLowerCase().includes('head quarter');

      if (!isHeadQuarterSupervisor) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // For HQ supervisors we still validate region/zone values below as usual.
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optionally validate regionId/zoneId exist
    let region = null;
    let zone = null;
    if (regionId) {
      region = await prisma.region.findUnique({ where: { id: regionId } });
      if (!region) return NextResponse.json({ error: 'Invalid regionId' }, { status: 400 });
    }
    if (zoneId) {
      zone = await prisma.zone.findUnique({ where: { id: zoneId } });
      if (!zone) return NextResponse.json({ error: 'Invalid zoneId' }, { status: 400 });
      // Ensure provided zone belongs to the provided region (prevent mismatched region/zone combos)
      if (regionId && zone.regionId !== regionId) {
        return NextResponse.json({ error: 'zone_region_mismatch', message: 'Zone does not belong to the specified region' }, { status: 400 });
      }
    }

    try {
      const newSite = await prisma.site.create({
        data: {
          name,
          siteCode,
          neNameAndId: neNameAndId || null,
          regionId,
          zoneId: zoneId || null,
          supervisorStationId: supervisorStationId || null,
          latitude: latitude || null,
          longitude: longitude || null,
        },
      });
      return NextResponse.json(newSite, { status: 201 });
    } catch (err: any) {
      if (err.code === 'P2002' && err.meta?.target?.includes('siteCode')) {
        return NextResponse.json({ error: 'Site code already exists', field: 'siteCode' }, { status: 400 });
      }
      console.error('[POST /api/sites]', err);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const region = params.get('region') || undefined;
  const zone = params.get('zone') || undefined;
  const regionIdParam = params.get('regionId') || undefined;
  const zoneIdParam = params.get('zoneId') || undefined;
  const scope = params.get('scope') || undefined;
  const supervisorId = params.get('supervisorId') || undefined;
  const where: any = {};

  // resolve optional session to enforce supervisor-scoped sites
  const session = (await getServerSession(authOptions as any)) as
    | { user?: { id?: string | number; role?: string; seeded?: boolean; assignedRegion?: any; assignedZone?: any } }
    | null;
  let currentUser: any = null;
  if (session?.user?.id) {
    currentUser = await prisma.user.findUnique({ where: { id: String(session.user.id) }, include: { role: true } });
  }

  // Resolve region/zone filters. Accept either IDs or names.
  const regionsAll = await prisma.region.findMany({ select: { id: true, name: true } });
  const zonesAll = await prisma.zone.findMany({ select: { id: true, name: true, regionId: true } });
  const areasAll = await prisma.area.findMany({ select: { id: true, name: true, regionId: true } });

  function matchRegionId(raw?: string) {
    if (!raw) return undefined;
    const v = String(raw).trim();
    const vLower = v.toLowerCase();
    return (
      regionsAll.find(r => r.id === v)?.id ||
      regionsAll.find(r => r.name.toLowerCase() === vLower)?.id
    );
  }

  function matchZoneId(raw?: string, preferRegionId?: string) {
    if (!raw) return undefined;
    const v = String(raw).trim();
    const vLower = v.toLowerCase();
    const exactInRegion = preferRegionId
      ? zonesAll.find(z => z.regionId === preferRegionId && z.name.toLowerCase() === vLower)
      : undefined;
    const byId = zonesAll.find(z => z.id === v);
    const byName = zonesAll.find(z => z.name.toLowerCase() === vLower);
    const byIncludesInRegion = preferRegionId
      ? zonesAll.find(z => z.regionId === preferRegionId && z.name.toLowerCase().includes(vLower))
      : undefined;
    const byIncludesAny = zonesAll.find(z => z.name.toLowerCase().includes(vLower));
    return (exactInRegion || byId || byName || byIncludesInRegion || byIncludesAny)?.id;
  }

  function matchAreaId(raw?: string, preferRegionId?: string) {
    if (!raw) return undefined;
    const v = String(raw).trim();
    const vLower = v.toLowerCase();
    const exactInRegion = preferRegionId
      ? areasAll.find(a => a.regionId === preferRegionId && a.name.toLowerCase() === vLower)
      : undefined;
    const byId = areasAll.find(a => a.id === v);
    const byName = areasAll.find(a => a.name.toLowerCase() === vLower);
    const byIncludesInRegion = preferRegionId
      ? areasAll.find(a => a.regionId === preferRegionId && a.name.toLowerCase().includes(vLower))
      : undefined;
    const byIncludesAny = areasAll.find(a => a.name.toLowerCase().includes(vLower));
    return (exactInRegion || byId || byName || byIncludesInRegion || byIncludesAny)?.id;
  }

  const regionFilterId = matchRegionId(regionIdParam) || matchRegionId(region);
  // if a region filter is present, prefer zones in that region for name matching
  const zoneFilterId = matchZoneId(zoneIdParam, regionFilterId) || matchZoneId(zone, regionFilterId);
  const areaNameRaw = params.get('area') || undefined;
  const areaFilterId = matchAreaId(params.get('areaId') || undefined, regionFilterId) || matchAreaId(areaNameRaw, regionFilterId);

  const isRegionScope = scope === 'region';

  if (!isRegionScope && regionFilterId) where.AND = [...(where.AND || []), { regionId: regionFilterId }];
  if (!isRegionScope) {
    if (zoneFilterId) where.AND = [...(where.AND || []), { zoneId: zoneFilterId }];
    if (areaFilterId) where.AND = [...(where.AND || []), { areaId: areaFilterId }];
    // If area name is provided but sites don't have areaId populated, fall back to zone name match
    if (areaNameRaw) {
      const areaNameLower = String(areaNameRaw).trim().toLowerCase();
      if (areaNameLower) {
        const areaOr: any[] = [];
        if (areaFilterId) areaOr.push({ areaId: areaFilterId });
        const zoneNameFilter = { zone: { name: { contains: areaNameLower, mode: 'insensitive' } } };
        if (regionFilterId) {
          areaOr.push({ AND: [{ regionId: regionFilterId }, zoneNameFilter] });
        } else {
          areaOr.push(zoneNameFilter);
        }
        where.AND = [...(where.AND || []), { OR: areaOr }];
      }
    }
  }
  // supervisorId filter removed: supervisorStationId is not a direct field on Site

  // If requester is a supervisor, restrict sites to their assigned regions/zones
  const roleKey = (currentUser?.role?.key || '').toString().toLowerCase() || (session?.user?.role || '').toString().toLowerCase();
  const isManagerOrSupervisor = roleKey === 'supervisor' || roleKey === 'manager';
  if (isManagerOrSupervisor) {
    const rawAllowedRegions = Array.isArray(currentUser?.assignedRegion) ? currentUser.assignedRegion : [];
    const rawAllowedZones = Array.isArray(currentUser?.assignedZone) ? currentUser.assignedZone : [];
    const isHeadQuarterSupervisor = rawAllowedRegions.some((r: any) => {
      const v = String(r || '').toLowerCase();
      return v.includes('head quarter') || v === 'hq';
    });
    // Additional check: consider supervisors with any AAZ or HQ assignment as
    // "AAZ/HQ supervisors" so they are not geographically restricted when
    // picking zones. This mirrors the client-side `isAazOrHqSupervisor`.
    const isAazHqSupervisor =
      roleKey === 'supervisor' &&
      (
        rawAllowedRegions.some((r: any) => {
          const v = String(r || '').toLowerCase();
          return v.includes('aaz');
        }) ||
        rawAllowedZones.some((z: any) => {
          const v = String(z || '').toLowerCase();
          return v.includes('aaz') || v.includes('hq');
        }) ||
        String((currentUser as any)?.locationCategory || '')
          .toLowerCase()
          .includes('head quarter')
      );
    // Normalize allowed regions/zones: entries may be stored as either
    // Region/Zone IDs or as seeded short codes/names (e.g. "WR", "Bako").
    let allowedRegions: string[] = [];
    let allowedZones: string[] = [];

    const caazRegionId = regionsAll.find(r => r.name.toLowerCase() === 'caaz')?.id;

    // Normalize regions from DB arrays (may contain ids or names)
    for (const raw of rawAllowedRegions) {
      const lower = String(raw || '').toLowerCase();
      const resolved = (lower.includes('head quarter') || lower === 'hq')
        ? caazRegionId
        : matchRegionId(String(raw || ''));
      if (resolved) allowedRegions.push(resolved);
    }

    // Normalize zones from DB arrays (may contain ids or names)
    for (const raw of rawAllowedZones) {
      const lower = String(raw || '').toLowerCase();
      const resolved = (lower.includes('head quarter') || lower === 'hq')
        ? (zonesAll.find(z => z.name.toLowerCase() === 'caaz')?.id)
        : matchZoneId(String(raw || ''));
      if (resolved) allowedZones.push(resolved);
    }

    // Seeded supervisors often have empty assignedRegion/assignedZone in DB.
    // Fall back to locationCategory/location from the user record to scope them.
    if (!allowedRegions.length && !allowedZones.length && !isHeadQuarterSupervisor) {
      const locCat = String((currentUser as any)?.locationCategory || '').trim();
      const loc = String((currentUser as any)?.location || '').trim();
      const locCatId = matchRegionId(locCat);
      if (locCatId) allowedRegions.push(locCatId);
      // Prefer Area match (e.g., "Ghimbi") over Zone code match (e.g., "WAAZ")
      const locAreaId = matchAreaId(loc, locCatId);
      if (locAreaId) {
        where.AND = [...(where.AND || []), { areaId: locAreaId }];
      } else {
        // If no Area match exists, fall back to Zone matching as a best-effort.
        const locZoneId = matchZoneId(loc, locCatId);
        if (locZoneId) {
          allowedZones.push(locZoneId);
          const z = zonesAll.find(z => z.id === locZoneId);
          if (z?.regionId) allowedRegions.push(z.regionId);
        }
      }
    }

    const zoneDerivedRegionIds = allowedZones
      .map(zId => zonesAll.find(z => z.id === zId)?.regionId)
      .filter((id): id is string => !!id);

    allowedRegions = Array.from(new Set([...allowedRegions, ...zoneDerivedRegionIds]));
    allowedZones = Array.from(new Set(allowedZones));

    // Special case: AAZ/HQ supervisors handle multi-zone tasks across AAZ/HQ
    // so we intentionally do NOT enforce the narrowed allowedRegions/allowedZones
    // filter for them. They are allowed to fetch any sites that match the
    // incoming region/zone parameters (e.g. any AAZ/HQ zone they pick).
    if (!isAazHqSupervisor) {
      // If the user has explicit allowed region/zone entries, enforce those
      // restrictions so managers and regular supervisors only see sites
      // within their assigned scope.
      if (allowedRegions.length || allowedZones.length) {
        if (isRegionScope) {
          const locCat = String((currentUser as any)?.locationCategory || '').trim();
          const idPrefix = String((currentUser as any)?.id || '').split('-')[0];
          const rawAssigned = Array.isArray((currentUser as any)?.assignedRegion)
            ? (currentUser as any).assignedRegion
            : [];
          const rawAssignedFirst = rawAssigned.length ? String(rawAssigned[0]) : '';
          const preferredRegionId =
            matchRegionId(locCat) ||
            matchRegionId(rawAssignedFirst) ||
            matchRegionId(idPrefix) ||
            (String(locCat).toLowerCase().includes('hq') ? caazRegionId : undefined) ||
            (String(idPrefix).toLowerCase() === 'hq' ? caazRegionId : undefined);

          const requestedRegionId = regionFilterId || preferredRegionId || allowedRegions[0];
          if (!requestedRegionId) {
            return NextResponse.json([]);
          }

          if (allowedRegions.length > 0 && !allowedRegions.includes(requestedRegionId)) {
            return NextResponse.json([]);
          }

          where.AND = [{ regionId: requestedRegionId }];
        } else {
          // Apply supervisor/manager scope using the region-vs-zone rule:
          const scopeOr: any[] = [];
          if (allowedZones.length) scopeOr.push({ zoneId: { in: allowedZones } });
          if (allowedRegions.length) scopeOr.push({ regionId: { in: allowedRegions }, zoneId: null });
          where.AND = [...(where.AND || []), { OR: scopeOr }];
        }
      }
    }
  }

  if (isRegionScope && !isManagerOrSupervisor && regionFilterId) {
    where.AND = [{ regionId: regionFilterId }];
  }

  const sites = await prisma.site.findMany({
    where,
    include: {
      region: true,
      zone: true,
      area: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return NextResponse.json(sites);
}