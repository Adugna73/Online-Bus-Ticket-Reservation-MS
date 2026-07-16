import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const teamId = url.searchParams.get('teamId') || undefined;
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  // Only allow if manager of team, admin, or supervisor who is a member
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, manager: true } });
  if (!team) return NextResponse.json({ error: 'team_not_found' }, { status: 404 });
  const user = session.user as any;
  if (user.role !== 'Admin') {
    if (user.role === 'Supervisor') {
      if (!team.members.some((m: any) => m.id === user.id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    } else if (user.role === 'Manager') {
      if (team.manager?.id !== user.id && !(user.assignedRegion || []).length && !(user.assignedZone || []).length) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const assignments = await prisma.teamAssignment.findMany({ where: { teamId }, include: { user: true } });
  return NextResponse.json(assignments);
}

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { teamId, userId, groupName, assignedNe } = body;
  if (!teamId || !userId) return NextResponse.json({ error: 'teamId_and_userId_required' }, { status: 400 });

  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { members: true, manager: true } });
  if (!team) return NextResponse.json({ error: 'team_not_found' }, { status: 404 });

  const user = session.user as any;
  // supervisors can only create assignment for their own team members
  if (user.role === 'Supervisor') {
    if (!team.members.some((m: any) => m.id === user.id)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const a = await prisma.teamAssignment.upsert({
      where: { teamId_userId: { teamId, userId } },
      create: { teamId, userId, groupName: groupName || null, assignedNe: assignedNe || null },
      update: { groupName: groupName || null, assignedNe: assignedNe || null },
    });
    return NextResponse.json(a);
  } catch (e: any) {
    console.error('team-assignments POST error', e);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}
