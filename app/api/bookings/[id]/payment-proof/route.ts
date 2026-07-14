import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const requestBody = {
    sizeLimit: "50mb",
};

export async function POST(
    req: Request,
    context: { params: { id: string } },
) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        const params = await context.params;
        const bookingId = String(params?.id || "").trim();
        if (!bookingId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });
        if (!booking) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        if (roleKey === "passenger" || roleKey === "technician") {
            if (String(booking.userId) !== String(session.user.id)) {
                return NextResponse.json({ error: "forbidden" }, { status: 403 });
            }
        }

        const body = (await req.json().catch(() => ({}))) as {
            fileName?: string;
            mimeType?: string;
            data?: string;
        };

        const fileName = String(body?.fileName || "").trim();
        const data = String(body?.data || "");
        if (!fileName || !data) {
            return NextResponse.json({ error: "missing" }, { status: 400 });
        }

        const base64 = data.replace(/^data:[^;]+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const uploadsDir = path.join(
            process.cwd(),
            "public",
            "uploads",
            "bookings",
            bookingId,
        );
        try {
            fs.mkdirSync(uploadsDir, { recursive: true });
        } catch (e) {}

        const uniqueName = `${Date.now()}-${fileName}`.replace(
            /[^a-zA-Z0-9._-]/g,
            "_",
        );
        const dest = path.join(uploadsDir, uniqueName);
        try {
            fs.writeFileSync(dest, buffer);
        } catch (e: any) {
            return NextResponse.json(
                { error: "write_failed", detail: e?.message },
                { status: 500 },
            );
        }

        const urlPath = `/uploads/bookings/${bookingId}/${uniqueName}`;
        const created = await prisma.bookingPaymentProof.create({
            data: {
                bookingId,
                fileName: uniqueName,
                fileUrl: urlPath,
                fileType: body?.mimeType || null,
                uploadedById: session?.user?.id || null,
            },
            include: { uploadedBy: true },
        });

        return NextResponse.json({
            id: created.id,
            fileUrl: created.fileUrl,
            fileName: created.fileName,
            fileType: created.fileType,
            createdAt: created.createdAt,
            uploadedBy: created.uploadedBy
                ? {
                      id: created.uploadedBy.id,
                      name: created.uploadedBy.fullName,
                  }
                : null,
        });
    } catch (error) {
        console.error("[booking] payment proof upload failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
