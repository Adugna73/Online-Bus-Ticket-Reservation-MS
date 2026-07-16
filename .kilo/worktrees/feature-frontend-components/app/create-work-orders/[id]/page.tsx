import WorkOrderDetails from "@/components/WorkOrderDetails";

export default async function WorkOrderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return (
        <div className="max-w-7xl mx-auto py-8 px-6">
            <WorkOrderDetails id={id} />
        </div>
    );
}
