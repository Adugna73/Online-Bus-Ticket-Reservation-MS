import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: String(session.user.id) },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const roleKey = String((session.user as any)?.role || "").toLowerCase();
        if (roleKey !== "passenger") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";

        if (!fullName || !email) {
            return NextResponse.json(
                { error: "full_name_and_email_required" },
                { status: 400 },
            );
        }
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "invalid_email" }, { status: 400 });
        }

        const existing = await prisma.user.findFirst({
            where: {
                email: { equals: email, mode: "insensitive" },
                NOT: { id: String(session.user.id) },
            },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json(
                { error: "email_exists" },
                { status: 409 },
            );
        }

        const updated = await prisma.user.update({
            where: { id: String(session.user.id) },
            data: {
                fullName,
                email,
                phone: phone || null,
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
