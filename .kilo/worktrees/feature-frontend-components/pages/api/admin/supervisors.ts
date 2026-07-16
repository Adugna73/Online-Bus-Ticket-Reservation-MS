import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  try {
    // Admin: fetch all supervisors with their technicians, sites, and network elements
    const supervisors = await prisma.user.findMany({
      where: { role: { key: 'supervisor' } },
      select: {
        id: true,
        fullName: true,
        email: true,
        location: true,
        locationCategory: true,
        staffId: true,
        supervisorStation: { select: { id: true, name: true } },
      },
    });

    // Fetch technicians for each supervisor
    const supervisorIds = supervisors.map(sup => sup.id);
    const techniciansBySupervisor = await prisma.user.findMany({
      where: {
        immediateSupervisorId: { in: supervisorIds },
        role: { key: 'technician' },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        staffId: true,
        username: true,
        immediateSupervisorId: true,
      },
    });

    // Format response for frontend
    const result = supervisors.map((sup) => ({
      id: sup.id,
      name: sup.fullName,
      email: sup.email,
      area: sup.location || null,
      region: sup.locationCategory || null,
      staffId: sup.staffId || null,
      station: sup.supervisorStation ? { id: sup.supervisorStation.id, name: sup.supervisorStation.name } : null,
      technicians: techniciansBySupervisor.filter(t => t.immediateSupervisorId === sup.id).map(({ immediateSupervisorId, ...t }) => t),
      // sites: You must fetch sites separately if needed
    }));
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch supervisors' });
  }
}
