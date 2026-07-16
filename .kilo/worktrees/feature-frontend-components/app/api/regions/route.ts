import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const regions = await prisma.region.findMany({ select: { id: true, name: true } });
  return NextResponse.json(regions);
}
