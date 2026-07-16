
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    // Get user from session (assume req.user or req.session?.user)
    const user = (req as any).user || (req as any).session?.user || null;

    let isAdmin = false;
    let managerRegionIds: string[] = [];
    let managerRegionCodes: string[] = [];
    let managerZones: string[] = [];
    if (user) {
      isAdmin = (user.role === 'admin' || user.role?.key === 'admin');
      if (user.assignedRegion) managerRegionIds = Array.isArray(user.assignedRegion) ? user.assignedRegion : [user.assignedRegion];
      if (user.assignedZone) managerZones = Array.isArray(user.assignedZone) ? user.assignedZone : [user.assignedZone];
    }


    // Map region IDs to region codes (e.g., 'WR')
    if (!isAdmin && managerRegionIds.length > 0) {
      const regions = await prisma.region.findMany({
        where: { id: { in: managerRegionIds } },
        select: { name: true },
      });
      managerRegionCodes = regions.map(r => r.name);
    }

    let supervisorWhere: any = { role: { key: 'supervisor' } };
    if (!isAdmin && (managerRegionCodes.length > 0 || managerZones.length > 0)) {
      supervisorWhere = {
        ...supervisorWhere,
        OR: [
          ...(managerRegionCodes.length > 0 ? [{ locationCategory: { in: managerRegionCodes } }] : []),
          ...(managerZones.length > 0 ? [{ location: { in: managerZones } }] : []),
        ],
      };
    }

    // Debug logging
    // eslint-disable-next-line no-console
    console.log('[manager/supervisors] user:', user && { email: user.email, role: user.role, assignedRegion: user.assignedRegion, assignedZone: user.assignedZone });
    // eslint-disable-next-line no-console
    console.log('[manager/supervisors] managerRegionCodes:', managerRegionCodes);
    // eslint-disable-next-line no-console
    console.log('[manager/supervisors] supervisorWhere:', JSON.stringify(supervisorWhere));

    const supervisors = await prisma.user.findMany({
      where: supervisorWhere,
      select: {
        id: true,
        fullName: true,
        location: true,
        locationCategory: true,
        supervisorStation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Map supervisor to only their own location and locationCategory
    const result = supervisors.map((sup) => ({
      id: sup.id,
      name: sup.fullName,
      area: sup.location || null,
      region: sup.locationCategory || null,
      station: sup.supervisorStation ? { id: sup.supervisorStation.id, name: sup.supervisorStation.name } : null,
    }));
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch supervisors' });
  }
}
