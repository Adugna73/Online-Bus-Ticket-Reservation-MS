import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { getSitesForRegion } from '../../../../lib/zoneSiteQueries';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  const user = session && typeof session === 'object' && 'user' in session ? (session as any).user : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Optionally allow regionId as query param
  const url = new URL(req.url);
  const regionId = url.searchParams.get('regionId');
  let sites: any[] = [];
  if (regionId) {
    sites = await getSitesForRegion(regionId);
  }
  return NextResponse.json(sites);
}
