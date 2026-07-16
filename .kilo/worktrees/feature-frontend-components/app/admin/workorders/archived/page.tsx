import WorkOrdersClient from "@/components/WorkOrdersClient";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import DashboardShell from "@/components/DashboardShell";

export default async function ArchivedWorkOrdersPage() {
    await getServerSession();

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-6">
                <h1 className="text-2xl font-semibold mb-6">
                    Archived Bookings
                </h1>
                <Suspense fallback={<div className="text-center">Loading...</div>}>
                    <WorkOrdersClient filterType="archived" />
                </Suspense>
            </div>
        </DashboardShell>
    );
}
