import DashboardShell from "@/components/DashboardShell";
import RoutesManagementClient from "@/components/RoutesManagementClient";

export default function SupervisorRoutesPage() {
    return (
        <DashboardShell>
            <div className="mx-auto w-full max-w-7xl px-6 py-8">
                <RoutesManagementClient />
            </div>
        </DashboardShell>
    );
}
