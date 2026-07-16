import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any) as { user?: { id?: string } } | null;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = String(session.user.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // determine team to assign the demo work orders (user's team or first team)
  let teamId = user.teamId;
  if (!teamId) {
    const t = await prisma.team.findFirst();
    if (t) teamId = t.id;
  }

  // create 4 demo work orders
  const demoItems = [
    { title: 'Demo PM Task - Planned', planned: true, status: 'scheduled' },
    { title: 'Demo PM Task - Planned 2', planned: true, status: 'created' },
    { title: 'Demo Repair - Unplanned', planned: false, status: 'created' },
    { title: 'Demo Urgent Repair - Unplanned', planned: false, status: 'created' },
  ];

  const team = teamId ? await prisma.team.findUnique({ where: { id: teamId } }) : null;
  const site = team && teamId ? await prisma.site.findFirst() : null;
  const asset = site ? await prisma.asset.findFirst({ where: { siteId: site.id } }) : null;

  const created = [] as any[];
  for (const item of demoItems) {
    const wo = await prisma.workOrder.create({
      data: {
        title: item.title,
        description: item.title,
        siteId: site ? site.id : (await prisma.site.findFirst())?.id || '',
        type: item.planned ? 'pm' : 'reactive',
        planned: item.planned,
        status: item.status,
        teamId: teamId || undefined,
        createdById: user.id,
        assignedToId: user.id,
        assetId: asset?.id || undefined,
      },
    });
    created.push(wo);
  }

  return NextResponse.json({ created });
}
