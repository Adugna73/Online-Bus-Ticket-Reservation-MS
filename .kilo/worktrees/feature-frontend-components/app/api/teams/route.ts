import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { authOptions } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  console.debug('/api/teams GET session user id:', session?.user?.id);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const teams = await prisma.team.findMany({
    include: {
      manager: {
        select: {
          id: true,
          fullName: true,
          staffId: true,
          username: true,
          assignedRegion: true,
          assignedZone: true,
          role: true,
        },
      },
      members: {
        select: {
          id: true,
          fullName: true,
          username: true,
          staffId: true,
          assignedRegion: true,
          assignedZone: true,
          immediateSupervisorId: true,
          role: true,
        },
      },
      // Include sites so the UI can reason about which sites
      // are already attached to which teams (used for groups).
      sites: {
        select: {
          id: true,
          name: true,
          siteCode: true,
          regionId: true,
          zoneId: true,
          neNameAndId: true,
        },
      },
    },
  });

  // Server-side scoping (role is stored lowercase in session)
  const user = session.user as any;
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return NextResponse.json(teams);

  if (role === 'supervisor') {
    // return teams the supervisor manages OR where they are a member
    const filtered = teams.filter(
      (t: any) => t.manager?.id === user.id || (t.members || []).some((m: any) => m.id === user.id),
    );
    return NextResponse.json(filtered);
  }

  if (role === 'manager') {
    // manager sees teams they manage OR teams that have members in manager's assigned regions/zones
    const userRegions = user.assignedRegion || [];
    const userZones = user.assignedZone || [];
    const filtered = teams.filter((t: any) => {
      if (t.manager?.id === user.id) return true;
      return (t.members || []).some((m: any) => {
        if ((m.assignedRegion || []).some((r: string) => userRegions.includes(r))) return true;
        if ((m.assignedZone || []).some((z: string) => userZones.includes(z))) return true;
        return false;
      });
    });
    return NextResponse.json(filtered);
  }

  // default: return empty
  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { name, managerId } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const team = await prisma.team.create({
      data: {
        name,
        managerId: managerId || null,
      },
      include: { manager: true, members: true },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (err) {
    console.error('POST /api/teams error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}