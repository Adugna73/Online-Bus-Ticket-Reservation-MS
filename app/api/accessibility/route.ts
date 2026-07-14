import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/accessibility";

// GAP 12: Accessibility & inclusivity (DB-backed)
export async function GET(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }

        const url = new URL(req.url);
        const trips = url.searchParams.get("trips");
        const summary = url.searchParams.get("summary");

        const filters: svc.AccessibilityFilter = {
            wheelchairAccessible:
                url.searchParams.get("wheelchair") === "1",
            womenOnly: url.searchParams.get("womenOnly") === "1",
            hasPrioritySeating: url.searchParams.get("priority") === "1",
            audioAnnouncements: url.searchParams.get("audio") === "1",
        };

        if (summary === "1") {
            const data = await svc.getAccessibilitySummary();
            return NextResponse.json(data);
        }

        if (trips === "1") {
            const data = await svc.listAccessibleTrips(filters);
            return NextResponse.json({ trips: data });
        }

        const buses = await svc.listAccessibleBuses(filters);
        return NextResponse.json({ buses });
    } catch (error) {
        console.error("[accessibility] GET failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

export async function POST(req: Request) {
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

        const body = await req.json().catch(() => ({}));
        const busId = String(body?.busId || "").trim();
        if (!busId) {
            return NextResponse.json(
                { error: "busId_required" },
                { status: 400 },
            );
        }

        const flags: svc.AccessibilityFlags = {
            wheelchairAccessible: toBool(body?.wheelchairAccessible),
            womenOnly: toBool(body?.womenOnly),
            hasPrioritySeating: toBool(body?.hasPrioritySeating),
            audioAnnouncements: toBool(body?.audioAnnouncements),
        };

        const bus = await svc.updateBusAccessibility(busId, flags);
        if (!bus) {
            return NextResponse.json(
                { error: "bus_not_found" },
                { status: 404 },
            );
        }
        return NextResponse.json({ bus });
    } catch (error) {
        console.error("[accessibility] POST failed", error);
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
