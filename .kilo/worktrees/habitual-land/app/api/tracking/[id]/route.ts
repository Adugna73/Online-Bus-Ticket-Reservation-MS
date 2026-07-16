import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/tracking";

// GAP 6: Resolve an SOS alert (admin/staff only).
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const role = String(session.user.role || "").toLowerCase();
        if (role !== "admin" && role !== "staff") {
            return NextResponse.json(
                { error: "forbidden" },
                { status: 403 },
            );
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json(
                { error: "id_required" },
                { status: 400 },
            );
        }

        const body = await req.json().catch(() => ({}));
        if (body?.resolved === false) {
            return NextResponse.json(
                { error: "only_resolve_supported" },
                { status: 400 },
            );
        }

        const alert = await svc.resolveSos(id);
        if (!alert) {
            return NextResponse.json(
                { error: "alert_not_found" },
                { status: 404 },
            );
        }
        return NextResponse.json({ alert });
    } catch (error) {
        console.error("[tracking][id] PATCH failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
