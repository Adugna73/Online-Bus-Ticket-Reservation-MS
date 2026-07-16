import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      const sites = await prisma.site.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json(sites);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch sites' });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
}
