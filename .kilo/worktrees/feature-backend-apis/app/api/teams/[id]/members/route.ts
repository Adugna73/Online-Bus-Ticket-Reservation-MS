import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { teamId, userId } = body;

  if (!teamId || !userId) {
    return NextResponse.json({ error: 'teamId and userId are required' }, { status: 400 });
  }

  try {
    // Check if user has permission to manage this team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { manager: true, members: true }
    });

    if (!team) {
      return NextResponse.json({ error: 'team not found' }, { status: 404 });
    }

    const user = session.user as any;
    const role = String(user.role || '').toLowerCase();
    const canManage =
      role === 'admin' ||
      (role === 'manager' && team.manager?.id === user.id) ||
      // Supervisors can manage teams they manage or where they are a member
      (role === 'supervisor' &&
        (team.manager?.id === user.id || team.members.some((m: any) => m.id === user.id)));

    if (!canManage) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Check if user is already a member
    const isAlreadyMember = team.members.some((m: any) => m.id === userId);
    if (isAlreadyMember) {
      return NextResponse.json({ error: 'user is already a member of this team' }, { status: 400 });
    }

    // Add user to team
    await prisma.team.update({
      where: { id: teamId },
      data: {
        members: {
          connect: { id: userId }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const teamId = url.searchParams.get('teamId');
  const userId = url.searchParams.get('userId');

  if (!teamId || !userId) {
    return NextResponse.json({ error: 'teamId and userId are required' }, { status: 400 });
  }

  try {
    // Check if user has permission to manage this team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { manager: true, members: true }
    });

    if (!team) {
      return NextResponse.json({ error: 'team not found' }, { status: 404 });
    }

    const user = session.user as any;
    const role = String(user.role || '').toLowerCase();
    const canManage =
      role === 'admin' ||
      (role === 'manager' && team.manager?.id === user.id) ||
      // Supervisors can manage teams they manage or where they are a member
      (role === 'supervisor' &&
        (team.manager?.id === user.id || team.members.some((m: any) => m.id === user.id)));

    if (!canManage) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Remove user from team
    await prisma.team.update({
      where: { id: teamId },
      data: {
        members: {
          disconnect: { id: userId }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}