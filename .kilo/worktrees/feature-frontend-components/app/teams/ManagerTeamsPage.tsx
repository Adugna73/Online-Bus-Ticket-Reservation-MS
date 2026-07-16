import DashboardShell from "@/components/DashboardShell";
import TeamClientWithState from "@/components/TeamClientWithState";

export default function ManagerTeamPage(props: any) {
    // Debug: log organization data
    if (typeof window !== "undefined") {
        // Only log on client
        // eslint-disable-next-line no-console
        console.log(
            "[ManagerTeamPage] organization prop:",
            props.organization,
        );
    }
    return (
        <DashboardShell>
            <div className="mx-auto max-w-screen-2xl px-4 py-3 md:px-8 lg:px-10 bg-background text-foreground">
                <h1 className="text-2xl font-semibold mb-6">Team</h1>
                {/* Debug output for organization data */}
                <pre
                    style={{
                        background: "#222",
                        color: "#0f0",
                        padding: "1em",
                        overflow: "auto",
                        maxHeight: 200,
                    }}
                >
                    {JSON.stringify(props.organization, null, 2)}
                </pre>
                <TeamClientWithState {...props} canEdit={true} />
            </div>
        </DashboardShell>
    );
}
