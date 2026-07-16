import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id }, include: { members: true, manager: true } });
  if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  // collect assigned regions and zones from members and manager
  const regionSet = new Set<string>();
  const zoneSet = new Set<string>();
  function addFromUser(u: any | undefined) {
    if (!u) return;
    (u.assignedRegion || []).forEach((r: string) => { if (r) regionSet.add(r); });
    (u.assignedZone || []).forEach((z: string) => { if (z) zoneSet.add(z); });
  }
  addFromUser(team.manager as any);
  (team.members || []).forEach((m: any) => addFromUser(m));

  const regions = Array.from(regionSet); // These are region IDs
  const zones = Array.from(zoneSet); // These are zone IDs

  // Use the region/zones IDs directly since assignedRegion/assignedZone contain IDs
  const regionIds = regions.filter(id => id); // Filter out empty strings
  const zoneIds = zones.filter(id => id); // Filter out empty strings

  // Fetch sites that match regions or zones
  let sites: any[] = [];
  if (regionIds.length > 0 || zoneIds.length > 0) {
    const where: any = {};
    if (regionIds.length > 0) where.regionId = { in: regionIds };
    if (zoneIds.length > 0) where.zoneId = { in: zoneIds };
    sites = await prisma.site.findMany({ where, select: { id: true, name: true, siteCode: true, regionId: true, zoneId: true } });
  }

  return NextResponse.json({ regions, zones, regionIds, zoneIds, sites });
}
