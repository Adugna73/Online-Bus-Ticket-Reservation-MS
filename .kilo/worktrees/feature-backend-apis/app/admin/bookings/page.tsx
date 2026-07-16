import { Suspense } from "react";

import DashboardShell from "@/components/DashboardShell";
import { WorkOrdersTableClient } from "@/components/workorders-table/WorkOrdersTableClient";

export default function AdminBookingsPage() {
    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-3 md:px-8 lg:px-10 bg-background text-foreground">
                <Suspense
                    fallback={
                        <div className="rounded border bg-card p-6 text-center text-muted-foreground">
                            Loading bookings...
                        </div>
                    }
                >
                    <WorkOrdersTableClient />
                </Suspense>
            </div>
        </DashboardShell>
    );
}
