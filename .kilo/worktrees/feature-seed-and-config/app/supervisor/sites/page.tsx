import DashboardShell from "@/components/DashboardShell";
import SitesClient from "@/components/SitesClient";

// NOTE: GET handler has been moved to a dedicated route.ts file in the
// same folder. Keeping it here triggered dynamic recompilation on every
// visit, which caused the "compiling" overlay to linger. The page now
// simply renders the UI component.

export default function StaffSitesPage() {
    return (
        <DashboardShell>
            <div className="mx-auto max-w-7xl py-8 px-6">
                <SitesClient />
            </div>
        </DashboardShell>
    );
}
