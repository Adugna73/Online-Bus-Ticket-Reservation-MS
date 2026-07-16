import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = (await getServerSession(authOptions as any)) as any;
        if (!session?.user) {
            return NextResponse.json({ error: "unauthorized" }, { status: 401 });
        }

        const [
            totalUsers,
            totalBookings,
            totalRoutes,
            totalBuses,
            totalTrips,
            totalStations,
            totalPayments,
            totalRevenueAgg,
            confirmedBookings,
            cancelledBookings,
            completedBookings,
            pendingBookings,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.booking.count(),
            prisma.route.count(),
            prisma.bus.count(),
            prisma.trip.count(),
            prisma.station.count(),
            prisma.payment.count(),
            prisma.payment.aggregate({
                where: { status: "PAID" },
                _sum: { amount: true },
            }),
            prisma.booking.count({ where: { status: "CONFIRMED" } }),
            prisma.booking.count({ where: { status: "CANCELLED" } }),
            prisma.booking.count({ where: { status: "COMPLETED" } }),
            prisma.booking.count({ where: { status: "PENDING" } }),
        ]);

        const totalRevenue = Number(totalRevenueAgg._sum.amount || 0);

        const now = new Date();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const recentBookings = await prisma.booking.findMany({
            where: { createdAt: { gte: sixMonthsAgo } },
            include: {
                trip: {
                    include: {
                        route: {
                            include: {
                                originStation: true,
                                destinationStation: true,
                            },
                        },
                        bus: { select: { plateNumber: true, driverName: true } },
                    },
                },
                payment: true,
            },
            take: 1000,
            orderBy: { createdAt: "desc" },
        });

        const monthlyData: { month: string; revenue: number; bookings: number; completed: number }[] = [];
        for (let i = 5; i >= 0; i--) {
            const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
            const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
            const inMonth = recentBookings.filter((b) => {
                const d = new Date(b.createdAt);
                return d >= start && d < end;
            });
            const revenue = inMonth
                .filter((b) => b.payment?.status === "PAID")
                .reduce((s, b) => s + (b.totalPrice || 0), 0);
            const completed = inMonth.filter((b) => b.status === "COMPLETED").length;
            monthlyData.push({
                month: dt.toLocaleString(undefined, { month: "short" }),
                revenue: Math.round(revenue),
                bookings: inMonth.length,
                completed,
            });
        }

        const routePopularity = new Map<string, { route: string; count: number; revenue: number }>();
        for (const b of recentBookings) {
            const routeName = `${b.trip?.route?.originStation?.name || "?"} → ${b.trip?.route?.destinationStation?.name || "?"}`;
            const existing = routePopularity.get(routeName) || {
                route: routeName,
                count: 0,
                revenue: 0,
            };
            existing.count += 1;
            if (b.payment?.status === "PAID") existing.revenue += b.totalPrice || 0;
            routePopularity.set(routeName, existing);
        }
        const topRoutes = Array.from(routePopularity.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const paymentMethodDist = await prisma.payment.groupBy({
            by: ["method"],
            _count: { _all: true },
            _sum: { amount: true },
        });

        const bookingStatusDist = [
            { name: "Confirmed", value: confirmedBookings, color: "#22c55e" },
            { name: "Pending", value: pendingBookings, color: "#f59e0b" },
            { name: "Completed", value: completedBookings, color: "#3b82f6" },
            { name: "Cancelled", value: cancelledBookings, color: "#ef4444" },
        ];

        const recentTrips = await prisma.trip.findMany({
            include: {
                route: {
                    include: {
                        originStation: true,
                        destinationStation: true,
                    },
                },
                bus: { select: { plateNumber: true, driverName: true, model: true } },
                _count: { select: { bookings: true } },
            },
            orderBy: { departAt: "desc" },
            take: 10,
        });

        const activeBuses = await prisma.bus.count({
            where: { status: "active" },
        });
        const inactiveBuses = totalBuses - activeBuses;

        const cancellationRate = totalBookings
            ? Math.round((cancelledBookings / totalBookings) * 10000) / 100
            : 0;
        const completionRate = totalBookings
            ? Math.round((completedBookings / totalBookings) * 10000) / 100
            : 0;
        const avgBookingValue = totalBookings
            ? Math.round((totalRevenue / totalBookings) * 100) / 100
            : 0;

        const lastMonth = monthlyData[monthlyData.length - 2] || { revenue: 0, bookings: 0 };
        const thisMonth = monthlyData[monthlyData.length - 1] || { revenue: 0, bookings: 0 };
        const revenueGrowth = lastMonth.revenue
            ? Math.round(((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 10000) / 100
            : 0;
        const bookingGrowth = lastMonth.bookings
            ? Math.round(((thisMonth.bookings - lastMonth.bookings) / lastMonth.bookings) * 10000) / 100
            : 0;

        return NextResponse.json({
            kpis: {
                totalRevenue,
                totalBookings,
                totalUsers,
                totalRoutes,
                totalBuses,
                totalTrips,
                totalStations,
                activeBuses,
                inactiveBuses,
                avgBookingValue,
                cancellationRate,
                completionRate,
                revenueGrowth,
                bookingGrowth,
            },
            monthlyData,
            topRoutes,
            bookingStatusDist,
            paymentMethodDist: paymentMethodDist.map((p) => ({
                method: p.method,
                count: p._count._all,
                amount: Number(p._sum.amount || 0),
            })),
            recentTrips: recentTrips.map((t) => ({
                id: t.id,
                route: `${t.route?.originStation?.name || "?"} → ${t.route?.destinationStation?.name || "?"}`,
                busPlate: t.bus?.plateNumber || "",
                driverName: t.bus?.driverName || "",
                departAt: t.departAt,
                arriveAt: t.arriveAt,
                status: t.status,
                bookingCount: t._count.bookings,
            })),
        });
    } catch (error) {
        console.error("[dashboard/trends] failed", error);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
}
