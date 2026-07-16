import DashboardShell from "@/components/DashboardShell";
import SitesClient from "@/components/SitesClient";

export default function AdminSitesPage() {
    return (
        <DashboardShell>
            <div className="mx-auto max-w-7xl py-8 px-6">
                <SitesClient />
            </div>
        </DashboardShell>
    );
}
