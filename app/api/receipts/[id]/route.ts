import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/receipts/[id] — full receipt details for inline display.
export async function GET(
    _req: Request,
    context: { params: { id: string } },
) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const receiptId = String(params?.id || "").trim();
        if (!receiptId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const receipt = await prisma.receipt.findUnique({
            where: { id: receiptId },
            include: {
                booking: {
                    include: {
                        user: true,
                        payment: true,
                        seats: { include: { seat: true } },
                        trip: {
                            include: {
                                route: {
                                    include: {
                                        originStation: true,
                                        destinationStation: true,
                                    },
                                },
                                bus: true,
                            },
                        },
                    },
                },
            },
        });

        if (!receipt || !receipt.booking) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const userId = String(session.user.id);
        const roleKey = String(session.user.role || "").toLowerCase();
        if (roleKey === "passenger" && receipt.booking.userId !== userId) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const b = receipt.booking;
        return NextResponse.json({
            receipt: {
                id: receipt.id,
                receiptNumber: receipt.receiptNumber,
                issuedAt: receipt.issuedAt,
                pdfUrl: `/api/receipts/${receipt.id}/pdf`,
                chapaReceiptUrl: (receipt as any).chapaReceiptUrl ?? null,
            },
            booking: {
                id: b.id,
                bookingRef: b.bookingRef,
                status: b.status,
                totalPrice: b.totalPrice,
                passengerFullName: (b as any).passengerFullName || b.user?.fullName || null,
                passengerPhone: (b as any).passengerPhone || b.user?.phone || null,
                passengerEmail: (b as any).passengerEmail || b.user?.email || null,
                seats: (b.seats || []).map((s) => s.seat?.seatNumber).filter(Boolean),
            },
            trip: b.trip
                ? {
                      departAt: b.trip.departAt,
                      arriveAt: b.trip.arriveAt,
                      origin: b.trip.route?.originStation
                          ? {
                                name: b.trip.route.originStation.name,
                                code: b.trip.route.originStation.code,
                            }
                          : null,
                      destination: b.trip.route?.destinationStation
                          ? {
                                name: b.trip.route.destinationStation.name,
                                code: b.trip.route.destinationStation.code,
                            }
                          : null,
                      bus: b.trip.bus
                          ? {
                                plateNumber: b.trip.bus.plateNumber,
                                model: b.trip.bus.model,
                            }
                          : null,
                  }
                : null,
            payment: b.payment
                ? {
                      method: b.payment.method,
                      status: b.payment.status,
                      amount: b.payment.amount,
                      transactionRef: b.payment.transactionRef,
                      paidAt: b.payment.paidAt,
                  }
                : null,
        });
    } catch (error) {
        console.error("[receipt] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
