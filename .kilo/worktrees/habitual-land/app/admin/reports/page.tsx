import ComprehensiveReports from "@/components/ComprehensiveReports";
import DashboardShell from "@/components/DashboardShell";

export const metadata = {
    title: "Reports",
};

export default function ReportsPage() {
    return (
        <DashboardShell>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-4">Reports</h1>
                <ComprehensiveReports />
            </div>
        </DashboardShell>
    );
}
