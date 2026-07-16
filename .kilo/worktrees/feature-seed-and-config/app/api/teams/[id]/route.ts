import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const team = await prisma.team.findUnique({ where: { id }, include: { members: { include: { role: true } }, manager: { include: { role: true } }, workOrders: true } });
  if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const user = session.user as any;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return NextResponse.json(team);
  if (role === 'supervisor') {
    // supervisor can fetch only if member of the team
    if ((team.members || []).some((m: any) => m.id === user.id)) return NextResponse.json(team);
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (role === 'manager') {
    // manager can fetch if they manage the team or team has members in manager's assigned regions/zones
    if (team.manager?.id === user.id) return NextResponse.json(team);
    const userRegions = user.assignedRegion || [];
    const userZones = user.assignedZone || [];
    const match = (team.members || []).some((m: any) => (m.assignedRegion || []).some((r: string) => userRegions.includes(r)) || (m.assignedZone || []).some((z: string) => userZones.includes(z)));
    if (match) return NextResponse.json(team);
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const currentUser = session.user as any;
    const role = String(currentUser.role || '').toLowerCase();

    const { id } = await params;
    const team = await prisma.team.findUnique({ where: { id }, include: { manager: true, members: true } });
    if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Only Admin or Manager who manages the team can update
    if (role !== 'admin') {
      if (role === 'manager') {
        if (team.manager?.id !== currentUser.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      } else {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    const body = await req.json();
    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.managerId !== undefined) data.managerId = body.managerId || null;

    const updated = await prisma.team.update({ where: { id }, data, include: { manager: true, members: true } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/teams/[id] error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const currentUser = session.user as any;
    const role = String(currentUser.role || '').toLowerCase();

    const { id } = await params;
    const team = await prisma.team.findUnique({ where: { id }, include: { manager: true } });
    if (!team) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    // Only Admin or Manager who manages the team can delete
    if (role !== 'admin') {
      if (role === 'manager') {
        if (team.manager?.id !== currentUser.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      } else {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    // detach members from team before deleting
    await prisma.user.updateMany({ where: { teamId: id }, data: { teamId: null } });

    const deleted = await prisma.team.delete({ where: { id } });
    return NextResponse.json({ success: true, id: deleted.id });
  } catch (err) {
    console.error('DELETE /api/teams/[id] error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
