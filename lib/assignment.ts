export function isAazOrHqSite(zoneName?: string, regionName?: string): boolean {
  const z = String(zoneName || "").toLowerCase();
  const r = String(regionName || "").toLowerCase();
  if (z.includes("hq") || z.includes("aaz")) return true;
  if (r.includes("aaz")) return true;
  return false;
}

export function findPreferredManagerForSite(
  managers: any[],
  siteZoneId: string | null | undefined,
  siteRegionId: string | null | undefined,
  zones: any[],
  regions: any[],
): any | undefined {
  if (!managers || managers.length === 0) return undefined;

  const hqManager = managers.find(
    (m) => String(m?.locationCategory || "").toLowerCase() === "head quarter",
  );
  if (hqManager) return hqManager;

  if (siteZoneId) {
    const zoneManager = managers.find((m) =>
      Array.isArray(m?.assignedZone) && m.assignedZone.includes(siteZoneId),
    );
    if (zoneManager) return zoneManager;
  }

  if (siteRegionId) {
    const regionManager = managers.find((m) =>
      Array.isArray(m?.assignedRegion) && m.assignedRegion.includes(siteRegionId),
    );
    if (regionManager) return regionManager;
  }

  return undefined;
}
