import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { getSitesForZoneManager, getSitesForRegionManager } from '../../../../lib/zoneSiteQueries';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  const user = session && typeof session === 'object' && 'user' in session ? (session as any).user : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (user.role || user.roleKey || '').toLowerCase();
  let sites: any[] = [];
  if (role === 'manager') {
    sites = await getSitesForRegionManager(user.id);
  } else if (role === 'zone_manager') {
    sites = await getSitesForZoneManager(user.id);
  }
  return NextResponse.json(sites);
}
