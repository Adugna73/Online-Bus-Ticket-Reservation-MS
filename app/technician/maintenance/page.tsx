import fs from "fs";
import path from "path";
import DashboardShell from "@/components/DashboardShell";

export const metadata = {
    title: "Passenger Trips & Schedules Templates",
};

export default function PassengerMaintenancePage() {
    const file = path.join(process.cwd(), "data", "maintenance-templates.json");
    const raw = fs.readFileSync(file, "utf-8");
    const templates = JSON.parse(raw) as any[];

    return (
        <DashboardShell>
            <div className="w-full py-8 px-4 md:px-6">
                <h1 className="text-2xl font-semibold mb-6">
                    Trips & Schedules Templates
                </h1>
                <p className="text-sm text-muted mb-4">
                    View planned trip templates assigned in the system. Bookings
                    for you will appear under your Bookings pages.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((t) => (
                        <div
                            key={t.id}
                            className="bg-background text-foreground p-4 rounded shadow"
                        >
                            <div className="flex justify-between">
                                <div>
                                    <div className="font-semibold">
                                        {t.name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        {t.description}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <a
                                        href={`/maintenance/${t.id}`}
                                        className="border border-border rounded-md px-4 py-2 [background:var(--button-background)] [color:var(--button-foreground)]"
                                    >
                                        Open
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardShell>
    );
}
