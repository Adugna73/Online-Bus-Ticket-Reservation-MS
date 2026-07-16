import TeamClientWithState from "@/components/TeamClientWithState";
import DashboardShell from "@/components/DashboardShell";
import DashboardCard from "@/components/DashboardCard";
import { cookies } from "next/headers";

import { type RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";

import { headers } from "next/headers";

async function fetchOrganization() {
    // build a base url from the request headers so we try to hit the exact
    // same origin the client used.  However this can fail when the host is
    // a container network address (172.*) that the Node runtime can't reach,
    // so we fall back to localhost if necessary.
    const h = await headers();
    // `headers()` can return either a Headers-like object with .get,
    // or a plain record depending on the runtime.  Normalize so we
    // don't crash when `.get` is missing (see earlier TypeError).
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
    const cookie = allCookies
        .map(({ name, value }) => `${name}=${value}`)
        .join("; ");

    async function doFetch(base: string) {
        const res = await fetch(`${base}/api/team/organization`, {
            headers: { Cookie: cookie },
            cache: "no-store",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
    }

    try {
        return await doFetch(candidate);
    } catch (err: any) {
        console.error("fetchOrganization failed for", candidate, err);
        if (!candidate.includes("localhost")) {
            try {
                return await doFetch("http://localhost:3000");
            } catch (err2) {
                console.error(
                    "fetchOrganization fallback localhost failed",
                    err2,
                );
            }
        }
        // give up and return empty object so caller shows warning
        return {};
    }
}

export default async function ManagerTeamPage() {
    let organization = {};
    let debugUser = null;
    try {
        organization = await fetchOrganization();
        // Try to get session user info for debugging; re-use same baseUrl & cookies
        try {
            const h2 = await headers();
            const getHeader2 = (name: string) => {
                if (h2 && typeof (h2 as any).get === "function") {
                    return (h2 as any).get(name);
                }
                return (h2 as any)[name.toLowerCase()] || null;
            };
            const host2 = getHeader2("host") || "localhost:3000";
            const proto2 = getHeader2("x-forwarded-proto") || "http";
            const baseUrl2 = `${proto2}://${host2}`;
            const cookieStore2 = await cookies();
            const all2 = cookieStore2.getAll();
            const cookieHeader = all2
                .map((c) => `${c.name}=${c.value}`)
                .join("; ");

            const res = await fetch(`${baseUrl2}/api/auth/session`, {
                headers: { Cookie: cookieHeader },
            });
            if (res.ok) debugUser = await res.json();
        } catch (err) {
            debugUser = { error: String(err) };
        }
        // eslint-disable-next-line no-console
        console.log("[ManagerTeamPage] organization:", organization);
        // eslint-disable-next-line no-console
        console.log("[ManagerTeamPage] session user:", debugUser);
    } catch (e) {
        // fallback: empty org
        // eslint-disable-next-line no-console
        console.log("[ManagerTeamPage] fetch error:", e);
    }
    return (
        <DashboardShell>
            <div className="mx-auto max-w-screen-2xl px-4 py-3 md:px-8 lg:px-10 bg-background text-foreground">
                <h1 className="text-2xl font-semibold mb-6">Team</h1>
                {/* summary cards showing counts for manager */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <DashboardCard
                        title="Regions"
                        value={Object.keys(organization).length}
                    />
                    {/* count supervisors visible to this manager */}
                    <DashboardCard
                        title="Manager"
                        value={(() => {
                            let count = 0;
                            for (const region of Object.values(organization)) {
                                const regs: any = region as any;
                                for (const areaSup of Object.values(
                                    regs.areas || {},
                                )) {
                                    count += (areaSup as any[]).length;
                                }
                            }
                            return count;
                        })()}
                    />
                    {/* count passengers under those supervisors */}
                    <DashboardCard
                        title="Passengers"
                        value={(() => {
                            let tcount = 0;
                            for (const region of Object.values(organization)) {
                                const regs: any = region as any;
                                for (const areaSup of Object.values(
                                    regs.areas || {},
                                )) {
                                    for (const sup of areaSup as any[]) {
                                        tcount += sup.passengers?.length || 0;
                                    }
                                }
                            }
                            return tcount;
                        })()}
                    />
                </div>
                <TeamClientWithState
                    organization={organization}
                    canEdit={true}
                />
            </div>
        </DashboardShell>
    );
}
