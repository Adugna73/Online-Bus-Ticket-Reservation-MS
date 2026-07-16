import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

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
    default:
      return 'PASSENGER';
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const normalized = {
      ...user,
      role: { key: user.role },
    } as any;

    return NextResponse.json(normalized);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roleLower = String(currentUser.role).toLowerCase();
    if (roleLower !== 'admin' && roleLower !== 'staff') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { fullName, email, phone, roleKey, stationId } = body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone || null;
    if (stationId !== undefined) updateData.stationId = stationId || null;

    if (roleKey) {
      // prevent scoped HQ admins from giving admin role
      try {
        const { isScopedHqAdminUser } = await import('../../../../lib/scopedAdmin');
        if (isScopedHqAdminUser(currentUser) && roleKey.toLowerCase() === 'admin') {
          return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
        }
      } catch {}
      updateData.role = roleKeyToEnum(roleKey) as any;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ ...updatedUser, role: { key: updatedUser.role } });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const roleLower = String(currentUser.role).toLowerCase();
    if (roleLower !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting admin users
    if (existingUser.role === 'ADMIN') {
      return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
