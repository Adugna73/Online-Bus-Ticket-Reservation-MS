"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis } from "recharts";
import { Badge } from "../ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "../ui/card";
import { ChartContainer, ChartTooltipContent } from "../ui/chart";

export type ChartPoint = {
    label: string;
    value: number;
};

export function ChartAreaInteractive({ data }: { data: ChartPoint[] }) {
    const [range, setRange] = useState<"all" | "top">("all");

    const filtered = useMemo(() => {
        if (range === "top") return data.slice(0, 3);
        return data;
    }, [data, range]);

    return (
        <Card className="@container/card">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Total Bookings</CardTitle>
                    <CardDescription>Status distribution</CardDescription>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <button
                        onClick={() => setRange("all")}
                        className={`rounded border px-3 py-1 transition ${
                            range === "all"
                                ? "bg-foreground text-background"
                                : "bg-muted text-foreground"
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setRange("top")}
                        className={`rounded border px-3 py-1 transition ${
                            range === "top"
                                ? "bg-foreground text-background"
                                : "bg-muted text-foreground"
                        }`}
                    >
                        Top 3
                    </button>
                    <Badge variant="outline">
                        {filtered.reduce((a, b) => a + b.value, 0)} total
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="px-2 pb-4 sm:px-4">
                <ChartContainer>
                    <AreaChart
                        data={filtered}
                        height={260}
                        width={600}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient
                                id="fillStatus"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="var(--primary)"
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--primary)"
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke="#eee" />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                        <Tooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent indicator="Bookings" />
                            }
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="var(--primary)"
                            fill="url(#fillStatus)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

export default ChartAreaInteractive;
