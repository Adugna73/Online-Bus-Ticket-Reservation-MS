import DashboardShell from "@/components/DashboardShell";
import RoutesManagementClient from "@/components/RoutesManagementClient";
import GarageManagement from "@/components/GarageManagement";

export default function AdminRoutesPage() {
    return (
        <DashboardShell>
            <div className="mx-auto w-full max-w-7xl px-6 py-8">
                <RoutesManagementClient />
                <div className="mt-10">
                    <h2 className="text-xl font-semibold mb-4">
                        Garage &amp; Vehicle Maintenance
                    </h2>
                    <GarageManagement />
                </div>
            </div>
        </DashboardShell>
    );
}
