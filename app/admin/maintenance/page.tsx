import fs from "fs";
import path from "path";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";
import GarageManagement from "@/components/GarageManagement";

export default async function MaintenancePage() {
    let templates: any[] = [];
    try {
        const file = path.join(process.cwd(), "data", "maintenance-templates.json");
        const raw = fs.readFileSync(file, "utf-8");
        templates = JSON.parse(raw) as any[];
    } catch (e) {
        // templates file may not exist
    }

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-4">
                <h1 className="text-2xl font-semibold mb-6">
                    Maintenance &amp; Garage Service
                </h1>

                {/* Garage & Vehicle Maintenance */}
                <div className="mb-10 rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
                    <h2 className="text-xl font-semibold mb-1">
                        Garage &amp; Vehicle Maintenance
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                        Manage garages, schedule vehicle maintenance, track parts
                        needing service, owner pickup/drop-off dates, and mechanic
                        status updates.
                    </p>
                    <GarageManagement />
                </div>

                {/* Trips & Schedules Templates */}
                {templates.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-xl font-semibold mb-4">
                            Trips &amp; Schedules Templates
                        </h2>
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
                                            <Link
                                                href={`/maintenance/${t.id}`}
                                                className="border border-border rounded-md px-4 py-2 w-full md:flex-1 [background:var(--button-background)] [color:var(--button-foreground)]"
                                            >
                                                Open
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
