import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';

function getRoleKey(user: any): string {
  return String(
    user?.role?.key ||
      user?.roleKey ||
      user?.role ||
      '',
  ).toLowerCase();
}

// List network elements for a given site
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
    // Ensure site exists (helps return 404 instead of empty list for bad IDs)
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const elements = await prisma.networkElement.findMany({
      where: { siteId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(elements);
  } catch (err: any) {
    console.error('GET /api/sites/[id]/network-elements error', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch network elements' },
      { status: 500 },
    );
  }
}

// Create a new network element for the given site
export async function POST(
  request: NextRequest,
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

  const role = getRoleKey(user);
  if (role !== 'supervisor' && role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: siteId } = await context.params;
  const body = await request.json();
  const { name, neId, type } = body ?? {};

  if (!name || !neId) {
    return NextResponse.json(
      { error: 'name and neId are required' },
      { status: 400 },
    );
  }

  try {
    // Ensure site exists before creating
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const ne = await prisma.networkElement.create({
      data: {
        siteId,
        name,
        neId,
        type: type ?? null,
      },
    });

    return NextResponse.json(ne);
  } catch (err: any) {
    console.error('POST /api/sites/[id]/network-elements error', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to add network element' },
      { status: 500 },
    );
  }
}

// Update an existing network element
export async function PUT(
  request: NextRequest,
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

  const role = getRoleKey(user);
  if (role !== 'supervisor' && role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: siteId } = await context.params;
  const body = await request.json();
  const { id, name, neId, type } = body ?? {};

  if (!id || !name || !neId) {
    return NextResponse.json(
      { error: 'id, name and neId are required' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.networkElement.findUnique({
      where: { id },
    });

    if (!existing || existing.siteId !== siteId) {
      return NextResponse.json(
        { error: 'Network element not found for this site' },
        { status: 404 },
      );
    }

    const ne = await prisma.networkElement.update({
      where: { id },
      data: {
        name,
        neId,
        type: type ?? null,
      },
    });

    return NextResponse.json(ne);
  } catch (err: any) {
    console.error('PUT /api/sites/[id]/network-elements error', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to update network element' },
      { status: 500 },
    );
  }
}

// Delete a network element by its id (passed as neId query param)
export async function DELETE(
  request: NextRequest,
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

  const role = getRoleKey(user);
  if (role !== 'supervisor' && role !== 'manager' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: siteId } = await context.params;
  const url = new URL(request.url);
  const neId = url.searchParams.get('neId');

  if (!neId) {
    return NextResponse.json(
      { error: 'neId query parameter is required' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.networkElement.findFirst({
      where: { id: neId, siteId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Network element not found for this site' },
        { status: 404 },
      );
    }

    await prisma.networkElement.delete({ where: { id: neId } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('DELETE /api/sites/[id]/network-elements error', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to delete network element' },
      { status: 500 },
    );
  }
}
