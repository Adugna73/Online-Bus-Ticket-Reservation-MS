import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const region = params.get('region') || undefined;
  const zone = params.get('zone') || undefined;
  const regionId = params.get('regionId') || undefined;
  const zoneId = params.get('zoneId') || undefined;
  const area = params.get('area') || undefined;
  const areaId = params.get('areaId') || undefined;
  const scope = params.get('scope') || undefined;
  const skipScope = params.get('skipScope') === 'true';

  const where: any = {};
  const [regionsAll, zonesAll, areasAll] = await Promise.all([
    prisma.region.findMany({ select: { id: true, name: true } }),
    prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
    prisma.area.findMany({ select: { id: true, name: true, regionId: true } }),
  ]);

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

  const regionFilterId = matchRegionId(regionId) || matchRegionId(region);
  const zoneFilterId = matchZoneId(zoneId, regionFilterId) || matchZoneId(zone, regionFilterId);
  const areaNameRaw = area || undefined;
  const areaFilterId = matchAreaId(areaId, regionFilterId) || matchAreaId(areaNameRaw, regionFilterId);

  const isRegionScope = scope === 'region';

  if (!isRegionScope && regionFilterId) where.AND = [...(where.AND || []), { regionId: regionFilterId }];
  if (!isRegionScope) {
    if (zoneFilterId) where.AND = [...(where.AND || []), { zoneId: zoneFilterId }];
    if (areaFilterId) where.AND = [...(where.AND || []), { areaId: areaFilterId }];
    // Area fallback: if area name provided but areaId not populated on sites, match zone name
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

  // Enforce supervisor scoping if applicable
  const session = (await getServerSession(authOptions as any)) as
    | { user?: { id?: string | number; role?: string; seeded?: boolean; assignedRegion?: any; assignedZone?: any } }
    | null;
  if (session?.user?.id) {
    const currentUser = await prisma.user.findUnique({ where: { id: String(session.user.id) }, include: { role: true } });
    const roleKey = (currentUser?.role?.key || '').toString().toLowerCase() || (session.user.role || '').toString().toLowerCase();
    const requesterIsSupervisor = roleKey === 'supervisor';
    const requesterIsManager = roleKey === 'manager';
    const isManagerOrSupervisor = requesterIsSupervisor || requesterIsManager;
    const isAazOrHqUser = (
      Array.isArray(currentUser?.assignedRegion) &&
      currentUser.assignedRegion.some((r: any) => {
        const v = String(r || '').toLowerCase();
        return v.includes('aaz') || v.includes('head quarter') || v === 'hq';
      })
    ) || (
      Array.isArray(currentUser?.assignedZone) &&
      currentUser.assignedZone.some((z: any) => {
        const v = String(z || '').toLowerCase();
        return v.includes('aaz') || v.includes('hq');
      })
    ) ||
      String((currentUser as any)?.locationCategory || '').toLowerCase().includes('aaz') ||
      String((currentUser as any)?.locationCategory || '').toLowerCase().includes('head quarter');
    if (isManagerOrSupervisor && !skipScope && !isAazOrHqUser) {
      const rawAllowedRegions = Array.isArray(currentUser?.assignedRegion) ? currentUser.assignedRegion : [];
      const rawAllowedZones = Array.isArray(currentUser?.assignedZone) ? currentUser.assignedZone : [];

        const isHeadQuarterSupervisor = rawAllowedRegions.some((r: any) => {
          const v = String(r || '').toLowerCase();
          return v.includes('head quarter') || v === 'hq';
        });

      // Normalize allowed regions/zones: values may be stored as Region/Zone
      // IDs or as human-readable codes/names (e.g. "WR", "Bako").
      let allowedRegions: string[] = [];
      let allowedZones: string[] = [];

      const caazRegionId = regionsAll.find(r => r.name.toLowerCase() === 'caaz')?.id;
      const caazZoneId = zonesAll.find(z => z.name.toLowerCase() === 'caaz')?.id;

      if (rawAllowedRegions.length || rawAllowedZones.length) {
        const regionIds = new Set(regionsAll.map((r) => r.id));
        const regionByName = new Map(regionsAll.map((r) => [r.name, r.id] as [string, string]));
        const zoneIds = new Set(zonesAll.map((z) => z.id));
        const zoneByName = new Map(zonesAll.map((z) => [z.name, z.id] as [string, string]));

        for (const original of rawAllowedRegions) {
          let val = original;
          const lower = String(original || '').toLowerCase();
          // Special handling: map Head Quarter / HQ supervisors to CAAZ
          // so their NE scope matches actual site regions.
          if (lower.includes('head quarter') || lower === 'hq') {
            if (regionByName.has('CAAZ')) {
              val = 'CAAZ';
            }
          }

          if (lower.includes('head quarter') || lower === 'hq') {
            if (caazRegionId) allowedRegions.push(caazRegionId);
            continue;
          }

          if (regionIds.has(val)) allowedRegions.push(val);
          else if (regionByName.has(val)) allowedRegions.push(regionByName.get(val)!);
        }
        for (const original of rawAllowedZones) {
          let val = original;
          const lower = String(original || '').toLowerCase();
          // For HQ users, treat their zone as CAAZ as well when present.
          if (lower.includes('head quarter') || lower === 'hq') {
            if (caazZoneId) {
              allowedZones.push(caazZoneId);
              continue;
            }
          }

          if (zoneIds.has(val)) allowedZones.push(val);
          else if (zoneByName.has(val)) allowedZones.push(zoneByName.get(val)!);
        }
      }

      // Seeded managers/supervisors may rely on locationCategory/location
      if (allowedRegions.length === 0 && allowedZones.length === 0 && !isHeadQuarterSupervisor) {
        const locCat = String((currentUser as any)?.locationCategory || '').trim();
        const loc = String((currentUser as any)?.location || '').trim();
        const locCatId = matchRegionId(locCat);
        if (locCatId) allowedRegions.push(locCatId);
        if (scope !== 'region') {
          const locAreaId = matchAreaId(loc, locCatId);
          if (locAreaId) {
            where.AND = [...(where.AND || []), { areaId: locAreaId }];
          } else {
            const locZoneId = matchZoneId(loc, locCatId);
            if (locZoneId) {
              allowedZones.push(locZoneId);
            }
          }
        }
      }
      const zoneDerivedRegionIds = allowedZones
        .map(zId => zonesAll.find(z => z.id === zId)?.regionId)
        .filter((id): id is string => !!id);

      allowedRegions = Array.from(new Set([...allowedRegions, ...zoneDerivedRegionIds]));
      allowedZones = Array.from(new Set(allowedZones));

      const isSeededUser = !!(session.user as any)?.seeded;
      // For normal managers/supervisors, require assigned areas; for newly-seeded users
      // (no assignedRegion/assignedZone yet), allow querying by explicit region/zone
      if (!isSeededUser && allowedRegions.length === 0 && allowedZones.length === 0) {
        return NextResponse.json([]);
      }

      // For Head Quarter supervisors, drop explicit region/zone filters so
      // the CAAZ-mapped allowedRegions/allowedZones define the scope.
      if (isHeadQuarterSupervisor) {
        if (where.regionId) delete where.regionId;
        if (where.zoneId) delete where.zoneId;
      }
      // if caller didn't provide explicit region/zone, restrict by assigned lists
      if (allowedRegions.length > 0 || allowedZones.length > 0) {
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
          if (!requestedRegionId) return NextResponse.json([]);
          if (allowedRegions.length > 0 && !allowedRegions.includes(requestedRegionId)) {
            return NextResponse.json([]);
          }
          where.AND = [{ regionId: requestedRegionId }];
        } else if (!where.regionId && !where.zoneId) {
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

          if (preferredRegionId) {
            where.AND = [...(where.AND || []), { regionId: { in: [preferredRegionId] } }];
          } else if (allowedRegions.length > 0) {
            where.AND = [...(where.AND || []), { regionId: { in: allowedRegions } }];
          } else {
            return NextResponse.json([]);
          }
          if (!isRegionScope && allowedZones.length > 0) where.AND = [...(where.AND || []), { zoneId: { in: allowedZones } }];
        } else {
          // if caller provided region/zone, we still intersect with allowed areas
          const areaAnd: any[] = [];
          if (where.regionId) areaAnd.push({ regionId: where.regionId });
          if (!isRegionScope && where.zoneId) areaAnd.push({ zoneId: where.zoneId });
          const areaOr: any[] = [];
          if (allowedRegions.length > 0) areaOr.push({ regionId: { in: allowedRegions } });
          if (!isRegionScope && allowedZones.length > 0) areaOr.push({ zoneId: { in: allowedZones } });
          if (areaOr.length > 0) {
            where.AND = where.AND || [];
            where.AND.push({ OR: areaOr }, ...areaAnd);
          }
        }
      }
    }
  }

  if (isRegionScope && regionFilterId && !where.AND?.length) {
    where.AND = [{ regionId: regionFilterId }];
  }

  // Get sites with NE fields and extract unique NE names
  const sites = await prisma.site.findMany({
    where,
    select: {
      neNameAndId: true,
      allNeNames: true,
    },
  });

  // Extract unique NE names from both the primary neNameAndId field and
  // the aggregated allNeNames JSON array, filtering out empty/null values.
  const neSet = new Set<string>();
  for (const site of sites as any[]) {
    const single = (site.neNameAndId ?? '').toString().trim();
    if (single) neSet.add(single);

    const all = (site.allNeNames ?? []) as any;
    if (Array.isArray(all)) {
      for (const raw of all) {
        const v = (raw ?? '').toString().trim();
        if (v) neSet.add(v);
      }
    }
  }

  const uniqueNeNames = [...neSet].sort();

  // Return NE names with both name and value for dropdown
  const neNamesData = uniqueNeNames.map(name => ({
    name,
    value: name
  }));

  return NextResponse.json(neNamesData);
}