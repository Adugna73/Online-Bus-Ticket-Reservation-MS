import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookingStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const STATUS_VALUES = new Set(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]);
const PAYMENT_STATUS_VALUES = new Set(["PENDING", "PAID", "FAILED", "REFUNDED"]);

function normalizeEnum(value: string | null, allowed: Set<string>) {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    return allowed.has(normalized) ? normalized : null;
}

export async function GET(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        const url = new URL(req.url);
        const statusParam = normalizeEnum(url.searchParams.get("status"), STATUS_VALUES);
        const paymentStatusParam = normalizeEnum(
            url.searchParams.get("paymentStatus"),
            PAYMENT_STATUS_VALUES,
        );
        const takeParam = Number(url.searchParams.get("take") || "200");
        const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 500) : 200;

        const where: any = {};
        if (statusParam) where.status = statusParam;
        if (paymentStatusParam) where.payment = { status: paymentStatusParam };

        if (roleKey === "passenger" || roleKey === "technician") {
            where.userId = String(session.user.id);
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                user: true,
                payment: true,
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
            orderBy: { createdAt: "desc" },
            take,
        });

        const payload = bookings.map((booking) => ({
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
                                          id: booking.trip.route.originStation.id,
                                          name: booking.trip.route.originStation.name,
                                          code: booking.trip.route.originStation.code,
                                      }
                                    : null,
                                destination: booking.trip.route.destinationStation
                                    ? {
                                          id: booking.trip.route.destinationStation.id,
                                          name: booking.trip.route.destinationStation.name,
                                          code: booking.trip.route.destinationStation.code,
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
               receipt: booking.receipt
                   ? {
                         id: booking.receipt.id,
                         receiptNumber: booking.receipt.receiptNumber,
                         pdfUrl: booking.receipt.pdfUrl,
                         emailedTo: booking.receipt.emailedTo,
                         issuedAt: booking.receipt.issuedAt,
                     }
                   : null,
        }));

        return NextResponse.json(payload);
    } catch (error) {
        console.error("[bookings] fetch failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}

function buildBookingRef() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 900 + 100).toString();
    return `BR-${stamp}-${rand}`;
}

function buildReceiptNumber(bookingRef: string) {
    const stamp = Date.now().toString(36).toUpperCase();
    return `RC-${bookingRef}-${stamp}`;
}

function normalizePaymentMethod(value?: string | null) {
    const raw = String(value || "").toUpperCase().replace(/\s+/g, "_");
    const allowed = new Set(Object.values(PaymentMethod));
    return allowed.has(raw as PaymentMethod)
        ? (raw as PaymentMethod)
        : PaymentMethod.CASH;
}

export async function POST(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const roleKey = String(session.user.role || "").toLowerCase();
        if (
            roleKey !== "passenger" &&
            roleKey !== "technician" &&
            roleKey !== "admin" &&
            roleKey !== "supervisor" &&
            roleKey !== "staff" &&
            roleKey !== "manager"
        ) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
        }

        const body = (await req.json().catch(() => ({}))) as {
            tripId?: string;
            seatId?: string;
            paymentMethod?: string;
            markPaid?: boolean;
            transactionRef?: string;
            userId?: string;
            passengerFullName?: string;
            passengerPhone?: string;
            passengerEmail?: string;
            passengerIdNumber?: string;
            passengerGender?: string;
            passengerAge?: number | string;
            emergencyContact?: string;
            notes?: string;
        };
        const tripId = String(body?.tripId || "").trim();
        const seatId = String(body?.seatId || "").trim();
        if (!tripId) {
            return NextResponse.json({ error: "trip_required" }, { status: 400 });
        }
        if (!seatId) {
            return NextResponse.json({ error: "seat_required" }, { status: 400 });
        }

        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
            include: { bus: true },
        });
        if (!trip || !trip.busId) {
            return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
        }

        const seat = await prisma.seat.findFirst({
            where: {
                id: seatId,
                busId: trip.busId,
                isActive: true,
            },
        });

        if (!seat) {
            return NextResponse.json({ error: "seat_invalid" }, { status: 400 });
        }

        const bookingRef = buildBookingRef();
        const paymentMethod = normalizePaymentMethod(body?.paymentMethod);
        const markPaid = Boolean(body?.markPaid);

        let bookingUserId = String(session.user.id);
        if (roleKey !== "passenger" && roleKey !== "technician") {
            const requestedUserId = String(body?.userId || "").trim();
            if (requestedUserId) {
                bookingUserId = requestedUserId;
            } else {
                const passengerEmail = String(body?.passengerEmail || "").trim();
                const passengerPhone = String(body?.passengerPhone || "").trim();
                const existing = await prisma.user.findFirst({
                    where: {
                        OR: [
                            passengerEmail ? { email: passengerEmail } : undefined,
                            passengerPhone ? { phone: passengerPhone } : undefined,
                        ].filter(Boolean) as any,
                    },
                });
                if (existing) {
                    bookingUserId = existing.id;
                } else {
                    const fullName =
                        String(body?.passengerFullName || "").trim() ||
                        "Guest Passenger";
                    const email =
                        passengerEmail ||
                        `guest_${Date.now()}@bus.local`;
                    const passwordHash = await bcrypt.hash(
                        Math.random().toString(36),
                        10,
                    );
                    const createdUser = await prisma.user.create({
                        data: {
                            fullName,
                            email,
                            phone: passengerPhone || null,
                            passwordHash,
                            role: "PASSENGER",
                        },
                    });
                    bookingUserId = createdUser.id;
                }
            }
        }

        let booking;
        try {
            booking = await prisma.$transaction(async (tx) => {
                const created = await tx.booking.create({
                    data: {
                        bookingRef,
                        userId: bookingUserId,
                        tripId: tripId,
                        status: markPaid
                            ? BookingStatus.CONFIRMED
                            : BookingStatus.PENDING,
                        totalPrice: trip.basePrice,
                        passengerFullName:
                            String(body?.passengerFullName || "").trim() ||
                            String((session.user as any)?.name || "").trim() ||
                            null,
                        passengerPhone:
                            String(body?.passengerPhone || "").trim() || null,
                        passengerEmail:
                            String(body?.passengerEmail || "").trim() || null,
                        passengerIdNumber:
                            String(body?.passengerIdNumber || "").trim() || null,
                        passengerGender:
                            String(body?.passengerGender || "").trim() || null,
                        passengerAge:
                            body?.passengerAge !== undefined &&
                            body?.passengerAge !== null &&
                            String(body?.passengerAge).trim() !== ""
                                ? Number(body?.passengerAge)
                                : null,
                        emergencyContact:
                            String(body?.emergencyContact || "").trim() || null,
                        notes: String(body?.notes || "").trim() || null,
                    },
                });

                await tx.bookingSeat.create({
                    data: {
                        bookingId: created.id,
                        tripId: tripId,
                        seatId: seat.id,
                        fare: trip.basePrice,
                    },
                });

                await tx.payment.create({
                    data: {
                        bookingId: created.id,
                        method: paymentMethod,
                        status: markPaid
                            ? PaymentStatus.PAID
                            : PaymentStatus.PENDING,
                        amount: trip.basePrice,
                        paidAt: markPaid ? new Date() : null,
                        transactionRef:
                            String(body?.transactionRef || "").trim() || null,
                    },
                });

                if (markPaid) {
                    await tx.receipt.create({
                        data: {
                            bookingId: created.id,
                            receiptNumber: buildReceiptNumber(bookingRef),
                            emailedTo: String(body?.passengerEmail || "").trim() || null,
                        },
                    });
                }

                return created;
            });
        } catch (error: any) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                return NextResponse.json(
                    { error: "seat_occupied" },
                    { status: 409 },
                );
            }
            throw error;
        }

        return NextResponse.json({
            id: booking.id,
            bookingRef: booking.bookingRef,
        });
    } catch (error) {
        console.error("[bookings] create failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
