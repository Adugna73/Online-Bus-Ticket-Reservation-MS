import DashboardShell from "@/components/DashboardShell";
import BusManagementClient from "@/components/BusManagementClient";

export default function SupervisorBusesPage() {
    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-4 md:px-8 lg:px-10 bg-background text-foreground">
                <h2 className="text-lg font-semibold tracking-tight">
                    Bus Management
                </h2>
                <p className="text-xs text-muted-foreground">
                    Update bus details, amenities, safety checks, and assign
                    trips.
                </p>
                <div className="mt-4">
                    <BusManagementClient />
                </div>
            </div>
        </DashboardShell>
    );
}
