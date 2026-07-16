import fs from "fs";
import path from "path";
import Link from "next/link";
import DashboardShell from "@/components/DashboardShell";

export default async function StaffMaintenancePage() {
    const file = path.join(process.cwd(), "data", "maintenance-templates.json");
    let templates: any[] = [];
    try {
        const raw = fs.readFileSync(file, "utf-8");
        templates = JSON.parse(raw) as any[];
    } catch (e) {
        // fallback: empty list
        console.warn(
            "[supervisor/maintenance] could not read maintenance templates",
            e,
        );
    }

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-4">
                <h1 className="text-2xl font-semibold mb-6">
                    Trips & Schedules Templates
                </h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.length ? (
                        templates.map((t) => (
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
                        ))
                    ) : (
                        <div className="p-6 bg-background rounded text-muted-foreground">
                            No trip templates found.
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
