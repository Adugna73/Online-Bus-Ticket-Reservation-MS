import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'team id required' }, { status: 400 });

    // ensure team exists (include members + sites so we can branch for groups)
    const team = await prisma.team.findUnique({ where: { id }, include: { members: true, sites: { include: { region: true, zone: true } } } });
    if (!team) return NextResponse.json({ error: 'team not found' }, { status: 404 });

    const user = session.user as any;
    const role = String(user.role || '').toLowerCase();
    if (role === 'supervisor') {
      // Supervisors can access teams they manage or are a member of
      const isManager = team.managerId && team.managerId === user.id;
      const isMember = (team.members || []).some((m: any) => m.id === user.id);
      if (!isManager && !isMember) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
    }

    // For supervisor group teams (Group-1, Group-2, ...), return the
    // explicitly attached sites via the TeamSites relation. This lets
    // each group have its own site list.
    if (/^Group-\d+/i.test(team.name || '')) {
      return NextResponse.json(team.sites || []);
    }

    // Default behaviour for non-group teams: derive sites from the
    // regions/zones of members, preserving existing behaviour.
    const members = await prisma.user.findMany({ where: { teamId: id }, select: { assignedRegion: true, assignedZone: true } });

    const regionNames = Array.from(new Set(members.flatMap(m => m.assignedRegion || [])));
    const zoneNames = Array.from(new Set(members.flatMap(m => m.assignedZone || [])));

    const regions = await prisma.region.findMany({
      where: { name: { in: regionNames } },
      select: { id: true }
    });
    const zones = await prisma.zone.findMany({
      where: { name: { in: zoneNames } },
      select: { id: true }
    });

    const regionIds = regions.map(r => r.id);
    const zoneIds = zones.map(z => z.id);

    const where: any = { OR: [] };
    if (regionIds.length) where.OR.push({ regionId: { in: regionIds } });
    if (zoneIds.length) where.OR.push({ zoneId: { in: zoneIds } });

    if (where.OR.length === 0) return NextResponse.json([]);

    const sites = await prisma.site.findMany({ where, include: { region: true, zone: true } });
    return NextResponse.json(sites);
  } catch (err) {
    console.error('GET /api/teams/[id]/sites error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Read body early so we can use it for dev fallbacks when session is missing
    const body = await req.json();

    let session = (await getServerSession(authOptions as any)) as any;
    // Development helper: when session is missing in local dev, allow a dev-specified
    // managerId or immediateSupervisorId in the request body to act as the caller.
    if (!session?.user?.id && process.env.NODE_ENV !== 'production') {
      try {
        const devUserId = body?.managerId || body?.immediateSupervisorId;
        if (devUserId) {
          const devUser = await prisma.user.findUnique({ where: { id: devUserId }, include: { role: true } });
          if (devUser) {
            session = { user: { id: devUser.id, role: devUser.role?.key ? String(devUser.role.key).toLowerCase() : 'no-access', assignedRegion: devUser.assignedRegion || [], assignedZone: devUser.assignedZone || [] } } as any;
            console.debug('DEV-FALLBACK: using dev user for POST /api/teams/[id]/sites', { devUserId: devUser.id });
          }
        }
      } catch (e) {
        console.debug('DEV-FALLBACK failed to resolve dev user', { error: (e as any)?.message });
      }
    }
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'team id required' }, { status: 400 });

    const user = session.user as any;
    const role = String(user.role || '').toLowerCase();

    // Only supervisors and managers can add sites
    if (role !== 'supervisor' && role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Branch 1: attach an existing site to this team (used for
    // supervisor groups). When `siteId` is provided we do not
    // create a new Site, we only connect via TeamSites.
    if (body.siteId && !body.name && !body.siteCode) {
      const siteId = String(body.siteId);

      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (!site) {
        return NextResponse.json({ error: 'site not found' }, { status: 404 });
      }

      // Enforce that a site can only belong to a single Group-*
      // team at a time. If it is already attached to another team,
      // prevent attaching to a second group.
      const existingTeam = await prisma.team.findFirst({
        where: {
          sites: { some: { id: siteId } },
        },
      });

      if (existingTeam && existingTeam.id !== id) {
        return NextResponse.json({ error: 'site already assigned to another group' }, { status: 400 });
      }

      await prisma.team.update({
        where: { id },
        data: {
          sites: {
            connect: { id: siteId },
          },
        },
      });

      const fullSite = await prisma.site.findUnique({
        where: { id: siteId },
        include: { region: true, zone: true },
      });

      return NextResponse.json(fullSite, { status: 201 });
    }

    const { name, siteCode, regionName, zoneName, neNameAndId, address } = body;

    if (!name || !siteCode || !regionName) {
      return NextResponse.json({ error: 'name, siteCode, and regionName are required' }, { status: 400 });
    }

    // Find region by name
    const region = await prisma.region.findFirst({ where: { name: regionName } });
    if (!region) {
      return NextResponse.json({ error: 'region not found' }, { status: 400 });
    }

    // Find zone by name if provided
    let zone = null;
    if (zoneName) {
      zone = await prisma.zone.findFirst({ where: { name: zoneName } });
      if (!zone) {
        return NextResponse.json({ error: 'zone not found' }, { status: 400 });
      }
    }

    // Check if site code already exists
    const existingSite = await prisma.site.findUnique({ where: { siteCode } });
    if (existingSite) {
      return NextResponse.json({ error: 'site code already exists' }, { status: 400 });
    }

    // For supervisors, ensure they can only add sites in their assigned regions/zones
    if (role === 'supervisor') {
      const supervisor = await prisma.user.findUnique({
        where: { id: user.id },
        select: { assignedRegion: true, assignedZone: true }
      });

      if (!supervisor?.assignedRegion?.includes(regionName)) {
        return NextResponse.json({ error: 'can only add sites in assigned regions' }, { status: 403 });
      }

      if (zoneName && !supervisor?.assignedZone?.includes(zoneName)) {
        return NextResponse.json({ error: 'can only add sites in assigned zones' }, { status: 403 });
      }
    }

    const site = await prisma.site.create({
      data: {
        name,
        siteCode,
        regionId: region.id,
        zoneId: zone?.id || "",
        neNameAndId,
        address,
      },
      include: { region: true, zone: true }
    });

    return NextResponse.json(site, { status: 201 });
  } catch (err) {
    console.error('POST /api/teams/[id]/sites error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await req.json();

    let session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id && process.env.NODE_ENV !== 'production') {
      try {
        const devUserId = body?.managerId || body?.immediateSupervisorId;
        if (devUserId) {
          const devUser = await prisma.user.findUnique({ where: { id: devUserId }, include: { role: true } });
          if (devUser) {
            session = { user: { id: devUser.id, role: devUser.role?.key ? String(devUser.role.key).toLowerCase() : 'no-access', assignedRegion: devUser.assignedRegion || [], assignedZone: devUser.assignedZone || [] } } as any;
            console.debug('DEV-FALLBACK: using dev user for PUT /api/teams/[id]/sites', { devUserId: devUser.id });
          }
        }
      } catch (e) {
        console.debug('DEV-FALLBACK failed to resolve dev user', { error: (e as any)?.message });
      }
    }
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'team id required' }, { status: 400 });

    const user = session.user as any;
    const role = String(user.role || '').toLowerCase();

    // Only supervisors and managers can update sites
    if (role !== 'supervisor' && role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { siteId, name, siteCode, regionName, zoneName, neNameAndId, address } = body;

    if (!siteId || !name || !siteCode || !regionName) {
      return NextResponse.json({ error: 'siteId, name, siteCode, and regionName are required' }, { status: 400 });
    }

    // Find region by name
    const region = await prisma.region.findFirst({ where: { name: regionName } });
    if (!region) {
      return NextResponse.json({ error: 'region not found' }, { status: 400 });
    }

    // Find zone by name if provided
    let zone = null;
    if (zoneName) {
      zone = await prisma.zone.findFirst({ where: { name: zoneName } });
      if (!zone) {
        return NextResponse.json({ error: 'zone not found' }, { status: 400 });
      }
    }

    // Check if site exists
    const existingSite = await prisma.site.findUnique({ where: { id: siteId } });
    if (!existingSite) {
      return NextResponse.json({ error: 'site not found' }, { status: 404 });
    }

    // Check if new site code conflicts (if changed)
    if (siteCode !== existingSite.siteCode) {
      const codeConflict = await prisma.site.findUnique({ where: { siteCode } });
      if (codeConflict) {
        return NextResponse.json({ error: 'site code already exists' }, { status: 400 });
      }
    }

    // For supervisors, ensure they can only update sites in their assigned regions/zones
    if (role === 'supervisor') {
      const supervisor = await prisma.user.findUnique({
        where: { id: user.id },
        select: { assignedRegion: true, assignedZone: true }
      });

      if (!supervisor?.assignedRegion?.includes(regionName)) {
        return NextResponse.json({ error: 'can only update sites in assigned regions' }, { status: 403 });
      }

      if (zoneName && !supervisor?.assignedZone?.includes(zoneName)) {
        return NextResponse.json({ error: 'can only update sites in assigned zones' }, { status: 403 });
      }
    }

    const site = await prisma.site.update({
      where: { id: siteId },
      data: {
        name,
        siteCode,
        regionId: region.id,
        zoneId: zone?.id,
        neNameAndId,
        address,
      },
      include: { region: true, zone: true }
    });

    return NextResponse.json(site);
  } catch (err) {
    console.error('PUT /api/teams/[id]/sites error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // For DELETE we look at query params for siteId, but allow the dev fallback
    // through a JSON body or query param `managerId`/`immediateSupervisorId`.
    const url = new URL(req.url);
    const maybeBodyText = await req.text();
    let parsedBody: any = {};
    try {
      parsedBody = maybeBodyText ? JSON.parse(maybeBodyText) : {};
    } catch (_) {
      parsedBody = {};
    }

    let session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id && process.env.NODE_ENV !== 'production') {
      try {
        const devUserId = parsedBody?.managerId || parsedBody?.immediateSupervisorId || url.searchParams.get('managerId') || url.searchParams.get('immediateSupervisorId');
        if (devUserId) {
          const devUser = await prisma.user.findUnique({ where: { id: devUserId }, include: { role: true } });
          if (devUser) {
            session = { user: { id: devUser.id, role: devUser.role?.key ? String(devUser.role.key).toLowerCase() : 'no-access', assignedRegion: devUser.assignedRegion || [], assignedZone: devUser.assignedZone || [] } } as any;
            console.debug('DEV-FALLBACK: using dev user for DELETE /api/teams/[id]/sites', { devUserId: devUser.id });
          }
        }
      } catch (e) {
        console.debug('DEV-FALLBACK failed to resolve dev user', { error: (e as any)?.message });
      }
    }
    if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'team id required' }, { status: 400 });

    const user = session.user as any;
    const role = String(user.role || '').toLowerCase();

    // Only supervisors and managers can delete sites
    if (role !== 'supervisor' && role !== 'manager') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const siteId = url.searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json({ error: 'siteId query parameter required' }, { status: 400 });
    }

    // Branch 1: unlink a site from this team only (used for group
    // membership) when `unlink=1` is provided. This does NOT delete
    // the underlying Site record.
    const unlink = url.searchParams.get('unlink');
    if (unlink === '1') {
      await prisma.team.update({
        where: { id },
        data: {
          sites: {
            disconnect: { id: siteId },
          },
        },
      });

      return NextResponse.json({ message: 'site unlinked from team' });
    }

    // Branch 2: legacy behaviour — fully delete the Site record
    // (used by manager-style site management flows).

    // Check if site exists
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return NextResponse.json({ error: 'site not found' }, { status: 404 });
    }

    // For supervisors, ensure they can only delete sites in their assigned regions/zones
    if (role === 'supervisor') {
      const supervisor = await prisma.user.findUnique({
        where: { id: user.id },
        select: { assignedRegion: true, assignedZone: true }
      });

      // `assignedRegion` / `assignedZone` hold human-readable names in seeded data,
      // while `site.regionId` / `site.zoneId` are DB ids. Resolve the names first.
      const region = await prisma.region.findUnique({ where: { id: site.regionId }, select: { name: true } });
      const zone = site.zoneId ? await prisma.zone.findUnique({ where: { id: site.zoneId }, select: { name: true } }) : null;

      const regionName = region?.name;
      const zoneName = zone?.name;

      if (regionName && !supervisor?.assignedRegion?.includes(regionName)) {
        return NextResponse.json({ error: 'can only delete sites in assigned regions' }, { status: 403 });
      }

      if (zoneName && !supervisor?.assignedZone?.includes(zoneName)) {
        return NextResponse.json({ error: 'can only delete sites in assigned zones' }, { status: 403 });
      }
    }

    // Check if site has associated work orders or assets (prevent deletion if it does)
    const workOrderCount = await prisma.workOrder.count({ where: { siteId } });
    const assetCount = await prisma.asset.count({ where: { siteId } });

    if (workOrderCount > 0 || assetCount > 0) {
      return NextResponse.json({
        error: 'cannot delete site with associated work orders or assets'
      }, { status: 400 });
    }

    await prisma.site.delete({ where: { id: siteId } });

    return NextResponse.json({ message: 'site deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/teams/[id]/sites error', err);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
