"use client";

import DashboardShell from "@/components/DashboardShell";
import PreventiveMaintenanceDashboard from "@/components/PreventiveMaintenanceDashboard";

export default function PassengerDashboardPage() {
    return (
        <DashboardShell>
            <div className="flex-1">
                <PreventiveMaintenanceDashboard />
            </div>
        </DashboardShell>
    );
}
