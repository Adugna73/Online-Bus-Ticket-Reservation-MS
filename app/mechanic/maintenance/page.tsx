import DashboardShell from "@/components/DashboardShell";
import GarageManagement from "@/components/GarageManagement";

export default function MechanicMaintenancePage() {
    return (
        <DashboardShell>
            <div className="w-full py-8 px-4 md:px-6">
                <h1 className="text-2xl font-semibold mb-6">
                    Maintenance &amp; Garage Service
                </h1>

                <div className="mb-10 rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
                    <h2 className="text-xl font-semibold mb-1">
                        Garage &amp; Vehicle Maintenance
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Manage garages, schedule vehicle maintenance, track parts
                        needing service, owner pickup/drop-off dates, and mechanic
                        status updates.
                    </p>
                    <GarageManagement />
                </div>
            </div>
        </DashboardShell>
    );
}
