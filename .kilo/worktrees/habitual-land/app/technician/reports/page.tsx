import DashboardShell from "@/components/DashboardShell";
import ReportsClient from "@/components/ReportsClient";

export const metadata = {
    title: "Passenger Reports",
};

export default function PassengerReportsPage() {
    return (
        <DashboardShell>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Reports</h1>
                <ReportsClient />
            </div>
        </DashboardShell>
    );
}
