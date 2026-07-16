"use client";
// DEBUG: Log assigned regions/zones and site region/zone for troubleshooting
// useEffect(() => {
//   if (stations.length > 0) {
//     console.log('Assigned Regions:', assignedRegions);
//     console.log('Assigned Zones:', assignedZones);
//     stations.forEach(site => {
//       console.log(`Site: ${site.name}, regionId: ${site.regionId}, zoneId: ${site.zoneId}`);
//     });
//   }
// }, [stations, assignedRegions, assignedZones]);
import React, { useEffect, useState } from "react";

interface Site {
    id: string;
    name: string;
    siteCode: string;
    neNameAndId?: string;
    regionId?: string;
    zoneId?: string;
    supervisorSiteId?: string;
    supervisorName?: string;
}
interface Staff {
    id: string;
    name: string;
}
interface Region {
    id: string;
    name: string;
}
interface Zone {
    id: string;
    name: string;
    regionId: string;
}

export default function SitesManagerPage({ session }: { session: any }) {
    const [stations, setSites] = useState<Site[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [supervisors, setManager] = useState<Staff[]>([]);
    const [regionFilter, setRegionFilter] = useState<string>("");
    const [zoneFilter, setZoneFilter] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [showAddSite, setShowAddSite] = useState(false);
    // Get manager's assigned regions/zones (IDs)
    const assignedRegionIds: string[] = React.useMemo(() => (
        Array.isArray(session?.user?.assignedRegion)
            ? session.user.assignedRegion
            : []
    ), [session?.user?.assignedRegion]);
    const assignedZoneIds: string[] = Array.isArray(session?.user?.assignedZone)
        ? session.user.assignedZone
        : [];
    // Helper: get region/zone names for API queries
    const assignedRegionNames = regions
        .filter((r) => assignedRegionIds.includes(r.id))
        .map((r) => r.name);
    const assignedZoneNames = zones
        .filter((z) => assignedZoneIds.includes(z.id))
        .map((z) => z.name);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            // Fetch regions and zones first to get names
            const [regionsR, zonesR, orgR] = await Promise.all([
                fetch("/api/regions"),
                fetch("/api/zones"),
                fetch("/api/team/organization"),
            ]);
            const regionsData = regionsR.ok ? await regionsR.json() : [];
            const zonesData = zonesR.ok ? await zonesR.json() : [];
            setRegions(regionsData);
            setZones(zonesData);
            // Get assigned region/zone names for query
            const regionNames = regionsData
                .filter((r: Region) => assignedRegionIds.includes(r.id))
                .map((r: Region) => r.name);
            const zoneNames = zonesData
                .filter((z: Zone) => assignedZoneIds.includes(z.id))
                .map((z: Zone) => z.name);
            // Build query for all assigned region/zone names
            const regionQs = regionNames
                .map((r: string) => `region=${encodeURIComponent(r)}`)
                .join("&");
            const zoneQs = zoneNames
                .map((z: string) => `zone=${encodeURIComponent(z)}`)
                .join("&");
            const query = [regionQs, zoneQs].filter(Boolean).join("&");
            const stationsR = await fetch(`/api/stations?${query}`);
            setSites(stationsR.ok ? await stationsR.json() : []);
            // Use organization API which is already scoped to the current manager
            const orgData = orgR.ok ? await orgR.json() : {};
            const supervisorMap = new Map<string, Staff>();
            Object.values(orgData || {}).forEach((region: any) => {
                Object.values(region?.areas || {}).forEach((supList: any) => {
                    (supList || []).forEach((sup: any) => {
                        if (!sup?.id) return;
                        supervisorMap.set(sup.id, {
                            id: sup.id,
                            name: sup.name,
                        });
                    });
                });
            });
            setManager(Array.from(supervisorMap.values()));
            setLoading(false);
        }
        fetchData();
    }, [assignedRegionIds, assignedZoneIds]);

    // Strictly filter stations to only those in assigned regions/zones, and by selected region/zone
    const filteredSites = stations.filter((site) => {
        // Only show stations in assigned regions and assigned zones (by ID)
        const inAssignedRegion =
            assignedRegionIds.length === 0 ||
            (site.regionId !== undefined &&
                assignedRegionIds.includes(site.regionId));
        const inAssignedZone =
            assignedZoneIds.length === 0 ||
            (site.zoneId && assignedZoneIds.includes(site.zoneId));
        const regionMatch = !regionFilter || site.regionId === regionFilter;
        const zoneMatch = !zoneFilter || site.zoneId === zoneFilter;
        return inAssignedRegion && inAssignedZone && regionMatch && zoneMatch;
    });

    const handleAssign = async (siteId: string, supervisorId: string) => {
        await fetch(`/api/stations/${siteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supervisorSiteId: supervisorId }),
        });
        setSites((stations) =>
            stations.map((s) =>
                s.id === siteId
                    ? { ...s, supervisorSiteId: supervisorId }
                    : s,
            ),
        );
    };

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center gap-4">
                <button
                    onClick={() => window.history.back()}
                    className="text-primary underline hover:text-primary/80"
                >
                    &larr; Back
                </button>
                <h2 className="text-xl font-semibold">Sites / NE Management</h2>
            </div>
            {/* List of manager's supervisors */}
            <div className="mb-4">
                <div className="font-semibold mb-1">
                    Manager in Your Region(s):
                </div>
                <ul className="flex flex-wrap gap-2">
                    {supervisors.length === 0 ? (
                        <li className="text-xs text-muted-foreground">
                            No supervisors found.
                        </li>
                    ) : (
                        supervisors.map((sup) => (
                            <li
                                key={sup.id}
                                className="px-2 py-1 bg-muted rounded text-xs"
                            >
                                {sup.name}
                            </li>
                        ))
                    )}
                </ul>
            </div>
            <div className="flex gap-4 mb-4 items-center">
                {/* Region filter: only show dropdown if multiple assigned, else show static label */}
                {assignedRegionIds.length > 1 ? (
                    <select
                        value={regionFilter}
                        onChange={(e) => {
                            setRegionFilter(e.target.value);
                            setZoneFilter("");
                        }}
                        className="border rounded p-2"
                    >
                        {regions
                            .filter((r) => assignedRegionIds.includes(r.id))
                            .map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                    </select>
                ) : (
                    <span className="border rounded p-2 bg-muted">
                        {regions.find((r) => r.id === assignedRegionIds[0])
                            ?.name || "No Region"}
                    </span>
                )}
                {/* Zone filter: only show dropdown if multiple assigned, else show static label */}
                {assignedZoneIds.length > 1 ? (
                    <select
                        value={zoneFilter}
                        onChange={(e) => setZoneFilter(e.target.value)}
                        className="border rounded p-2"
                    >
                        {zones
                            .filter(
                                (z) =>
                                    (!regionFilter ||
                                        z.regionId === regionFilter) &&
                                    assignedZoneIds.includes(z.id),
                            )
                            .map((z) => (
                                <option key={z.id} value={z.id}>
                                    {z.name}
                                </option>
                            ))}
                    </select>
                ) : assignedZoneIds.length === 1 ? (
                    <span className="border rounded p-2 bg-muted">
                        {zones.find((z) => z.id === assignedZoneIds[0])?.name ||
                            "No Zone"}
                    </span>
                ) : null}
                <button
                    onClick={() => setShowAddSite(true)}
                    className="ml-auto et-primary-button"
                >
                    Add New Site
                </button>
            </div>
            {/* Add Site Modal */}
            {showAddSite && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-background p-6 rounded-lg shadow-lg border max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4">
                            Add New Site
                        </h3>
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.target as any;
                                const name = form.name.value;
                                const siteCode = form.siteCode.value;
                                const neNameAndId = form.neNameAndId.value;
                                const regionId = form.regionId.value;
                                const zoneId = form.zoneId.value;
                                const latitude = form.latitude.value;
                                const longitude = form.longitude.value;
                                const zoneRegionId = zoneId
                                    ? zones.find((z) => z.id === zoneId)
                                          ?.regionId || ""
                                    : "";
                                const resolvedRegionId =
                                    regionId || zoneRegionId;
                                if (!resolvedRegionId) {
                                    alert(
                                        "Region is required (or select a zone).",
                                    );
                                    return;
                                }
                                await fetch("/api/stations", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        name,
                                        siteCode,
                                        neNameAndId,
                                        regionId: resolvedRegionId,
                                        zoneId,
                                        latitude: latitude || null,
                                        longitude: longitude || null,
                                    }),
                                });
                                setShowAddSite(false);
                                // Refresh stations
                                setLoading(true);
                                const stationsR = await fetch(
                                    `/api/stations?region=${regionId}${zoneId ? `&zone=${zoneId}` : ""}`,
                                );
                                setSites(stationsR.ok ? await stationsR.json() : []);
                                setLoading(false);
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Site Name
                                </label>
                                <input
                                    name="name"
                                    required
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Site Code
                                </label>
                                <input
                                    name="siteCode"
                                    required
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    NE Name(s)
                                </label>
                                <input
                                    name="neNameAndId"
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Region
                                </label>
                                <select
                                    name="regionId"
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="">Select region</option>
                                    {regions
                                        .filter(
                                            (r) =>
                                                assignedRegionIds.includes(
                                                    r.id,
                                                ) && !/(AAZ|HQ)/i.test(r.name),
                                        )
                                        .map((r) => (
                                            <option key={r.id} value={r.id}>
                                                {r.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Zone
                                </label>
                                <select
                                    name="zoneId"
                                    className="w-full p-2 border rounded"
                                >
                                    <option value="">None</option>
                                    {zones
                                        .filter((z) =>
                                            assignedZoneIds.includes(z.id),
                                        )
                                        .map((z) => (
                                            <option key={z.id} value={z.id}>
                                                {z.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Latitude
                                    </label>
                                    <input
                                        name="latitude"
                                        className="w-full p-2 border rounded"
                                        placeholder="e.g. 9.002111"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Longitude
                                    </label>
                                    <input
                                        name="longitude"
                                        className="w-full p-2 border rounded"
                                        placeholder="e.g. 38.767056"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button
                                    type="submit"
                                    className="et-primary-button flex-1"
                                >
                                    Add Site
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddSite(false)}
                                    className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                    <thead>
                        <tr className="bg-muted">
                            <th className="p-2 border">Site Name</th>
                            <th className="p-2 border">Site Code</th>
                            <th className="p-2 border">NE Name(s)</th>
                            <th className="p-2 border">Staff</th>
                            <th className="p-2 border">Assign/Reassign</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-4 text-center">
                                    Loading...
                                </td>
                            </tr>
                        ) : filteredSites.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-4 text-center">
                                    No stations found.
                                </td>
                            </tr>
                        ) : (
                            filteredSites.map((site) => (
                                <tr key={site.id}>
                                    <td className="p-2 border">{site.name}</td>
                                    <td className="p-2 border">
                                        {site.siteCode}
                                    </td>
                                    <td className="p-2 border">
                                        {site.neNameAndId || "N/A"}
                                    </td>
                                    <td className="p-2 border">
                                        {supervisors.find(
                                            (s) =>
                                                s.id ===
                                                site.supervisorSiteId,
                                        )?.name || "Unassigned"}
                                    </td>
                                    <td className="p-2 border">
                                        <select
                                            value={
                                                site.supervisorSiteId || ""
                                            }
                                            onChange={(e) =>
                                                handleAssign(
                                                    site.id,
                                                    e.target.value,
                                                )
                                            }
                                            className="border rounded p-1"
                                        >
                                            <option value="">Unassigned</option>
                                            {supervisors.map((sup) => (
                                                <option
                                                    key={sup.id}
                                                    value={sup.id}
                                                >
                                                    {sup.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
