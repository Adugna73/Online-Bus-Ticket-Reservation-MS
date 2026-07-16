import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const existing = await prisma.teamAssignment.findUnique({ where: { id }, include: { team: { include: { members: true, manager: true } } } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const user = session.user as any;
  if (user.role === 'Supervisor') {
    // allow only if supervisor is member of team
    if (!existing.team.members.some((m: any) => m.id === user.id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const updated = await prisma.teamAssignment.update({ where: { id }, data: { groupName: body.groupName ?? null, assignedNe: body.assignedNe ?? null } });
    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('team-assignments PATCH error', e);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.teamAssignment.findUnique({ where: { id }, include: { team: { include: { members: true, manager: true } } } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const user = session.user as any;
  if (user.role === 'Supervisor') {
    if (!existing.team.members.some((m: any) => m.id === user.id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    await prisma.teamAssignment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('team-assignments DELETE error', e);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
