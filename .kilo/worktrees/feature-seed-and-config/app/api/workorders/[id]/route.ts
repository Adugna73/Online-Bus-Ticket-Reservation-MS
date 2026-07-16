import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

function toNumber(value: any): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, username: true, email: true, fullName: true } },
      team: { select: { id: true, name: true } },
      completedBy: { select: { id: true, fullName: true, email: true } },
      reviewedBy: { select: { id: true, fullName: true, email: true } },
      deletedBy: { select: { id: true, fullName: true, email: true } },
      checklist: true,
      attachments: true,
      site: { 
        select: { 
          id: true, 
          name: true, 
          siteCode: true,
          longitude: true,
          latitude: true,
          deviceModel: true,
          vendor: true,
          runningState: true,
          address: true,
          region: { select: { name: true } },
          zone: { select: { name: true } },
          neNameAndId: true
        } 
      },
    },
  });
  if (!wo) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(wo);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data: any = {};

  // validate assignedToId — never allow assigning an `admin` user as handler
  if (body.assignedToId) {
    const candidate = await prisma.user.findUnique({ where: { id: String(body.assignedToId) }, select: { id: true, role: { select: { key: true } } } });
    if (candidate && String(candidate.role?.key || '').toLowerCase() === 'admin') {
      return NextResponse.json({ error: 'cannot_assign_admin', message: 'Work orders cannot be assigned to admin users' }, { status: 400 });
    }
    data.assignedToId = body.assignedToId;
  }

  if (body.status) data.status = body.status;
  // If assignedToId is provided but no explicit status was given, mark as 'assigned'
  if (body.assignedToId && !body.status) {
    // We'll attempt to set status to 'assigned' unless the work order is already in a later state
    try {
      const existing = await prisma.workOrder.findUnique({ where: { id } });
      if (existing && existing.status !== 'in_progress' && existing.status !== 'completed') {
        data.status = 'assigned';
      }
    } catch (e) {
      // ignore and set assigned status by default
      data.status = 'assigned';
    }
  }
  if (typeof body.teamId !== 'undefined') data.teamId = body.teamId || null;
  let locationVerifiedFromCoords: boolean | null = null;
  let existingForLocation: any | null = null;
  // Persist technician check-in coordinates and time when provided (not only on completion)
  if (typeof body.technicianLatitude !== 'undefined') data.technicianLatitude = body.technicianLatitude || null;
  if (typeof body.technicianLongitude !== 'undefined') data.technicianLongitude = body.technicianLongitude || null;
  if (typeof body.checkInTime !== 'undefined') {
    try {
      data.checkInTime = body.checkInTime ? new Date(body.checkInTime) : null;
    } catch (e) {
      // ignore invalid date
    }
  }
  if (
    typeof body.technicianLatitude !== 'undefined' ||
    typeof body.technicianLongitude !== 'undefined' ||
    typeof body.locationVerified !== 'undefined'
  ) {
    existingForLocation = await prisma.workOrder.findUnique({
      where: { id },
      select: {
        technicianLatitude: true,
        technicianLongitude: true,
        locationVerified: true,
        site: { select: { latitude: true, longitude: true } },
      },
    });
    const siteLat = toNumber(existingForLocation?.site?.latitude);
    const siteLon = toNumber(existingForLocation?.site?.longitude);
    const techLat = toNumber(body.technicianLatitude ?? existingForLocation?.technicianLatitude);
    const techLon = toNumber(body.technicianLongitude ?? existingForLocation?.technicianLongitude);
    if (siteLat != null && siteLon != null && techLat != null && techLon != null) {
      const distance = haversineMeters(siteLat, siteLon, techLat, techLon);
      locationVerifiedFromCoords = distance <= 100;
      data.locationVerified = locationVerifiedFromCoords;
    } else if (typeof body.locationVerified !== 'undefined') {
      data.locationVerified = !!body.locationVerified;
    }
  }
  // If a technician marks the work order completed, set completion timestamp
  // and ensure the work order has a teamId (use technician's team if missing)
  if (body.status === 'completed') {
    // Before allowing completion, validate that checklist exists and required photos were provided
    const checklist = await prisma.checklist.findUnique({ where: { workOrderId: id } });
    if (!checklist) {
      return NextResponse.json({ error: 'checklist_missing', message: 'Checklist is required before completing the work order' }, { status: 400 });
    }
    const items = (checklist.items as any[]) || [];
    const missingPhotos: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      // treat `requiredPhoto` truthy flag as indicator
      if (it.requiredPhoto) {
        // attachments may be stored on the checklist item under `attachments` as array of urls
        const atts = Array.isArray(it.attachments) ? it.attachments : [];
        if (atts.length === 0) {
          const label = it.label || it.task || `item_${i}`;
          missingPhotos.push(label);
        }
      }
    }
    if (missingPhotos.length > 0) {
      return NextResponse.json({ error: 'missing_required_photos', message: 'Required photos are missing for checklist items', items: missingPhotos }, { status: 400 });
    }

    // Require location for technicians completing the work order. Supervisors/managers may complete without location.
    const disableLocationCheck = process.env.DISABLE_LOCATION_CHECKIN === 'true';
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: { select: { key: true } } } });
    const isTechnician = user?.role?.key === 'tech' || user?.role?.key === 'technician';

    if (isTechnician && !disableLocationCheck) {
      // ensure work order has technicianLatitude & technicianLongitude either in body or already set
      const existingWO = existingForLocation || (await prisma.workOrder.findUnique({
        where: { id },
        select: {
          technicianLatitude: true,
          technicianLongitude: true,
          locationVerified: true,
          site: { select: { latitude: true, longitude: true } },
        },
      }));
      const lat = body.technicianLatitude || existingWO?.technicianLatitude;
      const lon = body.technicianLongitude || existingWO?.technicianLongitude;
      if (!lat || !lon) {
        return NextResponse.json({ error: 'location_required', message: 'Technician location (check-in) is required before completing the work order' }, { status: 400 });
      }
      const verified =
        locationVerifiedFromCoords ??
        existingWO?.locationVerified ??
        false;
      if (!verified) {
        return NextResponse.json({ error: 'location_not_verified', message: 'Check-in must be within 100m of the site before completing the work order' }, { status: 400 });
      }
      data.technicianLatitude = lat;
      data.technicianLongitude = lon;
    } else if (isTechnician && disableLocationCheck) {
      // environment disables location enforcement — mark verified so technician can complete
      data.locationVerified = true;
    }

    data.actualEndAt = new Date();
    data.completedAt = new Date();
    data.completedById = session.user.id;
    try {
      if (user && !data.teamId && user.teamId) {
        data.teamId = user.teamId;
      }
    } catch (e) {
      // ignore
    }
  }
  const updated = await prisma.workOrder.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, username: true, email: true, fullName: true } },
      team: { select: { id: true, name: true } },
      site: { 
        select: { 
          id: true, 
          name: true, 
          siteCode: true,
          longitude: true,
          latitude: true,
          deviceModel: true,
          vendor: true,
          runningState: true,
          address: true,
          region: { select: { name: true } },
          zone: { select: { name: true } },
          neNameAndId: true
        } 
      },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Only admins may hard-delete work orders
  const roleLower = String(session.user.role || '').toLowerCase();
  if (roleLower !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    // Soft-delete: keep record for audit/archived view
    const now = new Date();
    const updated = await prisma.workOrder.update({
      where: { id },
      data: {
        status: 'deleted',
        archived: true,
        archivedAt: now,
        deletedAt: now,
        deletedById: session.user.id,
      },
    });
    return NextResponse.json({ ok: true, deleted: 1, workOrder: updated });
  } catch (err: any) {
    console.error('[workorders/[id]] DELETE error', err);
    return NextResponse.json({ error: 'delete_failed', message: String(err) }, { status: 500 });
  }
}
