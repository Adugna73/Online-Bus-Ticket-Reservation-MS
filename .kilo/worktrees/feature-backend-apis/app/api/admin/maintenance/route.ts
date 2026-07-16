import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

// Admin-only maintenance endpoint that runs several housekeeping tasks
// - auto-assign unassigned work orders (/api/workorders/auto-assign)
// - auto-schedule weekly PMs (/api/workorders/auto-schedule)
// - reassign AAZ/HQ auto-scheduled PMs to Muhaba (same logic as scripts/reassign-aaz-hq-auto-wos-to-muhaba.js)
// - reassign createdBy -> assignedTo for Muhaba for cross-region mismatches (script parity)

export async function POST(req: Request) {
  const session: any = await getServerSession(authOptions as any);
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = String(session.user.role || "").toLowerCase();
  if (role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const results: any = { autoAssign: null, autoSchedule: null, reassignAazHq: null, reassignCreatedBy: null };

  try {
    // 1) Auto-assign unassigned (use internal API route)
    try {
      const res = await fetch(new URL('/api/workorders/auto-assign', process.env.NEXTAUTH_URL || 'http://localhost:3000').toString(), {
        method: 'POST',
        headers: { cookie: req.headers.get('cookie') || '' },
      });
      results.autoAssign = await res.json().catch(() => ({ status: res.status }));
    } catch (err: any) {
      results.autoAssign = { error: String(err?.message || err) };
    }

    // 2) Auto-schedule (weekly)
    try {
      const res = await fetch(new URL('/api/workorders/auto-schedule', process.env.NEXTAUTH_URL || 'http://localhost:3000').toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: req.headers.get('cookie') || '' },
        body: JSON.stringify({ mode: 'weekly' }),
      });
      results.autoSchedule = await res.json().catch(() => ({ status: res.status }));
    } catch (err: any) {
      results.autoSchedule = { error: String(err?.message || err) };
    }

    // 3) Reassign AAZ/HQ auto-scheduled PMs to Muhaba (inline from script)
    try {
      const muhabaEmail = 'muhaba.hussien@ethiotelecom.et';
      const muhaba = await prisma.user.findUnique({ where: { email: muhabaEmail }, select: { id: true, email: true, fullName: true, teamId: true, enabled: true } });
      if (!muhaba) {
        results.reassignAazHq = { error: 'Muhaba not found' };
      } else if (!muhaba.enabled) {
        results.reassignAazHq = { error: 'Muhaba account disabled' };
      } else {
        const wos = await prisma.workOrder.findMany({
          where: {
            planned: true,
            type: 'pm',
            archived: false,
            description: { contains: 'Auto-scheduled PM task' },
            assignedToId: { not: muhaba.id },
            site: {
              OR: [
                { region: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                { zone: { name: { contains: 'AAZ', mode: 'insensitive' } } },
                { region: { name: { contains: 'Head Quarter', mode: 'insensitive' } } },
                { zone: { name: { contains: 'HQ', mode: 'insensitive' } } },
                { region: { name: { contains: 'CAAZ', mode: 'insensitive' } } },
              ],
            },
          },
          include: { site: { include: { region: true, zone: true } }, assignedTo: true, createdBy: true },
        });

        const changes: any[] = [];
        for (const wo of wos) {
          try {
            const updated = await prisma.workOrder.update({
              where: { id: wo.id },
              data: { assignedToId: muhaba.id, teamId: muhaba.teamId || wo.teamId || null, status: 'assigned' },
              include: { assignedTo: true, site: { include: { region: true, zone: true } } },
            });
            changes.push({ id: wo.id, before: wo.assignedTo?.email || wo.assignedToId || null, after: muhaba.email, site: updated.site });
          } catch (err: any) {
            changes.push({ id: wo.id, error: String(err?.message || err) });
          }
        }
        results.reassignAazHq = { found: wos.length, changes };
      }
    } catch (err: any) {
      results.reassignAazHq = { error: String(err?.message || err) };
    }

    // 4) Reassign createdBy -> assignedTo for Muhaba where createdBy is cross-region
    try {
      const muhabaEmail = 'muhaba.hussien@ethiotelecom.et';
      const user = await prisma.user.findUnique({ where: { email: muhabaEmail }, select: { id: true, assignedRegion: true } });
      if (!user) {
        results.reassignCreatedBy = { error: 'Muhaba not found' };
      } else {
        const userRegionIds = Array.isArray(user.assignedRegion) ? user.assignedRegion : [];
        const wos = await prisma.workOrder.findMany({ where: { createdById: user.id }, include: { site: { select: { id: true, regionId: true } }, assignedTo: true } });
        const mismatches = wos.filter((wo: any) => {
          const siteRegionId = wo.site?.regionId;
          if (!siteRegionId) return false;
          if (userRegionIds.length === 0) return false;
          return !userRegionIds.includes(siteRegionId);
        });
        const updatedRows: any[] = [];
        for (const w of mismatches) {
          if (!w.assignedToId) continue;
          await prisma.workOrder.update({ where: { id: w.id }, data: { createdById: w.assignedToId } });
          updatedRows.push({ id: w.id, newCreatedBy: w.assignedToId });
        }
        results.reassignCreatedBy = { scanned: wos.length, mismatches: mismatches.length, updated: updatedRows.length, rows: updatedRows };
      }
    } catch (err: any) {
      results.reassignCreatedBy = { error: String(err?.message || err) };
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error('[admin/maintenance] error', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
