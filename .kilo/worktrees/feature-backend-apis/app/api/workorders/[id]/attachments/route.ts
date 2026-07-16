import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Increase request size so large file uploads don't trigger 413
export const requestBody = {
  sizeLimit: '100mb',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session: any = await getServerSession(authOptions as any);
  const user = session && session.user ? (session.user as typeof session.user & { id?: string }) : undefined;
  if (!session || !user || !user.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string;

  if (!file || !type) return NextResponse.json({ error: 'missing_file_or_type' }, { status: 400 });

  try {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = path.join(uploadsDir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Save to database
    const attachment = await prisma.workOrderAttachment.create({
      data: {
        workOrderId: id,
        fileName: file.name,
        fileUrl: `/uploads/${fileName}`,
        fileType: type,
        uploadedById: user.id,
      },
    });

    return NextResponse.json(attachment);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attachments = await prisma.workOrderAttachment.findMany({
    where: { workOrderId: id },
    include: { uploadedBy: { select: { fullName: true } } },
  });
  return NextResponse.json(attachments);
}