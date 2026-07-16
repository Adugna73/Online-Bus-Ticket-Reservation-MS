"use client";

import WorkOrdersClient from "@/components/WorkOrdersClient";
import { useSession } from "next-auth/react";
import { Suspense } from "react";
import DashboardShell from "@/components/DashboardShell";

function ProcessingWorkOrdersContent() {
    const { data: session } = useSession();
    const role = (session?.user as any)?.role ?? "Passenger";

    return (
        <div className="max-w-7xl mx-auto py-8 px-6">
            <h1 className="text-2xl font-semibold mb-6">Processing Bookings</h1>
            <p className="text-gray-600 mb-4">
                Bookings created by you that need bus assignment, payment
                verification, and travel readiness checks.
            </p>
            <WorkOrdersClient filterType="processing" />
        </div>
    );
}

export default function ProcessingWorkOrdersPage() {
    return (
        <DashboardShell>
            <Suspense
                fallback={
                    <div className="max-w-7xl mx-auto py-8 px-6">
                        <div className="text-center">Loading...</div>
                    </div>
                }
            >
                <ProcessingWorkOrdersContent />
            </Suspense>
        </DashboardShell>
    );
}
