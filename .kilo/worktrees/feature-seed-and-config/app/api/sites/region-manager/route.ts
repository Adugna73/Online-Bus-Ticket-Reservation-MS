import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { getSitesForRegionManager } from '../../../../lib/zoneSiteQueries';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  const user = session && typeof session === 'object' && 'user' in session ? (session as any).user : null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sites = await getSitesForRegionManager(user.id);
  return NextResponse.json(sites);
}
