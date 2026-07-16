import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import ExcelJS from 'exceljs';

export async function POST(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const currentUser = session.user as any;
  const role = (currentUser.role || '').toLowerCase();
  if (role !== 'manager' && role !== 'supervisor' && role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const start = body.start ? new Date(body.start) : new Date('1970-01-01');
  const end = body.end ? new Date(body.end) : new Date();
  // manager scope: prefer body.managerId or fall back to session user
  const managerId = body.managerId || currentUser.id;
  const managerEmail = body.managerEmail || currentUser.email;

  // Resolve manager area (assignedRegion/assignedZone) to siteIds for geographic scoping
  let managerSiteIds: string[] = [];
  try {
    const managerUser = await prisma.user.findUnique({
      where: { id: managerId },
      select: { assignedRegion: true, assignedZone: true, locationCategory: true },
    });
    if (managerUser) {
      const rawRegions: string[] = Array.isArray((managerUser as any).assignedRegion)
        ? ((managerUser as any).assignedRegion as string[])
        : [];
      const rawZones: string[] = Array.isArray((managerUser as any).assignedZone)
        ? ((managerUser as any).assignedZone as string[])
        : [];
      const locCat = String((managerUser as any)?.locationCategory || '').toLowerCase();
      const isHqManager = locCat.includes('head quarter') || locCat === 'hq';

      if (rawRegions.length || rawZones.length || isHqManager) {
        const [regions, zones] = await Promise.all([
          prisma.region.findMany({ select: { id: true, name: true } }),
          prisma.zone.findMany({ select: { id: true, name: true, regionId: true } }),
        ]);
        const regionByName = new Map(regions.map((r) => [String(r.name).toLowerCase(), r.id] as [string, string]));
        const zoneByName = new Map(zones.map((z) => [String(z.name).toLowerCase(), z.id] as [string, string]));
        const regionIdSet = new Set(regions.map((r) => r.id));
        const zoneIdSet = new Set(zones.map((z) => z.id));

        const regionIds: string[] = [];
        const zoneIds: string[] = [];
        for (const v of rawRegions) {
          const name = String(v).trim();
          const normalized = name.toLowerCase() === 'head quarter' || name.toLowerCase() === 'hq' ? 'caaz' : name.toLowerCase();
          if (regionIdSet.has(name)) regionIds.push(name);
          else if (regionByName.has(normalized)) regionIds.push(regionByName.get(normalized)!);
        }
        if (isHqManager) {
          const caazId = regionByName.get('caaz');
          if (caazId && !regionIds.includes(caazId)) regionIds.push(caazId);
        }
        for (const v of rawZones) {
          const name = String(v).trim();
          if (zoneIdSet.has(name)) zoneIds.push(name);
          else if (zoneByName.has(name.toLowerCase())) zoneIds.push(zoneByName.get(name.toLowerCase())!);
        }
        if (isHqManager) {
          zones
            .filter((z) => String(z.name).toLowerCase().startsWith('hq-'))
            .forEach((z) => {
              if (!zoneIds.includes(z.id)) zoneIds.push(z.id);
            });
        }

        if (regionIds.length || zoneIds.length) {
          const siteWhere: any = {};
          const orParts: any[] = [];
          if (zoneIds.length) orParts.push({ zoneId: { in: zoneIds } });
          if (regionIds.length) orParts.push({ regionId: { in: regionIds }, zoneId: null });
          if (orParts.length) siteWhere.OR = orParts;
          const areaSites = await prisma.site.findMany({ where: siteWhere, select: { id: true } });
          managerSiteIds = areaSites.map((s) => s.id).filter(Boolean) as string[];
        }
      }
    }
  } catch (err) {
    console.error('[reports/manager] error resolving manager area sites', err);
  }

  // Build team/direct-report scope — report must show only the manager's own team members and direct reports
  const teams = await prisma.team.findMany({ where: { managerId }, select: { id: true, name: true } });
  const teamIds = teams.map((t) => t.id);
  const directReports = await prisma.user.findMany({ where: { immediateSupervisorId: managerId }, select: { id: true, email: true, fullName: true, teamId: true } });
  const directIds = directReports.map((d) => d.id);

  // fetch all users who are members of manager's teams (team members)
  const teamMembers = teamIds.length
    ? await prisma.user.findMany({ where: { teamId: { in: teamIds } }, select: { id: true } })
    : [];
  const teamMemberIds = teamMembers.map((m) => m.id);

  // Final allowed user set: direct reports + team members (deduplicated)
  const allowedUserIds = Array.from(new Set([...directIds, ...teamMemberIds]));

  const where: any = { AND: [{ createdAt: { gte: start } }, { createdAt: { lte: end } }] };
  const orParts: any[] = [];

  // Only include work orders that involve the manager's own staff (assignedTo OR createdBy OR team)
  if (allowedUserIds.length && managerSiteIds.length) {
    orParts.push({ AND: [{ assignedToId: { in: allowedUserIds } }, { siteId: { in: managerSiteIds } }] });
    orParts.push({ AND: [{ createdById: { in: allowedUserIds } }, { siteId: { in: managerSiteIds } }] });
  }
  if (teamIds.length && managerSiteIds.length) {
    orParts.push({ AND: [{ teamId: { in: teamIds } }, { siteId: { in: managerSiteIds } }] });
  }

  // If no allowed users or no manager sites, return an empty result set instead of using the legacy staff JSON fallback
  if (orParts.length === 0) {
    // Force empty 'OR' so the query returns zero rows
    where.AND.push({ OR: [{ id: '__no_results__' }] });
  }

  if (orParts.length > 0) where.AND.push({ OR: orParts });
  // Remove the separate site restriction since it's now included in each OR condition

  const wos = await prisma.workOrder.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, email: true, fullName: true } },
      team: { select: { id: true, name: true } },
      site: { select: { id: true, name: true, siteCode: true, longitude: true, latitude: true, region: { select: { name: true } }, zone: { select: { name: true } } } },
      createdBy: { select: { id: true, email: true, fullName: true } },
      completedBy: { select: { id: true, email: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  // Build analytics same as script
  const uniqueSiteIds = new Set<string>();
  const siteCounts: Record<string, number> = {};
  const siteMap: Record<string, any> = {};
  const techMap: Record<string, any> = {};
  const teamMap: Record<string, any> = {};

  for (const wo of wos) {
    if (wo.site && wo.site.id) {
      uniqueSiteIds.add(wo.site.id);
      siteCounts[wo.site.id] = (siteCounts[wo.site.id] || 0) + 1;
      siteMap[wo.site.id] = { id: wo.site.id, name: wo.site.name || wo.site.siteCode || wo.site.id, region: wo.site.region?.name || '', zone: wo.site.zone?.name || '' };
    }
    const techId = wo.assignedToId || wo.assignedTo?.id || '(unassigned)';
    if (!techMap[techId]) techMap[techId] = { id: techId, email: wo.assignedTo?.email || '', fullName: wo.assignedTo?.fullName || '', tasksAssigned: 0, tasksCompleted: 0, completionTimes: [] };
    techMap[techId].tasksAssigned += 1;
    if (wo.status === 'completed' || wo.completedAt) {
      techMap[techId].tasksCompleted += 1;
      if (wo.completedAt && wo.createdAt) {
        const dur = new Date(wo.completedAt).getTime() - new Date(wo.createdAt).getTime();
        if (!isNaN(dur)) techMap[techId].completionTimes.push(dur);
      }
    }

    const tid = wo.teamId || (wo.team && wo.team.id) || '(no-team)';
    if (!teamMap[tid]) teamMap[tid] = { id: tid, name: wo.team?.name || tid, tasksAssigned: 0, tasksCompleted: 0, completionTimes: [] };
    teamMap[tid].tasksAssigned += 1;
    if (wo.status === 'completed' || wo.completedAt) {
      teamMap[tid].tasksCompleted += 1;
      if (wo.completedAt && wo.createdAt) {
        const dur = new Date(wo.completedAt).getTime() - new Date(wo.createdAt).getTime();
        if (!isNaN(dur)) teamMap[tid].completionTimes.push(dur);
      }
    }
  }

  function avg(arr: number[]) { if (!arr || arr.length === 0) return null; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length); }
  const techs = Object.values(techMap).map((t:any) => ({ ...t, avgCompletionMs: avg(t.completionTimes) }));
  const teamsOut = Object.values(teamMap).map((t:any) => ({ ...t, avgCompletionMs: avg(t.completionTimes) }));

  techs.sort((a:any,b:any) => (b.tasksCompleted - a.tasksCompleted) || ((a.avgCompletionMs||1e12) - (b.avgCompletionMs||1e12)));
  teamsOut.sort((a:any,b:any) => (b.tasksCompleted - a.tasksCompleted) || ((a.avgCompletionMs||1e12) - (b.avgCompletionMs||1e12)));

  const medals = ['🏆','🥈','🥉'];
  techs.forEach((t,i)=>{ t.rank = i+1; t.medal = medals[i] || null; });
  teamsOut.forEach((t,i)=>{ t.rank = i+1; t.medal = medals[i] || null; });

  // Build sheets
  try {
    const workbook = new ExcelJS.Workbook();

    const summaryRows = [
      ['managerId', managerId],
      ['managerEmail', managerEmail],
      ['periodStart', start.toISOString()],
      ['periodEnd', end.toISOString()],
      ['totalWorkOrders', String(wos.length)],
      ['uniqueSites', String(uniqueSiteIds.size)],
      ['teamCount', String(teamIds.length)],
      ['directReports', String(directIds.length)]
    ];
    const wsSummary = workbook.addWorksheet('Summary');
    wsSummary.addRow(['Key', 'Value']);
    for (const r of summaryRows) wsSummary.addRow(r);

    const sitesArray = Object.keys(siteCounts).map(id => ({ id, count: siteCounts[id], name: siteMap[id]?.name, region: siteMap[id]?.region, zone: siteMap[id]?.zone }));
    const wsSites = workbook.addWorksheet('Sites');
    wsSites.addRow(['siteId','siteName','region','zone','workOrderCount']);
    for (const s of sitesArray) wsSites.addRow([s.id, s.name||'', s.region||'', s.zone||'', s.count]);

      // Enrich sites with JSON site-info (siteCode, longitude, latitude) where available
      try {
        const siteInfoPath = path.join(process.cwd(), 'data', 'site-info.json');
        const raw = await fs.readFile(siteInfoPath, 'utf8');
        const siteInfo: any[] = JSON.parse(raw);
        // index by physical_site and by site_name (lowercase)
        const byPhysical: Record<string, any> = {};
        const byName: Record<string, any> = {};
        for (const s of siteInfo) {
          if (s.physical_site) byPhysical[String(s.physical_site)] = s;
          if (s.site_name) byName[String(s.site_name).toLowerCase()] = s;
        }
        // rewrite Sites sheet with enriched columns
        const enriched = sitesArray.map(s => {
          const siteCode = (s.name && s.name.match(/^\d+$/)) ? s.name : null;
          // try find by siteCode or by name
          let info = null;
          if (s.id && siteMap[s.id] && siteMap[s.id].name) {
            const nm = String(siteMap[s.id].name).toLowerCase();
            info = byName[nm] || null;
          }
          if (!info && siteMap[s.id] && siteMap[s.id].siteCode) {
            info = byPhysical[String(siteMap[s.id].siteCode)] || null;
          }
          if (!info && siteCode) info = byPhysical[siteCode] || null;
          return {
            siteId: s.id,
            siteName: s.name || '',
            region: s.region || '',
            zone: s.zone || '',
            workOrderCount: s.count || 0,
            siteCode: info ? (info.physical_site || '') : (siteMap[s.id]?.siteCode || ''),
            longitude: info ? (info.longitude || '') : (siteMap[s.id]?.longitude || ''),
            latitude: info ? (info.latitude || '') : (siteMap[s.id]?.latitude || ''),
          };
        });
        // rewrite Sites sheet with enriched columns
        // remove and recreate "Sites" worksheet
        const idx = workbook.worksheets.findIndex(w => w.name === 'Sites');
        if (idx !== -1) workbook.removeWorksheet(workbook.worksheets[idx].id);
        const wsSitesEn = workbook.addWorksheet('Sites');
        wsSitesEn.addRow(['siteId','siteName','siteCode','longitude','latitude','region','zone','workOrderCount']);
        for (const r of enriched) wsSitesEn.addRow([r.siteId,r.siteName,r.siteCode,r.longitude,r.latitude,r.region,r.zone,r.workOrderCount]);
      } catch (err: any) {
        // if enrichment fails, continue with original Sites sheet
        console.warn('site info enrichment failed', err?.message || err);
      }

    const wsTech = workbook.addWorksheet('Technicians');
    wsTech.addRow(['rank','medal','techId','fullName','email','tasksAssigned','tasksCompleted','avgCompletionMs']);
    for (const t of techs) wsTech.addRow([t.rank||'', t.medal||'', t.id||'', t.fullName||'', t.email||'', t.tasksAssigned||0, t.tasksCompleted||0, t.avgCompletionMs===null?'':t.avgCompletionMs]);

    const wsTeams = workbook.addWorksheet('Teams');
    wsTeams.addRow(['rank','medal','teamId','teamName','tasksAssigned','tasksCompleted','avgCompletionMs']);
    for (const t of teamsOut) wsTeams.addRow([t.rank||'', t.medal||'', t.id||'', t.name||'', t.tasksAssigned||0, t.tasksCompleted||0, t.avgCompletionMs===null?'':t.avgCompletionMs]);

    const woRows = [['id','taskNumber','title','status','createdAt','completedAt','siteId','siteName','teamId','assignedToId','assignedToEmail']];
    for (const wo of wos) {
      woRows.push([
        wo.id,
        wo.taskNumber || '',
        wo.title || '',
        wo.status || '',
        wo.createdAt ? new Date(wo.createdAt).toISOString() : '',
        wo.completedAt ? new Date(wo.completedAt).toISOString() : '',
        wo.site?.id||'',
        wo.site?.name||'',
        wo.teamId||'',
        wo.assignedToId||'',
        wo.assignedTo?.email||'',
      ]);
    }
    // enhance WorkOrders rows with createdBy/completedBy and site coordinates
    const woRowsEnhanced = [['id','taskNumber','title','status','createdAt','completedAt','siteId','siteName','siteCode','siteLongitude','siteLatitude','teamId','assignedToId','assignedToEmail','createdById','createdByEmail','createdByName','completedById','completedByEmail','completedByName','description','technicianLatitude','technicianLongitude']];
    for (const wo of wos) {
      const siteCode = wo.site?.siteCode || '';
      const siteLon = wo.site?.longitude || '';
      const siteLat = wo.site?.latitude || '';
      const isAutoScheduled = Boolean(wo.planned) && /auto-?scheduled/i.test(String(wo.description || ''));
      const createdByName = isAutoScheduled ? 'System (auto-scheduler)' : (wo.createdBy?.fullName || '');
      const createdByEmail = isAutoScheduled ? 'system@autoscheduler' : (wo.createdBy?.email || '');
      woRowsEnhanced.push([
        wo.id,
        wo.taskNumber || '',
        wo.title || '',
        wo.status || '',
        wo.createdAt ? new Date(wo.createdAt).toISOString() : '',
        wo.completedAt ? new Date(wo.completedAt).toISOString() : '',
        wo.site?.id||'',
        wo.site?.name||'',
        siteCode,
        siteLon,
        siteLat,
        wo.teamId||'',
        wo.assignedToId||'',
        wo.assignedTo?.email||'',
        wo.createdById||wo.createdBy?.id||'',
        createdByEmail,
        createdByName,
        wo.completedById||wo.completedBy?.id||'',
        wo.completedBy?.email||'',
        wo.completedBy?.fullName||'',
        wo.description||'',
        wo.technicianLatitude||'',
        wo.technicianLongitude||'',
      ]);
    }
    const wsWO = workbook.addWorksheet('WorkOrders');
    wsWO.addRow(['id','taskNumber','title','status','createdAt','completedAt','siteId','siteName','siteCode','siteLongitude','siteLatitude','teamId','assignedToId','assignedToEmail','createdById','createdByEmail','createdByName','completedById','completedByEmail','completedByName','description','technicianLatitude','technicianLongitude']);
    for (const row of woRowsEnhanced) wsWO.addRow(row);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(Buffer.from(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="manager-report-${managerId}.xlsx"`,
      },
    });
  } catch (err: any) {
    console.error('report api error', err);
    return NextResponse.json({ error: 'report_failed', message: err?.message || String(err) }, { status: 500 });
  }
}
