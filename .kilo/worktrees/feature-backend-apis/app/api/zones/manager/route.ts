import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { getZonesForZoneManager } from '../../../../lib/zoneSiteQueries';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const user = session && typeof session === 'object' && 'user' in session ? (session as any).user : null;
    if (!user) {
      console.error('[zones/manager] Unauthorized access', { session });
      // Always return an array, even if unauthorized
      return NextResponse.json([]);
    }
    // For managers, return assigned zones
    const assignedZoneIds = Array.isArray(user.assignedZone) ? user.assignedZone : [];
    if (assignedZoneIds.length > 0) {
      const zones = await prisma.zone.findMany({
        where: { id: { in: assignedZoneIds } },
      });
      return NextResponse.json(zones);
    }
    // Fallback to managed zones
    const zones = await getZonesForZoneManager(user.id);
    // Always return an array
    return NextResponse.json(Array.isArray(zones) ? zones : []);
  } catch (err) {
    console.error('[zones/manager] Error:', err);
    // Always return an array on error
    return NextResponse.json([]);
  }
}
