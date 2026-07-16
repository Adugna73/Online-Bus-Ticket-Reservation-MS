export function isAazOrHqSite(zoneName?: string, regionName?: string): boolean {
  const z = String(zoneName || '').toLowerCase();
  const r = String(regionName || '').toLowerCase();
  return /aaz/i.test(z || r) || z.startsWith('hq-') || r === 'hq' || r === 'caaz';
}

/**
 * Given a list of managers and the site's zone/region, return the preferred
 * manager candidate (HQ first, then exact zone, then exact region) or
 * undefined when none match.
 */
export function findPreferredManagerForSite(
  managers: any[],
  siteZoneId: string | null | undefined,
  siteRegionId: string | null | undefined,
  zones: any[],
  regions: any[],
) {
  const z = siteZoneId ? zones.find((zz) => zz.id === siteZoneId) : null;
  const r = siteRegionId ? regions.find((rr) => rr.id === siteRegionId) : null;
  const zname = String(z?.name || '').toLowerCase();
  const rname = String(r?.name || '').toLowerCase();

  if (!isAazOrHqSite(zname, rname)) return undefined;

  const preferredCandidates = managers.filter((m: any) => {
    const regs = Array.isArray(m.assignedRegion) ? m.assignedRegion : [];
    const zns = Array.isArray(m.assignedZone) ? m.assignedZone : [];
    const regNames = regs.map(String).join(' ').toLowerCase();
    const zoneNames = zns.map(String).join(' ').toLowerCase();
    const locCat = String((m as any).locationCategory || '').toLowerCase();
    const email = String((m as any).email || '').toLowerCase();
    const fullName = String((m as any).fullName || '').toLowerCase();
    const isHqManager = locCat.includes('head quarter') || locCat === 'hq';

    // Hard rule from business: all AAZ/CAAZ/HQ Addis sites that are
    // not grouped must be owned by Muhaba only, never by any other
    // manager. Enforce this by only considering Muhaba as a
    // candidate, identified by email/full name.
    const isMuhaba =
      email === 'muhaba.hussien@ethiotelecom.et' ||
      fullName.includes('muhaba') ||
      fullName.includes('indris');

    if (!isHqManager || !isMuhaba) return false;

    const explicitMatch = (siteRegionId && regs.includes(siteRegionId)) || (siteZoneId && zns.includes(siteZoneId));
    const nameMatch = /aaz/i.test(regNames) || /aaz/i.test(zoneNames) || /hq/i.test(regNames) || /hq/i.test(zoneNames);

    // Muhaba remains preferred when he explicitly covers the
    // region/zone or has AAZ/HQ in his region/zone assignments.
    return explicitMatch || nameMatch;
  });

  if (preferredCandidates.length === 0) return undefined;

  preferredCandidates.sort((a: any, b: any) => {
    const aLoc = String((a as any).locationCategory || '').toLowerCase().includes('head quarter') ? 1 : 0;
    const bLoc = String((b as any).locationCategory || '').toLowerCase().includes('head quarter') ? 1 : 0;
    if (aLoc !== bLoc) return bLoc - aLoc; // prefer Head Quarter

    const aZone = Array.isArray(a.assignedZone) && siteZoneId && a.assignedZone.includes(siteZoneId) ? 1 : 0;
    const bZone = Array.isArray(b.assignedZone) && siteZoneId && b.assignedZone.includes(siteZoneId) ? 1 : 0;
    if (aZone !== bZone) return bZone - aZone; // prefer exact zone

    const aReg = Array.isArray(a.assignedRegion) && siteRegionId && a.assignedRegion.includes(siteRegionId) ? 1 : 0;
    const bReg = Array.isArray(b.assignedRegion) && siteRegionId && b.assignedRegion.includes(siteRegionId) ? 1 : 0;
    if (aReg !== bReg) return bReg - aReg; // prefer exact region

    return 0;
  });

  return preferredCandidates[0];
}
