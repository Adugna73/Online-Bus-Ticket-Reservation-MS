import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = (await req.json().catch(() => ({}))) as {
            fullName?: string;
            email?: string;
            phone?: string;
            password?: string;
        };

        const fullName = String(body?.fullName || "").trim();
        const email = String(body?.email || "").trim().toLowerCase();
        const phone = String(body?.phone || "").trim();
        const password = String(body?.password || "");

        if (!fullName || !email || !password) {
            return NextResponse.json(
                { error: "required_fields" },
                { status: 400 },
            );
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json(
                { error: "invalid_email" },
                { status: 400 },
            );
        }

        const existing = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
        });
        if (existing) {
            return NextResponse.json(
                { error: "email_exists" },
                { status: 409 },
            );
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const created = await prisma.user.create({
            data: {
                fullName,
                email,
                phone: phone || null,
                passwordHash,
                role: "PASSENGER",
            },
            select: { id: true },
        });

        return NextResponse.json({ id: created.id });
    } catch (error) {
        console.error("[auth] signup failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
