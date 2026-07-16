"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    Users,
    ChevronLeft,
    User,
    Building,
    UserCog,
    MapPinned,
    SquarePen,
    UserPlus,
    Trash2,
    Plus,
} from "lucide-react";

export default function AdminTeamManagerGrid({
    managers,
    organization,
}: {
    managers: any[];
    organization: any;
}) {
    const [selectedManager, setSelectedManager] = useState<any | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<any | null>(
        null,
    );
    const [localManager, setLocalManager] = useState<any[]>(managers);
    const [deletedUserIds, setDeletedUserIds] = useState<Set<string>>(
        new Set(),
    );
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
    const [regionSites, setRegionSites] = useState<any[]>([]);
    const [loadingRegionSites, setLoadingRegionSites] = useState(false);
    const [deletedSiteIds, setDeletedSiteIds] = useState<Set<string>>(
        new Set(),
    );
    const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);

    const [staffs, setStaffs] = useState<any[]>([]);
    const [siteInfoEntries, setSiteInfoEntries] = useState<any[]>([]);

    useEffect(() => {
        setLocalManager(managers);
    }, [managers]);

    useEffect(() => {
        import("../data/staffs.under-supervisors.json").then((mod) => {
            setStaffs(mod.default || mod);
        });
    }, []);

    useEffect(() => {
        import("../data/site-info.json").then((mod) => {
            const raw = mod.default || mod;
            const entries = Object.values(raw || {}).flatMap((group: any) =>
                Array.isArray(group) ? group : [],
            );
            setSiteInfoEntries(entries);
        });
    }, []);

    useEffect(() => {
        // derive region/zone from the selected manager or supervisor using
        // our helper functions.  this handles cases where managers only have
        // a zone code (e.g. "SWAAZ") instead of a bare region.
        const activeRegionName =
            (selectedManager && getManagerRegionName(selectedManager)) ||
            (selectedStaff &&
                getStaffRegionName(selectedStaff)) ||
            undefined;

        if (!activeRegionName) {
            setRegionSites([]);
            return;
        }

        setLoadingRegionSites(true);

        // Build requests from the active scope. Regular region managers should
        // only see their own region. HQ is the only scope that needs the extra
        // AAZ zone query. Manager already assigned by zone (for example
        // "SWAAZ") should stay on that exact zone.
        const promises: Promise<any>[] = [];
        const upperScope = activeRegionName.toUpperCase();

        if (upperScope === "HQ") {
            promises.push(fetch(`/api/stations`).then((r) => r.json()));
        } else if (upperScope.endsWith("AAZ")) {
            promises.push(
                fetch(
                    `/api/stations?zone=${encodeURIComponent(activeRegionName)}`,
                ).then((r) => r.json()),
            );
            promises.push(
                fetch(
                    `/api/stations?region=${encodeURIComponent(activeRegionName)}&scope=region`,
                ).then((r) => r.json()),
            );
        } else {
            promises.push(
                fetch(
                    `/api/stations?region=${encodeURIComponent(activeRegionName)}&scope=region`,
                ).then((r) => r.json()),
            );
        }

        Promise.all(promises)
            .then((results) => {
                // results may be arrays or other values; flatten and dedupe by id
                const combined: any[] = [];
                const seen = new Set<string>();
                results.forEach((res) => {
                    if (Array.isArray(res)) {
                        res.forEach((site: any) => {
                            if (site && site.id && !seen.has(site.id)) {
                                seen.add(site.id);
                                combined.push(site);
                            }
                        });
                    }
                });
                setRegionSites(combined);
            })
            .catch((error) => {
                console.error(error);
                setRegionSites([]);
            })
            .finally(() => setLoadingRegionSites(false));
    }, [selectedManager, selectedStaff]);

    function getManagerForManager(managerId: string) {
        const supervisorsById = new Map<string, any>();
        for (const [regionCode, regionUnknown] of Object.entries(
            organization,
        )) {
            const region = regionUnknown as {
                manager?: any;
                areas?: Record<string, any[]>;
            };
            if (region.manager && region.manager.id === managerId) {
                for (const [areaName, areaSupers] of Object.entries(
                    region.areas || {},
                )) {
                    for (const sup of areaSupers) {
                        const existing = supervisorsById.get(sup.id);
                        if (!existing) {
                            supervisorsById.set(sup.id, {
                                ...sup,
                                locationCategory:
                                    sup.locationCategory || regionCode,
                                zones: [areaName],
                            });
                            continue;
                        }

                        const mergedZones = Array.from(
                            new Set(
                                [
                                    ...(existing.zones || []),
                                    areaName,
                                    ...(sup.zones || []),
                                ].filter(Boolean),
                            ),
                        );

                        supervisorsById.set(sup.id, {
                            ...existing,
                            ...sup,
                            zones: mergedZones,
                            locationCategory:
                                existing.locationCategory ||
                                sup.locationCategory ||
                                regionCode,
                        });
                    }
                }
            }
        }
        return Array.from(supervisorsById.values()).filter(
            (sup) => !deletedUserIds.has(String(sup.id)),
        );
    }

    function getLocationByEmail(email: string) {
        if (!email) return undefined;
        const staff = staffs.find(
            (s: any) => s.email?.toLowerCase() === email.toLowerCase(),
        );
        return staff?.location;
    }

    function makeUsersHref({
        scope,
        focusUserId,
        regionName,
        zoneName,
        location,
        createUser,
        defaultRole,
    }: {
        scope?: "manager" | "supervisor" | "passenger";
        focusUserId?: string;
        regionName?: string;
        zoneName?: string;
        location?: string;
        createUser?: boolean;
        defaultRole?: "admin" | "manager" | "supervisor" | "passenger";
    }) {
        const params = new URLSearchParams();
        if (scope) params.set("scope", scope);
        if (focusUserId) params.set("focusUserId", focusUserId);
        if (regionName) params.set("regionName", regionName);
        if (zoneName) params.set("zoneName", zoneName);
        if (location) params.set("location", location);
        if (createUser) params.set("createUser", "1");
        if (defaultRole) params.set("defaultRole", defaultRole);
        const query = params.toString();
        return query ? `/admin/users?${query}` : "/admin/users";
    }

    function makeSitesHref({
        supervisorId,
        regionName,
        zoneName,
        siteSearch,
        createSite,
        editSiteId,
    }: {
        supervisorId?: string;
        regionName?: string;
        zoneName?: string;
        siteSearch?: string;
        createSite?: boolean;
        editSiteId?: string;
    }) {
        const params = new URLSearchParams();
        if (supervisorId) params.set("supervisorId", supervisorId);
        if (regionName) params.set("regionName", regionName);
        if (zoneName) params.set("zoneName", zoneName);
        if (siteSearch) params.set("siteSearch", siteSearch);
        if (createSite) params.set("createSite", "1");
        if (editSiteId) params.set("editSiteId", editSiteId);
        const query = params.toString();
        return query ? `/admin/stations?${query}` : "/admin/stations";
    }

    function getManagerRegionName(manager: any) {
        return manager?.regions?.[0] || manager?.zones?.[0] || undefined;
    }

    function getStaffRegionName(supervisor: any) {
        return (
            selectedManager?.regions?.[0] ||
            selectedManager?.zones?.[0] ||
            supervisor?.locationCategory ||
            undefined
        );
    }

    function getScopeTitle(scopeName?: string) {
        return scopeName ? `${scopeName} - Sites` : "Region Sites";
    }

    function getSiteNeList(site: any) {
        const siteCode = String(site?.siteCode || "").trim();
        const siteName = String(site?.name || "")
            .trim()
            .toLowerCase();
        const neValues = new Set<string>();

        if (site?.neNameAndId) {
            neValues.add(String(site.neNameAndId).trim());
        }

        siteInfoEntries.forEach((entry: any) => {
            const physicalSite = String(entry?.physical_site || "").trim();
            const entrySiteName = String(entry?.site_name || "")
                .trim()
                .toLowerCase();
            const neName = String(entry?.ne_name_and_id || "").trim();

            if (!neName) return;

            const codeMatches = siteCode && physicalSite === siteCode;
            const nameMatches = siteName && entrySiteName === siteName;

            if (codeMatches || nameMatches) {
                neValues.add(neName);
            }
        });

        return Array.from(neValues);
    }

    function getDisplaySiteCards(stations: any[], supervisorId?: string) {
        return stations.flatMap(
            (
                site: any,
            ): Array<{
                key: string;
                site: any;
                siteZoneName: string;
                assignedStaffName: string | null;
                neName: string | null;
            }> => {
                const neList = getSiteNeList(site);
                const siteZoneName = site.zone?.name || site.area?.name || "-";
                const assignedStaffName =
                    site.supervisorSite?.fullName ||
                    site.supervisorSiteName ||
                    (supervisorId &&
                    String(site.supervisorSiteId || "") ===
                        String(supervisorId)
                        ? "Assigned here"
                        : null);

                if (neList.length === 0) {
                    return [
                        {
                            key: `${site.id}-default`,
                            site,
                            siteZoneName,
                            assignedStaffName,
                            neName: null,
                        },
                    ];
                }

                return neList.map((neName) => ({
                    key: `${site.id}-${neName}`,
                    site,
                    siteZoneName,
                    assignedStaffName,
                    neName,
                }));
            },
        );
    }

    function siteMatchesScope(site: any, scopeName?: string) {
        if (!scopeName) return true;

        const upperScope = String(scopeName).toUpperCase();
        const zoneOrArea = String(site?.zone?.name || site?.area?.name || "")
            .trim()
            .toUpperCase();
        const regionName = String(site?.region?.name || "")
            .trim()
            .toUpperCase();

        if (upperScope === "HQ") {
            return (
                zoneOrArea.endsWith("AAZ") ||
                regionName.endsWith("AAZ") ||
                zoneOrArea === "HQ" ||
                regionName === "HQ"
            );
        }

        if (upperScope.endsWith("AAZ")) {
            return zoneOrArea === upperScope || regionName === upperScope;
        }

        if (zoneOrArea) {
            return zoneOrArea === upperScope;
        }

        return regionName === upperScope;
    }

    function getSitesForStaff(supervisor: any) {
        const activeRegionName = getStaffRegionName(supervisor);
        // stations coming from the region query (already scoped via fetch above)
        let stationsByRegion: any[] = [];
        if (activeRegionName) {
            stationsByRegion = regionSites.filter((site: any) => {
                return (
                    !deletedSiteIds.has(String(site.id)) &&
                    siteMatchesScope(site, activeRegionName)
                );
            });
        }
        // also include whatever stations are explicitly assigned to the supervisor
        let assigned = Array.isArray(supervisor.stations)
            ? supervisor.stations.filter(
                  (s: any) => !deletedSiteIds.has(String(s.id)),
              )
            : [];
        // if we have a region filter from the fetch results, restrict assigned
        // stations to that scope as well – prevents supervisors from dragging in
        // stations from other regions when viewed under an admin/manager.
        if (activeRegionName && stationsByRegion.length) {
            const allowed = new Set(
                stationsByRegion.map((s: any) => String(s.id)),
            );
            assigned = assigned.filter((s: any) => allowed.has(String(s.id)));
        }
        // merge unique by id
        const merged: any[] = [];
        const seen = new Set<string>();
        for (const s of [...stationsByRegion, ...assigned]) {
            if (s && s.id && !seen.has(String(s.id))) {
                seen.add(String(s.id));
                merged.push(s);
            }
        }
        return merged;
    }

    function getSitesForManager(manager: any) {
        const activeRegionName = getManagerRegionName(manager);
        let stationsByRegion: any[] = [];
        if (activeRegionName) {
            // regionSites already contains everything we need (region+zone fetches)
            stationsByRegion = regionSites.filter((site: any) => {
                return (
                    !deletedSiteIds.has(String(site.id)) &&
                    siteMatchesScope(site, activeRegionName)
                );
            });
        }
        // gather supervisor-specific assignments
        const supervisors = getManagerForManager(manager.id);
        let supAssigned: any[] = [];
        supervisors.forEach((sup) => {
            if (Array.isArray(sup.stations)) {
                sup.stations.forEach((s: any) => {
                    if (!deletedSiteIds.has(String(s.id))) supAssigned.push(s);
                });
            }
        });
        // restrict those assignments to the current region if needed
        if (activeRegionName && stationsByRegion.length) {
            const allowed = new Set(
                stationsByRegion.map((s: any) => String(s.id)),
            );
            supAssigned = supAssigned.filter((s: any) =>
                allowed.has(String(s.id)),
            );
        }
        // merge unique
        const merged: any[] = [];
        const seen = new Set<string>();
        for (const s of [...stationsByRegion, ...supAssigned]) {
            if (s && s.id && !seen.has(String(s.id))) {
                seen.add(String(s.id));
                merged.push(s);
            }
        }
        return merged;
    }

    function CrudActions({
        staffHref,
        siteHref,
        compact = false,
    }: {
        staffHref: string;
        siteHref: string;
        compact?: boolean;
    }) {
        return (
            <div
                className={`flex flex-wrap items-center gap-2 ${compact ? "mt-3" : ""}`}
                onClick={(e) => e.stopPropagation()}
            >
                <Link
                    href={staffHref}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                    title="Update this user"
                >
                    <UserCog className="h-3.5 w-3.5" /> Update
                </Link>
                <Link
                    href={staffHref}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                    title="Add new staff under this scope"
                >
                    <UserPlus className="h-3.5 w-3.5" /> Add Staff
                </Link>
                <Link
                    href={siteHref}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                    title="Create, edit, move, and delete stations"
                >
                    <MapPinned className="h-3.5 w-3.5" /> Site CRUD
                </Link>
                <Link
                    href={siteHref}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                    title="Adjust assignments and reassign stations"
                >
                    <SquarePen className="h-3.5 w-3.5" /> Adjust
                </Link>
            </div>
        );
    }

    async function handleDeleteUser(userId: string, label: string) {
        if (!window.confirm(`Delete ${label}?`)) return;
        try {
            setDeletingUserId(userId);
            const response = await fetch(`/api/users/${userId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || "Failed to delete user");
            }

            setDeletedUserIds((prev) => new Set(prev).add(String(userId)));
            setLocalManager((prev) => prev.filter((m) => m.id !== userId));

            if (selectedStaff?.id === userId) {
                setSelectedStaff(null);
            }

            if (selectedManager?.id === userId) {
                setSelectedManager(null);
                setSelectedStaff(null);
            }
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : "Failed to delete user",
            );
        } finally {
            setDeletingUserId(null);
        }
    }

    async function handleDeleteSite(siteId: string, label: string) {
        if (!window.confirm(`Delete site ${label}?`)) return;
        try {
            setDeletingSiteId(siteId);
            const response = await fetch(`/api/stations/${siteId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(
                    error.error || error.message || "Failed to delete site",
                );
            }

            setDeletedSiteIds((prev) => new Set(prev).add(String(siteId)));
            setRegionSites((prev) => prev.filter((site) => site.id !== siteId));
        } catch (error) {
            alert(
                error instanceof Error
                    ? error.message
                    : "Failed to delete site",
            );
        } finally {
            setDeletingSiteId(null);
        }
    }

    function UserQuickActions({
        editHref,
        userId,
        label,
    }: {
        editHref: string;
        userId: string;
        label: string;
    }) {
        return (
            <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
            >
                <Link
                    href={editHref}
                    className="inline-flex items-center justify-center rounded-md border p-1.5 text-xs hover:bg-muted transition"
                    title={`Update ${label}`}
                    aria-label={`Update ${label}`}
                >
                    <SquarePen className="h-3.5 w-3.5" />
                </Link>
                <button
                    type="button"
                    onClick={() => handleDeleteUser(userId, label)}
                    disabled={deletingUserId === userId}
                    className="inline-flex items-center justify-center rounded-md border p-1.5 text-xs text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                    title={`Delete ${label}`}
                    aria-label={`Delete ${label}`}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    function SiteQuickActions({
        actionHref,
        siteId,
        label,
    }: {
        actionHref: string;
        siteId: string;
        label: string;
    }) {
        return (
            <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
            >
                <Link
                    href={actionHref}
                    className="inline-flex items-center justify-center rounded-md border p-1.5 text-xs hover:bg-muted transition"
                    title={`Edit site ${label}`}
                    aria-label={`Edit site ${label}`}
                >
                    <SquarePen className="h-3.5 w-3.5" />
                </Link>
                <button
                    type="button"
                    onClick={() => handleDeleteSite(siteId, label)}
                    disabled={deletingSiteId === siteId}
                    className="inline-flex items-center justify-center rounded-md border p-1.5 text-xs text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                    title={`Delete site ${label}`}
                    aria-label={`Delete site ${label}`}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    function SitesSection({
        title,
        stations,
        regionName,
        supervisorId,
        emptyMessage,
    }: {
        title: string;
        stations: any[];
        regionName?: string;
        supervisorId?: string;
        emptyMessage: string;
    }) {
        const displayCards = getDisplaySiteCards(stations, supervisorId);

        return (
            <div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-md font-semibold flex items-center gap-2">
                        <Building className="h-4 w-4" /> {title} (
                        {displayCards.length})
                    </h3>
                    <Link
                        href={makeSitesHref({
                            regionName,
                            createSite: true,
                        })}
                        className="inline-flex items-center gap-1 self-start rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                        title={`Add a site in ${regionName || "this region"}`}
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Site
                    </Link>
                </div>
                {loadingRegionSites ? (
                    <div className="text-sm text-muted-foreground">
                        Loading stations...
                    </div>
                ) : displayCards.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        {emptyMessage}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {displayCards.map((card: any) => {
                            const {
                                site,
                                siteZoneName,
                                assignedStaffName,
                                neName,
                            } = card;
                            return (
                                <div
                                    key={card.key}
                                    className="p-3 bg-background border rounded"
                                >
                                    <div className="font-medium text-foreground">
                                        {site.name}
                                    </div>
                                    <div className="text-sm text-foreground">
                                        Code: {site.siteCode}
                                    </div>
                                    <div className="text-sm text-foreground">
                                        Zone/Area: {siteZoneName}
                                    </div>
                                    {assignedStaffName && (
                                        <div className="text-sm text-foreground">
                                            Assigned: {assignedStaffName}
                                        </div>
                                    )}
                                    {neName && (
                                        <div className="text-sm text-foreground">
                                            NE: {neName}
                                        </div>
                                    )}
                                    <div className="mt-3">
                                        <SiteQuickActions
                                            siteId={site.id}
                                            label={site.name}
                                            actionHref={makeSitesHref({
                                                editSiteId: site.id,
                                                supervisorId,
                                                regionName,
                                                zoneName:
                                                    site.zone?.name ||
                                                    undefined,
                                                siteSearch: site.name,
                                            })}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    if (selectedStaff) {
        return (
            <div>
                <button
                    className="mb-4 flex items-center gap-2 px-3 py-1 bg-background text-foreground rounded hover:bg-base-hover text-sm"
                    onClick={() => setSelectedStaff(null)}
                >
                    <ChevronLeft className="h-4 w-4" /> Back to Manager
                </button>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                        Staff: {selectedStaff.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Link
                            href={makeUsersHref({
                                scope: "passenger",
                                regionName: selectedManager?.regions?.[0],
                                zoneName: selectedStaff.zones?.[0],
                                location:
                                    getLocationByEmail(
                                        selectedStaff.email,
                                    ) || selectedStaff.location,
                                createUser: true,
                                defaultRole: "passenger",
                            })}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                            title="Add passenger under this supervisor"
                        >
                            <UserPlus className="h-3.5 w-3.5" /> Add Staff
                        </Link>
                    </div>
                </div>
                <div className="mb-4">
                    <div className="font-bold text-lg mb-1 flex items-center gap-2">
                        <Users className="h-5 w-5" /> {selectedStaff.name}
                    </div>
                    <div className="text-sm text-foreground mb-1">
                        Email: {selectedStaff.email}
                    </div>
                    <div className="text-sm text-foreground mb-1">
                        {selectedStaff.zones &&
                        selectedStaff.zones.length > 0
                            ? `Region/Zone: ${selectedStaff.locationCategory || "-"} / ${selectedStaff.zones.join(", ")}`
                            : `Region: ${selectedStaff.locationCategory || "-"}`}
                    </div>
                    <div className="text-sm text-foreground mb-1">
                        Location:{" "}
                        {getLocationByEmail(selectedStaff.email) ||
                            selectedStaff.location ||
                            "-"}
                    </div>
                    <div className="text-sm text-foreground mb-1">
                        Staff ID: {selectedStaff.staffId || "-"}
                    </div>
                </div>
                <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
                    <User className="h-4 w-4" /> Passengers (
                    {selectedStaff.passengers?.length || 0})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedStaff.passengers
                        ?.filter(
                            (tech: any) => !deletedUserIds.has(String(tech.id)),
                        )
                        .map((tech: any) => (
                            <div
                                key={tech.id}
                                className="p-3 bg-background border rounded"
                            >
                                <div className="font-medium text-foreground">
                                    {tech.name}
                                </div>
                                <div className="text-sm text-foreground">
                                    @{tech.username}
                                </div>
                                {tech.staffId && (
                                    <div className="text-sm text-foreground">
                                        Staff ID: {tech.staffId}
                                    </div>
                                )}
                                <div className="mt-3">
                                    <UserQuickActions
                                        userId={tech.id}
                                        label={tech.name}
                                        editHref={makeUsersHref({
                                            scope: "passenger",
                                            focusUserId: tech.id,
                                            regionName:
                                                selectedManager?.regions?.[0],
                                            zoneName:
                                                selectedStaff.zones?.[0],
                                            location:
                                                getLocationByEmail(
                                                    selectedStaff.email,
                                                ) ||
                                                selectedStaff.location,
                                        })}
                                    />
                                </div>
                            </div>
                        ))}
                </div>
                <div>
                    <SitesSection
                        title={getScopeTitle(
                            getStaffRegionName(selectedStaff),
                        )}
                        stations={getSitesForStaff(selectedStaff)}
                        regionName={getStaffRegionName(selectedStaff)}
                        supervisorId={selectedStaff.id}
                        emptyMessage="No stations found for this supervisor's region."
                    />
                </div>
            </div>
        );
    }

    if (selectedManager) {
        const supervisors = getManagerForManager(selectedManager.id);
        return (
            <div>
                <button
                    className="mb-4 flex items-center gap-2 px-3 py-1 bg-background text-foreground rounded hover:bg-base-hover text-sm"
                    onClick={() => setSelectedManager(null)}
                >
                    <ChevronLeft className="h-4 w-4" /> Back to Manager
                </button>
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h2 className="text-xl font-semibold">
                        Manager under {selectedManager.name}
                    </h2>
                    <Link
                        href={makeUsersHref({
                            scope: "supervisor",
                            regionName: selectedManager?.regions?.[0],
                            createUser: true,
                            defaultRole: "supervisor",
                        })}
                        className="inline-flex items-center gap-1 self-start rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                        title="Add a supervisor under this manager"
                    >
                        <UserPlus className="h-3.5 w-3.5" /> Add Staff
                    </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {supervisors.map((sup) => {
                        const supSites = getSitesForStaff(sup);
                        return (
                            <div
                                key={sup.id}
                                className="p-4 bg-background border rounded cursor-pointer hover:bg-muted/10 transition"
                                onClick={() => setSelectedStaff(sup)}
                            >
                                <div className="font-bold text-lg mb-1 flex items-center gap-2">
                                    <Users className="h-5 w-5" /> {sup.name}
                                </div>
                                <div className="text-sm text-foreground mb-1">
                                    Email: {sup.email}
                                </div>
                                <div className="text-sm text-foreground mb-1">
                                    Region: {sup.locationCategory || "-"}
                                </div>
                                <div className="text-sm text-foreground mb-1">
                                    Location:{" "}
                                    {getLocationByEmail(sup.email) ||
                                        sup.location ||
                                        sup.userLocation ||
                                        "-"}
                                </div>
                                <div className="text-sm text-foreground mb-1">
                                    Staff ID: {sup.staffId || "-"}
                                </div>
                                <div className="text-sm text-foreground mb-1">
                                    Sites: {supSites.length}
                                </div>
                                <div className="mb-3">
                                    <UserQuickActions
                                        userId={sup.id}
                                        label={sup.name}
                                        editHref={makeUsersHref({
                                            scope: "supervisor",
                                            focusUserId: sup.id,
                                            regionName:
                                                selectedManager?.regions?.[0],
                                            zoneName: sup.zones?.[0],
                                            location:
                                                getLocationByEmail(sup.email) ||
                                                sup.location ||
                                                sup.userLocation,
                                        })}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-6">
                    {(() => {
                        const regionCode =
                            getManagerRegionName(selectedManager);
                        const emptyMsg = regionCode
                            ? `No stations found for region ${regionCode}.`
                            : "No stations found for this manager's region.";
                        return (
                            <SitesSection
                                title={getScopeTitle(regionCode)}
                                stations={getSitesForManager(selectedManager)}
                                regionName={regionCode}
                                emptyMessage={emptyMsg}
                            />
                        );
                    })()}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-xl font-semibold">Manager</h2>
                <Link
                    href={makeUsersHref({
                        scope: "manager",
                        createUser: true,
                        defaultRole: "manager",
                    })}
                    className="inline-flex items-center gap-1 self-start rounded-md border px-2 py-1 text-xs hover:bg-muted transition"
                    title="Add a new manager"
                >
                    <UserPlus className="h-3.5 w-3.5" /> Add Manager
                </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {localManager
                    .filter(
                        (manager) => !deletedUserIds.has(String(manager.id)),
                    )
                    .map((manager) => (
                        <div
                            key={manager.id}
                            className="p-4 bg-background border rounded cursor-pointer hover:bg-muted/10 transition"
                            onClick={() => setSelectedManager(manager)}
                        >
                            <div className="font-bold text-lg mb-1 flex items-center gap-2">
                                <Users className="h-5 w-5" /> {manager.name}
                            </div>
                            <div className="text-sm text-foreground mb-1">
                                Email: {manager.email}
                            </div>
                            <div className="text-sm text-foreground mb-1">
                                {manager.regions && manager.regions.length > 0
                                    ? `Region/Zone: ${manager.regions.join(", ")}`
                                    : manager.zones && manager.zones.length > 0
                                      ? `Region/Zone: ${manager.zones.join(", ")}`
                                      : "Region/Zone: -"}
                            </div>
                            {/* Manager do not have a location field, so do not display it */}
                            <div className="mb-3">
                                <UserQuickActions
                                    userId={manager.id}
                                    label={manager.name}
                                    editHref={makeUsersHref({
                                        scope: "manager",
                                        focusUserId: manager.id,
                                        regionName: manager.regions?.[0],
                                    })}
                                />
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
}
