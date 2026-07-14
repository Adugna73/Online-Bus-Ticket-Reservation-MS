"use client";

import { useEffect, useState } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    RadialBarChart,
    RadialBar,
} from "recharts";
import {
    DollarSign,
    Users,
    Bus,
    Route,
    TrendingUp,
    TrendingDown,
    Calendar,
    MapPin,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
} from "lucide-react";

type TrendData = {
    kpis: {
        totalRevenue: number;
        totalBookings: number;
        totalUsers: number;
        totalRoutes: number;
        totalBuses: number;
        totalTrips: number;
        totalStations: number;
        activeBuses: number;
        inactiveBuses: number;
        avgBookingValue: number;
        cancellationRate: number;
        completionRate: number;
        revenueGrowth: number;
        bookingGrowth: number;
    };
    monthlyData: { month: string; revenue: number; bookings: number; completed: number }[];
    topRoutes: { route: string; count: number; revenue: number }[];
    bookingStatusDist: { name: string; value: number; color: string }[];
    paymentMethodDist: { method: string; count: number; amount: number }[];
    recentTrips: {
        id: string;
        route: string;
        busPlate: string;
        driverName: string;
        departAt: string;
        arriveAt: string;
        status: string;
        bookingCount: number;
    }[];
};

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function TrendDashboard() {
    const [data, setData] = useState<TrendData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/dashboard/trends", { cache: "no-store" });
                if (!res.ok) throw new Error("Failed to load trend data");
                setData(await res.json());
            } catch (err: any) {
                setError(err?.message || "Failed to load");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
                <div className="animate-pulse text-lg">Loading trend dashboard...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {error || "No data available"}
            </div>
        );
    }

    const k = data.kpis;

    return (
        <div className="space-y-6">
            {/* Hero KPI Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                <HeroCard
                    title="Total Revenue"
                    value={`ETB ${(k.totalRevenue || 0).toLocaleString()}`}
                    growth={k.revenueGrowth}
                    icon={<DollarSign className="h-6 w-6" />}
                    gradient="from-emerald-500 to-teal-600"
                />
                <HeroCard
                    title="Total Bookings"
                    value={k.totalBookings.toLocaleString()}
                    growth={k.bookingGrowth}
                    icon={<Calendar className="h-6 w-6" />}
                    gradient="from-blue-500 to-indigo-600"
                />
                <HeroCard
                    title="Registered Users"
                    value={k.totalUsers.toLocaleString()}
                    icon={<Users className="h-6 w-6" />}
                    gradient="from-purple-500 to-pink-600"
                />
                <HeroCard
                    title="Avg Booking Value"
                    value={`ETB ${(k.avgBookingValue || 0).toLocaleString()}`}
                    icon={<TrendingUp className="h-6 w-6" />}
                    gradient="from-amber-500 to-orange-600"
                />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <MiniStat label="Active Routes" value={k.totalRoutes} icon={<Route className="h-4 w-4" />} />
                <MiniStat label="Total Buses" value={k.totalBuses} icon={<Bus className="h-4 w-4" />} />
                <MiniStat label="Active Buses" value={k.activeBuses} icon={<Activity className="h-4 w-4" />} color="text-green-600" />
                <MiniStat label="Total Trips" value={k.totalTrips} icon={<Calendar className="h-4 w-4" />} />
                <MiniStat label="Stations" value={k.totalStations} icon={<MapPin className="h-4 w-4" />} />
                <MiniStat label="Completion Rate" value={`${k.completionRate}%`} icon={<TrendingUp className="h-4 w-4" />} color="text-blue-600" />
            </div>

            {/* Charts Row 1: Revenue + Bookings trend */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Revenue Trend (6 Months)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={data.monthlyData}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                                formatter={(v: any) => [`ETB ${v.toLocaleString()}`, "Revenue"]}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#revGrad)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        Bookings & Completions (6 Months)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Bookings" />
                            <Bar dataKey="completed" fill="#22c55e" radius={[4, 4, 0, 0]} name="Completed" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 2: Booking Status Pie + Top Routes */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-purple-500" />
                        Booking Status Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={data.bookingStatusDist}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                innerRadius={40}
                                label={(entry: any) => `${entry.name}: ${entry.value}`}
                            >
                                {data.bookingStatusDist.map((entry, i) => (
                                    <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Route className="h-4 w-4 text-indigo-500" />
                        Top Routes by Popularity
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={data.topRoutes} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 11 }} />
                            <YAxis
                                type="category"
                                dataKey="route"
                                tick={{ fontSize: 10 }}
                                width={150}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                            />
                            <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Bookings" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 3: Payment Methods + Completion Rate Radial */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-amber-500" />
                        Revenue by Payment Method
                    </h3>
                    {data.paymentMethodDist.length > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={data.paymentMethodDist}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    formatter={(v: any, name: string) =>
                                        name === "amount"
                                            ? [`ETB ${v.toLocaleString()}`, "Revenue"]
                                            : [v, name]
                                    }
                                />
                                <Bar dataKey="amount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Revenue (ETB)" />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                            No payment data available
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        System Performance Indicators
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center">
                            <ResponsiveContainer width="100%" height={160}>
                                <RadialBarChart
                                    data={[{ name: "Completion", value: k.completionRate, fill: "#22c55e" }]}
                                    innerRadius="50%"
                                    outerRadius="80%"
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    <RadialBar background dataKey="value" cornerRadius={10} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="text-center -mt-12">
                                <div className="text-2xl font-bold text-green-600">
                                    {k.completionRate}%
                                </div>
                                <div className="text-xs text-muted-foreground">Completion Rate</div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center">
                            <ResponsiveContainer width="100%" height={160}>
                                <RadialBarChart
                                    data={[{ name: "Cancellation", value: k.cancellationRate, fill: "#ef4444" }]}
                                    innerRadius="50%"
                                    outerRadius="80%"
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    <RadialBar background dataKey="value" cornerRadius={10} />
                                </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="text-center -mt-12">
                                <div className="text-2xl font-bold text-red-600">
                                    {k.cancellationRate}%
                                </div>
                                <div className="text-xs text-muted-foreground">Cancellation Rate</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Trips Table */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Bus className="h-4 w-4 text-blue-500" />
                    Recent Trips Overview
                </h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">Route</th>
                                <th className="px-3 py-2 text-left font-medium">Bus</th>
                                <th className="px-3 py-2 text-left font-medium">Driver</th>
                                <th className="px-3 py-2 text-left font-medium">Departure</th>
                                <th className="px-3 py-2 text-left font-medium">Arrival</th>
                                <th className="px-3 py-2 text-left font-medium">Status</th>
                                <th className="px-3 py-2 text-right font-medium">Bookings</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.recentTrips.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-4 text-center text-muted-foreground">
                                        No recent trips found.
                                    </td>
                                </tr>
                            ) : (
                                data.recentTrips.map((t) => (
                                    <tr key={t.id} className="border-t hover:bg-muted/40">
                                        <td className="px-3 py-2">{t.route}</td>
                                        <td className="px-3 py-2">{t.busPlate}</td>
                                        <td className="px-3 py-2">{t.driverName || "—"}</td>
                                        <td className="px-3 py-2">
                                            {t.departAt
                                                ? new Date(t.departAt).toLocaleDateString(undefined, {
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  })
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                            {t.arriveAt
                                                ? new Date(t.arriveAt).toLocaleDateString(undefined, {
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  })
                                                : "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`rounded px-2 py-0.5 text-xs ${
                                                    t.status === "COMPLETED"
                                                        ? "bg-green-100 text-green-700"
                                                        : t.status === "CANCELLED"
                                                          ? "bg-red-100 text-red-700"
                                                          : "bg-blue-100 text-blue-700"
                                                }`}
                                            >
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right">{t.bookingCount}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Insight Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <InsightCard
                    title="Revenue Growth"
                    value={`${k.revenueGrowth > 0 ? "+" : ""}${k.revenueGrowth}%`}
                    positive={k.revenueGrowth >= 0}
                    description="Month-over-month revenue change"
                />
                <InsightCard
                    title="Booking Growth"
                    value={`${k.bookingGrowth > 0 ? "+" : ""}${k.bookingGrowth}%`}
                    positive={k.bookingGrowth >= 0}
                    description="Month-over-month booking change"
                />
                <InsightCard
                    title="Fleet Utilization"
                    value={`${k.totalBuses ? Math.round((k.activeBuses / k.totalBuses) * 100) : 0}%`}
                    positive={true}
                    description={`${k.activeBuses} of ${k.totalBuses} buses active`}
                />
            </div>
        </div>
    );
}

function HeroCard({
    title,
    value,
    growth,
    icon,
    gradient,
}: {
    title: string;
    value: string;
    growth?: number;
    icon: React.ReactNode;
    gradient: string;
}) {
    return (
        <div className={`rounded-xl bg-gradient-to-br ${gradient} p-5 text-white shadow-lg`}>
            <div className="flex items-center justify-between">
                <div className="opacity-80">{icon}</div>
                {growth !== undefined && (
                    <div
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                            growth >= 0 ? "bg-white/20" : "bg-red-500/30"
                        }`}
                    >
                        {growth >= 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                        ) : (
                            <ArrowDownRight className="h-3 w-3" />
                        )}
                        {Math.abs(growth)}%
                    </div>
                )}
            </div>
            <div className="mt-3 text-2xl font-bold">{value}</div>
            <div className="mt-1 text-sm opacity-80">{title}</div>
        </div>
    );
}

function MiniStat({
    label,
    value,
    icon,
    color,
}: {
    label: string;
    value: string | number;
    icon: React.ReactNode;
    color?: string;
}) {
    return (
        <div className="rounded-lg border bg-card p-3 shadow-sm">
            <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${color || ""}`}>
                {icon}
                {label}
            </div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
        </div>
    );
}

function InsightCard({
    title,
    value,
    positive,
    description,
}: {
    title: string;
    value: string;
    positive: boolean;
    description: string;
}) {
    return (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{title}</span>
                {positive ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                )}
            </div>
            <div
                className={`mt-2 text-2xl font-bold ${
                    positive ? "text-green-600" : "text-red-600"
                }`}
            >
                {value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
    );
}
