import DashboardShell from "@/components/DashboardShell";
import TeamClient from "@/components/TeamClient";
import PassengerSitesSidebar from "@/components/PassengerSitesSidebar";

export const metadata = {
    title: "Passenger Team",
};

export default function PassengerTeamPage() {
    return (
        <DashboardShell>
            <div className="flex flex-col md:flex-row max-w-7xl mx-auto py-8 px-6 gap-6">
                <div className="w-full md:w-1/3 lg:w-1/4">
                    <PassengerSitesSidebar />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-semibold mb-6">
                        Team & Organization
                    </h1>
                    <TeamClient />
                </div>
            </div>
        </DashboardShell>
    );
}
