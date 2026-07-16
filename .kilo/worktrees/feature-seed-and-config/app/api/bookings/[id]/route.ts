import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    _req: Request,
    context: { params: { id: string } },
) {
    try {
        const params = await context.params;
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        const bookingId = String(params?.id || "");
        if (!bookingId) {
            return NextResponse.json({ error: "invalid_id" }, { status: 400 });
        }

        const where: any = { id: bookingId };
        if (roleKey === "passenger" || roleKey === "technician") {
            where.userId = String(session.user.id);
        }

        const booking = await prisma.booking.findFirst({
            where,
            include: {
                user: true,
                payment: true,
                receipt: true,
                paymentProofs: {
                    include: { uploadedBy: true },
                    orderBy: { createdAt: "desc" },
                },
                seats: { include: { seat: true } },
                trip: {
                    include: {
                        bus: { include: { company: true } },
                        route: {
                            include: {
                                originStation: true,
                                destinationStation: true,
                            },
                        },
                    },
                },
            },
        });

        if (!booking) {
            return NextResponse.json({ error: "not_found" }, { status: 404 });
        }

        const payload = {
            id: booking.id,
            bookingRef: booking.bookingRef,
            status: booking.status,
            totalPrice: booking.totalPrice,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
            passenger: booking.user
                ? {
                      id: booking.user.id,
                      name: booking.user.fullName,
                      email: booking.user.email,
                      phone: booking.user.phone,
                  }
                : null,
            passengerInfo: {
                fullName: booking.passengerFullName,
                phone: booking.passengerPhone,
                email: booking.passengerEmail,
                idNumber: booking.passengerIdNumber,
                gender: booking.passengerGender,
                age: booking.passengerAge,
                emergencyContact: booking.emergencyContact,
                notes: booking.notes,
            },
            payment: booking.payment
                ? {
                      status: booking.payment.status,
                      method: booking.payment.method,
                      amount: booking.payment.amount,
                      paidAt: booking.payment.paidAt,
                      transactionRef: booking.payment.transactionRef,
                  }
                : null,
            receipt: booking.receipt
                ? {
                                            id: booking.receipt.id,
                      receiptNumber: booking.receipt.receiptNumber,
                      pdfUrl: booking.receipt.pdfUrl,
                      emailedTo: booking.receipt.emailedTo,
                      issuedAt: booking.receipt.issuedAt,
                  }
                : null,
            paymentProofs: (booking.paymentProofs || []).map((proof) => ({
                id: proof.id,
                fileUrl: proof.fileUrl,
                fileName: proof.fileName,
                fileType: proof.fileType,
                createdAt: proof.createdAt,
                uploadedBy: proof.uploadedBy
                    ? {
                          id: proof.uploadedBy.id,
                          name: proof.uploadedBy.fullName,
                      }
                    : null,
            })),
            trip: booking.trip
                ? {
                      id: booking.trip.id,
                      departAt: booking.trip.departAt,
                      arriveAt: booking.trip.arriveAt,
                      basePrice: booking.trip.basePrice,
                      status: booking.trip.status,
                      bus: booking.trip.bus
                          ? {
                                id: booking.trip.bus.id,
                                plateNumber: booking.trip.bus.plateNumber,
                                model: booking.trip.bus.model,
                                seatCount: booking.trip.bus.seatCount,
                                level: booking.trip.bus.level,
                                driverName: booking.trip.bus.driverName,
                                imageUrl: booking.trip.bus.imageUrl,
                                amenities: booking.trip.bus.amenities,
                                safetyChecklist: booking.trip.bus.safetyChecklist,
                                seatLayout: booking.trip.bus.seatLayout,
                                companyName:
                                    booking.trip.bus.company?.name || null,
                            }
                          : null,
                      route: booking.trip.route
                          ? {
                                id: booking.trip.route.id,
                                origin: booking.trip.route.originStation
                                    ? {
                                          id: booking.trip.route.originStation
                                              .id,
                                          name: booking.trip.route.originStation
                                              .name,
                                          code: booking.trip.route.originStation
                                              .code,
                                      }
                                    : null,
                                destination: booking.trip.route
                                    .destinationStation
                                    ? {
                                          id: booking.trip.route
                                              .destinationStation.id,
                                          name: booking.trip.route
                                              .destinationStation.name,
                                          code: booking.trip.route
                                              .destinationStation.code,
                                      }
                                    : null,
                            }
                          : null,
                  }
                : null,
            seats: booking.seats.map((seat) => ({
                id: seat.id,
                seatNumber: seat.seat?.seatNumber || "",
                seatType: seat.seat?.seatType || null,
                fare: seat.fare,
            })),
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[bookings:id] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
