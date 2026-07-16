
import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const teams = await prisma.team.findMany({
        include: {
          manager: { select: { id: true, fullName: true } },
          members: { select: { id: true, fullName: true } },
          sites: { select: { id: true, name: true } },
        },
      });
      // Map to expected frontend shape
      const mapped = teams.map((t) => ({
        id: t.id,
        name: t.name,
        supervisor: t.manager ? { id: t.manager.id, name: t.manager.fullName } : null,
        technicians: (t.members || []).map((m: { id: string; fullName: string }) => ({ id: m.id, name: m.fullName })),
        sites: (t.sites || []).map((s) => ({ id: s.id, name: s.name })),
      }));
      return res.status(200).json(mapped);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch teams' });
    }
  }
  if (req.method === 'POST') {
    try {
      const { name, supervisor, technicians, sites } = req.body;
      const team = await prisma.team.create({
        data: {
          name,
          manager: supervisor ? { connect: { id: supervisor.id } } : undefined,
          members: technicians && technicians.length > 0 ? { connect: technicians.map((t: any) => ({ id: t.id })) } : undefined,
          sites: sites && sites.length > 0 ? { connect: sites.map((s: any) => ({ id: s.id })) } : undefined,
        },
        include: {
          manager: { select: { id: true, fullName: true } },
          members: { select: { id: true, fullName: true } },
          sites: { select: { id: true, name: true } },
        },
      });
      return res.status(201).json({
        id: team.id,
        name: team.name,
        supervisor: team.manager ? { id: team.manager.id, name: team.manager.fullName } : null,
        technicians: (team.members || []).map((m) => ({ id: m.id, name: m.fullName })),
        sites: (team.sites || []).map((s) => ({ id: s.id, name: s.name })),
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create team' });
    }
  }
  if (req.method === 'PUT') {
    try {
      const { id, name, supervisor, technicians, sites } = req.body;
      const team = await prisma.team.update({
        where: { id },
        data: {
          name,
          manager: supervisor ? { connect: { id: supervisor.id } } : { disconnect: true },
          members: technicians ? { set: technicians.map((t: any) => ({ id: t.id })) } : undefined,
          sites: sites ? { set: sites.map((s: any) => ({ id: s.id })) } : undefined,
        },
        include: {
          manager: { select: { id: true, fullName: true } },
          members: { select: { id: true, fullName: true } },
          sites: { select: { id: true, name: true } },
        },
      });
      return res.status(200).json({
        id: team.id,
        name: team.name,
        supervisor: team.manager ? { id: team.manager.id, name: team.manager.fullName } : null,
        technicians: (team.members || []).map((m) => ({ id: m.id, name: m.fullName })),
        sites: (team.sites || []).map((s) => ({ id: s.id, name: s.name })),
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update team' });
    }
  }
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      await prisma.team.delete({ where: { id } });
      return res.status(204).end();
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete team' });
    }
  }
  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
