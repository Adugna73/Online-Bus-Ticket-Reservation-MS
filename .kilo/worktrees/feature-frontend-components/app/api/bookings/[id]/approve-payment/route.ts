import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, BookingStatus } from "@prisma/client";

function buildReceiptNumber(bookingRef: string) {
    const stamp = Date.now().toString(36).toUpperCase();
    return `RC-${bookingRef}-${stamp}`;
}

export async function POST(
    req: Request,
    context: { params: { id: string } },
) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey !== "admin" && roleKey !== "supervisor" && roleKey !== "staff") {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const params = await context.params;
        const bookingId = String(params?.id || "").trim();
        if (!bookingId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            transactionRef?: string;
            paidAt?: string;
        };

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true, receipt: true, user: true, trip: true },
        });

        if (!booking || !booking.payment) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
        const receiptNumber =
            booking.receipt?.receiptNumber ||
            buildReceiptNumber(booking.bookingRef);

        await prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: booking.payment!.id },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt,
                    transactionRef:
                        String(body?.transactionRef || "").trim() || null,
                },
            });

            await tx.booking.update({
                where: { id: booking.id },
                data: {
                    status: BookingStatus.CONFIRMED,
                },
            });

            if (!booking.receipt) {
                await tx.receipt.create({
                    data: {
                        bookingId: booking.id,
                        receiptNumber,
                        emailedTo: booking.user?.email || null,
                    },
                });
            }
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[bookings] approve payment failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
