import TeamClientWithState from "@/components/TeamClientWithState";
import AdminTeamManagerGrid from "@/components/AdminTeamManagerGrid";
import AdminTeamCard from "@/components/AdminTeamCard";
import DashboardShell from "@/components/DashboardShell";
import { Users } from "lucide-react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { headers, cookies } from "next/headers";

async function fetchWithSession(path: string) {
    const h = await headers();
    const getHeader = (name: string) => {
        if (h && typeof (h as any).get === "function") {
            return (h as any).get(name);
        }
        return (h as any)[name.toLowerCase()] || null;
    };
    const host = getHeader("host") || "localhost:3000";
    const proto = getHeader("x-forwarded-proto") || "http";
    const candidate = `${proto}://${host}`;

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies
        .map(({ name, value }) => `${name}=${value}`)
        .join("; ");

    async function doFetch(base: string) {
        const res = await fetch(`${base}${path}`, {
            headers: { Cookie: cookieHeader },
            cache: "no-store",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
    }

    try {
        return await doFetch(candidate);
    } catch (err) {
        console.error("fetchWithSession failed for", candidate, err);
        if (!candidate.includes("localhost")) {
            try {
                return await doFetch("http://localhost:3000");
            } catch (err2) {
                console.error(
                    "fetchWithSession localhost fallback failed",
                    err2,
                );
            }
        }
        return path.includes("/team/organization") ? {} : [];
    }
}

export default async function TeamPage() {
    const session = await getServerSession(authOptions as any);
    const [organization, visibleTeam] = await Promise.all([
        fetchWithSession("/api/team/organization"),
        fetchWithSession("/api/team"),
    ]);

    // Extract managers from organization data
    const managers: any[] = [];
    for (const [regionCode, region] of Object.entries(organization)) {
        const typedRegion = region as {
            manager?: any;
            areas?: Record<string, any>;
        };
        if (typedRegion.manager) {
            managers.push({
                ...typedRegion.manager,
                regions: [regionCode],
                zones: Object.keys(typedRegion.areas || {}),
            });
        }
    }

    // Helper to get supervisors for a manager
    function getManagerForManager(managerId: string) {
        const supervisors: any[] = [];
        for (const [regionCode, region] of Object.entries(organization)) {
            const typedRegion = region as {
                manager?: any;
                areas?: Record<string, any>;
            };
            if (typedRegion.manager && typedRegion.manager.id === managerId) {
                for (const areaSupers of Object.values(
                    typedRegion.areas || {},
                )) {
                    supervisors.push(...areaSupers);
                }
            }
        }
        return supervisors;
    }

    // Render supervisors grid (can reuse TeamClient for details, or custom)
    function renderManagerGrid(supervisors: any[], manager: any) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {supervisors.map((sup) => (
                    <div
                        key={sup.id}
                        className="p-4 bg-background border rounded"
                    >
                        <div className="font-bold text-lg mb-1 flex items-center gap-2">
                            <Users className="h-5 w-5" /> {sup.name}
                        </div>
                        <div className="text-sm text-foreground mb-1">
                            Email: {sup.email}
                        </div>
                        <div className="text-sm text-foreground mb-1">
                            Location:{" "}
                            {sup.location || sup.locationCategory || "-"}
                        </div>
                        <div className="text-sm text-foreground mb-1">
                            Staff ID: {sup.staffId || "-"}
                        </div>
                        {/* Add more supervisor details/actions as needed */}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-8 px-6">
                <h1 className="text-2xl font-semibold mb-6">Team</h1>
                {/* Explicit team list so HQ-Microwave admin team (e.g. Buzayehu/Fekadu) has its own page */}
                {Array.isArray(visibleTeam) && visibleTeam.length > 0 && (
                    <div className="mt-10">
                        <h2 className="text-xl font-semibold mb-4">
                            All Team
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {visibleTeam.map((team: any) => (
                                <AdminTeamCard key={team.id} team={team} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Region managers and their supervisors/passengers */}
                <div className="mt-10">
                    <AdminTeamManagerGrid
                        managers={managers}
                        organization={organization}
                    />
                </div>
            </div>
        </DashboardShell>
    );
}
