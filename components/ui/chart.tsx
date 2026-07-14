"use client";
import * as React from "react";
import { TooltipProps } from "recharts";

export type ChartConfig = Record<string, { label: string; color: string }>;

export function ChartContainer({
    children,
}: {
    children: React.ReactNode;
    config?: ChartConfig;
}) {
    return <div className="w-full h-44">{children}</div>;
}

export function ChartTooltip(props: any) {
    // passthrough to recharts <Tooltip /> usage; we'll just render children
    return <>{props.content}</>;
}

export function ChartTooltipContent({ indicator }: { indicator?: string }) {
    return (
        <div className="bg-card p-2 rounded shadow">
            <div className="text-sm">{indicator || ""}</div>
        </div>
    );
}

export default ChartContainer;
