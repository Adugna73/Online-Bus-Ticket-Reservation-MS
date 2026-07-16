import React from "react";
import WorkOrderDetails from "@/components/WorkOrderDetails";

export default async function WorkOrderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="p-4">
            <WorkOrderDetails id={id} />
        </div>
    );
}
