import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';

function normalizeSingleAssignment(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const first = value.find((item) => typeof item === 'string' && item);
  return first ? [first] : [];
}

export async function GET(request: NextRequest) {
  try {
    // API key bypass for development/testing
    const apiKey = request.headers.get('x-api-key');
    const validApiKey = process.env.API_KEY;
    let session = null;
    let currentUser = null;

    if (apiKey && validApiKey && apiKey === validApiKey) {
      // Bypass session check, treat as admin
      session = { user: { id: 'api-key', role: 'admin' } };
      currentUser = { id: 'api-key', role: { key: 'admin' }, assignedRegion: [], assignedZone: [] };
    } else {
      session = await getServerSession(authOptions);
      if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // resolve current user from DB to get assignedRegion/assignedZone and role key
      currentUser = await prisma.user.findUnique({ where: { id: String(session.user.id) }, include: { role: true } });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const regionId = searchParams.get('regionId');
    const zoneId = searchParams.get('zoneId');
    const location = searchParams.get('location');
    const email = searchParams.get('email');
    const immediateSupervisorId = searchParams.get('immediateSupervisorId');

    const where: any = {};
    if (role) {
      const roleKey = String(role);
      where.role = {
        key: {
          equals: roleKey,
          mode: 'insensitive',
        },
      };
    }
    if (regionId) {
      where.AND = where.AND || [];
      // Check if regionId is a UUID (ID) or name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(regionId);
      if (isUUID) {
        // It's a region ID
        where.AND.push({ assignedRegion: { has: regionId } });
      } else {
        // It might be a region name/code in seeded data
        where.AND.push({
          OR: [
            { assignedRegion: { has: regionId } },
            { assignedRegion: { hasSome: [regionId] } },
            { locationCategory: { equals: regionId, mode: 'insensitive' } },
          ]
        });
      }
    }
    if (zoneId) {
      where.AND = where.AND || [];
      // Check if zoneId is a UUID (ID) or name
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(zoneId);
      if (isUUID) {
        // It's a zone ID
        where.AND.push({ assignedZone: { has: zoneId } });
      } else {
        // It might be a zone name
        where.AND.push({
          OR: [
            { assignedZone: { has: zoneId } },
            { assignedZone: { hasSome: [zoneId] } },
          ]
        });
      }
    }
    if (location) {
      where.location = {
        equals: location,
        mode: 'insensitive',
      };
    }
    if (email) {
      where.email = {
        equals: email,
        mode: 'insensitive',
      };
    }
    if (immediateSupervisorId) {
      where.immediateSupervisorId = immediateSupervisorId;
    }

    // Determine requester's role key for scoping decisions
    const requesterRoleKey = String(currentUser?.role?.key || session.user.role || '').toLowerCase();
    const requesterIsSupervisor = requesterRoleKey === 'supervisor';
    const requesterIsManager = requesterRoleKey === 'manager';

    // Head Quarter supervisors are a special case: they are not
    // geographically restricted, but the UI still wants to limit them to
    // their own direct reports (plus themselves). We handle that below.
    const isHeadQuarterSupervisor =
      requesterIsSupervisor &&
      Array.isArray(currentUser?.assignedRegion) &&
      currentUser.assignedRegion.some((r: any) => {
        return r === 'Head Quarter' || r?.name === 'Head Quarter';
      });

    // Enforce area scoping for managers and supervisors. We apply these
    // constraints *after* any query parameters (regionId/zoneId) so that
    // the client cannot expand beyond the user's own territory.
    if (requesterIsManager || requesterIsSupervisor) {
      if (requesterIsSupervisor && isHeadQuarterSupervisor && currentUser) {
        // HQ supervisor sees only self and direct reports
        where.AND = where.AND || [];
        where.AND.push({
          OR: [
            { immediateSupervisorId: currentUser.id },
            { id: currentUser.id },
          ],
        });
      } else {
        const areaClauses: any[] = [];
        if (currentUser && Array.isArray(currentUser.assignedRegion) && currentUser.assignedRegion.length) {
          areaClauses.push({ assignedRegion: { hasSome: currentUser.assignedRegion } });
        }
        if (currentUser && Array.isArray(currentUser.assignedZone) && currentUser.assignedZone.length) {
          areaClauses.push({ assignedZone: { hasSome: currentUser.assignedZone } });
        }
        // If we have at least one area to restrict by, add an OR clause.
        if (areaClauses.length) {
          where.AND = where.AND || [];
          where.AND.push({ OR: areaClauses });
        }
      }
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  console.log('POST /api/users handler invoked');
  // This handler is purposely richer than the original; it needs to
  // support teamId/immediateSupervisorId and proper permission scoping
  // so managers can add technicians under specific supervisors.
  try {
    const body = await request.json();
    body.assignedRegion = normalizeSingleAssignment(body.assignedRegion);
    body.assignedZone = normalizeSingleAssignment(body.assignedZone);
    let session: any = await getServerSession(authOptions as any);

    // in dev mode allow a fallback using immediateSupervisorId when cookie
    // is missing (turbopack). See route.post.ts for explanation.
    let currentUser: any = null;
    if (!session?.user?.id && process.env.NODE_ENV !== 'production' && body?.immediateSupervisorId) {
      const sup = await prisma.user.findUnique({ where: { id: body.immediateSupervisorId }, include: { role: true } });
      if (sup && sup.role && String(sup.role.key).toLowerCase() === 'supervisor') {
        currentUser = sup;
      }
    }
    if (!currentUser) {
      if (!session || !session.user || !session.user.id) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
      currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } });
      if (!currentUser) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    const roleLower = String(currentUser.role?.key || session.user.role || '').toLowerCase();

    // import scoped helper dynamically to avoid server bundle issues
    let canManageAdmin = true;
    try {
        const { canManageAdminUsers, isScopedHqAdminUser } = await import('../../../lib/scopedAdmin');
        canManageAdmin = canManageAdminUsers(currentUser);
    } catch (e) {
        // ignore, default to true
    }

    // permission checks
    if (!['admin', 'manager'].includes(roleLower)) {
      if (roleLower === 'supervisor') {
        if ((body.roleKey || '').toLowerCase() !== 'technician') {
          return NextResponse.json({ error: 'Supervisors can only create technicians' }, { status: 403 });
        }
        if (body.immediateSupervisorId !== currentUser.id) {
          return NextResponse.json({ error: 'immediate_supervisor_mismatch' }, { status: 403 });
        }
        // allow creation even without teamId if supervisor is creating for self
      } else {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    // team exists and the rest of manager scoping are handled below
    if (body.teamId) {
      const team = await prisma.team.findUnique({ where: { id: body.teamId } });
      if (!team) return NextResponse.json({ error: 'team_not_found' }, { status: 404 });
      let allowed = false;
      if (roleLower === 'manager') {
        // managers may create for teams in their allowed areas
        const reqRegions: string[] = body.assignedRegion || [];
        const reqZones: string[] = body.assignedZone || [];
        const userRegions = currentUser.assignedRegion || [];
        const userZones = currentUser.assignedZone || [];
        const regionMatch = reqRegions.some((r: string) => userRegions.includes(r));
        const zoneMatch = reqZones.some((z: string) => userZones.includes(z));
        if (regionMatch || zoneMatch) allowed = true;
      }
      if (!allowed) {
        // allow team manager or the supervisor themselves
        allowed = session.user.id === team.managerId || session.user.id === body.immediateSupervisorId;
      }
      if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // disallow scoped HQ admins from creating new admin accounts
    if ((body.roleKey || '').toLowerCase() === 'admin' && !canManageAdmin) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // build final create data
    const data: any = {
      username: body.username || body.email || body.staffId,
      email: body.email,
      fullName: body.fullName || body.username || body.email,
      staffId: body.staffId || null,
      phone: body.phone || null,
      teamId: body.teamId || null,
      immediateSupervisorId: body.immediateSupervisorId || null,
      assignedRegion: body.assignedRegion || [],
      assignedZone: body.assignedZone || [],
      location: body.location || null,
      roleId: undefined,
      enabled: body.enabled === undefined ? true : !!body.enabled,
    };

    // if a supervisor was chosen but no location was sent, inherit their location
    if (!data.location && data.immediateSupervisorId) {
      const sup = await prisma.user.findUnique({ where: { id: data.immediateSupervisorId } });
      if (sup?.location) {
        data.location = sup.location;
      }
    }

    // determine roleId
    if (body.roleId) data.roleId = body.roleId;
    else if (body.roleKey) {
      const r = await prisma.role.findUnique({ where: { key: body.roleKey } });
      if (r) data.roleId = r.id;
    }
    if (!data.roleId) {
      const def = await prisma.role.findFirst({ where: { key: 'Technician' } });
      data.roleId = def?.id;
    }

    try {
      const user = await prisma.user.create({ data });
      return NextResponse.json(user, { status: 201 });
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