import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import * as svc from "@/lib/services/social";

// DELETE: remove a review. Only the author (or staff/admin) may delete.
export async function DELETE(
    _req: Request,
    context: { params: { id: string } },
) {
    try {
        const params = await context.params;
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json(
                { error: "unauthorized" },
                { status: 401 },
            );
        }
        const userId = session.user.id;
        const role = String(session.user.role || "").toLowerCase();
        const reviewId = String(params?.id || "");
        if (!reviewId) {
            return NextResponse.json(
                { error: "invalid_id" },
                { status: 400 },
            );
        }

        try {
            const result = await svc.deleteReview(reviewId, userId, role);
            return NextResponse.json(result);
        } catch (err: any) {
            const msg = String(err?.message || "");
            if (msg === "not_found") {
                return NextResponse.json(
                    { error: "not_found" },
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
    } catch (error) {
        console.error("[social:id] delete failed", error);
        return NextResponse.json(
            { error: "server_error" },
            { status: 500 },
        );
    }
}
