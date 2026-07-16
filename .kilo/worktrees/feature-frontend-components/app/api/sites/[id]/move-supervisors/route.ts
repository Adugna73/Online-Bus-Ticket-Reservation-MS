
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: siteId } = await context.params;
  const { supervisorIds } = await request.json();
  if (!siteId || !Array.isArray(supervisorIds)) {
    return NextResponse.json({ error: 'Missing siteId or supervisorIds' }, { status: 400 });
  }
  const primarySupervisorId = supervisorIds[0] || null;
  try {
    const updated = await prisma.site.update({
      where: { id: siteId },
      data: {
        supervisorStationId: primarySupervisorId,
        supervisors: { set: supervisorIds.map((id: string) => ({ id })) },
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update site supervisors' }, { status: 500 });
  }
}
