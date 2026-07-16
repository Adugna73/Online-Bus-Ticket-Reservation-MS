import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';

// Increase request body size for image uploads (base64 payload)
export const requestBody = {
  sizeLimit: '100mb',
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { workOrderId, itemIndex, fileName, mimeType, data } = body;
  if (!workOrderId || typeof itemIndex === 'undefined' || !fileName || !data) {
    return NextResponse.json({ error: 'missing' }, { status: 400 });
  }
  const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } });
  if (!wo) return NextResponse.json({ error: 'workorder_not_found' }, { status: 404 });
  // decode base64
  const base64 = (data as string).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'checklist', workOrderId);
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (e) {}
  const uniqueName = `${Date.now()}-${fileName}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  const dest = path.join(uploadsDir, uniqueName);
  try {
    fs.writeFileSync(dest, buffer);
  } catch (e) {
    return NextResponse.json({ error: 'write_failed', detail: (e as any).message }, { status: 500 });
  }
  const urlPath = `/uploads/checklist/${workOrderId}/${uniqueName}`;
  // create WorkOrderAttachment record so attachments are discoverable from the workorder
  try {
    const session = await getServerSession(authOptions as any) as any;
    const uploadedById = session?.user?.id || null;
    const created = await prisma.workOrderAttachment.create({ data: { workOrderId, fileName: uniqueName, fileUrl: urlPath, fileType: mimeType || null, uploadedById } });
    return NextResponse.json({ url: urlPath, id: created.id });
  } catch (e:any) {
    // If DB write fails, still return the url but include warning
    return NextResponse.json({ url: urlPath, warning: 'db_create_failed', detail: e?.message }, { status: 201 });
  }
}
