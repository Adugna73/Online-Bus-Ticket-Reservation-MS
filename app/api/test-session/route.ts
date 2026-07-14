import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '../../../lib/auth';

export async function GET(request: NextRequest) {
  // getServerSession for App Router expects only (authOptions)
  const session = await getServerSession(authOptions as any);
  return NextResponse.json({ session });
}
