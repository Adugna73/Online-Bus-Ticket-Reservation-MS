import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regionId = url.searchParams.get('regionId');

    if (!regionId) {
      return NextResponse.json([], { status: 200 });
    }

    const areas = await prisma.area.findMany({
      where: { regionId },
      select: { id: true, name: true, regionId: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(areas);
  } catch (error) {
    console.error('[areas/region] Error fetching areas:', error);
    return NextResponse.json([], { status: 200 });
  }
}