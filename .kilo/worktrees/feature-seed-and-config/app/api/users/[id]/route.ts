import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

function normalizeSingleAssignment(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const first = value.find((item) => typeof item === 'string' && item);
  return first ? [first] : [];
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        subordinates: {
          include: { role: true }
        },
        immediateSupervisor: {
          include: { role: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure `staffId` is returned even when the seeded data used `employeeId`
    const normalized = {
      ...user,
      staffId: user.staffId ?? user.employeeId,
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
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    body.assignedRegion = normalizeSingleAssignment(body.assignedRegion);
    body.assignedZone = normalizeSingleAssignment(body.assignedZone);
    const { fullName, email, staffId, roleKey, assignedRegion, assignedZone, enabled, immediateSupervisorId, location } = body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (staffId !== undefined) updateData.staffId = staffId;
    if (assignedRegion !== undefined) updateData.assignedRegion = assignedRegion;
    if (assignedZone !== undefined) updateData.assignedZone = assignedZone;
    if (location !== undefined) updateData.location = location;

    // if the client switched supervisors without supplying a location
    if (!updateData.location && immediateSupervisorId) {
      const sup = await prisma.user.findUnique({ where: { id: immediateSupervisorId } });
      if (sup?.location) updateData.location = sup.location;
    }
    if (immediateSupervisorId !== undefined) {
      // Validate supervisor <-> subordinate region alignment to prevent cross-region linking
      const supervisor = await prisma.user.findUnique({ where: { id: immediateSupervisorId } });
      const targetRegions = assignedRegion !== undefined ? (assignedRegion || []) : (existingUser.assignedRegion || []);
      const supRegions = supervisor?.assignedRegion || [];

      // If supervisor is assigned to AAZ/HQ (special multi-area role), allow linking
      let supervisorIsAazOrHq = false;
      // Check supervisor regions for AAZ/HQ keywords
      if (Array.isArray(supRegions) && supRegions.length > 0) {
        const supRegionRows = await prisma.region.findMany({ where: { id: { in: supRegions } }, select: { name: true } });
        supervisorIsAazOrHq = supRegionRows.some((r) => /aaz|\bhead quarter\b|\bhq\b|caaz/i.test(String(r.name || '')));
      }

      // Also check supervisor assigned zones for AAZ/HQ (some users are zonal AAZ/HQ)
      const supZoneIds = (supervisor?.assignedZone || []).filter((z: any) => typeof z === 'string');
      if (!supervisorIsAazOrHq && supZoneIds.length > 0) {
        const supZoneRows = await prisma.zone.findMany({ where: { id: { in: supZoneIds } }, select: { name: true } });
        supervisorIsAazOrHq = supZoneRows.some((z) => /aaz|\bhq\b|head quarter/i.test(String(z.name || '')));
        // also allow if assignedZone contains literal 'AAZ' or 'HQ'
        if (!supervisorIsAazOrHq) {
          supervisorIsAazOrHq = supZoneIds.some((zn: string) => /aaz|\bhq\b|head quarter/i.test(String(zn)));
        }
      }

      // If both sides have explicit regions, require at least one common region *unless* supervisor is AAZ/HQ
      if (!supervisorIsAazOrHq && Array.isArray(targetRegions) && targetRegions.length > 0 && Array.isArray(supRegions) && supRegions.length > 0) {
        const hasIntersection = targetRegions.some((r: string) => supRegions.includes(r));
        if (!hasIntersection) {
          return NextResponse.json({ error: 'supervisor_region_mismatch', message: 'Supervisor and subordinate assigned regions do not overlap' }, { status: 400 });
        }
      }

      updateData.immediateSupervisorId = immediateSupervisorId;
    }

    if (enabled !== undefined) updateData.enabled = enabled;

    // Handle role update
    if (roleKey) {
      // prevent scoped HQ admins from giving admin role
      try {
        const { isScopedHqAdminUser } = await import('../../../../lib/scopedAdmin');
        if (isScopedHqAdminUser(currentUser) && roleKey.toLowerCase() === 'admin') {
          return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
        }
      } catch {}

      const role = await prisma.role.findFirst({ where: { key: roleKey } });
      if (role) {
        // Supervisors cannot promote users to Supervisor or Manager
        if (currentUser.role?.key === 'Supervisor' && role.key !== 'Technician') {
          return NextResponse.json({ error: 'forbidden_role' }, { status: 403 });
        }
        updateData.roleId = role.id;
      }
    }

    // Additional permission checks: Supervisors can only update their own technicians
    if (currentUser.role?.key === 'Supervisor') {
      if (existingUser.immediateSupervisorId !== currentUser.id && existingUser.teamId !== currentUser.teamId) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      // prevent supervisors from changing role to non-technician (already checked above)
    }

    // Managers may update users within their assigned regions/zones or teams they manage
    if (currentUser.role?.key === 'Manager') {
      const userRegions = currentUser.assignedRegion || [];
      const userZones = currentUser.assignedZone || [];
      const targetRegions = existingUser.assignedRegion || [];
      const targetZones = existingUser.assignedZone || [];
      const regionMatch = targetRegions.some((r: string) => userRegions.includes(r));
      const zoneMatch = targetZones.some((z: string) => userZones.includes(z));

      // also allow if manager is the team manager of the target user's team
      let managesTeam = false;
      if (existingUser.teamId) {
        const team = await prisma.team.findUnique({ where: { id: existingUser.teamId } });
        if (team && team.managerId === currentUser.id) managesTeam = true;
      }

      if (!regionMatch && !zoneMatch && !managesTeam && currentUser.id !== existingUser.immediateSupervisorId) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    // Only Admins and Managers can set immediateSupervisorId for users (not supervisors themselves)
    if (immediateSupervisorId !== undefined && currentUser.role?.key === 'Supervisor') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        role: true
      }
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } });
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting admin users
    if (existingUser.roleId) {
      const role = await prisma.role.findUnique({ where: { id: existingUser.roleId } });
      if (role?.key === 'Admin') {
        return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 403 });
      }
    }

    // Supervisors can only delete their own technicians
    if (currentUser.role?.key === 'Supervisor') {
      if (existingUser.role?.key !== 'Technician') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      if (existingUser.immediateSupervisorId !== currentUser.id && existingUser.teamId !== currentUser.teamId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Managers may delete users within their assigned regions/zones or teams they manage
    if (currentUser.role?.key === 'Manager') {
      if (existingUser.role?.key === 'Admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      const userRegions = currentUser.assignedRegion || [];
      const userZones = currentUser.assignedZone || [];
      const targetRegions = existingUser.assignedRegion || [];
      const targetZones = existingUser.assignedZone || [];
      const regionMatch = targetRegions.some((r: string) => userRegions.includes(r));
      const zoneMatch = targetZones.some((z: string) => userZones.includes(z));
      let managesTeam = false;
      if (existingUser.teamId) {
        const team = await prisma.team.findUnique({ where: { id: existingUser.teamId } });
        if (team && team.managerId === currentUser.id) managesTeam = true;
      }
      if (!regionMatch && !zoneMatch && !managesTeam && existingUser.immediateSupervisorId !== currentUser.id) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
