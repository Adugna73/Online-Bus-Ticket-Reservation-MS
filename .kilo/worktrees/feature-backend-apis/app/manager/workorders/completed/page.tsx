import WorkOrdersClient from "@/components/WorkOrdersClient";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import DashboardShell from "@/components/DashboardShell";

export default async function CompletedWorkOrdersPage() {
    // server-side session read (not used here but reserved for future server-side behavior)
    // keep page as server component and render client `WorkOrdersClient` inside Suspense
    await getServerSession();

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-6">
                <h1 className="text-2xl font-semibold mb-6">
                    Completed Bookings
                </h1>
                <Suspense
                    fallback={<div className="text-center">Loading...</div>}
                >
                    <WorkOrdersClient filterType="completed" />
                </Suspense>
            </div>
        </DashboardShell>
    );
}
