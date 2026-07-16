import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getServerSession } from 'next-auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, latitude, longitude } = await req.json();

  if (!action || !['checkin', 'checkout'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be checkin or checkout' }, { status: 400 });
  }

  // Get work order with site details
  const workOrder = await prisma.workOrder.findUnique({
    where: { id: id },
    include: { site: true, assignedTo: true }
  });

  if (!workOrder) {
    return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
  }

  // Check if user is assigned to this work order
  if (workOrder.assignedToId !== (session.user as any).id) {
    return NextResponse.json({ error: 'Not assigned to this work order' }, { status: 403 });
  }

  // Validate location if provided
  let locationVerified = false;
  const disableLocationCheck = process.env.DISABLE_LOCATION_CHECKIN === 'true';
  if (disableLocationCheck) {
    // when disabled, always treat as verified
    locationVerified = true;
  } else if (latitude && longitude && workOrder.site.latitude && workOrder.site.longitude) {
    const siteLat = parseFloat(workOrder.site.latitude);
    const siteLng = parseFloat(workOrder.site.longitude);
    const techLat = parseFloat(latitude);
    const techLng = parseFloat(longitude);

    // Calculate distance (simple approximation)
    const distance = Math.sqrt(
      Math.pow(siteLat - techLat, 2) + Math.pow(siteLng - techLng, 2)
    ) * 111; // Rough km conversion

    // Allow 500m radius for location verification
    locationVerified = distance <= 0.5;
  }

  const updateData: any = {};

  if (action === 'checkin') {
    updateData.checkInTime = new Date();
    updateData.technicianLatitude = latitude?.toString();
    updateData.technicianLongitude = longitude?.toString();
    updateData.locationVerified = locationVerified;
    updateData.actualStartAt = new Date();
  } else if (action === 'checkout') {
    updateData.checkOutTime = new Date();
    updateData.actualEndAt = new Date();
  }

  const updatedWorkOrder = await prisma.workOrder.update({
    where: { id: id },
    data: updateData,
    include: { site: true }
  });

  return NextResponse.json({
    success: true,
    workOrder: updatedWorkOrder,
    locationVerified,
    message: locationVerified ? 'Location verified' : 'Location verification failed - you may be too far from the site'
  });
}