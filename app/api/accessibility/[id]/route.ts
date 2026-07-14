import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/accessibility";

// GAP 12: Update accessibility flags on a single bus (admin/staff only).
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
        const flags: svc.AccessibilityFlags = {
            wheelchairAccessible: toBool(body?.wheelchairAccessible),
            womenOnly: toBool(body?.womenOnly),
            hasPrioritySeating: toBool(body?.hasPrioritySeating),
            audioAnnouncements: toBool(body?.audioAnnouncements),
        };

        const bus = await svc.updateBusAccessibility(id, flags);
        if (!bus) {
            return NextResponse.json(
                { error: "bus_not_found" },
                { status: 404 },
            );
        }
        return NextResponse.json({ bus });
    } catch (error) {
        console.error("[accessibility][id] PATCH failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

function toBool(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === 1 || value === "1") return true;
    if (value === "false" || value === 0 || value === "0") return false;
    return undefined;
}
