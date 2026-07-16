export const dynamic = "force-dynamic";
import TeamClientWithState from "@/components/TeamClientWithState";
import DashboardShell from "@/components/DashboardShell";
import { cookies } from "next/headers";

async function fetchOrganization() {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookie = allCookies
        .map(({ name, value }) => `${name}=${value}`)
        .join("; ");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/team/organization`, {
        headers: { Cookie: cookie },
        cache: "no-store",
    });
    if (!res.ok) throw new Error("Failed to fetch organization data");
    return res.json();
}

export default async function TeamPage() {
    let organization = {};
    try {
        organization = await fetchOrganization();
    } catch (e) {
        // eslint-disable-next-line no-console
        console.log("[StaffTeamPage] fetch error:", e);
    }

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-6">
                <h1 className="text-2xl font-semibold mb-6">Team</h1>
                <TeamClientWithState
                    organization={organization}
                    visibleTeam={[]}
                    canEdit={true}
                />
            </div>
        </DashboardShell>
    );
}
