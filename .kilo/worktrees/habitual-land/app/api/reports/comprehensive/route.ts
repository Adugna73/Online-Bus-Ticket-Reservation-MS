import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const url = new URL(req.url);
        const startDate = url.searchParams.get("start");
        const endDate = url.searchParams.get("end");
        const routeId = url.searchParams.get("routeId");
        const status = url.searchParams.get("status");

        const where: any = {};
        if (startDate || endDate) {
            where.trip = {};
            if (startDate) where.trip.departAt = { gte: new Date(startDate) };
            if (endDate) {
                where.trip.departAt = {
                    ...(where.trip.departAt || {}),
                    lte: new Date(endDate),
                };
            }
        }
        if (routeId) where.trip = { ...where.trip, routeId };
        if (status) where.status = status;

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
                trip: {
                    include: {
                        route: {
                            include: {
                                originStation: true,
                                destinationStation: true,
                            },
                        },
                        bus: {
                            select: {
                                id: true,
                                plateNumber: true,
                                model: true,
                                driverName: true,
                                seatCount: true,
                                company: { select: { name: true } },
                            },
                        },
                    },
                },
                payment: true,
                seats: {
                    include: {
                        seat: { select: { seatNumber: true, seatType: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 500,
        });

        const totalRevenue = bookings
            .filter((b) => b.payment?.status === "PAID")
            .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

        const totalBookings = bookings.length;
        const confirmedBookings = bookings.filter(
            (b) => b.status === "CONFIRMED" || b.status === "COMPLETED",
        ).length;
        const cancelledBookings = bookings.filter(
            (b) => b.status === "CANCELLED",
        ).length;
        const refundedBookings = bookings.filter(
            (b) => b.payment?.status === "REFUNDED",
        ).length;

        const routeRevenue = new Map<string, { route: string; revenue: number; count: number }>();
        for (const b of bookings) {
            if (b.payment?.status !== "PAID") continue;
            const routeName = `${b.trip?.route?.originStation?.name || "?"} → ${b.trip?.route?.destinationStation?.name || "?"}`;
            const existing = routeRevenue.get(routeName) || {
                route: routeName,
                revenue: 0,
                count: 0,
            };
            existing.revenue += b.totalPrice || 0;
            existing.count += 1;
            routeRevenue.set(routeName, existing);
        }

        const topRoutes = Array.from(routeRevenue.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        const reportRows = bookings.map((b) => ({
            bookingRef: b.bookingRef,
            passengerName: b.passengerFullName || b.user?.fullName || "",
            passengerPhone: b.passengerPhone || b.user?.phone || "",
            passengerEmail: b.passengerEmail || b.user?.email || "",
            route: `${b.trip?.route?.originStation?.name || "?"} → ${b.trip?.route?.destinationStation?.name || "?"}`,
            busPlate: b.trip?.bus?.plateNumber || "",
            busModel: b.trip?.bus?.model || "",
            companyName: b.trip?.bus?.company?.name || "",
            driverName: b.trip?.bus?.driverName || "",
            departDate: b.trip?.departAt,
            arriveDate: b.trip?.arriveAt,
            seatNumbers: b.seats?.map((s) => s.seat?.seatNumber).filter(Boolean).join(", ") || "",
            totalPrice: b.totalPrice,
            bookingStatus: b.status,
            paymentStatus: b.payment?.status || "PENDING",
            paymentMethod: b.payment?.method || "",
            createdAt: b.createdAt,
        }));

        return NextResponse.json({
            summary: {
                totalRevenue,
                totalBookings,
                confirmedBookings,
                cancelledBookings,
                refundedBookings,
                avgBookingValue: totalBookings
                    ? Math.round((totalRevenue / totalBookings) * 100) / 100
                    : 0,
            },
            topRoutes,
            rows: reportRows,
        });
    } catch (error) {
        console.error("[reports/comprehensive] failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
