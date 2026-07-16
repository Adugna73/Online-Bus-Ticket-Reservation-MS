"use client";

import { Badge } from "../ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface Totals {
    createdCount?: number;
    assignedCount?: number;
    inProgressCount?: number;
    completedCount?: number;
}

export function SectionCards({ totals }: { totals: Totals }) {
    const cards = [
        {
            title: "New (To Assign)",
            value: totals.createdCount ?? 0,
            hint: "Waiting assignment",
            trend: "+0%",
            trendPositive: true,
        },
        {
            title: "Assigned",
            value: totals.assignedCount ?? 0,
            hint: "Has an owner",
            trend: "+0%",
            trendPositive: true,
        },
        {
            title: "In Progress",
            value: totals.inProgressCount ?? 0,
            hint: "Actively being worked",
            trend: "~",
            trendPositive: true,
        },
        {
            title: "Completed",
            value: totals.completedCount ?? 0,
            hint: "Finished this period",
            trend: "+0%",
            trendPositive: true,
        },
    ];

    return (
        <div className="grid grid-cols-1 gap-4 px-2 sm:px-0 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.title} className="@container/card">
                    <CardHeader className="space-y-2">
                        <CardDescription>{card.title}</CardDescription>
                        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                            {card.value}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{card.trend}</Badge>
                            <span>{card.hint}</span>
                        </div>
                    </CardHeader>
                </Card>
            ))}
        </div>
    );
}

export default SectionCards;
