import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/gamification";

// GAP 11: Gamification — fully DB-backed.
// GET: loyalty + badges + referrals for the authenticated user.
export async function GET() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;

        const [loyalty, badges, referrals] = await Promise.all([
            svc.getLoyalty(userId),
            svc.listBadges(userId),
            svc.listReferrals(userId),
        ]);

        return NextResponse.json({ loyalty, badges, referrals });
    } catch (error) {
        console.error("[gamification] list failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}

// POST: action="referral" (create) | action="redeem" (redeem referral).
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

        if (action === "referral") {
            const referredEmail = String(body?.referredEmail || "").trim();
            if (!referredEmail) {
                return NextResponse.json(
                    { error: "referredEmail_required" },
                    { status: 400 },
                );
            }
            const referral = await svc.createReferral(userId, referredEmail);
            return NextResponse.json(referral);
        }

        if (action === "redeem") {
            const id = String(body?.id || "").trim();
            if (!id) {
                return NextResponse.json(
                    { error: "id_required" },
                    { status: 400 },
                );
            }
            const referrals = await svc.listReferrals(userId);
            const owned = referrals.find((r) => r.id === id);
            if (!owned) {
                return NextResponse.json(
                    { error: "not_found" },
                    { status: 404 },
                );
            }
            const referral = await svc.redeemReferral(id);
            return NextResponse.json(referral);
        }

        return NextResponse.json(
            { error: "unknown_action" },
            { status: 400 },
        );
    } catch (error) {
        console.error("[gamification] action failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
