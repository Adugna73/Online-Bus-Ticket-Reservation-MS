import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session = (await getServerSession(authOptions as any)) as any;
  // fallback to JWT token if session lookup fails (handles rare session propagation races)
  if (!session?.user?.id) {
    try {
      const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
      if (token && (token.sub || token.id)) {
        session = { user: { id: token.sub || token.id } } as any;
        console.warn('[checklist] session fallback via JWT token used for user', session.user.id);
      }
    } catch (err) {
      // ignore
    }
  }
  if (!session?.user?.id) {
    console.warn('[checklist] unauthorized access (missing session); cookie present?', !!req.headers.get('cookie'));
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const items = body.items || [];
  const finalize = !!body.finalize;

  // If finalize is requested, validate required-photo items have attachments
  if (finalize) {
    const missing: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      if (it.requiredPhoto) {
        const atts = Array.isArray(it.attachments) ? it.attachments : [];
        if (atts.length === 0) {
          const label = it.label || it.task || `item_${i}`;
          missing.push(label);
        }
      }
    }
    if (missing.length > 0) {
      return NextResponse.json({ error: 'missing_required_photos', message: 'Required photos are missing for checklist items', items: missing }, { status: 400 });
    }
  }

  // If finalize is requested, additionally validate that provided attachment URLs exist in WorkOrderAttachment table
  if (finalize) {
    const missingUrls: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const atts = Array.isArray(it.attachments) ? it.attachments : [];
      for (const att of atts) {
        // attachment can be a string (url) or an object { url, fileName, ... }
        const fileUrl = typeof att === 'string' ? att : (att?.url ?? att?.fileUrl ?? null);
        if (!fileUrl) {
          missingUrls.push(typeof att === 'string' ? att : JSON.stringify(att));
          continue;
        }
        const found = await prisma.workOrderAttachment.findFirst({ where: { workOrderId: id, fileUrl } });
        if (!found) missingUrls.push(fileUrl);
      }
    }
    if (missingUrls.length > 0) {
      return NextResponse.json({ error: 'attachment_urls_not_found', message: 'Some attachment URLs were not found in records', urls: missingUrls }, { status: 400 });
    }
  }

  // upsert checklist
  const now = new Date();
  const existing = await prisma.checklist.findUnique({ where: { workOrderId: id } });
  if (existing) {
    const data: any = { items, completedById: userId };
    if (finalize) data.completedAt = now;
    const updated = await prisma.checklist.update({ where: { id: existing.id }, data });
    return NextResponse.json(updated);
  }
  const createData: any = { workOrderId: id, items, completedById: userId };
  if (finalize) createData.completedAt = now;
  const created = await prisma.checklist.create({ data: createData });
  return NextResponse.json(created);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checklist = await prisma.checklist.findUnique({ where: { workOrderId: id } });
  if (!checklist) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(checklist);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // For supervisor approval: update items[index].approved and approvedById
  let session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    try {
      const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
      if (token && (token.sub || token.id)) {
        session = { user: { id: token.sub || token.id } } as any;
        console.warn('[checklist:patch] session fallback via JWT token used for user', session.user.id);
      }
    } catch (err) {
      // ignore
    }
  }
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  // Support two modes:
  // 1) item approval (itemIndex + approved)
  // 2) reviewAction for whole-checklist actions by supervisor: { reviewAction: 'approve'|'reject'|'reassign', reviewNote?, reassignToId? }
  const { itemIndex, approved, reviewAction, reviewNote, reassignToId, reviewFinding } = body;

  // If reviewAction provided, handle manager/supervisor level actions
  if (reviewAction) {
    const roleKey = String(session.user.role || '').toLowerCase();
    if (!(roleKey === 'manager' || roleKey === 'supervisor' || roleKey === 'admin')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const checklist = await prisma.checklist.findUnique({ where: { workOrderId: id } });

    const now = new Date();

    if (reviewAction === 'approve') {
      try {
        // Archive the work order: preserve technician completion if present,
        // record reviewer info and archived timestamps
        console.log('[checklist] approve called by', session.user.id, 'workorder', id);
        const workOrderUpdate: any = {
          status: 'completed',
          reviewedById: session.user.id,
          reviewedAt: now,
          archived: true,
          archivedAt: now,
        };
        // If technician already completed (checklist.completedAt), preserve that as completedAt
        if (checklist && checklist.completedAt) {
          workOrderUpdate.completedById = checklist.completedById || undefined;
          workOrderUpdate.completedAt = checklist.completedAt;
        } else {
          // fallback: mark completedAt as now and completedById as checklist.completedById or reviewer
          workOrderUpdate.completedById = checklist?.completedById || session.user.id;
          workOrderUpdate.completedAt = now;
        }

        const updatedWO = await prisma.workOrder.update({ where: { id }, data: workOrderUpdate });
        // Ensure there is a checklist record to represent completion
        if (checklist) {
          await prisma.checklist.update({ where: { id: checklist.id }, data: { completedById: checklist.completedById ?? session.user.id, completedAt: checklist.completedAt ?? now } });
        } else {
          await prisma.checklist.create({ data: { workOrderId: id, items: [], completedById: session.user.id, completedAt: now } });
        }
        await prisma.activityLog.create({ data: { userId: session.user.id, entityType: 'workorder', entityId: id, action: 'checklist_approved', payload: { note: reviewNote || null, finding: reviewFinding || null } } as any });
        return NextResponse.json({ ok: true, action: 'approved', workOrder: updatedWO });
      } catch (err) {
        console.error('[checklist] approve error', err);
        return NextResponse.json({ error: 'approve_failed', detail: String(err) }, { status: 500 });
      }
    }

    if (reviewAction === 'reject') {
      // Keep work order in_progress and create activity log with note
      await prisma.workOrder.update({ where: { id }, data: { status: 'in_progress', reviewedById: session.user.id, reviewedAt: now } });
      await prisma.activityLog.create({ data: { userId: session.user.id, entityType: 'workorder', entityId: id, action: 'checklist_rejected', payload: { note: reviewNote || null, finding: reviewFinding || null } } as any });
      return NextResponse.json({ ok: true, action: 'rejected' });
    }

    if (reviewAction === 'reassign') {
      if (!reassignToId) return NextResponse.json({ error: 'missing_reassign_to' }, { status: 400 });
      // Reassign the work order to another technician and set status to assigned
      await prisma.workOrder.update({ where: { id }, data: { assignedToId: reassignToId, status: 'assigned', reviewedById: session.user.id, reviewedAt: now } });
      await prisma.activityLog.create({ data: { userId: session.user.id, entityType: 'workorder', entityId: id, action: 'checklist_reassigned', payload: { reassignToId, note: reviewNote || null, finding: reviewFinding || null } } as any });
      return NextResponse.json({ ok: true, action: 'reassigned' });
    }

    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  // Fallback: single item approval
  const checklist = await prisma.checklist.findUnique({ where: { workOrderId: id } });
  if (!checklist) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const items = (checklist.items as any[]) || [];
  if (typeof itemIndex !== 'number' || itemIndex < 0 || itemIndex >= items.length) {
    return NextResponse.json({ error: 'invalid_item' }, { status: 400 });
  }
  items[itemIndex] = items[itemIndex] || {};
  items[itemIndex].approved = !!approved;
  items[itemIndex].approvedBy = approved ? userId : null;
  const updated = await prisma.checklist.update({ where: { id: checklist.id }, data: { items } });
  return NextResponse.json(updated);
}
