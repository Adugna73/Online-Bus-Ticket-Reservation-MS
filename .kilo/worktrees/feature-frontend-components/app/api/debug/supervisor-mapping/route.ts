import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import fs from 'fs/promises';
import path from 'path';

function normalizeName(s?: string) {
  if (!s) return '';
  return s
    .toString()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s@.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export async function GET(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const managerId = params.get('managerId') || undefined;
  const managerEmail = params.get('managerEmail') || undefined;

  try {
    let managerUser = null;
    if (managerEmail) {
      managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });
    }
    if (!managerUser && managerId) {
      managerUser = await prisma.user.findUnique({ where: { id: managerId } });
    }
    if (!managerUser) {
      // default to session user
      managerUser = await prisma.user.findUnique({ where: { id: String(session.user.id) } });
    }
    if (!managerUser) return NextResponse.json({ error: 'manager_not_found' }, { status: 404 });

    const managerFullName = managerUser.fullName || managerUser.username || managerUser.email;
    const normalizedManagerName = normalizeName(managerFullName as string);

    // DB direct reports by immediateSupervisorId
    const directReports = await prisma.user.findMany({ where: { immediateSupervisorId: managerUser.id }, select: { id: true, email: true, fullName: true, teamId: true } });

    // supervisors.json matches
    const supPath = path.join(process.cwd(), 'TN_OM Staff V.2.json');
    let jsonMatches: string[] = [];
    try {
      const raw = await fs.readFile(supPath, 'utf-8');
      const list = JSON.parse(raw) as Array<any>;
      for (const r of list) {
        const immediate = r['Immediate Supervisor'] || r['Immediate supervisor'] || r['ImmediateSupervisor'];
        const email = r['Email'] || r['email'];
        if (!immediate || !email) continue;
        const n = normalizeName(String(immediate));
        // match if normalized names are equal or one contains the other
        if (n === normalizedManagerName || normalizedManagerName.includes(n) || n.includes(normalizedManagerName)) {
          jsonMatches.push(String(email).trim());
        }
      }
    } catch (e) {
      // ignore missing file
    }

    // Also attempt to find users in DB matching those emails to extract teamIds
    const dbUsersForJson = jsonMatches.length > 0 ? await prisma.user.findMany({ where: { email: { in: jsonMatches } }, select: { id: true, email: true, teamId: true, fullName: true } }) : [];

    const derivedTeamIds = [
      ...new Set([
        ...directReports.map((d) => d.teamId).filter(Boolean) as string[],
        ...dbUsersForJson.map((u: any) => u.teamId).filter(Boolean) as string[],
      ]),
    ];

    // Attempt to read local supervisors files for seeded Location Category / Location
    const candidateNames = ['supervisors.json', 'supervisors.normalized.json', 'supervisors.normalized.json'];
    let supervisorLocations: { categories: string[]; locations: string[] } = { categories: [], locations: [] };
    for (const name of candidateNames) {
      try {
        const supJsonPath = path.join(process.cwd(), name);
        const rawSup = await fs.readFile(supJsonPath, 'utf-8');
        const list = JSON.parse(rawSup) as Array<any>;
        for (const r of list) {
          const email = (r['Email'] || r['email'] || r['emailAddress'] || '').toString().trim();
          const full = (r['Full Name'] || r['FullName'] || r['fullName'] || r['full_name'] || r['fullNameNormalized'] || '').toString();
          const normalizedFull = normalizeName(full);
          if (!email && !full) continue;
          if (
            String(email).toLowerCase() === String(managerUser.email || '').toLowerCase() ||
            normalizedFull === normalizedManagerName ||
            normalizedManagerName.includes(normalizedFull) ||
            normalizedFull.includes(normalizedManagerName)
          ) {
            const locCat = r['Location Category'] || r['LocationCategory'] || r['Location category'] || r['locationCategory'] || r['locationCategoryName'] || r['locationCategory'] || '';
            const loc = r['Location'] || r['location'] || r['area'] || '';
            if (locCat) supervisorLocations.categories.push(String(locCat).trim());
            if (loc) supervisorLocations.locations.push(String(loc).trim());
          }
        }
        supervisorLocations.categories = Array.from(new Set(supervisorLocations.categories));
        supervisorLocations.locations = Array.from(new Set(supervisorLocations.locations));
        // stop after first successful read
        break;
      } catch (e) {
        // try next candidate
      }
    }

    return NextResponse.json({
      manager: { id: managerUser.id, email: managerUser.email, fullName: managerFullName, assignedRegion: managerUser.assignedRegion || [], assignedZone: managerUser.assignedZone || [] },
      normalizedManagerName,
      directReports,
      jsonMatches,
      dbUsersForJson,
      derivedTeamIds,
      supervisorLocations,
    });
  } catch (err) {
    console.error('debug supervisor mapping error', err);
    return NextResponse.json({ error: 'internal_error', detail: String(err) }, { status: 500 });
  }
}
