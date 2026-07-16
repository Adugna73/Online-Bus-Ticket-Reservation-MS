"use client";
import React from "react";

export default function DashboardCard({
    title,
    value,
    color = "bg-white",
}: {
    title: string;
    value: string | number;
    color?: string;
}) {
    return (
        <div className={`p-3 rounded-md shadow-sm ${color}`}>
            <div className="text-[11px] text-gray-500 tracking-tight">
                {title}
            </div>
            <div className="text-xl font-semibold leading-tight">{value}</div>
        </div>
    );
}
