
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

// Fetch a single site with basic details. This powers places like
// WorkOrderForm and team views that call GET /api/sites/:id.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions as any);
  const user =
    session && typeof session === 'object' && 'user' in session
      ? (session as any).user
      : null;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: siteId } = await context.params;

  try {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        region: true,
        zone: true,
      },
    });

    if (!site) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(site);
  } catch (err: any) {
    console.error('GET /api/sites/[id] error', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch site' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions as any);
  const user = (session && typeof session === 'object' && 'user' in session) ? (session as any).user : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: siteId } = await context.params;
  const body = await request.json();
  const { supervisorStationId, name, siteCode, regionId, zoneId, neNameAndId, latitude, longitude } = body;

  // Only allow managers or admins to update site assignments
  const role = String((user as any)?.role?.key || (user as any)?.roleKey || (user as any)?.role || '').toLowerCase();
  if (role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let resolvedRegionId = regionId;
  if (!resolvedRegionId && zoneId) {
    const zone = await prisma.zone.findUnique({ where: { id: zoneId }, select: { regionId: true } });
    if (zone?.regionId) resolvedRegionId = zone.regionId;
  }
  try {
    const updated = await prisma.site.update({
      where: { id: siteId },
      data: {
        ...(supervisorStationId !== undefined ? { supervisorStationId } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(siteCode !== undefined ? { siteCode } : {}),
        ...(resolvedRegionId !== undefined ? { regionId: resolvedRegionId } : {}),
        ...(zoneId !== undefined ? { zoneId } : {}),
        ...(neNameAndId !== undefined ? { neNameAndId } : {}),
        ...(latitude !== undefined ? { latitude } : {}),
        ...(longitude !== undefined ? { longitude } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update site' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions as any);
  const user = (session && typeof session === 'object' && 'user' in session) ? (session as any).user : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: siteId } = await context.params;
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  const role = String((user as any)?.role?.key || (user as any)?.roleKey || (user as any)?.role || '').toLowerCase();
  if (role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (force && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [workOrderCount, assetCount] = await Promise.all([
      prisma.workOrder.count({ where: { siteId } }),
      prisma.asset.count({ where: { siteId } }),
    ]);

    if ((workOrderCount > 0 || assetCount > 0) && !force) {
      return NextResponse.json(
        {
          error: 'site_has_dependencies',
          message: `Cannot delete site: ${workOrderCount} work orders, ${assetCount} assets are linked.`,
        },
        { status: 409 },
      );
    }

    if (force) {
      await prisma.workOrder.deleteMany({ where: { siteId } });
      await prisma.asset.deleteMany({ where: { siteId } });
    }

    // Detach supervisors linked via supervisorStationId
    await prisma.user.updateMany({
      where: { supervisorStationId: siteId },
      data: { supervisorStationId: null },
    });

    // Detach teams associated with this site
    await prisma.site.update({
      where: { id: siteId },
      data: { teams: { set: [] } },
    });

    await prisma.site.delete({ where: { id: siteId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete site' }, { status: 500 });
  }
}
