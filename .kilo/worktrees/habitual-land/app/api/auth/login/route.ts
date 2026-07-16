import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { username } = body;
        if (!username) {
            return NextResponse.json({ error: "Username required" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const res = NextResponse.json({ user });
        // Create a simple session cookie (not secure: demo use only). Real auth should use next-auth or JWTs.
        res.cookies.set("session", user.id as string, { path: "/", httpOnly: true });
        return res;
    } catch (err) {
        console.error("Login failed", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
