

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: Request) {
  // Get current user session
  const session = await getServerSession(authOptions as any) || {};
  const user = (session as any).user || null;
  // Get all users with their roles, teams, and relationships
  const users = await prisma.user.findMany({
    include: {
      role: true,
      team: true,
      subordinates: {
        include: {
          role: true,
          team: true,
        },
      },
      immediateSupervisor: {
        include: {
          role: true,
        },
      },
    },
  });

  // Get all sites
  const sites = await prisma.site.findMany({
    include: {
      region: true,
      zone: true,
    },
  });

  // Get all regions and zones so we can map both IDs and
  // human-readable codes/names (e.g. "CWR", "Ambo") from seeded data.
  const regions = await prisma.region.findMany({
    select: { id: true, name: true },
  });
  const zones = await prisma.zone.findMany({
    select: { id: true, name: true, regionId: true },
  });

  const regionById = new Map<string, { id: string; name: string }>();
  const regionByName = new Map<string, { id: string; name: string }>();
  for (const r of regions) {
    regionById.set(r.id, r);
    regionByName.set(r.name, r);
  }

  const zoneById = new Map<string, { id: string; name: string; regionId: string }>();
  const zoneByName = new Map<string, { id: string; name: string; regionId: string }>();
  const zoneRegionMap: Record<string, string> = {};
  for (const z of zones) {
    zoneById.set(z.id, { ...z, regionId: z.regionId ?? '' });
    zoneByName.set(z.name, { ...z, regionId: z.regionId ?? '' });
    zoneRegionMap[z.id] = z.regionId ?? '';
  }

  const normalizeRegionLike = (val: string) => {
    const lower = (val || '').toString().toLowerCase();
    if (lower.includes('head quarter') || lower === 'hq') return 'HQ';
    return val;
  };

  const normalizeZoneLike = (val: string) => {
    const lower = (val || '').toString().toLowerCase();
    if (lower.includes('head quarter') || lower === 'hq') return 'CAAZ';
    return val;
  };

  const isHqZoneName = (val: string) => {
    const lower = (val || '').toString().toLowerCase();
    return lower.endsWith('aaz') || lower.startsWith('hq-') || lower === 'hq';
  };

  const isHqRegionName = (val: string) => {
    const lower = (val || '').toString().toLowerCase();
    return lower.includes('head quarter') || lower === 'hq' || lower === 'caaz';
  };

  // Helper: derive concrete regionIds / zoneIds for a user from
  // assignedRegion / assignedZone which may contain either IDs or
  // seeded codes/names (e.g. "CWR", "Ambo").
  const userRegionIds: Record<string, string[]> = {};
  const userZoneIds: Record<string, string[]> = {};

  for (const u of users) {
    const rIds = new Set<string>();
    const zIds = new Set<string>();

    for (const original of u.assignedRegion || []) {
      const val = original as string;
      const norm = normalizeRegionLike(val);

      if (regionById.has(val)) {
        rIds.add(val);
        continue;
      }
      if (regionById.has(norm)) {
        rIds.add(norm);
        continue;
      }
      if (regionByName.has(norm)) {
        rIds.add(regionByName.get(norm)!.id);
        continue;
      }
      if (regionByName.has(val)) {
        rIds.add(regionByName.get(val)!.id);
      }
    }

    for (const original of u.assignedZone || []) {
      const val = original as string;
      const norm = normalizeZoneLike(val);

      if (zoneById.has(val)) {
        zIds.add(val);
        continue;
      }
      if (zoneById.has(norm)) {
        zIds.add(norm);
        continue;
      }
      if (zoneByName.has(norm)) {
        zIds.add(zoneByName.get(norm)!.id);
        continue;
      }
      if (zoneByName.has(val)) {
        zIds.add(zoneByName.get(val)!.id);
      }
    }

    userRegionIds[u.id] = Array.from(rIds);
    userZoneIds[u.id] = Array.from(zIds);
  }

  // Group users by role using a normalized (lowercased) key so that
  // variants like "technician" / "Technician" / "tech" are all handled.
  const managers = users.filter((u) =>
    (u.role?.key || '').toLowerCase() === 'manager'
  );
  const supervisors = users.filter((u) =>
    (u.role?.key || '').toLowerCase() === 'supervisor'
  );
  // Identify technicians.  Normally we look at the role key, but some
  // old/buggy records might have had roleId left null (see user reports).
  // Treat any user who reports to a supervisor and lacks a role as a
  // technician so they show up under their supervisor for managers.
  const technicians = users.filter((u) => {
    // explicit role-based check
    const key = (u.role?.key || '').toLowerCase();
    if (key === 'technician' || key === 'tech') return true;
    // fallback for missing roleId
    if (!u.roleId && u.immediateSupervisorId) return true;
    return false;
  });

  // Create the hierarchical structure purely from seeded DB data
  const organization: Record<string, any> = {};

  for (const region of regions) {
    const regionName = region.name;

    organization[regionName] = {
      regionCode: regionName,
      manager: null as any,
      areas: {} as Record<string, any>, // Group supervisors by zones/areas
    };

    // Find manager for this region (at most one per region).
    // Prefer the HR locationCategory (e.g. "SSWR", "CWR") and
    // fall back to assignedRegion-derived ids if needed.
    const regionManager = managers.find((m) => {
      const rawLocCat = (m as any).locationCategory?.toString().trim();
      const locCat = rawLocCat ? normalizeRegionLike(rawLocCat) : rawLocCat;
      if (locCat && locCat === regionName) return true;
      return (userRegionIds[m.id] || []).includes(region.id);
    });

    if (regionManager) {
      organization[regionName].manager = {
        id: regionManager.id,
        name: regionManager.fullName,
        staffId: regionManager.employeeId,
        email: regionManager.email,
      };
    }

    // Find supervisors for this region. Again prefer HR locationCategory
    // so that SSWR supervisors like Leta/Teshome are kept under SSWR
    // even if other scripts accidentally touched assignedRegion.
    const regionSupervisors = supervisors.filter((s) => {
      const rawLocCat = (s as any).locationCategory?.toString().trim();
      const locCat = rawLocCat ? normalizeRegionLike(rawLocCat) : rawLocCat;
      const supervisorIsHq = Boolean(locCat && isHqRegionName(locCat));
      const targetRegionIsHq = isHqRegionName(regionName);

      // Keep Head Quarter supervisors strictly under HQ. Some HQ users are
      // intentionally assigned AAZ/HQ compatibility zones (for admin scope),
      // but those assignments must not cause them to appear under WR/SWR/etc.
      if (supervisorIsHq && !targetRegionIsHq) return false;

      if (locCat && locCat === regionName) return true;
      if ((userRegionIds[s.id] || []).includes(region.id)) return true;
      // If supervisor has zones assigned, include them under the zone's region
      const sZoneIds = userZoneIds[s.id] || [];
      if (sZoneIds.length) {
        if (sZoneIds.some((zid) => zoneById.get(zid)?.regionId === region.id)) {
          return true;
        }
      }
      // additionally, treat supervisor whose `location` text matches any site
      // name in this region as belonging to that region
      const sLoc = ((s as any).location || '').toString().trim().toLowerCase();
      if (sLoc) {
        const matchSite = sites.find(
          (site) => site.regionId === region.id && site.name.toLowerCase() === sLoc,
        );
        if (matchSite) return true;
      }
      return false;
    });

    // Also include supervisors who are assigned to sites in this region
    const regionSiteSupervisorIds = new Set(
      sites
        .filter((site) => site.regionId === region.id && site.supervisorStationId)
        .map((site) => String(site.supervisorStationId))
    );
    const siteSupervisors = supervisors.filter((s) => regionSiteSupervisorIds.has(s.id));

    const regionSupervisorsById = new Map<string, any>();
    for (const s of regionSupervisors) regionSupervisorsById.set(s.id, s);
    for (const s of siteSupervisors) regionSupervisorsById.set(s.id, s);
    const mergedRegionSupervisors = Array.from(regionSupervisorsById.values());

    // Group supervisors by their assigned zones/areas within this region
    const supervisorsByZone: Record<string, any[]> = {};

    for (const supervisor of mergedRegionSupervisors) {
      const sRegionIds = userRegionIds[supervisor.id] || [];
      const sZoneIds = userZoneIds[supervisor.id] || [];

      // If supervisor has specific zones assigned in this region, group by those
      // zone names. Otherwise, fall back to the supervisor's raw assignedZone
      // value (e.g. "Bako", "Ghimbi", "Dembidolo"), and only then to the
      // HR location field. If everything is missing, use a generic label.
      let zoneNames: string[] = [];
      if (sZoneIds.length) {
        zoneNames = sZoneIds
          .map((zoneId) => zoneById.get(zoneId))
          .filter((z) => z && z.regionId === region.id)
          .map((z) => z!.name)
          .filter(Boolean) as string[];
      }

      if (!zoneNames || zoneNames.length === 0) {
        // If supervisor is assigned to sites in this region, use those site zones
        const siteZones = sites
          .filter((site) => site.regionId === region.id && site.supervisorStationId === supervisor.id)
          .map((site) => zoneById.get(site.zoneId || '')?.name)
          .filter(Boolean) as string[];
        if (siteZones.length) {
          zoneNames = Array.from(new Set(siteZones));
        } else {
        const rawZones: any[] = ((supervisor as any).assignedZone || []) as any[];
        const rawZone = rawZones.find((z) =>
          typeof z === 'string' && z.toString().trim().length > 0
        ) as string | undefined;

          if (rawZone) {
            zoneNames = [rawZone.toString().trim()];
          } else {
            const rawLocation = ((supervisor as any).location || '')
              .toString()
              .trim();
            if (rawLocation) {
              zoneNames = [rawLocation];
            } else {
              zoneNames = ['General'];
            }
          }
        }
      }

      // Sites for this supervisor within the CURRENT region only.
      // Always show sites assigned to this supervisor via supervisorStationId.
      let supervisorSites: any[] = [];
      supervisorSites = sites.filter((site) => {
        if (site.regionId !== region.id) return false;
        if (site.supervisorStationId !== supervisor.id) return false;
        return true;
      });

      const supervisorData = {
        id: supervisor.id,
        name: supervisor.fullName,
        staffId: supervisor.employeeId,
        email: supervisor.email,
        sites: supervisorSites.map((site) => ({
          id: site.id,
          name: site.name,
          siteCode: site.siteCode,
          neNameAndId: site.neNameAndId || null,
          deviceModel: site.deviceModel || null,
        })),
        technicians: [] as any[],
      };

      // Technicians under this supervisor come from the seeded
      // immediateSupervisorId relationship, not from AD.
      const supervisorTechnicians = technicians.filter(
        (t) => t.immediateSupervisorId === supervisor.id
      );

      supervisorData.technicians = supervisorTechnicians.map((tech) => ({
        id: tech.id,
        name: tech.fullName,
        username: tech.username,
        staffId: tech.employeeId,
        email: tech.email,
        phone: tech.phone,
      }));

      for (const zoneName of zoneNames) {
        if (!supervisorsByZone[zoneName]) {
          supervisorsByZone[zoneName] = [];
        }
        supervisorsByZone[zoneName].push(supervisorData);
      }
    }

    // For managers: Add an 'Unassigned' pseudo-supervisor for sites in the region with no supervisorStationId
    const isManager = user && ((user.role?.key || user.role || '').toLowerCase() === 'manager');
    if (isManager) {
      // Find all sites in this region with no supervisorStationId
      const unassignedSites = sites.filter((site) => site.regionId === region.id && !site.supervisorStationId);
      if (unassignedSites.length > 0) {
        const unassignedSupervisor = {
          id: '',
          name: 'Unassigned',
          staffId: '',
          email: '',
          sites: unassignedSites.map((site) => ({
            id: site.id,
            name: site.name,
            siteCode: site.siteCode,
            neNameAndId: site.neNameAndId || null,
            deviceModel: site.deviceModel || null,
            zoneId: site.zoneId || null, // preserve zone for filtering
          })),
          technicians: [],
        };
        // Place under a special area or under each area as needed
        const unassignedArea = 'Unassigned';
        if (!supervisorsByZone[unassignedArea]) supervisorsByZone[unassignedArea] = [];
        supervisorsByZone[unassignedArea].push(unassignedSupervisor);
      }
    }

    // Always assign areas after supervisorsByZone is built
    organization[regionName].areas = supervisorsByZone;
  }
  // (removed stray reference to 'organization')

  const roleKey = String(user?.role || '').toLowerCase();
  const isHQUser = (locCat: string) => {
    const lower = (locCat || '').toLowerCase();
    return lower.includes('head quarter') || lower === 'hq';
  };

  // If not a manager, return all (admin/supervisor/tech can see all)
  if (!user || roleKey !== 'manager') {
    return NextResponse.json(organization);
  }

  // We'll build a pared-down copy for manager's view
  const filteredOrg: Record<string, any> = {};

  // Get manager's assigned regions/zones (by id or name)
  const assignedRegions = Array.isArray(user.assignedRegion) ? user.assignedRegion : [];
  const assignedZones = Array.isArray(user.assignedZone) ? user.assignedZone : [];

  // Map assignedRegion IDs to region names
  const assignedRegionNames = assignedRegions.map((rid: string) => {
    if (regionById.has(rid)) return regionById.get(rid)!.name;
    return rid;
  });

  // Map assignedZone IDs/names to zone names
  let assignedZoneNames = assignedZones
    .map((zid: string) => {
      if (zoneById.has(zid)) return zoneById.get(zid)!.name;
      if (zoneByName.has(zid)) return zoneByName.get(zid)!.name;
      return zid;
    })
    .filter(Boolean);
  // If manager has both region and zone assignments, a zone equal to the
  // region code is redundant and should not be used to filter the result.
  // (This avoids dropping the entire region when the seeded data assigned
  // the manager a zone named identical to the region name, e.g. a WR manager
  // with zone "WR".)
  if (assignedRegions.length && assignedZoneNames.length) {
    assignedZoneNames = assignedZoneNames.filter(
      (zn: string) => !assignedRegionNames.includes(zn),
    );
  }
  // If manager is HQ, also include HQ-* zones by name
  const locCat = String((user as any)?.locationCategory || '').toLowerCase();
  if (locCat.includes('head quarter') || locCat === 'hq') {
    const hqZoneNames = zones
      .map((z) => z.name)
      .filter((name) => String(name || '').toLowerCase().startsWith('hq-'));
    assignedZoneNames = Array.from(new Set([...assignedZoneNames, ...hqZoneNames]));
  }
  const hasZoneOnlyAssignments = assignedZones.length > 0 && assignedRegions.length === 0;

  // Special-case for HQ managers: they should see all supervisors
  // whose assigned zones/regions include any HQ-related value. We
  // collapse those into a fake "HQ" region with AAZ/HQ area so the
  // UI renders them under the expected header.
  // reuse locCat defined earlier
  if (locCat.includes('head quarter') || locCat === 'hq') {
    const hqSupIds = new Set<string>();
    for (const sup of supervisors) {
      const sZoneIds: string[] = userZoneIds[sup.id] || [];
      const sRegionIds: string[] = userRegionIds[sup.id] || [];

      const hasHqZone = sZoneIds.some((zid) => {
        const zn = zoneById.get(zid)?.name || '';
        return isHqZoneName(zn);
      });
      const hasHqRegion = sRegionIds.some((rid) => {
        const rn = regionById.get(rid)?.name || '';
        return isHqRegionName(rn);
      });
      if (hasHqZone || hasHqRegion) {
        hqSupIds.add(sup.id);
      }
    }

    const hqSupervisors = Array.from(hqSupIds).map((sid) => {
      let s: any = null;
      for (const regionDataRaw of Object.values(organization)) {
        const regionData = regionDataRaw as Record<string, any>;
        if (!regionData?.areas) continue;
        for (const supervisors of Object.values(regionData.areas)) {
          const match = (supervisors as any[]).find((x) => x.id === sid);
          if (match) s = match;
        }
      }
      const supUser = supervisors.find((u) => u.id === sid);
      const supervisorTechnicians = technicians.filter(
        (t) => t.immediateSupervisorId === sid,
      );
      return {
        id: sid,
        name: supUser?.fullName || s?.name || '',
        staffId: supUser?.employeeId || s?.staffId || null,
        email: supUser?.email || s?.email || null,
        sites: s?.sites || [],
        technicians: supervisorTechnicians.map((tech) => ({
          id: tech.id,
          name: tech.fullName,
          username: tech.username,
          staffId: tech.employeeId,
          email: tech.email,
          phone: tech.phone,
        })),
      };
    });

    filteredOrg['HQ'] = {
      regionCode: 'HQ',
      manager: {
        id: user.id,
        name: user.name || user.fullName || user.email,
        staffId: (user as any).employeeId || null,
        email: user.email || null,
      },
      areas: {
        'AAZ/HQ': hqSupervisors,
      },
    };
    return NextResponse.json(filteredOrg);
  }

  for (const [regionName, regionDataRaw] of Object.entries(organization)) {
    const regionData = regionDataRaw as Record<string, any>;
    // Check if manager is assigned to this region by name or by region ID
    const regionId = regionData.regionCode || regionData.id || null;
    const isRegionAssigned = assignedRegionNames.includes(regionName) ||
      (regionId && assignedRegions.includes(regionId)) ||
      (regionData.manager && regionData.manager.id === user.id);

    // Filter zones/areas if assignedZones is set *and* those zones actually
    // belong to this region.  A manager may have a mixture of region+zone
    // assignments, and the previous code would blindly restrict to whatever
    // zones appeared, even if they were from a different region leading to an
    // empty list of supervisors.  The fix ensures we only filter by zones that
    // exist in `regionData.areas`.
    if (assignedZones.length && regionData.areas) {
      // determine which of the manager's assigned zones are present here
      const assignedZoneNamesForRegion = assignedZoneNames.filter((zn: string) =>
        Object.prototype.hasOwnProperty.call(regionData.areas, zn),
      );

      if (assignedZoneNamesForRegion.length) {
        const filteredAreas: Record<string, any> = {};
        for (const zoneName of assignedZoneNamesForRegion) {
          filteredAreas[zoneName] = regionData.areas[zoneName];
        }
        if (hasZoneOnlyAssignments) {
          // Zone-only managers should only see AAZ areas; skip region if none match
          if (Object.keys(filteredAreas).length === 0) continue;
          filteredOrg[regionName] = { ...regionData, areas: filteredAreas };
        } else if (isRegionAssigned) {
          filteredOrg[regionName] = { ...regionData, areas: filteredAreas };
        }
      } else if (isRegionAssigned) {
        // manager has region assignment but none of the assignedZones apply to
        // this region – treat it as an ordinary region-assigned manager and
        // include all non-HQ areas.
        const filteredAreas: Record<string, any> = {};
        for (const [zoneName, supervisors] of Object.entries(regionData.areas)) {
          if (isHqZoneName(zoneName)) continue;
          filteredAreas[zoneName] = supervisors;
        }
        filteredOrg[regionName] = { ...regionData, areas: filteredAreas };
      }
    } else if (isRegionAssigned) {
      if (regionData.areas) {
        const filteredAreas: Record<string, any> = {};
        for (const [zoneName, supervisors] of Object.entries(regionData.areas)) {
          if (isHqZoneName(zoneName)) continue;
          filteredAreas[zoneName] = supervisors;
        }
        filteredOrg[regionName] = { ...regionData, areas: filteredAreas };
      } else {
        filteredOrg[regionName] = regionData;
      }
    }
  }

  // further prune unassigned sites if manager has zone restrictions
  // even a region-only assignment should implicitly restrict to the
  // zone named after the region, preventing inclusion of unrelated zones
  // (e.g. WAAZ sites in WR region when manager only manages WR zone).
  if (user && roleKey === 'manager') {
    // build allowed zone list depending on assignments
    for (const [rname, rdata] of Object.entries(filteredOrg)) {
      const areaData = rdata as any;
      if (!areaData.areas) continue;

      let allowedZoneIds: string[] = [];
      if (assignedZoneNames.length) {
        allowedZoneIds = zones
          .filter((z) => assignedZoneNames.includes(z.name))
          .map((z) => z.id);
      } else if (assignedRegionNames.includes(rname)) {
        // region-only or redundant-zone manager: allow zones whose name
        // exactly matches the region code.  We can't rely on rdata.regionId
        // since it isn't stored, so look it up using the earlier map.
        const regionRec = regionByName.get(rname);
        const regionId = regionRec?.id;
        if (regionId) {
          allowedZoneIds = zones
            .filter((z) => z.regionId === regionId && z.name === rname)
            .map((z) => z.id);
        }
      }

      if (allowedZoneIds.length === 0) continue;

      if (areaData.areas['Unassigned']) {
        areaData.areas['Unassigned'] = (areaData.areas['Unassigned'] as any[])
          .map((sup) => {
            if (sup && sup.sites) {
              sup.sites = sup.sites.filter((s: any) =>
                allowedZoneIds.includes(s.zoneId),
              );
            }
            return sup;
          })
          .filter((sup) => sup.sites && sup.sites.length > 0);
        if (areaData.areas['Unassigned'].length === 0) {
          delete areaData.areas['Unassigned'];
        }
      }
    }
  }
  // TEMP: Log for debugging
  console.log('[teams/organization] user:', user);
  console.log('[teams/organization] assignedRegionNames:', assignedRegionNames);
  console.log('[teams/organization] filteredOrg:', filteredOrg);
  return NextResponse.json(filteredOrg);
}
