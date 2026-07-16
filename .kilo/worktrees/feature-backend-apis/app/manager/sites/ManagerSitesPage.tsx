import DashboardShell from "@/components/DashboardShell";
import SitesClientWrapper from "./SitesClientWrapper";

export default function ManagerSitesPage(props: any) {
    return (
        <DashboardShell>
            <div className="mx-auto max-w-screen-2xl px-4 py-3 md:px-8 lg:px-10 bg-background text-foreground">
                <h1 className="text-2xl font-semibold mb-6">Sites / NE</h1>
                <SitesClientWrapper {...props} />
            </div>
        </DashboardShell>
    );
}
