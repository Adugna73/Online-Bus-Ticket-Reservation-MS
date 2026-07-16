import { NextResponse } from "next/server";
import { expireStaleBookings } from "@/lib/services/seats";

// Cron job: cancel PENDING bookings that were never paid within 15 minutes and
// release their seats. Call periodically (e.g. every 1-5 min) from an external
// scheduler, Vercel cron, or a systemd timer.
//
// Auth: if CRON_SECRET is set in the environment, callers must send it as a
// Bearer token. When unset, the endpoint is open (suitable for internal
// sidecar/cron side invocation) — set CRON_SECRET in production.
export async function POST(req: Request) {
    try {
        const expected = process.env.CRON_SECRET;
        if (expected) {
            const auth = req.headers.get("authorization") || "";
            const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
            if (token !== expected) {
                return NextResponse.json(
                    { error: "unauthorized" },
                    { status: 401 },
                );
            }
        }

        const result = await expireStaleBookings();
        return NextResponse.json({ ok: true, ...result });
    } catch (error) {
        console.error("[cron/expire-bookings] failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    return POST(req);
}
