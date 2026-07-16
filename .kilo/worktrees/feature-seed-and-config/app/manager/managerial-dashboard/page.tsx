export const dynamic = "force-dynamic";

import DashboardShell from "@/components/DashboardShell";
import PreventiveMaintenanceDashboard from "@/components/PreventiveMaintenanceDashboard";

export default function Dashboard() {
    return (
        <DashboardShell>
            <div className="flex-1">
                <PreventiveMaintenanceDashboard />
            </div>
        </DashboardShell>
    );
}
