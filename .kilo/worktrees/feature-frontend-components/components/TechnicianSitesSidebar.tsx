"use client";
import React, { useEffect, useState } from "react";

export default function PassengerSitesSidebar() {
    const [stations, setSites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSites() {
            setLoading(true);
            try {
                const resp = await fetch("/api/team/organization");
                if (resp.ok) {
                    const org = await resp.json();
                    // Find the supervisor for the current passenger
                    const session = (
                        await import("next-auth/react")
                    ).useSession();
                    // This is a hack: in a real app, pass supervisorId as prop or get from context
                    // For now, flatten all supervisors and their stations
                    let allSites: any[] = [];
                    Object.values(org).forEach((region: any) => {
                        Object.values(region.areas || {}).forEach((supList) => {
                            if (Array.isArray(supList)) {
                                supList.forEach((sup: any) => {
                                    if (Array.isArray(sup.stations)) {
                                        allSites = allSites.concat(
                                            sup.stations.map((site: any) => ({
                                                ...site,
                                                supervisorName: sup.name,
                                            })),
                                        );
                                    }
                                });
                            }
                        });
                    });
                    setSites(allSites);
                }
            } catch (e) {
                setSites([]);
            }
            setLoading(false);
        }
        fetchSites();
    }, []);

    if (loading) return <div className="p-4 text-sm">Loading stations...</div>;
    if (!stations.length)
        return (
            <div className="p-4 text-sm">
                No stations found under your supervisor.
            </div>
        );

    return (
        <div className="p-4">
            <h4 className="font-semibold mb-2 text-base">
                Sites Under Your Staff
            </h4>
            <ul className="space-y-2">
                {stations.map((site) => (
                    <li key={site.id} className="border rounded p-2 bg-base">
                        <div className="font-medium">
                            {site.name} ({site.siteCode})
                        </div>
                        <div className="text-xs text-muted-foreground">
                            NE: {site.neNameAndId || "N/A"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            Staff: {site.supervisorName}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
