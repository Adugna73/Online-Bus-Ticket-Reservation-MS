import WorkOrdersClient from "@/components/WorkOrdersClient";
import { getServerSession } from "next-auth";

export default async function WorkOrdersPage() {
    const session = await getServerSession();
    const role = (session?.user as any)?.role ?? "Passenger";
    const title = role === "Passenger" ? "Assigned Tasks" : "Bookings";
    return (
        <div className="max-w-7xl mx-auto py-8 px-6">
            <h1 className="text-2xl font-semibold mb-6">{title}</h1>
            <WorkOrdersClient />
        </div>
    );
}
