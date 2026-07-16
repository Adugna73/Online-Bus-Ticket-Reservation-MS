"use client";

import * as React from "react";
import { TrendingUp } from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartContainer,
    ChartConfig,
    ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "Booking status overview";

type Counts = Record<string, number>;

async function fetchCounts(): Promise<Counts | null> {
    try {
        const res = await fetch("/api/workorders/counts", {
            cache: "no-store",
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

const defaultConfig: ChartConfig = {
    created: { label: "Created", color: "var(--chart-1)" },
    assigned: { label: "Assigned", color: "var(--chart-2)" },
    in_progress: { label: "In Progress", color: "var(--chart-3)" },
    completed: { label: "Completed", color: "var(--chart-4)" },
};

export function WorkOrdersStatusCard() {
    const [counts, setCounts] = React.useState<Counts | null>(null);

    React.useEffect(() => {
        let mounted = true;
        fetchCounts().then((c) => {
            if (mounted) setCounts(c);
        });
        return () => {
            mounted = false;
        };
    }, []);

    // Map counts into chart-friendly data
    const chartData = React.useMemo(() => {
        const keys = Object.keys(defaultConfig);
        return keys.map((k) => ({
            name: defaultConfig[k as keyof typeof defaultConfig].label,
            value: counts ? counts[k] ?? 0 : 0,
            key: k,
        }));
    }, [counts]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bookings</CardTitle>
                <CardDescription>Current status distribution</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                        >
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--muted)"
                            />
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="value" radius={4}>
                                {chartData.map((d) => (
                                    <Cell
                                        key={d.key}
                                        fill={
                                            defaultConfig[
                                                d.key as keyof typeof defaultConfig
                                            ]?.color || "var(--primary)"
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 leading-none font-medium">
                    Status overview <TrendingUp className="h-4 w-4" />
                </div>
                <div className="text-muted-foreground leading-none">
                    Showing current counts per status
                </div>
            </CardFooter>
        </Card>
    );
}

export default WorkOrdersStatusCard;
