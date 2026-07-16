import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        // read session cookie
        // NextResponse isn't available here, so use new URL to parse cookies - Next uses Request.cookies API
        // In Edge runtime we can use req.cookies.get
        let userId = null as string | null;
        // @ts-ignore
        if (req.cookies && typeof req.cookies.get === "function") {
            // Next's RequestCookies
            // @ts-ignore
            const cookie = req.cookies.get("session");
            userId = cookie?.value ?? null;
        } else {
            // fallback: parse cookie header
            const cookieHeader = (req as any).headers?.get?.("cookie") ?? "";
            const match = cookieHeader.match(/session=([^;]+)/);
            userId = match?.[1] ?? null;
        }

        if (!userId) return NextResponse.json({ user: null });

        const user = await prisma.user.findUnique({ where: { id: userId } });
        return NextResponse.json({ user });
    } catch (err) {
        console.error("me failed", err);
        return NextResponse.json({ user: null });
    }
}
