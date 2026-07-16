import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const requestBody = {
    sizeLimit: "20mb",
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
        if (roleKey !== "admin" && roleKey !== "supervisor") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const params = await context.params;
        const busId = String(params?.id || "").trim();
        if (!busId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const bus = await prisma.bus.findUnique({ where: { id: busId } });
        if (!bus) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
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
            "buses",
            busId,
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

        const urlPath = `/uploads/buses/${busId}/${uniqueName}`;
        await prisma.bus.update({
            where: { id: busId },
            data: { imageUrl: urlPath },
        });

        return NextResponse.json({ imageUrl: urlPath });
    } catch (error) {
        console.error("[buses] image upload failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
