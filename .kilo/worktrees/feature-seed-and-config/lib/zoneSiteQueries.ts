// Example Prisma queries for fetching zones and sites based on manager role and selection
import { prisma } from '@/lib/prisma';

// Fetch zones managed by a zone manager
export async function getZonesForZoneManager(userId: string) {
  // Step 1: Find all zone IDs managed by this user from the join table
  const userWithZones = await prisma.user.findUnique({
    where: { id: userId },
    select: { managedZones: { select: { id: true } } },
  });
  const zoneIds = userWithZones?.managedZones?.map((z: { id: string }) => z.id) || [];
  // Step 2: Fetch those zones
  if (zoneIds.length === 0) return [];
  return prisma.zone.findMany({ where: { id: { in: zoneIds } } });
}

// Fetch sites for a given zone
export async function getSitesForZone(zoneId: string) {
  return prisma.site.findMany({
    where: { zoneId }
  });
}

// Fetch region managed by a region manager
export async function getRegionForRegionManager(userId: string) {
  // Query Region where managers relation includes the userId
  return prisma.region.findFirst({
    where: {
      managers: {
        some: { id: userId }
      }
    }
  });
}

// Fetch zones for a region
export async function getZonesForRegion(regionId: string) {
  return prisma.zone.findMany({
    where: { regionId }
  });
}

// Fetch sites for a region
export async function getSitesForRegion(regionId: string) {
  return prisma.site.findMany({
    where: { regionId }
  });
}

// Fetch sites for a zone manager (all zones they manage)
export async function getSitesForZoneManager(userId: string) {
  const zones = await getZonesForZoneManager(userId);
  const zoneIds = zones.map((z: { id: string }) => z.id);
  return prisma.site.findMany({
    where: {
      zoneId: { in: zoneIds }
    }
  });
}

// Fetch sites for a region manager (all sites in their region)
export async function getSitesForRegionManager(userId: string) {
  const region = await getRegionForRegionManager(userId);
  if (!region) return [];
  return prisma.site.findMany({
    where: { regionId: region.id }
  });
}
