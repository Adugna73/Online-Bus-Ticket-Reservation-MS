"use client";

import DashboardShell from "@/components/DashboardShell";
import TrendDashboard from "@/components/TrendDashboard";

export default function PassengerDashboardPage() {
    return (
        <DashboardShell>
            <div className="flex-1">
                <TrendDashboard />
            </div>
        </DashboardShell>
    );
}
