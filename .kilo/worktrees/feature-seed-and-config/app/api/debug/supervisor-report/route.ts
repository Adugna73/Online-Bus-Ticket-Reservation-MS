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
  const managerEmail = params.get('managerEmail') || undefined;
  const managerId = params.get('managerId') || undefined;

  try {
    let managerUser = null;
    if (managerEmail) {
      managerUser = await prisma.user.findUnique({ where: { email: managerEmail } });
    }
    if (!managerUser && managerId) {
      managerUser = await prisma.user.findUnique({ where: { id: managerId } });
    }
    if (!managerUser) {
      managerUser = await prisma.user.findUnique({ where: { id: String(session.user.id) } });
    }
    if (!managerUser) return NextResponse.json({ error: 'manager_not_found' }, { status: 404 });

    // find teams managed by this user
    const teams = await prisma.team.findMany({ where: { managerId: managerUser.id }, include: { members: { include: { role: true } }, manager: { include: { role: true } } } });

    const allSiteIds = new Set<string>();
    const neNames = new Set<string>();
    const techMap = new Map<string, any>();
    const supervisors: Array<{ id: string; fullName: string | null; email: string | null }> = [];
    const seenSupervisorIds = new Set<string>();

    for (const t of teams) {
      // collect region/zone ids from manager and members
      const regionSet = new Set<string>();
      const zoneSet = new Set<string>();
      function addFromUser(u: any) {
        if (!u) return;
        (u.assignedRegion || []).forEach((r: string) => r && regionSet.add(r));
        (u.assignedZone || []).forEach((z: string) => z && zoneSet.add(z));
      }
      addFromUser(t.manager);
      (t.members || []).forEach((m: any) => addFromUser(m));

      const regionIds = Array.from(regionSet);
      const zoneIds = Array.from(zoneSet);

      // find sites matching regions/zones
      let where: any = {};
      if (regionIds.length > 0 && zoneIds.length > 0) {
        where = { OR: [{ regionId: { in: regionIds } }, { zoneId: { in: zoneIds } }] };
      } else if (regionIds.length > 0) {
        where = { regionId: { in: regionIds } };
      } else if (zoneIds.length > 0) {
        where = { zoneId: { in: zoneIds } };
      }

      let sites: any[] = [];
      if (Object.keys(where).length > 0) {
        sites = await prisma.site.findMany({ where, select: { id: true, name: true, siteCode: true, neNameAndId: true, allNeNames: true, regionId: true, zoneId: true } });
      }
      for (const s of sites) {
        allSiteIds.add(s.id);
        if (s.neNameAndId) neNames.add(s.neNameAndId);
        if (Array.isArray(s.allNeNames)) {
          for (const raw of s.allNeNames as any[]) {
            const v = (raw ?? '').toString().trim();
            if (v) neNames.add(v);
          }
        }
      }

      // collect technicians from team members and manager
      for (const m of t.members || []) {
        const rk = m.role?.key || '';
        if (typeof rk === 'string' && (rk.toLowerCase().includes('tech') || rk.toLowerCase().includes('technician'))) {
          techMap.set(m.id, { id: m.id, fullName: m.fullName, email: m.email });
        } else if (typeof rk === 'string' && rk.toLowerCase().includes('supervisor')) {
          if (!seenSupervisorIds.has(m.id)) {
            seenSupervisorIds.add(m.id);
            supervisors.push({ id: m.id, fullName: m.fullName, email: m.email });
          }
        }
      }
      if (t.manager) {
        const rk = t.manager.role?.key || '';
        const rkLower = typeof rk === 'string' ? rk.toLowerCase() : '';
        if (rkLower.includes('tech') || rkLower.includes('technician')) {
          techMap.set(t.manager.id, { id: t.manager.id, fullName: t.manager.fullName, email: t.manager.email });
        }
        if (rkLower.includes('supervisor')) {
          if (!seenSupervisorIds.has(t.manager.id)) {
            seenSupervisorIds.add(t.manager.id);
            supervisors.push({ id: t.manager.id, fullName: t.manager.fullName, email: t.manager.email });
          }
        }
      }
    }

    // also include direct reports (both technicians and supervisors)
    const directReports = await prisma.user.findMany({ where: { immediateSupervisorId: managerUser.id }, include: { role: true } });
    for (const d of directReports) {
      const rk = d.role?.key || '';
      const rkLower = typeof rk === 'string' ? rk.toLowerCase() : '';
      if (rkLower.includes('tech') || rkLower.includes('technician')) {
        techMap.set(d.id, { id: d.id, fullName: d.fullName, email: d.email });
      }
      if (rkLower.includes('supervisor')) {
        if (!seenSupervisorIds.has(d.id)) {
          seenSupervisorIds.add(d.id);
          supervisors.push({ id: d.id, fullName: d.fullName, email: d.email });
        }
      }
    }

      // Also consult the TN_OM Staff V.2.json seeded staff list to include any staff whose
      // "Immediate Supervisor" matches this manager (fallback when DB relations are missing).
      try {
        const staffPath = path.join(process.cwd(), 'TN_OM Staff V.2.json');
        const raw = await fs.readFile(staffPath, 'utf-8');
        const staffList = JSON.parse(raw) as Array<any>;
        const managerNameNorm = normalizeName(managerUser.fullName || managerUser.username || managerUser.email || '');
        for (const s of staffList) {
          const immediate = (s['Immediate Supervisor'] || s['ImmediateSupervisor'] || s['Immediate supervisor'] || '').toString();
          const email = (s['Email'] || s['email'] || '').toString().trim();
          const full = (s['Full Name'] || s['FullName'] || s['fullName'] || s['Name'] || '').toString();
          if (!immediate) continue;
          const immNorm = normalizeName(immediate);
          // match if normalized immediate supervisor equals manager name or vice versa
          if (immNorm === managerNameNorm || managerNameNorm.includes(immNorm) || immNorm.includes(managerNameNorm)) {
            // try to resolve the user from DB by email
            if (email) {
              const dbu = await prisma.user.findUnique({ where: { email } , include: { role: true } }).catch(()=>null);
              if (dbu) {
                const rk = dbu.role?.key || '';
                if (typeof rk === 'string' && (rk.toLowerCase().includes('tech') || rk.toLowerCase().includes('technician'))) {
                  techMap.set(dbu.id, { id: dbu.id, fullName: dbu.fullName, email: dbu.email });
                  continue;
                }
              }
            }
            // add a lightweight entry from the seeded file if DB record missing
            const key = email || full || Math.random().toString(36).slice(2,8);
            if (!techMap.has(key)) {
              techMap.set(key, { id: key, fullName: full || email, email: email || '' });
            }
          }
        }
      } catch (e) {
        // ignore missing or parse errors for the seeded file
      }

    // Also include all supervisors within the manager's assigned regions/zones.
    try {
      const managerRegions: string[] = Array.isArray((managerUser as any).assignedRegion)
        ? ((managerUser as any).assignedRegion as string[])
        : [];
      const managerZones: string[] = Array.isArray((managerUser as any).assignedZone)
        ? ((managerUser as any).assignedZone as string[])
        : [];

      if (managerRegions.length || managerZones.length) {
        const orArea: any[] = [];
        if (managerRegions.length) {
          orArea.push({ assignedRegion: { hasSome: managerRegions } });
        }
        if (managerZones.length) {
          orArea.push({ assignedZone: { hasSome: managerZones } });
        }

        const extraSupers = await prisma.user.findMany({
          where: {
            role: { key: { equals: 'Supervisor', mode: 'insensitive' } },
            OR: orArea,
          },
          select: { id: true, fullName: true, email: true },
        });

        for (const s of extraSupers) {
          if (!seenSupervisorIds.has(s.id)) {
            seenSupervisorIds.add(s.id);
            supervisors.push({ id: s.id, fullName: s.fullName, email: s.email });
          }
        }
      }
    } catch (e) {
      // area-based supervisor enrichment is best-effort; ignore failures
    }

    // fetch site full records for the unique site ids (limit to 500)
    const siteIds = Array.from(allSiteIds).slice(0, 500);
    const sites = siteIds.length > 0 ? await prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true, name: true, siteCode: true, neNameAndId: true, allNeNames: true, regionId: true, zoneId: true } }) : [];

    return NextResponse.json({
      sites,
      neNames: Array.from(neNames),
      technicians: Array.from(techMap.values()),
      teams: teams.map(t => ({ id: t.id, name: t.name })),
      supervisors,
    });
  } catch (err) {
    console.error('supervisor-report error', err);
    return NextResponse.json({ error: 'internal_error', detail: String(err) }, { status: 500 });
  }
}
