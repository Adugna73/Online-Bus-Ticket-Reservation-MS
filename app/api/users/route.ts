import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD = 'bus@12345';

function roleKeyToEnum(roleKey: string): string {
  const rk = String(roleKey || '').toLowerCase();
  switch (rk) {
    case 'admin':
      return 'ADMIN';
    case 'supervisor':
    case 'staff':
      return 'STAFF';
    case 'mechanic':
      return 'MECHANIC';
    case 'garage_owner':
      return 'GARAGE_OWNER';
    case 'driver':
      return 'DRIVER';
    default:
      return 'PASSENGER';
  }
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.API_KEY;
    let session: any = null;
    let currentUser: any = null;

    if (apiKey && validApiKey && apiKey === validApiKey) {
      session = { user: { id: 'api-key', role: 'admin' } };
      currentUser = { id: 'api-key', role: 'ADMIN' };
    } else {
      session = await getServerSession(authOptions);
      if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      currentUser = await prisma.user.findUnique({ where: { id: String(session.user.id) } });
      if (!currentUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const email = searchParams.get('email');

    const where: any = {};
    if (role) {
      where.role = roleKeyToEnum(role) as any;
    }
    if (email) {
      where.email = { equals: email, mode: 'insensitive' };
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const usersWithRoleObj = users.map((u: any) => ({
      ...u,
      role: { key: u.role },
    }));

    return NextResponse.json(usersWithRoleObj);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const session: any = await getServerSession(authOptions as any);

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!currentUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const roleLower = String(currentUser.role).toLowerCase();

    // Only admins (and supervisors mapped from staff) can create users
    if (roleLower !== 'admin' && roleLower !== 'staff') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Scoped HQ admins cannot create new admin accounts
    if ((body.roleKey || '').toLowerCase() === 'admin') {
      try {
        const { canManageAdminUsers } = await import('../../../lib/scopedAdmin');
        if (!canManageAdminUsers(currentUser)) {
          return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        }
      } catch {}
    }

    const fullName = String(body.fullName || '').trim();
    const email = String(body.email || '').trim();
    if (!fullName || !email) {
      return NextResponse.json({ error: 'fullName_and_email_required' }, { status: 400 });
    }

    const roleEnum = roleKeyToEnum(body.roleKey || 'passenger') as any;
    const password = body.password || DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(password, 10);

    const data: any = {
      fullName,
      email,
      phone: body.phone || null,
      passwordHash,
      role: roleEnum,
      stationId: body.stationId || null,
    };

    try {
      const user = await prisma.user.create({ data });
      return NextResponse.json({ ...user, role: { key: user.role } }, { status: 201 });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return NextResponse.json({ error: 'unique_violation', meta: e.meta }, { status: 409 });
      }
      console.error('user.create error', e);
      return NextResponse.json({ error: 'create_failed', detail: e?.message }, { status: 500 });
    }
  } catch (e: any) {
    console.error('POST /api/users general error', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
