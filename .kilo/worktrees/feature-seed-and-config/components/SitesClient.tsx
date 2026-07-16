"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Filter, MapPin, Plus, Trash2, UserCog } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { Button } from "./ui/button"; // use relative path to avoid alias issues in tests
import { cn } from "@/lib/utils";

type Region = { id: string; name: string };
type Zone = { id: string; name: string; regionId: string };

type Site = {
    id: string;
    siteCode: string | null;
    name: string | null;
    regionId: string | null;
    zoneId: string | null;
    supervisorSiteId?: string | null;
    neNameAndId?: string | null;
    allNeNames?: string[] | null;
    latitude?: string | null;
    longitude?: string | null;
};

type NeName = { name: string; value: string };
type ManagerOption = {
    id: string;
    fullName: string;
    assignedRegion: string[];
    assignedZone: string[];
    locationCategory?: string | null;
    location?: string | null;
};

interface SitesClientProps {
    fixedRegionName?: string;
    hideRegionFilter?: boolean;
}

export default function SitesClient({
    fixedRegionName,
    hideRegionFilter,
}: SitesClientProps = {}) {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const supervisorId = searchParams?.get("supervisorId") || "";
    const regionNameParam = searchParams?.get("regionName") || "";
    const zoneNameParam = searchParams?.get("zoneName") || "";
    const siteSearchParam = searchParams?.get("siteSearch") || "";
    const createSiteParam = searchParams?.get("createSite") || "";
    const editSiteIdParam = searchParams?.get("editSiteId") || "";
    const user = session?.user as any;
    const roleLower = String(
        user?.role?.key || user?.roleKey || user?.role || "",
    ).toLowerCase();
    const isAdmin = roleLower === "admin";
    const isManager = roleLower === "manager";
    const isStaff =
        roleLower === "supervisor" || roleLower === "zone_manager";
    // treat any user who isn't a manager/supervisor but *does* have an assigned
    // region/zone as a "region supervisor"; they should see the same scoped
    // behavior (this fixes the missing-stations bug).
    const hasAssignedAreas =
        (Array.isArray(user?.assignedRegion) &&
            user.assignedRegion.length > 0) ||
        (Array.isArray(user?.assignedZone) && user.assignedZone.length > 0);
    const isRegionStaff = !isManager && !isStaff && hasAssignedAreas;
    const areaUser = isManager || isStaff || isRegionStaff;

    // the two "scoped HQ" admins should see every site.
    // we avoid dynamic require on client by hardcoding their emails here.
    const isScopedAdmin = useMemo(() => {
        if (!user || !user.email) return false;
        const email = String(user.email).toLowerCase();
        return (
            email === "buzayehu.fininsa@ethiotelecom.et" ||
            email === "fekadu.dagnachew@ethiotelecom.et"
        );
    }, [user]);

    const effectiveAreaUser = isScopedAdmin ? false : areaUser;

    const canAssignSites = (isAdmin || isManager) && Boolean(supervisorId);
    const canSelectForDelete = isAdmin;
    // Assigned region/zone IDs for manager OR supervisor OR region-supervisor
    const assignedRegionIds: string[] =
        effectiveAreaUser && Array.isArray(user?.assignedRegion)
            ? user.assignedRegion
            : [];
    const assignedZoneIds: string[] =
        effectiveAreaUser && Array.isArray(user?.assignedZone)
            ? user.assignedZone
            : [];

    const [regions, setRegions] = useState<Region[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [stations, setSites] = useState<Site[]>([]);
    const [neNames, setNeNames] = useState<NeName[]>([]);

    const [regionFilter, setRegionFilter] = useState<string>("");
    const [zoneFilter, setZoneFilter] = useState<string>("");
    const [siteSearch, setSiteSearch] = useState<string>("");

    // clear any initial URL filters for scoped admin accounts
    useEffect(() => {
        if (isScopedAdmin) {
            setRegionFilter("");
            setZoneFilter("");
        }
    }, [isScopedAdmin]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
    const [assigning, setAssigning] = useState(false);
    const [assigningManagerSiteId, setAssigningManagerSiteId] = useState<
        string | null
    >(null);
    const [bulkManagerId, setBulkManagerId] = useState("");
    const [managers, setManager] = useState<ManagerOption[]>([]);

    // dropdown background style borrowed from workorders table
    const MENU_BG_CLASS =
        "z-50 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-foreground shadow-md";

    const [showSiteForm, setShowSiteForm] = useState(false);
    const [savingSite, setSavingSite] = useState(false);
    const [editingSite, setEditingSite] = useState<Site | null>(null);

    const [formSiteCode, setFormSiteCode] = useState("");
    const [formName, setFormName] = useState("");
    const [formRegionId, setFormRegionId] = useState("");
    const [formZoneId, setFormZoneId] = useState("");
    // Track whether the user explicitly chose Region or Zone so auto-filled
    // values (zone -> region) don't incorrectly lock the other control.
    const [formRegionChosenExplicitly, setFormRegionChosenExplicitly] =
        useState(false);
    const [formZoneChosenExplicitly, setFormZoneChosenExplicitly] =
        useState(false);
    const [formNeName, setFormNeName] = useState("");
    const [formLatitude, setFormLatitude] = useState("");
    const [formLongitude, setFormLongitude] = useState("");
    const [queryInitialized, setQueryInitialized] = useState(false);
    const [siteFormQueryHandled, setSiteFormQueryHandled] = useState(false);

    useEffect(() => {
        if (!showSiteForm) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = original;
        };
    }, [showSiteForm]);

    useEffect(() => {
        (async () => {
            try {
                const [regionsR, zonesR] = await Promise.all([
                    fetch("/api/regions"),
                    fetch("/api/zones"),
                ]);
                let regionsData = regionsR.ok ? await regionsR.json() : [];
                let zonesData = zonesR.ok ? await zonesR.json() : [];
                // For HQ managers/supervisors, do NOT restrict to assigned regions/zones — show AAZ/HQ zones
                const isHQ =
                    effectiveAreaUser &&
                    Array.isArray(user?.assignedRegion) &&
                    user.assignedRegion.some((r: string) =>
                        String(r).toLowerCase().includes("head quarter"),
                    );
                if (effectiveAreaUser && isHQ) {
                    // HQ manager/supervisor: show only AAZ and HQ zones
                    zonesData = zonesData.filter(
                        (z: any) =>
                            z.name?.toUpperCase().endsWith("AAZ") ||
                            z.name?.toUpperCase().includes("HQ"),
                    );
                } else if (effectiveAreaUser) {
                    // restrict to assigned regions/zones for non-HQ area users
                    regionsData = regionsData.filter((r: any) =>
                        assignedRegionIds.includes(r.id),
                    );
                    zonesData = zonesData.filter((z: any) =>
                        assignedZoneIds.includes(z.id),
                    );
                }
                // ensure ANY AAZ/HQ zone also appears as a region entry
                const extra = zonesData
                    .filter(
                        (z: any) =>
                            /aaz/i.test(z.name) ||
                            z.name.toLowerCase().includes("head quarter") ||
                            /^hq/i.test(z.name),
                    )
                    .map((z: any) => ({ id: `zone-${z.id}`, name: z.name }));
                // avoid duplicates
                const combinedRegions = [...extra, ...regionsData];
                setRegions(combinedRegions);
                setZones(zonesData);
                // Auto-select region/zone if only one assigned (but not for HQ area users).
                // Scoped HQ admins should not be auto-filtered.
                if (!isScopedAdmin && areaUser && !isHQ) {
                    if (assignedRegionIds.length === 1)
                        setRegionFilter(assignedRegionIds[0]);
                    if (assignedZoneIds.length === 1)
                        setZoneFilter(assignedZoneIds[0]);
                }
                // If fixedRegionName is provided, auto-select that region
                if (fixedRegionName && combinedRegions.length > 0) {
                    const region = combinedRegions.find(
                        (r: any) => r.name === fixedRegionName,
                    );
                    if (region) setRegionFilter(region.id);
                }
            } catch (e) {
                // ignore; filters just won't populate
            }
        })();
    }, [areaUser, assignedRegionIds, assignedZoneIds, fixedRegionName, user]);

    const fetchManagerForAdmin = async () => {
        if (!isAdmin) return [] as ManagerOption[];
        try {
            const [managerRes, zoneManagerRes] = await Promise.all([
                fetch("/api/users?role=manager"),
                fetch("/api/users?role=zone_manager"),
            ]);

            const managerData = managerRes.ok ? await managerRes.json() : [];
            const zoneManagerData = zoneManagerRes.ok
                ? await zoneManagerRes.json()
                : [];

            const mapped = [...managerData, ...zoneManagerData].map(
                (u: any) => ({
                    id: String(u.id),
                    fullName: String(u.fullName || u.name || u.email || u.id),
                    assignedRegion: Array.isArray(u.assignedRegion)
                        ? u.assignedRegion
                        : [],
                    assignedZone: Array.isArray(u.assignedZone)
                        ? u.assignedZone
                        : [],
                    locationCategory: u.locationCategory || null,
                    location: u.location || null,
                }),
            );

            const uniqueById = new Map<string, ManagerOption>();
            for (const mgr of mapped) uniqueById.set(mgr.id, mgr);
            const uniqueManager = Array.from(uniqueById.values());
            setManager(uniqueManager);
            return uniqueManager;
        } catch {
            setManager([]);
            return [] as ManagerOption[];
        }
    };

    // whenever the current user becomes / is an admin, ensure manager list is loaded
    useEffect(() => {
        if (isAdmin) {
            void fetchManagerForAdmin();
        } else {
            setManager([]);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (queryInitialized) return;
        if (regions.length === 0 && zones.length === 0) return;

        if (!isScopedAdmin) {
            if (regionNameParam) {
                const region = regions.find(
                    (r) =>
                        r.name.toLowerCase() === regionNameParam.toLowerCase(),
                );
                if (region) setRegionFilter(region.id);
            }

            if (zoneNameParam) {
                const zone = zones.find(
                    (z) => z.name.toLowerCase() === zoneNameParam.toLowerCase(),
                );
                if (zone) setZoneFilter(zone.id);
            }
        }

        if (siteSearchParam) setSiteSearch(siteSearchParam);

        setQueryInitialized(true);
    }, [
        queryInitialized,
        regionNameParam,
        zoneNameParam,
        siteSearchParam,
        regions,
        zones,
        isScopedAdmin,
    ]);

    useEffect(() => {
        setSiteFormQueryHandled(false);
    }, [createSiteParam, editSiteIdParam]);

    const fetchSitesAndNe = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            // If fixedRegionName is provided, always filter by that region
            if (fixedRegionName) {
                params.set("region", fixedRegionName);
            } else if (effectiveAreaUser) {
                // Use all assigned region/zone names for query (treat supervisors like managers)
                const regionNames = regions
                    .filter((r) => assignedRegionIds.includes(r.id))
                    .map((r) => r.name);
                const zoneNames = zones
                    .filter((z) => assignedZoneIds.includes(z.id))
                    .map((z) => z.name);
                regionNames.forEach((rn) => params.append("region", rn));
                zoneNames.forEach((zn) => params.append("zone", zn));
            } else {
                if (regionFilter) {
                    const region = regions.find((r) => r.id === regionFilter);
                    if (region) {
                        params.set("region", region.name);
                    } else {
                        const zone = zones.find((z) => z.id === regionFilter);
                        if (zone) {
                            params.set("zone", zone.name);
                        }
                    }
                }
                if (zoneFilter) {
                    const zoneName = zones.find(
                        (z) => z.id === zoneFilter,
                    )?.name;
                    if (zoneName) params.set("zone", zoneName);
                }
            }
            const qs = params.toString();
            const [stationsR, neR] = await Promise.all([
                fetch(qs ? `/api/stations?${qs}` : "/api/stations"),
                fetch(qs ? `/api/ne-names?${qs}` : "/api/ne-names"),
            ]);
            if (!stationsR.ok) {
                const body = await stationsR.json().catch(() => ({}));
                throw new Error(body.error || "Failed to load stations");
            }
            const stationsData = await stationsR.json();
            setSites(stationsData || []);
            if (neR.ok) {
                setNeNames(await neR.json());
            } else {
                setNeNames([]);
            }
        } catch (e: any) {
            setError(e?.message || "Failed to load stations");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchSitesAndNe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [regionFilter, zoneFilter]);

    // For managers, filter zones and stations based on assignment type
    const filteredZones = useMemo(() => {
        if (isManager) {
            // If assigned to regions, show only zones in those regions
            if (assignedRegionIds.length > 0 && assignedZoneIds.length === 0) {
                return zones.filter((z) =>
                    assignedRegionIds.includes(z.regionId),
                );
            }
            // If assigned to zones, show only those zones
            if (assignedZoneIds.length > 0) {
                return zones.filter((z) => assignedZoneIds.includes(z.id));
            }
            return [];
        }
        if (!regionFilter) return zones;
        const region = regions.find((r) => r.id === regionFilter);
        if (region) {
            return zones.filter((z) => z.regionId === region.id);
        } else {
            return zones.filter((z) => z.id === regionFilter);
        }
    }, [
        zones,
        regionFilter,
        regions,
        isManager,
        assignedRegionIds,
        assignedZoneIds,
    ]);

    const zonesById = useMemo(() => {
        const m = new Map<string, string>();
        zones.forEach((z) => m.set(z.id, z.name));
        return m;
    }, [zones]);

    const regionsById = useMemo(() => {
        const m = new Map<string, string>();
        regions.forEach((r) => m.set(r.id, r.name));
        return m;
    }, [regions]);

    const zonesWithRegionNames = useMemo(() => {
        return zones.map((z) => ({
            ...z,
            regionName: regionsById.get(z.regionId) || "Unknown Region",
        }));
    }, [zones, regionsById]);

    const visibleSites = useMemo(() => {
        let filtered = stations;
        // Scoped HQ admins bypass all area restrictions and see every site
        if (isScopedAdmin) {
            // still apply search term below
        } else if (isManager || isStaff || isRegionStaff) {
            const isHQ =
                Array.isArray(user?.assignedRegion) &&
                user.assignedRegion.some((r: string) =>
                    String(r).toLowerCase().includes("head quarter"),
                );
            if (isHQ) {
                // HQ manager/supervisor: filter by selected zone, otherwise show all AAZ/HQ stations
                if (zoneFilter) {
                    filtered = filtered.filter((s) => s.zoneId === zoneFilter);
                } else {
                    filtered = filtered.filter((s) => {
                        const zoneName =
                            zones.find((z) => z.id === s.zoneId)?.name || "";
                        const regionName =
                            regions.find((r) => r.id === s.regionId)?.name ||
                            "";
                        return (
                            zoneName.toUpperCase().endsWith("AAZ") ||
                            zoneName.toUpperCase().includes("HQ") ||
                            regionName.toUpperCase().endsWith("AAZ") ||
                            regionName.toUpperCase().includes("HQ")
                        );
                    });
                }
            } else {
                filtered = filtered.filter((s) => {
                    if (s.zoneId && s.zoneId !== "") {
                        return assignedZoneIds.includes(s.zoneId);
                    }
                    if (!s.zoneId || s.zoneId === "") {
                        return assignedRegionIds.includes(s.regionId || "");
                    }
                    return false;
                });
            }
        } else {
            if (zoneFilter) {
                filtered = filtered.filter((s) => s.zoneId === zoneFilter);
            } else if (regionFilter) {
                filtered = filtered.filter((s) => s.regionId === regionFilter);
            }
        }
        if (siteSearch.trim()) {
            const q = siteSearch.toLowerCase();
            filtered = filtered.filter((s) => {
                const code = (s.siteCode || "").toLowerCase();
                const name = (s.name || "").toLowerCase();
                return code.includes(q) || name.includes(q);
            });
        }
        return filtered;
    }, [
        stations,
        siteSearch,
        regionFilter,
        zoneFilter,
        isManager,
        assignedRegionIds,
        assignedZoneIds,
        user,
        zones,
    ]);

    // Expand each physical site into one row per NE so that stations
    // with multiple network elements (same site code, different NE)
    // are displayed as separate rows in the table.
    const expandedSiteRows = useMemo(() => {
        type Row = Site & { neDisplay: string };
        const rows: Row[] = [];

        for (const s of visibleSites) {
            const hasZone = Boolean(s.zoneId);
            const regionName = hasZone
                ? "-"
                : s.regionId
                  ? regionsById.get(s.regionId) || s.regionId
                  : "-";
            const zoneName = hasZone
                ? zonesById.get(s.zoneId!) || s.zoneId
                : "-";

            const neSet = new Set<string>();
            if (s.neNameAndId) {
                const v = s.neNameAndId.toString().trim();
                if (v) neSet.add(v);
            }
            if (Array.isArray(s.allNeNames)) {
                for (const raw of s.allNeNames) {
                    const v = (raw ?? "").toString().trim();
                    if (v) neSet.add(v);
                }
            }

            const neList = Array.from(neSet);

            if (neList.length === 0) {
                rows.push({
                    ...s,
                    neDisplay: "",
                    regionId: s.regionId,
                    zoneId: s.zoneId,
                });
            } else {
                for (const ne of neList) {
                    rows.push({
                        ...s,
                        neDisplay: ne,
                        regionId: s.regionId,
                        zoneId: s.zoneId,
                    });
                }
            }
        }

        return rows;
    }, [visibleSites, regionsById, zonesById]);

    // Filter NE names to match visible stations, using same region/zone logic for managers
    // Use real NE names from backend, already filtered by region/zone
    // Only show NE names that are present in the currently visible stations
    const filteredNeNames = useMemo(() => {
        const neSet = new Set<string>();
        visibleSites.forEach((site) => {
            if (site.neNameAndId) {
                neSet.add(site.neNameAndId);
            }
            if (Array.isArray(site.allNeNames)) {
                site.allNeNames.forEach((ne) => neSet.add(ne));
            }
        });
        return Array.from(neSet).map((name) => ({ name, value: name }));
    }, [visibleSites]);

    const resetForm = () => {
        setFormSiteCode("");
        setFormName("");
        setFormRegionId(regionFilter || "");
        setFormZoneId("");
        setFormNeName("");
        setFormLatitude("");
        setFormLongitude("");
        setFormRegionChosenExplicitly(false);
        setFormZoneChosenExplicitly(false);
    };

    // Region remains the primary scope selector. Zone is optional and can further
    // narrow the site within the chosen region when needed.

    const openSiteForm = () => {
        setEditingSite(null);
        resetForm();
        setShowSiteForm(true);
    };

    const openEditSiteForm = (site: Site) => {
        setEditingSite(site);
        setFormSiteCode(site.siteCode || "");
        setFormName(site.name || "");
        // prefer the region of the selected zone, but when the zone itself is
        // an AAZ/HQ area we want the region dropdown to show the zone code (e.g. WAAZ).
        let initRegion = site.regionId || "";
        if (site.zoneId) {
            const zone = zones.find((z) => z.id === site.zoneId);
            if (zone) {
                const zoneName = String(zone.name || "").toLowerCase();
                const isAazHq =
                    /aaz/i.test(zoneName) ||
                    zoneName.includes("head quarter") ||
                    zoneName === "hq";
                if (isAazHq) {
                    // see if we already have a region entry with the same name
                    const existing = regions.find(
                        (r) => r.name.toLowerCase() === zone.name.toLowerCase(),
                    );
                    if (existing) {
                        initRegion = existing.id;
                    } else {
                        // inject a temporary region so dropdown can display it
                        const fake = { id: `zone-${zone.id}`, name: zone.name };
                        setRegions((prev) => [fake, ...prev]);
                        initRegion = fake.id;
                    }
                } else if (zone.regionId) {
                    initRegion = zone.regionId;
                }
            }
        }
        setFormRegionId(initRegion);
        setFormZoneId(site.zoneId || "");
        setFormNeName(site.neNameAndId || "");
        setFormLatitude(site.latitude || "");
        setFormLongitude(site.longitude || "");
        // mark which field appears to be the authoritative selection
        if (site.zoneId) {
            setFormZoneChosenExplicitly(true);
            setFormRegionChosenExplicitly(false);
        } else if (site.regionId) {
            setFormRegionChosenExplicitly(true);
            setFormZoneChosenExplicitly(false);
        } else {
            setFormRegionChosenExplicitly(false);
            setFormZoneChosenExplicitly(false);
        }
        setShowSiteForm(true);
    };

    const closeSiteForm = () => {
        setShowSiteForm(false);
    };

    useEffect(() => {
        if (!queryInitialized || siteFormQueryHandled) return;

        const shouldOpenCreate =
            createSiteParam === "1" || createSiteParam.toLowerCase() === "true";

        if (shouldOpenCreate) {
            openSiteForm();
            setSiteFormQueryHandled(true);
            return;
        }

        if (!editSiteIdParam) return;

        const existingSite = stations.find((site) => site.id === editSiteIdParam);
        if (existingSite) {
            openEditSiteForm(existingSite);
            setSiteFormQueryHandled(true);
            return;
        }

        let cancelled = false;

        const loadSite = async () => {
            try {
                const response = await fetch(`/api/stations/${editSiteIdParam}`);
                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || "Failed to load site");
                }

                const site = await response.json();
                if (cancelled) return;

                openEditSiteForm(site);
                setSiteFormQueryHandled(true);
            } catch (e: any) {
                if (cancelled) return;
                setError(e?.message || "Failed to load site");
                setSiteFormQueryHandled(true);
            }
        };

        void loadSite();

        return () => {
            cancelled = true;
        };
    }, [
        createSiteParam,
        editSiteIdParam,
        queryInitialized,
        siteFormQueryHandled,
        stations,
    ]);

    const handleSaveSite = async (e: React.FormEvent) => {
        e.preventDefault();
        const zoneRegionId = formZoneId
            ? zones.find((z) => z.id === formZoneId)?.regionId || ""
            : "";
        const resolvedRegionId = formRegionId || zoneRegionId;

        // guard: prevent mismatched region/zone if both fields are present
        if (
            formRegionId &&
            formZoneId &&
            zoneRegionId &&
            zoneRegionId !== formRegionId
        ) {
            alert(
                "Selected Zone does not belong to the selected Region. Clear one of the fields.",
            );
            return;
        }

        if (!formSiteCode || !formName || !resolvedRegionId) {
            alert("Region is required (or select a zone).");
            return;
        }
        try {
            setSavingSite(true);
            const body: any = {
                siteCode: formSiteCode,
                name: formName,
                regionId: resolvedRegionId,
                zoneId: formZoneId || null,
                latitude: formLatitude.trim() || null,
                longitude: formLongitude.trim() || null,
            };
            if (formNeName) {
                body.neNameAndId = formNeName;
            }
            const res = await fetch(
                editingSite ? `/api/stations/${editingSite.id}` : "/api/stations",
                {
                    method: editingSite ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                },
            );
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(
                    err.error ||
                        (editingSite
                            ? "Failed to update site"
                            : "Failed to create site"),
                );
            }
            setShowSiteForm(false);
            await fetchSitesAndNe();
        } catch (e: any) {
            alert(
                e?.message ||
                    (editingSite
                        ? "Failed to update site"
                        : "Failed to create site"),
            );
        } finally {
            setSavingSite(false);
        }
    };

    const handleDeleteSite = async (site: Site) => {
        if (!confirm(`Delete site ${site.name || site.siteCode}?`)) return;
        try {
            const res = await fetch(`/api/stations/${site.id}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (err?.error === "site_has_dependencies" && isAdmin) {
                    const force = confirm(
                        `${err.message || "This site has linked data."}\n\nForce delete will remove linked bookings and assets. Continue?`,
                    );
                    if (!force) return;
                    const resForce = await fetch(
                        `/api/stations/${site.id}?force=1`,
                        { method: "DELETE" },
                    );
                    if (!resForce.ok) {
                        const err2 = await resForce.json().catch(() => ({}));
                        throw new Error(
                            err2.message ||
                                err2.error ||
                                "Failed to delete site",
                        );
                    }
                } else {
                    const message =
                        err.message || err.error || "Failed to delete site";
                    throw new Error(message);
                }
            }
            await fetchSitesAndNe();
        } catch (e: any) {
            alert(e?.message || "Failed to delete site");
        }
    };

    const toggleSiteSelection = (siteId: string) => {
        setSelectedSiteIds((prev) =>
            prev.includes(siteId)
                ? prev.filter((id) => id !== siteId)
                : [...prev, siteId],
        );
    };

    const allVisibleSiteIds = useMemo(
        () => visibleSites.map((s) => s.id),
        [visibleSites],
    );
    const allSelected =
        allVisibleSiteIds.length > 0 &&
        allVisibleSiteIds.every((id) => selectedSiteIds.includes(id));
    const toggleSelectAll = () => {
        setSelectedSiteIds((prev) =>
            allSelected
                ? []
                : Array.from(new Set([...prev, ...allVisibleSiteIds])),
        );
    };

    const deleteSelectedSites = async () => {
        if (!isAdmin || selectedSiteIds.length === 0) return;
        if (!confirm(`Delete ${selectedSiteIds.length} selected stations?`))
            return;
        const dependencyIds: string[] = [];
        for (const siteId of selectedSiteIds) {
            try {
                const res = await fetch(`/api/stations/${siteId}`, {
                    method: "DELETE",
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    if (err?.error === "site_has_dependencies") {
                        dependencyIds.push(siteId);
                    } else {
                        throw new Error(
                            err.message || err.error || "Failed to delete site",
                        );
                    }
                }
            } catch (e: any) {
                alert(e?.message || "Failed to delete site");
                return;
            }
        }

        if (dependencyIds.length > 0) {
            const force = confirm(
                `${dependencyIds.length} stations have linked bookings/assets.\n\nForce delete them?`,
            );
            if (force) {
                for (const siteId of dependencyIds) {
                    const resForce = await fetch(
                        `/api/stations/${siteId}?force=1`,
                        { method: "DELETE" },
                    );
                    if (!resForce.ok) {
                        const err2 = await resForce.json().catch(() => ({}));
                        alert(
                            err2.message ||
                                err2.error ||
                                "Failed to delete site",
                        );
                        return;
                    }
                }
            }
        }

        setSelectedSiteIds([]);
        await fetchSitesAndNe();
    };

    const assignSelectedSites = async () => {
        if (!supervisorId || selectedSiteIds.length === 0) return;
        try {
            setAssigning(true);
            await Promise.all(
                selectedSiteIds.map((siteId) =>
                    fetch(`/api/stations/${siteId}/move-supervisors`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ supervisorIds: [supervisorId] }),
                    }),
                ),
            );
            setSelectedSiteIds([]);
            await fetchSitesAndNe();
        } catch (e: any) {
            alert(e?.message || "Failed to assign stations");
        } finally {
            setAssigning(false);
        }
    };

    const assignManagerToSiteIds = async (
        siteIds: string[],
        managerId: string,
    ) => {
        const uniqueSiteIds = Array.from(
            new Set(siteIds.map((id) => String(id || "")).filter(Boolean)),
        );

        await Promise.all(
            uniqueSiteIds.map(async (siteId) => {
                const res = await fetch(`/api/stations/${siteId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ supervisorSiteId: managerId }),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || "Failed to assign manager");
                }
            }),
        );

        setSites((prev) =>
            prev.map((site) =>
                uniqueSiteIds.includes(String(site.id))
                    ? { ...site, supervisorSiteId: managerId }
                    : site,
            ),
        );
    };

    const assignSelectedSitesToManager = async () => {
        if (!isAdmin || selectedSiteIds.length === 0) return;

        const selectedManagerId = String(bulkManagerId || "");
        if (!selectedManagerId) {
            alert("Select a manager first.");
            return;
        }

        try {
            setAssigning(true);
            await assignManagerToSiteIds(selectedSiteIds, selectedManagerId);
            setSelectedSiteIds([]);
            setBulkManagerId("");
            await fetchSitesAndNe();
        } catch (e: any) {
            alert(e?.message || "Failed to assign manager");
        } finally {
            setAssigning(false);
        }
    };

    const normalizeToken = (value?: string | null) =>
        String(value || "")
            .trim()
            .toLowerCase();

    const isAazHqText = (value?: string | null) => {
        const v = normalizeToken(value);
        return (
            v.includes("aaz") ||
            v.includes("head quarter") ||
            v === "hq" ||
            v.startsWith("hq-") ||
            v.includes("caaz")
        );
    };

    const assignmentMatches = (
        assignments: string[] | undefined,
        idValue?: string | null,
        nameValue?: string | null,
    ) => {
        if (!Array.isArray(assignments) || assignments.length === 0) {
            return false;
        }
        const idNorm = normalizeToken(idValue);
        const nameNorm = normalizeToken(nameValue);
        return assignments.some((raw) => {
            const token = normalizeToken(raw);
            return token === idNorm || token === nameNorm;
        });
    };

    const isAazHqManager = (mgr: ManagerOption) => {
        if (mgr.assignedRegion.some((r) => isAazHqText(r))) return true;
        if (mgr.assignedZone.some((z) => isAazHqText(z))) return true;
        if (isAazHqText(mgr.locationCategory || "")) return true;
        if (isAazHqText(mgr.location || "")) return true;
        return false;
    };

    const getEligibleManagerForSite = (site: Site) => {
        if (managers.length === 0) return [];

        const regionName = site.regionId ? regionsById.get(site.regionId) : "";
        const zoneName = site.zoneId ? zonesById.get(site.zoneId) : "";
        const siteIsAazHq = isAazHqText(regionName) || isAazHqText(zoneName);

        const scoped = managers.filter((mgr) => {
            if (siteIsAazHq) {
                return isAazHqManager(mgr);
            }
            const zoneMatch = assignmentMatches(
                mgr.assignedZone,
                site.zoneId,
                zoneName,
            );
            const regionMatch = assignmentMatches(
                mgr.assignedRegion,
                site.regionId,
                regionName,
            );
            return zoneMatch || regionMatch;
        });

        return scoped.length > 0 ? scoped : managers;
    };

    const getManagerOptionsForSite = (site: Site) => {
        // Admin reassignment should always allow all managers.
        if (isAdmin) return managers;
        return getEligibleManagerForSite(site);
    };

    const handleAssignManagerForSite = async (
        site: Site,
        managerId: string,
    ) => {
        if (!isAdmin) return;

        const selectedManagerId = String(managerId || "");
        if (!selectedManagerId) {
            alert("Select a manager first.");
            return;
        }

        try {
            setAssigningManagerSiteId(site.id);
            const sameCodeIds = stations
                .filter(
                    (s) =>
                        s.siteCode &&
                        site.siteCode &&
                        s.siteCode === site.siteCode,
                )
                .map((s) => s.id);
            const targetSiteIds =
                sameCodeIds.length > 0 ? sameCodeIds : [site.id];

            await assignManagerToSiteIds(targetSiteIds, selectedManagerId);
        } catch (e: any) {
            alert(e?.message || "Failed to assign manager");
        } finally {
            setAssigningManagerSiteId(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-background text-foreground flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Sites &amp; NE</h1>
                    <p className="text-sm text-muted-foreground">
                        View and manage stations and NE names, filtered by region
                        and zone.
                    </p>
                </div>
                {(isAdmin || isManager) && (
                    <Button
                        size="sm"
                        className="et-primary-button inline-flex items-center gap-1"
                        onClick={openSiteForm}
                    >
                        <Plus className="h-3 w-3" /> Add Site
                    </Button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs md:text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Filter className="h-3 w-3" /> Filters
                </div>
                {!isManager && !hideRegionFilter && (
                    <select
                        value={regionFilter}
                        onChange={(e) => {
                            setRegionFilter(e.target.value);
                            setZoneFilter("");
                        }}
                        className="h-8 rounded border px-2 text-xs md:text-sm"
                    >
                        <option value="">All regions</option>
                        {regions
                            .filter(
                                (r) =>
                                    isScopedAdmin || !/(AAZ|HQ)/i.test(r.name),
                            )
                            .map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                    </select>
                )}
                {!isManager && (
                    <select
                        value={zoneFilter}
                        onChange={(e) => setZoneFilter(e.target.value)}
                        className="h-8 rounded border px-2 text-xs md:text-sm"
                    >
                        <option value="">All zones</option>
                        {filteredZones.map((z) => (
                            <option key={z.id} value={z.id}>
                                {z.name}
                            </option>
                        ))}
                    </select>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <input
                        type="text"
                        value={siteSearch}
                        onChange={(e) => setSiteSearch(e.target.value)}
                        placeholder="Search by site code or name"
                        className="h-8 w-40 md:w-60 rounded border px-2 text-xs md:text-sm"
                    />
                </div>
            </div>

            {(canAssignSites || canSelectForDelete) && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                        {canAssignSites ? (
                            <>
                                <span className="text-muted-foreground">
                                    Assigning to supervisor:
                                </span>
                                <span className="font-medium">
                                    {supervisorId}
                                </span>
                            </>
                        ) : (
                            <span className="text-muted-foreground">
                                Bulk actions
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isAdmin && managers.length > 0 && (
                            <>
                                <select
                                    value={bulkManagerId}
                                    onChange={(e) =>
                                        setBulkManagerId(e.target.value)
                                    }
                                    className="h-8 rounded border px-2 text-xs md:text-sm"
                                >
                                    <option value="">Assign to manager</option>
                                    {managers.map((mgr) => (
                                        <option key={mgr.id} value={mgr.id}>
                                            {mgr.fullName}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    size="sm"
                                    disabled={
                                        assigning ||
                                        selectedSiteIds.length === 0 ||
                                        !bulkManagerId
                                    }
                                    onClick={assignSelectedSitesToManager}
                                >
                                    {assigning
                                        ? "Assigning..."
                                        : "Assign to Manager"}
                                </Button>
                            </>
                        )}
                        <label className="text-xs text-muted-foreground">
                            Select all
                        </label>
                        <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                        />
                        {canAssignSites && (
                            <Button
                                size="sm"
                                disabled={
                                    assigning ||
                                    selectedSiteIds.length === 0 ||
                                    !supervisorId
                                }
                                onClick={assignSelectedSites}
                            >
                                {assigning ? "Assigning..." : "Assign Selected"}
                            </Button>
                        )}
                        {canSelectForDelete && (
                            <Button
                                size="sm"
                                variant="destructive"
                                disabled={selectedSiteIds.length === 0}
                                onClick={deleteSelectedSites}
                            >
                                Delete Selected
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {error}
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="col-span-3 overflow-x-auto rounded-md border bg-card">
                    <table className="min-w-full text-xs md:text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                {(canAssignSites || canSelectForDelete) && (
                                    <th className="px-3 py-2 text-left font-medium">
                                        Select
                                    </th>
                                )}
                                <th className="px-3 py-2 text-left font-medium">
                                    Site Code
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Name
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Region
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    Zone
                                </th>
                                <th className="px-3 py-2 text-left font-medium">
                                    NE
                                </th>
                                {(isAdmin || isManager) && (
                                    <th className="px-3 py-2 text-left font-medium">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={
                                            (canAssignSites ||
                                            canSelectForDelete
                                                ? 7
                                                : 6) +
                                            (isAdmin || isManager ? 1 : 0)
                                        }
                                        className="px-3 py-4 text-center text-muted-foreground"
                                    >
                                        Loading stations...
                                    </td>
                                </tr>
                            ) : expandedSiteRows.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={
                                            (canAssignSites ||
                                            canSelectForDelete
                                                ? 7
                                                : 6) +
                                            (isAdmin || isManager ? 1 : 0)
                                        }
                                        className="px-3 py-4 text-center text-muted-foreground"
                                    >
                                        No stations found.
                                    </td>
                                </tr>
                            ) : (
                                expandedSiteRows.map((s, idx) => {
                                    // If zoneFilter is set, show '-' for region column
                                    const hasZone = Boolean(s.zoneId);
                                    const regionName = hasZone
                                        ? "-"
                                        : s.regionId
                                          ? regionsById.get(s.regionId) ||
                                            s.regionId
                                          : "-";
                                    const zoneName = hasZone
                                        ? zonesById.get(s.zoneId!) || s.zoneId
                                        : "-";
                                    const neDisplay = s.neDisplay || "";

                                    // determine assigned manager by finding any site with the same code
                                    const assignedManagerId =
                                        stations.find(
                                            (x) =>
                                                x.siteCode === s.siteCode &&
                                                x.supervisorSiteId,
                                        )?.supervisorSiteId || null;
                                    const currentManager = assignedManagerId
                                        ? managers.find(
                                              (m) => m.id === assignedManagerId,
                                          )
                                        : undefined;
                                    // only display the manager's name; codes are noisy
                                    const currentManagerInfo = currentManager
                                        ? currentManager.fullName
                                        : null;

                                    return (
                                        <tr
                                            key={`${s.id}-${idx}-${neDisplay}`}
                                            className="border-t hover:bg-muted/40"
                                        >
                                            {(canAssignSites ||
                                                canSelectForDelete) && (
                                                <td className="px-3 py-2 align-top">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSiteIds.includes(
                                                            s.id,
                                                        )}
                                                        onChange={() =>
                                                            toggleSiteSelection(
                                                                s.id,
                                                            )
                                                        }
                                                    />
                                                </td>
                                            )}
                                            <td className="px-3 py-2 align-top">
                                                {s.siteCode || "-"}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                {s.name || "-"}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                {regionName}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                {zoneName}
                                            </td>
                                            <td className="px-3 py-2 align-top text-xs">
                                                {neDisplay || "-"}
                                            </td>
                                            {(isAdmin || isManager) && (
                                                <td className="px-3 py-2 align-top">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            onClick={() =>
                                                                openEditSiteForm(
                                                                    s,
                                                                )
                                                            }
                                                            className="px-2 py-1 bg-background border rounded text-xs hover:bg-base-hover"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteSite(
                                                                    s,
                                                                )
                                                            }
                                                            className="p-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
                                                            aria-label="Delete site"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>

                                                        {isAdmin && (
                                                            <DropdownMenu.Root>
                                                                <DropdownMenu.Trigger
                                                                    asChild
                                                                >
                                                                    <Button
                                                                        size="sm"
                                                                        className="et-primary-button h-7 px-2 text-xs inline-flex items-center gap-1"
                                                                        disabled={
                                                                            assigningManagerSiteId ===
                                                                            s.id
                                                                        }
                                                                    >
                                                                        <UserCog className="mr-1 h-3.5 w-3.5" />
                                                                        {assigningManagerSiteId ===
                                                                        s.id
                                                                            ? "Saving..."
                                                                            : assignedManagerId
                                                                              ? "Reassign"
                                                                              : "Assign"}
                                                                    </Button>
                                                                </DropdownMenu.Trigger>
                                                                <DropdownMenu.Content
                                                                    side="bottom"
                                                                    align="end"
                                                                    className={cn(
                                                                        MENU_BG_CLASS,
                                                                        "max-h-72 overflow-y-auto w-48",
                                                                    )}
                                                                >
                                                                    {assignedManagerId &&
                                                                        currentManagerInfo && (
                                                                            <>
                                                                                <DropdownMenu.Item
                                                                                    className="px-3 py-2 text-sm text-muted-foreground cursor-default"
                                                                                    disabled
                                                                                >
                                                                                    Current:{" "}
                                                                                    {
                                                                                        currentManagerInfo
                                                                                    }
                                                                                </DropdownMenu.Item>
                                                                                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                                                                            </>
                                                                        )}
                                                                    {getManagerOptionsForSite(
                                                                        s,
                                                                    ).length ===
                                                                        0 && (
                                                                        <DropdownMenu.Item className="px-3 py-2 text-sm text-muted-foreground">
                                                                            No
                                                                            managers
                                                                            available
                                                                        </DropdownMenu.Item>
                                                                    )}
                                                                    {getManagerOptionsForSite(
                                                                        s,
                                                                    ).map(
                                                                        (
                                                                            mgr,
                                                                        ) => (
                                                                            <DropdownMenu.Item
                                                                                key={
                                                                                    mgr.id
                                                                                }
                                                                                className="px-3 py-2 text-sm hover:bg-muted cursor-pointer"
                                                                                onSelect={() =>
                                                                                    void handleAssignManagerForSite(
                                                                                        s,
                                                                                        mgr.id,
                                                                                    )
                                                                                }
                                                                            >
                                                                                {
                                                                                    mgr.fullName
                                                                                }
                                                                            </DropdownMenu.Item>
                                                                        ),
                                                                    )}
                                                                </DropdownMenu.Content>
                                                            </DropdownMenu.Root>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="col-span-3 text-xs text-muted-foreground">
                    Your stations: {expandedSiteRows.length}
                    {stations.length !== visibleSites.length
                        ? ` · Organization total (unique stations): ${stations.length}`
                        : ""}
                </div>
            </div>

            {showSiteForm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-full max-w-4xl rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold">
                                    {editingSite ? "Edit Site" : "Add Site"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={closeSiteForm}
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Close
                                </button>
                            </div>
                            <form
                                onSubmit={handleSaveSite}
                                className="space-y-4 text-sm"
                            >
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Site Code *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formSiteCode}
                                            onChange={(e) =>
                                                setFormSiteCode(e.target.value)
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm placeholder:text-muted-foreground"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formName}
                                            onChange={(e) =>
                                                setFormName(e.target.value)
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm placeholder:text-muted-foreground"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Region
                                        </label>
                                        <select
                                            value={formRegionId}
                                            onChange={(e) => {
                                                const nextRegion =
                                                    e.target.value;
                                                setFormRegionId(nextRegion);
                                                if (formZoneId) {
                                                    const z = zones.find(
                                                        (z) =>
                                                            z.id === formZoneId,
                                                    );
                                                    const regionName = String(
                                                        regions.find(
                                                            (r) =>
                                                                r.id ===
                                                                nextRegion,
                                                        )?.name || "",
                                                    ).toLowerCase();
                                                    const regionIsAazHq =
                                                        /aaz/i.test(
                                                            regionName,
                                                        ) ||
                                                        regionName.includes(
                                                            "head quarter",
                                                        ) ||
                                                        regionName === "hq" ||
                                                        /caaz/i.test(
                                                            regionName,
                                                        );
                                                    const zoneName = String(
                                                        z?.name || "",
                                                    ).toLowerCase();
                                                    const zoneIsAazHq =
                                                        /aaz/i.test(zoneName) ||
                                                        zoneName.startsWith(
                                                            "hq-",
                                                        ) ||
                                                        /caaz/i.test(zoneName);
                                                    if (
                                                        z &&
                                                        ((nextRegion &&
                                                            !regionIsAazHq &&
                                                            z.regionId !==
                                                                nextRegion) ||
                                                            (!nextRegion &&
                                                                !zoneIsAazHq))
                                                    ) {
                                                        setFormZoneId("");
                                                    }
                                                }
                                                setFormRegionChosenExplicitly(
                                                    Boolean(nextRegion),
                                                );
                                                setFormZoneChosenExplicitly(
                                                    false,
                                                );
                                            }}
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        >
                                            <option value="">
                                                Select region
                                            </option>
                                            {regions.map((r) => (
                                                <option key={r.id} value={r.id}>
                                                    {r.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Selecting a Region filters the Zone
                                            list below. Zone is optional.
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Zone
                                        </label>
                                        <select
                                            value={formZoneId}
                                            onChange={(e) => {
                                                const nextZone = e.target.value;
                                                setFormZoneId(nextZone);
                                                const match = zones.find(
                                                    (z) => z.id === nextZone,
                                                );
                                                const zoneName = String(
                                                    match?.name || "",
                                                ).toLowerCase();
                                                const zoneIsAazHq =
                                                    /aaz/i.test(zoneName) ||
                                                    zoneName.startsWith(
                                                        "hq-",
                                                    ) ||
                                                    /caaz/i.test(zoneName);

                                                if (!nextZone) {
                                                    setFormZoneChosenExplicitly(
                                                        false,
                                                    );
                                                    return;
                                                }

                                                if (!zoneIsAazHq) {
                                                    setFormRegionId(
                                                        match?.regionId || "",
                                                    );
                                                } else if (!formRegionId) {
                                                    const regionMatch =
                                                        regions.find(
                                                            (r) =>
                                                                r.name.toLowerCase() ===
                                                                zoneName,
                                                        );
                                                    if (regionMatch) {
                                                        setFormRegionId(
                                                            regionMatch.id,
                                                        );
                                                    }
                                                }

                                                setFormZoneChosenExplicitly(
                                                    true,
                                                );
                                                setFormRegionChosenExplicitly(
                                                    false,
                                                );
                                            }}
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        >
                                            <option value="">
                                                Select zone
                                            </option>
                                            {zones
                                                .filter((z) => {
                                                    const selZone = zones.find(
                                                        (zz) =>
                                                            zz.id ===
                                                            formZoneId,
                                                    );
                                                    const selZoneName = String(
                                                        selZone?.name || "",
                                                    ).toLowerCase();
                                                    const selZoneIsAazHq =
                                                        /aaz/i.test(
                                                            selZoneName,
                                                        ) ||
                                                        selZoneName.startsWith(
                                                            "hq-",
                                                        ) ||
                                                        /caaz/i.test(
                                                            selZoneName,
                                                        );

                                                    const selRegion =
                                                        regions.find(
                                                            (r) =>
                                                                r.id ===
                                                                formRegionId,
                                                        );
                                                    const selRegionName =
                                                        String(
                                                            selRegion?.name ||
                                                                "",
                                                        ).toLowerCase();
                                                    const selRegionIsAazHq =
                                                        /aaz/i.test(
                                                            selRegionName,
                                                        ) ||
                                                        selRegionName.includes(
                                                            "head quarter",
                                                        ) ||
                                                        selRegionName ===
                                                            "hq" ||
                                                        /caaz/i.test(
                                                            selRegionName,
                                                        );

                                                    const zname = String(
                                                        z.name || "",
                                                    ).toLowerCase();
                                                    const isAazHqZone =
                                                        /aaz/i.test(zname) ||
                                                        zname.startsWith(
                                                            "hq-",
                                                        ) ||
                                                        /caaz/i.test(zname) ||
                                                        String(
                                                            regions.find(
                                                                (r) =>
                                                                    r.id ===
                                                                    z.regionId,
                                                            )?.name || "",
                                                        )
                                                            .toLowerCase()
                                                            .includes(
                                                                "head quarter",
                                                            );

                                                    if (
                                                        selZoneIsAazHq ||
                                                        selRegionIsAazHq
                                                    ) {
                                                        return isAazHqZone;
                                                    }

                                                    if (formRegionId) {
                                                        return (
                                                            z.regionId ===
                                                                formRegionId &&
                                                            !isAazHqZone
                                                        );
                                                    }

                                                    return true;
                                                })
                                                .map((z) => (
                                                    <option
                                                        key={z.id}
                                                        value={z.id}
                                                    >
                                                        {z.name}
                                                    </option>
                                                ))}
                                        </select>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            Select a Zone when the site belongs
                                            to a specific zone inside the chosen
                                            Region.
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Latitude
                                        </label>
                                        <input
                                            type="text"
                                            value={formLatitude}
                                            onChange={(e) =>
                                                setFormLatitude(e.target.value)
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm placeholder:text-muted-foreground"
                                            placeholder="e.g. 9.002111"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium">
                                            Longitude
                                        </label>
                                        <input
                                            type="text"
                                            value={formLongitude}
                                            onChange={(e) =>
                                                setFormLongitude(e.target.value)
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm placeholder:text-muted-foreground"
                                            placeholder="e.g. 38.767056"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium">
                                        NE name / ID
                                    </label>
                                    <input
                                        type="text"
                                        value={formNeName}
                                        onChange={(e) =>
                                            setFormNeName(e.target.value)
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm placeholder:text-muted-foreground"
                                        placeholder="e.g. NE12345"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeSiteForm}
                                        className="rounded border px-3 py-1 text-xs hover:bg-muted/50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingSite}
                                        className="h-7 px-3 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60"
                                    >
                                        {savingSite ? "Saving..." : "Save"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
