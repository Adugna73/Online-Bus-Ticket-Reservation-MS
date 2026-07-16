import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const session = (await getServerSession(authOptions as any)) as
      | { user?: { id?: string | number } }
      | null;
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: String(session.user.id) },
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        email: true,
        username: true,
        phone: true,
        division: true,
        department: true,
        section: true,
        group: true,
        locationCategory: true,
        location: true,
        jobTitle: true,
        category: true,
        jobRole: true,
        roleId: true,
        assignedRegion: true,
        assignedZone: true,
        enabled: true,
        role: {
          select: {
            id: true,
            key: true,
            displayName: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: {
              select: {
                id: true,
                key: true,
                displayName: true,
              },
            },
          },
        },
        immediateSupervisor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: {
              select: {
                id: true,
                key: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching current user (me):', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
