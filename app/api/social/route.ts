import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as svc from "@/lib/services/social";

// GAP 7: Social & Community — fully DB-backed.
// GET:
//   ?tripId=        -> reviews + buddies for that trip
//   ?routeId=       -> reviews for that route
//   ?safety=1       -> safety reports (staff/admin see all, passengers own)
//   ?buddies=1&tripId= -> buddies only
export async function GET(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;
        const role = String(session.user.role || "").toLowerCase();

        const url = new URL(req.url);
        const tripId = url.searchParams.get("tripId");
        const routeId = url.searchParams.get("routeId");
        const safety = url.searchParams.get("safety");
        const buddiesOnly = url.searchParams.get("buddies");

        if (safety === "1") {
            const reports = await svc.listSafetyReports(role, userId);
            return NextResponse.json({ safetyReports: reports });
        }

        if (buddiesOnly === "1" && tripId) {
            const buddies = await svc.listBuddies(tripId);
            return NextResponse.json({ buddies });
        }

        if (tripId || routeId) {
            const [reviews, buddies] = await Promise.all([
                svc.listReviews(routeId, tripId),
                tripId ? svc.listBuddies(tripId) : Promise.resolve([]),
            ]);
            return NextResponse.json({ reviews, buddies });
        }

        // Default: return recent reviews across the platform.
        const reviews = await svc.listReviews();
        return NextResponse.json({ reviews, buddies: [] });
    } catch (error) {
        console.error("[social] list failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

// POST: body.action = review | buddy | buddyOut | safety
export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;

        const body = await req.json().catch(() => ({}));
        const action = body?.action;

        if (action === "review") {
            const bookingId = String(body?.bookingId || "").trim();
            const rating = Number(body?.rating || 0);
            if (!bookingId) {
                return NextResponse.json(
                    { error: "bookingId_required" },
                    { status: 400 },
                );
            }
            if (!rating || rating < 1 || rating > 5) {
                return NextResponse.json(
                    { error: "invalid_rating" },
                    { status: 400 },
                );
            }
            try {
                const review = await svc.createReview(
                    bookingId,
                    userId,
                    rating,
                    body?.comment,
                    body?.photoUrls,
                );
                return NextResponse.json(review);
            } catch (err: any) {
                const msg = String(err?.message || "");
                if (msg === "booking_not_found") {
                    return NextResponse.json(
                        { error: "booking_not_found" },
                        { status: 404 },
                    );
                }
                if (msg === "not_authorized") {
                    return NextResponse.json(
                        { error: "not_authorized" },
                        { status: 403 },
                    );
                }
                throw err;
            }
        }

        if (action === "buddy") {
            const tripId = String(body?.tripId || "").trim();
            if (!tripId) {
                return NextResponse.json(
                    { error: "tripId_required" },
                    { status: 400 },
                );
            }
            const trip = await prisma.trip.findUnique({ where: { id: tripId } });
            if (!trip) {
                return NextResponse.json(
                    { error: "trip_not_found" },
                    { status: 404 },
                );
            }
            const buddy = await svc.optInBuddy(tripId, userId);
            return NextResponse.json(buddy);
        }

        if (action === "buddyOut") {
            const tripId = String(body?.tripId || "").trim();
            if (!tripId) {
                return NextResponse.json(
                    { error: "tripId_required" },
                    { status: 400 },
                );
            }
            const buddy = await svc.optOutBuddy(tripId, userId);
            return NextResponse.json(buddy);
        }

        if (action === "safety") {
            const category = String(body?.category || "").trim();
            if (!category) {
                return NextResponse.json(
                    { error: "category_required" },
                    { status: 400 },
                );
            }
            const report = await svc.createSafetyReport(
                userId,
                body?.bookingId,
                category,
                body?.description,
            );
            return NextResponse.json(report);
        }

        return NextResponse.json(
            { error: "unknown_action" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[social] action failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
