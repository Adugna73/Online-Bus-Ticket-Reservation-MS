"use client";
import {
    Users,
    Plus,
    Edit,
    Trash2,
    ChevronDown,
    ChevronRight,
    MapPin,
    Building,
    UserCheck,
    IdCard,
    User,
    X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

// You'll also need a schema for validation - add this import
// import { z } from "zod"; // Uncomment if using Zod
// const passengerSchema = z.object({ ... }); // Define your schema

interface Passenger {
    id: string;
    name: string;
    username: string;
    staffId?: string;
    email?: string;
}

interface Site {
    id: string;
    name: string;
    siteCode: string;
    regionId?: string;
    zoneId?: string;
    neNameAndId?: string;
    networkElements?: NetworkElement[];
}

interface NetworkElement {
    id: string;
    name: string;
    neId: string;
    type?: string;
    siteId?: string;
}

interface Staff {
    id: string;
    name: string;
    staffId?: string;
    email?: string;
    stations: Site[];
    passengers: Passenger[];
    regionCode?: string;
    areaName?: string;
}

interface Manager {
    id: string;
    name: string;
    staffId?: string;
}

interface Region {
    manager?: Manager;
    areas: Record<string, Staff[]>;
}

interface Organization {
    [regionCode: string]: Region;
}

interface TeamClientProps {
    organization?: Organization;
    visibleTeam?: any[];
    canEdit?: boolean;
    // callbacks passed from wrapper component
    setOrganization?: React.Dispatch<React.SetStateAction<Organization>>;
    setVisibleTeam?: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function TeamClient({
    organization = {},
    visibleTeam = [],
    canEdit = false,
    setOrganization,
    setVisibleTeam,
}: TeamClientProps) {
    const { data: session } = useSession();
    const user = session?.user as any;
    const roleLower = String(user?.role || "").toLowerCase();

    // State for UI interactions
    const [expandedRegions, setExpandedRegions] = useState<Set<string>>(
        new Set(),
    );
    const [expandedManager, setExpandedManager] = useState<Set<string>>(
        new Set(),
    );
    const [selectedStaff, setSelectedStaff] =
        useState<Staff | null>(null);
    const [showAddPassenger, setShowAddPassenger] = useState(false);
    const [editingPassenger, setEditingPassenger] =
        useState<Passenger | null>(null);
    const [newPassenger, setNewPassenger] = useState<{
        name: string;
        email: string;
        phone: string;
        username: string;
        staffId: string;
        assignedRegion: string[];
        assignedZone: string[];
        location?: string;
        roleKey: string;
    }>({
        name: "",
        email: "",
        phone: "",
        username: "",
        staffId: "",
        assignedRegion: selectedStaff?.regionCode
            ? [selectedStaff.regionCode]
            : [],
        assignedZone: [],
        location: undefined,
        roleKey: "Passenger",
    });
    // ...existing code...

    // State for stations and NEs management
    const [showAddSite, setShowAddSite] = useState(false);
    // Separate modal for assigning existing stations to a specific
    // supervisor group (Group-1, Group-2, ...).
    const [showGroupSitesModal, setShowGroupSitesModal] = useState(false);
    const [groupSitesLoading, setGroupSitesLoading] = useState(false);
    const [groupSiteCandidates, setGroupSiteCandidates] = useState<Site[]>([]);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [showAddNE, setShowAddNE] = useState(false);
    const [editingNE, setEditingNE] = useState<NetworkElement | null>(null);
    const [selectedSiteForNE, setSelectedSiteForNE] = useState<Site | null>(
        null,
    );
    const [newSite, setNewSite] = useState({
        name: "",
        siteCode: "",
        neNameAndId: "",
        region: "", // regionId when using manager form
        zone: "", // zoneId when using manager form
        latitude: "",
        longitude: "",
    });
    const [newNE, setNewNE] = useState({ name: "", neId: "", type: "" });

    // State for fetched data
    const [teamSites, setTeamSites] = useState<Site[]>([]);
    const [loadingSites, setLoadingSites] = useState(false);

    // State for grouping passengers into a team (for supervisors)
    const [groupingTeam, setGroupingTeam] = useState(false);
    const [groupStatus, setGroupStatus] = useState<string | null>(null);
    const techListRef = useRef<HTMLDivElement | null>(null);

    // Active group (team) selection for supervisors – allows multiple
    // Group-1, Group-2, ... per supervisor.
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [groupsLoaded, setGroupsLoaded] = useState(false);

    // Manager filter state
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [supLocations, setSupLocations] = useState<string[]>([]);

    // Get user's team information
    // ...existing code...
    const userTeam = useMemo(() => {
        if (!organization || !user) return null;

        const role = user?.role ? String(user.role).toLowerCase() : "";

        // For supervisors, show themselves as team lead
        if (role === "supervisor") {
            // Find the supervisor in the organization
            for (const [regionCode, region] of Object.entries(organization)) {
                if (!region.areas) continue;
                for (const [areaName, supervisors] of Object.entries(
                    region.areas,
                )) {
                    const supervisor = supervisors.find(
                        (s) => s.id === user.id,
                    );
                    if (supervisor) {
                        return {
                            type: "supervisor",
                            supervisor,
                            regionCode,
                            areaName,
                        };
                    }
                }
            }
        }

        // For passengers, find their supervisor
        if (role === "passenger") {
            for (const [regionCode, region] of Object.entries(organization)) {
                if (!region.areas) continue;
                for (const [areaName, supervisors] of Object.entries(
                    region.areas,
                )) {
                    for (const supervisor of supervisors) {
                        const passenger = supervisor.passengers.find(
                            (t) => t.id === user.id,
                        );
                        if (passenger) {
                            return {
                                type: "passenger",
                                supervisor,
                                passenger,
                                regionCode,
                                areaName,
                            };
                        }
                    }
                }
            }
        }

        return null;
    }, [organization, user]);

    // For supervisors: compute which regions/areas they appear in (from organization)
    const supervisorAreasByRegion = useMemo(() => {
        const out: Record<string, string[]> = {};
        if (!organization || !user) return out;
        const supId = user?.id;
        for (const [regionCode, region] of Object.entries(organization)) {
            if (!region.areas) continue;
            for (const [areaName, supervisors] of Object.entries(
                region.areas || {},
            )) {
                if (supervisors.some((s) => s.id === supId)) {
                    if (!out[regionCode]) out[regionCode] = [];
                    if (!out[regionCode].includes(areaName))
                        out[regionCode].push(areaName);
                }
            }
        }
        return out;
    }, [organization, user]);

    // Determine if current user is an HQ supervisor (used to show manager-style Add Site form)
    const assignedZonesLower = Array.isArray((user as any)?.assignedZone)
        ? ((user as any).assignedZone as string[]).map((z) =>
              String(z).toLowerCase(),
          )
        : [];
    const assignedRegionsLower = Array.isArray((user as any)?.assignedRegion)
        ? ((user as any).assignedRegion as string[]).map((r) =>
              String(r).toLowerCase(),
          )
        : [];
    const isHqStaff =
        roleLower === "supervisor" &&
        (assignedRegionsLower.some(
            (r) => r.includes("head quarter") || r === "hq",
        ) ||
            assignedZonesLower.some((z) => z.startsWith("hq-")) ||
            String((user as any)?.locationCategory || "")
                .toLowerCase()
                .includes("head quarter"));

    // Region supervisor: ordinary (non-HQ) supervisor assigned to one or more regions
    const isRegionStaff =
        roleLower === "supervisor" &&
        !isHqStaff &&
        Array.isArray((user as any)?.assignedRegion) &&
        ((user as any).assignedRegion as string[]).length > 0;

    // All groups (team) owned by this supervisor (managerId === user.id)
    // Deduplicate by Group-N name so accidental duplicates don't create
    // multiple chips/cards for the same logical group number.
    const supervisorGroups = useMemo(() => {
        if (roleLower !== "supervisor" || !user?.id) return [];
        const mine = (visibleTeam || []).filter(
            (t: any) => t.managerId === user.id,
        );
        const seenGroupNames = new Set<string>();
        // Only treat team with names like "Group-1", "Group-2", ... as
        // supervisor groups. Base team such as "Zeine Nesro Mahdi Team"
        // should not appear as group chips/cards in the supervisor view.
        return mine.filter((t: any) => {
            const raw = String(t.name || "").trim();
            const m = raw.match(/^Group-(\d+)$/i);
            if (!m) return false;
            const key = raw.toLowerCase();
            if (seenGroupNames.has(key)) return false;
            seenGroupNames.add(key);
            return true;
        });
    }, [roleLower, user?.id, visibleTeam]);

    // Initial load of supervisor-owned groups from /api/team into
    // visibleTeam so they can be selected as Group-1, Group-2, ...
    useEffect(() => {
        if (roleLower !== "supervisor") return;
        if (!setVisibleTeam) return;
        if (groupsLoaded) return;
        (async () => {
            try {
                const resp = await fetch("/api/team", {
                    credentials: "same-origin",
                });
                if (!resp.ok) return;
                const all = await resp.json();
                const mine = (all || []).filter(
                    (t: any) => t.managerId === user?.id,
                );
                if (mine.length) {
                    // Merge any supervisor-owned team into visibleTeam,
                    // de-duplicating by id so groups persist across refreshes.
                    setVisibleTeam?.(
                        [...visibleTeam, ...mine].filter(
                            (t, idx, arr) =>
                                t.id &&
                                arr.findIndex((x: any) => x.id === t.id) ===
                                    idx,
                        ),
                    );
                }
            } catch (e) {
                // non-fatal – grouping UI will still work when creating new groups
            } finally {
                setGroupsLoaded(true);
            }
        })();
    }, [roleLower, groupsLoaded, setVisibleTeam, user?.id, visibleTeam]);

    // Default the active group to the first supervisor group when available
    useEffect(() => {
        if (roleLower !== "supervisor") return;
        if (!activeGroupId && supervisorGroups.length > 0) {
            setActiveGroupId(supervisorGroups[0].id);
        }
    }, [roleLower, supervisorGroups, activeGroupId]);

    // Ensure there is a concrete Team record representing this supervisor's
    // grouped passengers so that stations can be attached to the team.
    const ensureStaffTeam = useCallback(async () => {
        if (!userTeam || !userTeam.supervisor) return null;
        const sup = userTeam.supervisor;
        setGroupStatus(null);

        try {
            // 1) Try existing visibleTeam first
            let team: any | null =
                (visibleTeam || []).find(
                    (t: any) =>
                        t.managerId === sup.id ||
                        (t.members || []).some((m: any) => m.id === sup.id),
                ) || null;

            // 2) If not found, fetch from /api/team
            if (!team) {
                const resp = await fetch("/api/team", {
                    credentials: "same-origin",
                });
                if (resp.ok) {
                    const all = await resp.json();
                    team =
                        (all || []).find(
                            (t: any) =>
                                t.managerId === sup.id ||
                                (t.members || []).some(
                                    (m: any) => m.id === sup.id,
                                ),
                        ) || null;
                }
            }

            // 3) If still missing, create a new group-style team for this supervisor
            if (!team) {
                // Derive next group number from existing team for this supervisor
                let nextIndex = 1;
                try {
                    const allResp = await fetch("/api/team", {
                        credentials: "same-origin",
                    });
                    if (allResp.ok) {
                        const allTeam = await allResp.json();
                        const myTeam = (allTeam || []).filter(
                            (t: any) => t.managerId === sup.id,
                        );
                        const used = myTeam
                            .map((t: any) =>
                                String(t.name || "")
                                    .trim()
                                    .match(/^Group-(\d+)$/i),
                            )
                            .filter(Boolean)
                            .map((m: any) => parseInt(m[1], 10))
                            .filter((n: number) => !Number.isNaN(n));
                        if (used.length > 0) {
                            nextIndex = Math.max(...used) + 1;
                        }
                    }
                } catch (e) {
                    // fall back to Group-1 when inspection fails
                }

                const createResp = await fetch("/api/team", {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: `Group-${nextIndex}`,
                        managerId: sup.id,
                    }),
                });
                if (createResp.ok) {
                    team = await createResp.json();
                }
            }

            // 4) Keep visibleTeam in sync so other parts of the UI can use it
            if (team && setVisibleTeam) {
                setVisibleTeam(
                    [...visibleTeam, team].filter((t, idx, arr) => {
                        const id = t.id;
                        return (
                            id && arr.findIndex((x: any) => x.id === id) === idx
                        );
                    }),
                );
            }

            return team;
        } catch (e: any) {
            console.error("Failed to ensure supervisor team", e);
            setGroupStatus("Could not prepare grouped team. Please try again.");
            return null;
        }
    }, [userTeam, visibleTeam, setVisibleTeam]);

    const deleteGroup = async (groupId: string, groupName: string) => {
        if (!confirm(`Delete ${groupName}? This action cannot be undone.`))
            return;

        try {
            const resp = await fetch(`/api/team/${groupId}`, {
                method: "DELETE",
                credentials: "same-origin",
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete group");
            }

            setVisibleTeam?.((prev: any[] = []) =>
                (prev || []).filter((t: any) => t.id !== groupId),
            );

            if (activeGroupId === groupId) {
                setActiveGroupId(null);
            }

            setGroupStatus(`${groupName} has been deleted.`);
        } catch (error: any) {
            console.error("Failed to delete group", error);
            setGroupStatus(
                `Could not delete ${groupName}: ${error?.message || "unknown error"}`,
            );
        }
    };

    // Regions/zones for manager-style Add Site modal (loaded on demand)
    const [availableRegions, setAvailableRegions] = useState<any[]>([]);
    const [availableZones, setAvailableZones] = useState<any[]>([]);
    useEffect(() => {
        if (showAddSite && (isHqStaff || isRegionStaff)) {
            // fetch regions and zones for the manager-style form (HQ or Region supervisors)
            Promise.all([fetch("/api/regions"), fetch("/api/zones")])
                .then(async ([rRes, zRes]) => {
                    const r = rRes.ok ? await rRes.json() : [];
                    const z = zRes.ok ? await zRes.json() : [];

                    if (isRegionStaff) {
                        const assigned = Array.isArray(
                            (user as any)?.assignedRegion,
                        )
                            ? ((user as any).assignedRegion as string[]).map(
                                  (v) => String(v).toLowerCase(),
                              )
                            : [];
                        const filteredRegions = r.filter(
                            (rr: any) =>
                                assigned.includes(
                                    String(rr.id).toLowerCase(),
                                ) ||
                                assigned.includes(
                                    String(rr.name).toLowerCase(),
                                ),
                        );
                        setAvailableRegions(filteredRegions);
                        setAvailableZones(
                            z.filter((zz: any) =>
                                filteredRegions.some(
                                    (fr: any) => fr.id === zz.regionId,
                                ),
                            ),
                        );

                        // auto-prefill region for region supervisors when exactly one assigned
                        if (filteredRegions.length === 1) {
                            setNewSite((ns) => ({
                                ...ns,
                                region: filteredRegions[0].id,
                            }));
                        } else if (
                            assigned.length > 0 &&
                            filteredRegions.length > 0 &&
                            !nsHasRegion()
                        ) {
                            // if assigned list contains a match by name, prefill first
                            setNewSite((ns) => ({
                                ...ns,
                                region: filteredRegions[0].id,
                            }));
                        }
                    } else {
                        setAvailableRegions(r);
                        setAvailableZones(z);
                    }
                })
                .catch(() => {
                    setAvailableRegions([]);
                    setAvailableZones([]);
                });
        }

        function nsHasRegion() {
            return Boolean((newSite && newSite.region) || false);
        }
    }, [showAddSite, isHqStaff, isRegionStaff]);

    const filteredOrganization = useMemo(() => {
        if (!organization) return {} as Organization;
        if (!selectedRegion && !selectedArea) return organization;

        const out: Organization = {};
        for (const [regionCode, region] of Object.entries(organization)) {
            if (selectedRegion && regionCode !== selectedRegion) continue;
            if (!region || !region.areas) continue;
            const areas: Record<string, Staff[]> = {};
            for (const [areaName, supervisors] of Object.entries(
                region.areas,
            )) {
                if (selectedArea && areaName !== selectedArea) continue;
                areas[areaName] = supervisors;
            }
            if (Object.keys(areas).length > 0) {
                out[regionCode] = { manager: region.manager, areas };
            }
        }
        return out;
    }, [organization, selectedRegion, selectedArea]);

    const filteredTeamSites = useMemo(() => {
        if (!teamSites || !user) return teamSites;

        // For supervisors viewing a specific group (Group-1, Group-2, ...),
        // show the stations attached to that group directly without applying
        // additional organization-based filters. Group-level site
        // assignments are stored on the Team itself, not on the
        // supervisor's organization.stations list.
        if (String(user.role || "").toLowerCase() === "supervisor") {
            if (activeGroupId) {
                return teamSites;
            }

            // When no specific group is active, fall back to filtering by
            // the supervisor's stations within the selected region/area.
            const supId = user.id;
            const supSites = new Set<string>();
            for (const [regionCode, region] of Object.entries(
                organization || {},
            )) {
                for (const [areaName, supervisors] of Object.entries(
                    region.areas || {},
                )) {
                    for (const sup of supervisors) {
                        if (sup.id === supId) {
                            if (
                                !selectedRegion ||
                                selectedRegion === regionCode
                            ) {
                                if (
                                    !selectedArea ||
                                    selectedArea === areaName
                                ) {
                                    (sup.stations || []).forEach((s: any) =>
                                        supSites.add(s.id),
                                    );
                                }
                            }
                        }
                    }
                }
            }
            if (supSites.size === 0) return [];
            return teamSites.filter((s) => supSites.has(s.id));
        }

        return teamSites;
    }, [
        teamSites,
        organization,
        user,
        selectedRegion,
        selectedArea,
        activeGroupId,
    ]);

    // Add Passenger error state
    const [addTechError, setAddTechError] = useState("");
    const [addingExistingTechId, setAddingExistingTechId] = useState<
        string | null
    >(null);
    // You'll need to implement this function
    const openEditPassenger = (passengerId: string) => {
        // Find the passenger in selectedStaff's passengers
        if (selectedStaff) {
            const passenger = selectedStaff.passengers.find(
                (t) => t.id === passengerId,
            );
            if (passenger) {
                setEditingPassenger(passenger);
            }
        }
    };

    // Fetch stations for the current user's team - wrapped in useCallback
    const fetchTeamSites = useCallback(async () => {
        if (!user) return;

        try {
            setLoadingSites(true);

            let stations: Site[] = [];
            const role = String(user?.role || "").toLowerCase();

            if (role === "supervisor") {
                // When a specific group (team) is active, load stations for that
                // group via the team API. Otherwise, fall back to the
                // organization payload for the supervisor.
                if (activeGroupId) {
                    try {
                        const stationsResponse = await fetch(
                            `/api/team/${activeGroupId}/stations`,
                            { credentials: "same-origin" },
                        );
                        if (stationsResponse.ok) {
                            stations = await stationsResponse.json();
                        }
                    } catch (err) {
                        console.error(
                            "Staff group stations fetch failed:",
                            err,
                        );
                    }

                    // If group-specific fetch fails or returns nothing, fall
                    // back to supervisor's organization stations.
                    if (!stations || stations.length === 0) {
                        stations = (userTeam?.supervisor?.stations || []) as Site[];
                    }
                } else if (userTeam?.supervisor) {
                    stations = (userTeam.supervisor.stations || []) as Site[];
                }
            } else {
                const response = await fetch("/api/team", {
                    credentials: "same-origin",
                });
                if (!response.ok) throw new Error("Failed to get user team");

                const team = await response.json();
                const userTeamData = team.find(
                    (t: any) =>
                        (t.members || []).some(
                            (m: any) =>
                                m.id === user?.id ||
                                m.immediateStaffId === user?.id,
                        ) || t.managerId === user?.id,
                );

                if (!userTeamData) {
                    setTeamSites([]);
                    return;
                }

                const stationsResponse = await fetch(
                    `/api/team/${userTeamData.id}/stations`,
                    { credentials: "same-origin" },
                );
                if (!stationsResponse.ok) throw new Error("Failed to fetch stations");

                stations = await stationsResponse.json();
            }

            // Fetch network elements for each site
            const stationsWithNEs = await Promise.all(
                (stations || []).map(async (site: Site) => {
                    try {
                        const neResponse = await fetch(
                            `/api/stations/${site.id}/network-elements`,
                        );
                        if (neResponse.ok) {
                            const networkElements = await neResponse.json();
                            return { ...site, networkElements };
                        }
                    } catch (error) {
                        console.error(
                            `Failed to fetch NEs for site ${site.id}:`,
                            error,
                        );
                    }
                    return { ...site, networkElements: [] };
                }),
            );

            setTeamSites(stationsWithNEs);
        } catch (error) {
            console.error("Error fetching team stations:", error);
        } finally {
            setLoadingSites(false);
        }
    }, [user, userTeam, activeGroupId]);

    // Add a useEffect to fetch stations on component mount
    // ...existing code...
    useEffect(() => {
        fetchTeamSites();
    }, [user, userTeam, activeGroupId, fetchTeamSites]);

    // whenever selectedStaff changes, load subordinate locations for their team
    useEffect(() => {
        if (!selectedStaff) {
            setSupLocations([]);
            return;
        }
        fetch(`/api/users?immediateStaffId=${selectedStaff.id}`)
            .then((r) => r.json())
            .then((data) => {
                const locs = Array.from(
                    new Set(
                        (data || [])
                            .map((u: any) => u.location)
                            .filter((l: any) => !!l),
                    ),
                );
                setSupLocations(locs as string[]);
                if (locs.length) {
                    setNewPassenger((t) => ({
                        ...t,
                        location: locs[0] as string,
                    }));
                }
            })
            .catch(console.error);
    }, [selectedStaff]);

    const addPassenger = async () => {
        setAddTechError("");
        if (!selectedStaff) {
            setAddTechError(
                "Staff context missing. Please refresh and try again.",
            );
            return;
        }
        // Zod validation - you need to define passengerSchema
        // const result = passengerSchema.safeParse(newPassenger);
        // if (!result.success) {
        //     setAddTechError(result.error.errors[0]?.message || "Validation error");
        //     return;
        // }
        try {
            // Prefer the currently active group (team) for this supervisor;
            // fall back to any team where the supervisor is manager/member.
            let teamId: string | null = null;
            const supId = selectedStaff.id;

            if (activeGroupId) {
                teamId = activeGroupId;
            } else {
                const teamFromVisible = (visibleTeam || []).find(
                    (t: any) =>
                        (t.members || []).some((m: any) => m.id === supId) ||
                        t.managerId === supId,
                );
                if (teamFromVisible) teamId = teamFromVisible.id;
            }

            const payload: any = {
                teamId,
                immediateStaffId: selectedStaff.id,
                fullName: newPassenger.name,
                email: newPassenger.email,
                username:
                    newPassenger.username ||
                    newPassenger.email ||
                    newPassenger.staffId,
                staffId: newPassenger.staffId || undefined,
                mobile: newPassenger.phone || undefined,
                assignedRegion: selectedStaff.regionCode
                    ? [selectedStaff.regionCode]
                    : [],
                assignedZone: selectedStaff.areaName
                    ? [selectedStaff.areaName]
                    : [],
                location: newPassenger.location || undefined,
                roleKey: "Passenger",
            };

            // Fetch CSRF token from NextAuth
            const csrfRes = await fetch("/api/auth/csrf");
            const { csrfToken } = await csrfRes.json();

            console.debug("addPassenger payload", payload);
            const resp = await fetch("/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken,
                },
                credentials: "include", // always send cookies for auth
                body: JSON.stringify(payload),
            });
            console.debug("addPassenger response status", resp.status);
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || "Failed to create passenger");
            }
            const created = await resp.json();

            setShowAddPassenger(false);
            setNewPassenger({
                name: "",
                email: "",
                phone: "",
                username: "",
                staffId: "",
                assignedRegion: [],
                assignedZone: [],
                location: undefined,
                roleKey: "Passenger",
            });

            // Update selectedStaff list in UI
            if (selectedStaff) {
                selectedStaff.passengers = [
                    ...(selectedStaff.passengers || []),
                    {
                        id: created.id,
                        name:
                            created.fullName ||
                            created.username ||
                            created.email,
                        username: created.username || created.email,
                        staffId: created.staffId,
                        email: created.email,
                    },
                ];
                setSelectedStaff({ ...selectedStaff });
            }
        } catch (error) {
            console.error("Error adding passenger:", error);
            alert("Failed to add passenger:" + (error as Error).message);
        }
    };

    // Helper to open the group-stations modal for a specific group team.
    const openGroupSitesModal = async (teamId: string) => {
        if (!user) return;
        setActiveGroupId(teamId);
        setGroupSitesLoading(true);
        try {
            // Base stations available to this supervisor are already
            // filtered by /api/stations using the current session.
            const res = await fetch("/api/stations", {
                credentials: "same-origin",
            });
            const allSites: Site[] = res.ok ? await res.json() : [];

            // Sites that are already attached to ANY team (used for
            // groups) are stored on visibleTeam via the `stations`
            // relation included from /api/team.
            const globallyAssignedSiteIds = new Set<string>();
            (visibleTeam || []).forEach((t: any) => {
                (t.stations || []).forEach((s: any) => {
                    if (s?.id) globallyAssignedSiteIds.add(s.id);
                });
            });

            const candidates = allSites.filter(
                (s) => s.id && !globallyAssignedSiteIds.has(s.id),
            );
            setGroupSiteCandidates(candidates);
            setShowGroupSitesModal(true);
        } catch (err) {
            console.error("Failed to load stations for group modal", err);
            setGroupSiteCandidates([]);
            setShowGroupSitesModal(true);
        } finally {
            setGroupSitesLoading(false);
        }
    };

    const editPassenger = async () => {
        if (
            !editingPassenger ||
            !editingPassenger.name ||
            !editingPassenger.email
        )
            return;
        try {
            const resp = await fetch(`/api/users/${editingPassenger.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: editingPassenger.name,
                    email: editingPassenger.email,
                    staffId: editingPassenger.staffId,
                }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || "Failed to update passenger");
            }
            const updated = await resp.json();
            setEditingPassenger(null);
            if (selectedStaff) {
                selectedStaff.passengers = (
                    selectedStaff.passengers || []
                ).map((t) =>
                    t.id === updated.id
                        ? { ...t, name: updated.fullName || updated.username }
                        : t,
                );
                setSelectedStaff({ ...selectedStaff });
            }
        } catch (error) {
            console.error("Error updating passenger:", error);
            setEditingPassenger(null);
            alert("Failed to update passenger:" + (error as Error).message);
        }
    };

    // delete a user from the system (also updates currently selected supervisor list)
    const deleteUser = async (userId: string) => {
        try {
            const resp = await fetch(`/api/users/${userId}`, {
                method: "DELETE",
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || "Failed to delete user");
            }
            if (selectedStaff) {
                selectedStaff.passengers = (
                    selectedStaff.passengers || []
                ).filter((t) => t.id !== userId);
                setSelectedStaff({ ...selectedStaff });
            }
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Failed to delete user:" + (error as Error).message);
        }
    };

    // helper to remove a site from our local organization state
    const removeSiteFromOrg = (supId: string, siteId: string) => {
        if (!setOrganization) return;
        setOrganization((o: any) => {
            const copy = { ...o };
            for (const regionKey of Object.keys(copy)) {
                const region = copy[regionKey];
                if (!region.areas) continue;
                for (const areaKey of Object.keys(region.areas)) {
                    const supList: any[] = region.areas[areaKey];
                    const idx = supList.findIndex((s) => s.id === supId);
                    if (idx !== -1) {
                        const sup = { ...supList[idx] };
                        sup.stations = (sup.stations || []).filter(
                            (s: any) => s.id !== siteId,
                        );
                        supList[idx] = sup;
                    }
                }
            }
            return copy;
        });
    };

    // unassign a site from a supervisor (PATCH site.supervisorSiteId = null)
    const unassignSite = async (site: Site, sup: Staff) => {
        if (!confirm(`Remove site ${site.name} from ${sup.name}?`)) return;
        try {
            const res = await fetch(`/api/stations/${site.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ supervisorSiteId: null }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to unassign site");
            }
            // update local state
            if (selectedStaff?.id === sup.id) {
                setSelectedStaff({
                    ...selectedStaff,
                    stations: (selectedStaff.stations || []).filter(
                        (s: any) => s.id !== site.id,
                    ),
                });
            }
            removeSiteFromOrg(sup.id, site.id);
        } catch (error: any) {
            console.error("Error unassigning site:", error);
            alert(
                "Failed to remove site:" + (error?.message || "unknown error"),
            );
        }
    };

    // CRUD functions for stations
    const addSite = async () => {
        if (!selectedStaff || !newSite.name || !newSite.siteCode) return;
        try {
            // Prefer the currently active group (team) for this supervisor.
            let userTeam: any = null;
            if (activeGroupId) {
                userTeam = (visibleTeam || []).find(
                    (t: any) => t.id === activeGroupId,
                );
            }

            // Fallbacks: locate a team linked to the user/supervisor
            if (!userTeam) {
                userTeam = (visibleTeam || []).find(
                    (t: any) =>
                        (t.members || []).some((m: any) => m.id === user?.id) ||
                        t.managerId === user?.id,
                );
            }

            if (!userTeam && selectedStaff) {
                userTeam = (visibleTeam || []).find(
                    (t: any) =>
                        t.managerId === selectedStaff.id ||
                        (t.members || []).some(
                            (m: any) => m.id === selectedStaff.id,
                        ),
                );
            }

            if (!userTeam) {
                alert(
                    "Unable to find your team. Please contact your administrator.",
                );
                return;
            }

            const stationsResponse = await fetch(
                `/api/team/${userTeam.id}/stations`,
                {
                    method: "POST",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: newSite.name,
                        siteCode: newSite.siteCode,
                        regionName:
                            selectedStaff.regionCode ||
                            userTeam.members?.[0]?.assignedRegion?.[0] ||
                            "default-region",
                        neNameAndId: newSite.neNameAndId,
                    }),
                },
            );
            if (!stationsResponse.ok) {
                const error = await stationsResponse.json();
                throw new Error(error.error || "Failed to add site");
            }
            const site = await stationsResponse.json();
            setShowAddSite(false);
            setNewSite({
                name: "",
                siteCode: "",
                neNameAndId: "",
                region: "",
                zone: "",
                latitude: "",
                longitude: "",
            });
            setTeamSites((prev) => [...prev, { ...site, networkElements: [] }]);
        } catch (error) {
            console.error("Error adding site:", error);
            alert("Failed to add site: " + (error as Error).message);
        }
    };

    const editSite = async () => {
        if (!editingSite || !editingSite.name || !editingSite.siteCode) return;
        try {
            let userTeam: any = null;
            if (activeGroupId) {
                userTeam = (visibleTeam || []).find(
                    (t: any) => t.id === activeGroupId,
                );
            }
            if (!userTeam) {
                userTeam = (visibleTeam || []).find(
                    (t: any) =>
                        (t.members || []).some((m: any) => m.id === user?.id) ||
                        t.managerId === user?.id,
                );
            }
            if (!userTeam) {
                const response = await fetch("/api/team", {
                    credentials: "same-origin",
                });
                if (!response.ok) throw new Error("Failed to get user team");
                const team = await response.json();
                userTeam = team.find(
                    (t: any) =>
                        (t.members || []).some((m: any) => m.id === user?.id) ||
                        t.managerId === user?.id,
                );
            }
            if (!userTeam) {
                alert(
                    "Unable to find your team. Please contact your administrator.",
                );
                return;
            }
            const siteResponse = await fetch(
                `/api/team/${userTeam.id}/stations`,
                {
                    method: "PUT",
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        siteId: editingSite.id,
                        name: editingSite.name,
                        siteCode: editingSite.siteCode,
                        regionName:
                            editingSite.regionId ||
                            selectedStaff?.regionCode ||
                            userTeam.members?.[0]?.assignedRegion?.[0] ||
                            "default-region",
                        zoneName: editingSite.zoneId,
                        neNameAndId: editingSite.neNameAndId,
                    }),
                },
            );
            if (!siteResponse.ok) {
                const error = await siteResponse.json();
                throw new Error(error.error || "Failed to update site");
            }
            const site = await siteResponse.json();
            setEditingSite(null);
            setTeamSites((prev) =>
                prev.map((s) =>
                    s.id === site.id
                        ? { ...site, networkElements: s.networkElements }
                        : s,
                ),
            );
        } catch (error) {
            console.error("Error updating site:", error);
            alert("Failed to update site: " + (error as Error).message);
        }
    };

    const removeSite = async (siteId: string) => {
        if (!selectedStaff) return;
        try {
            let userTeam: any = null;
            if (activeGroupId) {
                userTeam = (visibleTeam || []).find(
                    (t: any) => t.id === activeGroupId,
                );
            }
            if (!userTeam) {
                userTeam = (visibleTeam || []).find(
                    (t: any) =>
                        (t.members || []).some((m: any) => m.id === user?.id) ||
                        t.managerId === user?.id,
                );
            }
            if (!userTeam) {
                const response = await fetch("/api/team", {
                    credentials: "same-origin",
                });
                if (!response.ok) throw new Error("Failed to get user team");
                const team = await response.json();
                userTeam = team.find(
                    (t: any) =>
                        (t.members || []).some((m: any) => m.id === user?.id) ||
                        t.managerId === user?.id,
                );
            }
            if (!userTeam) {
                alert(
                    "Unable to find your team. Please contact your administrator.",
                );
                return;
            }

            const isGroupTeam =
                typeof userTeam.name === "string" &&
                userTeam.name.toLowerCase().startsWith("group-");

            const url = isGroupTeam
                ? `/api/team/${userTeam.id}/stations?siteId=${siteId}&unlink=1`
                : `/api/team/${userTeam.id}/stations?siteId=${siteId}`;

            const siteResponse = await fetch(url, {
                method: "DELETE",
                credentials: "same-origin",
            });
            if (!siteResponse.ok) {
                const error = await siteResponse.json();
                throw new Error(error.error || "Failed to remove site");
            }

            // Update the local site list used by the Sites & Network
            // Elements section.
            setTeamSites((prev) => prev.filter((s) => s.id !== siteId));

            // Also update visibleTeam.stations so group membership is
            // correctly reflected for supervisor groups.
            if (isGroupTeam) {
                setVisibleTeam?.((prev: any[] = []) =>
                    (prev || []).map((t: any) =>
                        t.id === userTeam.id
                            ? {
                                  ...t,
                                  stations: (t.stations || []).filter(
                                      (s: any) => s.id !== siteId,
                                  ),
                              }
                            : t,
                    ),
                );
            }
        } catch (error) {
            console.error("Error removing site:", error);
            alert("Failed to remove site: " + (error as Error).message);
        }
    };

    // Unlink a site from a specific group team only (used inside
    // each Group-* card). This does not delete the site from the
    // system, it only removes the association with that group.
    const unlinkGroupSite = async (teamId: string, siteId: string) => {
        try {
            const url = `/api/team/${teamId}/stations?siteId=${siteId}&unlink=1`;
            const res = await fetch(url, {
                method: "DELETE",
                credentials: "same-origin",
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(
                    error.error || "Failed to remove site from group",
                );
            }

            // Update the list used for the main Sites & Network
            // Elements section when viewing this group.
            setTeamSites((prev) => prev.filter((s) => s.id !== siteId));

            // Update visibleTeam.stations so the group card reflects
            // the change immediately.
            setVisibleTeam?.((prev: any[] = []) =>
                (prev || []).map((t: any) =>
                    t.id === teamId
                        ? {
                              ...t,
                              stations: (t.stations || []).filter(
                                  (s: any) => s.id !== siteId,
                              ),
                          }
                        : t,
                ),
            );
        } catch (error) {
            console.error("Error unlinking group site:", error);
            alert(
                "Failed to remove site from group: " + (error as Error).message,
            );
        }
    };

    // CRUD functions for Network Elements
    const addNE = async () => {
        if (!selectedSiteForNE || !newNE.name || !newNE.neId) return;
        try {
            const response = await fetch(
                `/api/stations/${selectedSiteForNE.id}/network-elements`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: newNE.name,
                        neId: newNE.neId,
                        type: newNE.type,
                    }),
                },
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to add network element");
            }
            const ne = await response.json();
            setShowAddNE(false);
            setNewNE({ name: "", neId: "", type: "" });
            setSelectedSiteForNE(null);
            setTeamSites((prev) =>
                prev.map((site) =>
                    site.id === selectedSiteForNE.id
                        ? {
                              ...site,
                              networkElements: [
                                  ...(site.networkElements || []),
                                  ne,
                              ],
                          }
                        : site,
                ),
            );
        } catch (error) {
            console.error("Error adding network element:", error);
            alert("Failed to add network element: " + (error as Error).message);
        }
    };

    const editNE = async () => {
        if (!editingNE || !editingNE.name || !editingNE.neId) return;
        try {
            const response = await fetch(
                `/api/stations/${editingNE.siteId}/network-elements`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: editingNE.id,
                        name: editingNE.name,
                        neId: editingNE.neId,
                        type: editingNE.type,
                    }),
                },
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to update network element",
                );
            }
            const ne = await response.json();
            setEditingNE(null);
            setTeamSites((prev) =>
                prev.map((site) =>
                    site.id === editingNE.siteId
                        ? {
                              ...site,
                              networkElements: (site.networkElements || []).map(
                                  (neItem) =>
                                      neItem.id === ne.id ? ne : neItem,
                              ),
                          }
                        : site,
                ),
            );
        } catch (error) {
            console.error("Error updating network element:", error);
            alert(
                "Failed to update network element: " + (error as Error).message,
            );
        }
    };

    const removeNE = async (neId: string, siteId: string) => {
        try {
            const response = await fetch(
                `/api/stations/${siteId}/network-elements?neId=${neId}`,
                { method: "DELETE" },
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error || "Failed to delete network element",
                );
            }
            setTeamSites((prev) =>
                prev.map((site) =>
                    site.id === siteId
                        ? {
                              ...site,
                              networkElements: (
                                  site.networkElements || []
                              ).filter((ne) => ne.id !== neId),
                          }
                        : site,
                ),
            );
        } catch (error) {
            console.error("Error deleting network element:", error);
            alert(
                "Failed to delete network element: " + (error as Error).message,
            );
        }
    };

    // Toggle functions
    const toggleRegion = (regionCode: string) => {
        setExpandedRegions((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(regionCode)) newSet.delete(regionCode);
            else newSet.add(regionCode);
            return newSet;
        });
    };

    const toggleStaff = (supervisorId: string) => {
        setExpandedManager((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(supervisorId)) newSet.delete(supervisorId);
            else newSet.add(supervisorId);
            return newSet;
        });
    };

    return (
        <div className="space-y-4">
            {/* Team Organization Section */}
            <div className="bg-background p-6 rounded-lg shadow-sm border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {user?.role === "supervisor"
                            ? "My Team"
                            : user?.role === "passenger"
                              ? "My Staff & Team"
                              : user?.role === "manager"
                                ? "Team I Manage"
                                : "Team Organization"}
                    </h3>
                    {canEdit &&
                        (user?.role === "supervisor" ||
                            user?.role === "manager") && (
                            <div className="flex flex-wrap gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        const sup =
                                            user?.role === "manager"
                                                ? selectedStaff
                                                : userTeam?.supervisor;
                                        if (!sup) {
                                            setAddTechError(
                                                "Select a supervisor from the list first.",
                                            );
                                            return;
                                        }
                                        setAddTechError("");
                                        setSelectedStaff(sup || null);
                                        setShowAddPassenger(true);
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 whitespace-nowrap"
                                >
                                    <Plus className="h-4 w-4" /> Add Member
                                </button>
                                {user?.role === "supervisor" && (
                                    <button
                                        onClick={() => {
                                            setSelectedStaff(
                                                userTeam?.supervisor || null,
                                            );
                                            // Prefill region for region supervisors
                                            if (
                                                isRegionStaff &&
                                                Array.isArray(
                                                    (user as any)
                                                        ?.assignedRegion,
                                                ) &&
                                                (user as any).assignedRegion
                                                    .length > 0
                                            ) {
                                                setNewSite((ns) => ({
                                                    ...ns,
                                                    region: String(
                                                        (user as any)
                                                            .assignedRegion[0],
                                                    ),
                                                }));
                                            }
                                            setShowAddSite(true);
                                        }}
                                        className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 whitespace-nowrap"
                                    >
                                        <Building className="h-4 w-4" /> Add
                                        Site
                                    </button>
                                )}
                            </div>
                        )}
                </div>
                {user?.role === "supervisor" && groupStatus && (
                    <div className="text-xs text-foreground mt-1">
                        {groupStatus}
                    </div>
                )}

                {userTeam ? (
                    <div className="space-y-4">
                        {/* Staff Groups (team) selector */}
                        {user?.role === "supervisor" && (
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="font-medium">Groups:</span>
                                {supervisorGroups.map((g: any) => (
                                    <div
                                        key={g.id}
                                        className="inline-flex items-center gap-1"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setActiveGroupId(g.id)
                                            }
                                            className={`px-2 py-1 rounded border text-xs ${
                                                activeGroupId === g.id
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-background text-foreground hover:bg-base-hover"
                                            }`}
                                        >
                                            {g.name}
                                        </button>
                                        {canEdit &&
                                            (roleLower === "manager" ||
                                                roleLower === "admin" ||
                                                roleLower === "supervisor") && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        deleteGroup(
                                                            g.id,
                                                            g.name,
                                                        )
                                                    }
                                                    className="p-1 rounded border text-xs bg-error/10 text-destructive hover:bg-destructive/10"
                                                    title={`Delete ${g.name}`}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Team Lead */}
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                            <div className="flex items-center gap-3">
                                <UserCheck className="h-6 w-6 text-primary" />
                                <div>
                                    <div className="font-medium text-foreground">
                                        {userTeam.type === "supervisor"
                                            ? "Team Lead: You"
                                            : `Staff: ${userTeam.supervisor.name}`}
                                    </div>
                                    {canEdit &&
                                        user?.role === "manager" &&
                                        userTeam.type !== "supervisor" && (
                                            <button
                                                onClick={async () => {
                                                    if (
                                                        confirm(
                                                            "Delete this supervisor user?",
                                                        )
                                                    ) {
                                                        await deleteUser(
                                                            userTeam.supervisor
                                                                .id,
                                                        );
                                                        // optionally collapse or reload org
                                                        setOrganization?.(
                                                            (o: any) => {
                                                                const copy = {
                                                                    ...o,
                                                                };
                                                                // remove supervisor from areas
                                                                for (const rc of Object.keys(
                                                                    copy,
                                                                )) {
                                                                    const reg =
                                                                        copy[
                                                                            rc
                                                                        ];
                                                                    for (const an of Object.keys(
                                                                        reg.areas ||
                                                                            {},
                                                                    )) {
                                                                        reg.areas[
                                                                            an
                                                                        ] = (
                                                                            reg
                                                                                .areas[
                                                                                an
                                                                            ] ||
                                                                            []
                                                                        ).filter(
                                                                            (
                                                                                s: any,
                                                                            ) =>
                                                                                s.id !==
                                                                                userTeam
                                                                                    .supervisor
                                                                                    .id,
                                                                        );
                                                                    }
                                                                }
                                                                return copy;
                                                            },
                                                        );
                                                        setSelectedStaff(
                                                            null,
                                                        );
                                                    }
                                                }}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    <div className="text-sm text-foreground">
                                        {(() => {
                                            const areaLower = (
                                                userTeam.areaName || ""
                                            ).toLowerCase();
                                            const regionLower = (
                                                userTeam.regionCode || ""
                                            ).toLowerCase();
                                            const isAazArea =
                                                areaLower.includes("aaz");
                                            const isHqRegion =
                                                regionLower === "hq" ||
                                                regionLower === "caaz";
                                            const userLocCat = String(
                                                (user as any)
                                                    ?.locationCategory || "",
                                            ).toLowerCase();
                                            const userZones: string[] =
                                                Array.isArray(
                                                    (user as any)?.assignedZone,
                                                )
                                                    ? (user as any).assignedZone
                                                    : [];
                                            const isHqZoneAssigned =
                                                userZones.some((z) =>
                                                    String(z || "")
                                                        .toLowerCase()
                                                        .startsWith("hq-"),
                                                );
                                            const isHqStaff =
                                                isHqRegion ||
                                                userLocCat.includes(
                                                    "head quarter",
                                                ) ||
                                                isHqZoneAssigned;

                                            const displayArea = isHqStaff
                                                ? "Head Quarter"
                                                : userTeam.areaName;

                                            return (
                                                <>
                                                    {displayArea}
                                                    {displayArea ===
                                                    "Head Quarter"
                                                        ? ""
                                                        : " Area"}
                                                    {/* Show region for non-AAZ, non-HQ team only */}
                                                    {!isAazArea &&
                                                        !isHqRegion &&
                                                        displayArea !==
                                                            "Head Quarter" && (
                                                            <>
                                                                ,{" "}
                                                                {
                                                                    userTeam.regionCode
                                                                }{" "}
                                                                Region
                                                            </>
                                                        )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    {userTeam.supervisor.staffId && (
                                        <div className="text-sm text-foreground">
                                            Staff ID:{" "}
                                            {userTeam.supervisor.staffId}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Team Members */}
                        <div className="space-y-3">
                            <h4 className="text-md font-medium text-foreground flex items-center gap-2">
                                <Users className="h-4 w-4" /> Team Members (
                                {userTeam.supervisor.passengers.length +
                                    userTeam.supervisor.stations.length}
                                )
                            </h4>

                            {/* Passengers - ungrouped view (no groups created yet) */}
                            {supervisorGroups.length === 0 &&
                                userTeam.supervisor.passengers.length > 0 && (
                                    <div ref={techListRef}>
                                        <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1">
                                            <User className="h-4 w-4" />{" "}
                                            Passengers (
                                            {
                                                userTeam.supervisor.passengers
                                                    .length
                                            }
                                            )
                                        </h5>
                                        {userTeam.supervisor.passengers.map(
                                            (passenger) => (
                                                <div
                                                    key={passenger.id}
                                                    className="p-3 bg-background border rounded relative"
                                                >
                                                    <div className="font-medium text-foreground">
                                                        {passenger.name}
                                                    </div>
                                                    <div className="text-sm text-foreground">
                                                        @{passenger.username}
                                                    </div>
                                                    {passenger.staffId && (
                                                        <div className="text-sm text-foreground">
                                                            Staff ID:{" "}
                                                            {passenger.staffId}
                                                        </div>
                                                    )}
                                                    {passenger.id ===
                                                        user?.id && (
                                                        <div className="text-xs text-primary font-medium mt-1">
                                                            (You)
                                                        </div>
                                                    )}
                                                    {canEdit &&
                                                        (user?.role ===
                                                            "supervisor" ||
                                                            user?.role ===
                                                                "manager" ||
                                                            user?.role ===
                                                                "admin") && (
                                                            <div className="absolute top-2 right-2 flex gap-1">
                                                                {(roleLower ===
                                                                    "manager" ||
                                                                    roleLower ===
                                                                        "supervisor" ||
                                                                    roleLower ===
                                                                        "admin") && (
                                                                    <button
                                                                        onClick={() =>
                                                                            deleteUser(
                                                                                passenger.id,
                                                                            )
                                                                        }
                                                                        className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedStaff(
                                                                            userTeam.supervisor ||
                                                                                null,
                                                                        );
                                                                        openEditPassenger(
                                                                            passenger.id,
                                                                        );
                                                                    }}
                                                                    className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                >
                                                                    <Edit className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}

                            {/* Passengers grouped by supervisor Groups (Group-1, Group-2, ...) */}
                            {supervisorGroups.length > 0 && (
                                <div className="space-y-4" ref={techListRef}>
                                    {supervisorGroups.map((g: any) => {
                                        const team =
                                            (visibleTeam || []).find(
                                                (t: any) => t.id === g.id,
                                            ) || g;
                                        const members = (team.members ||
                                            []) as any[];
                                        const groupSites = (team.stations ||
                                            []) as Site[];
                                        return (
                                            <div
                                                key={g.id}
                                                className="rounded-xl border border-primary/40 bg-background/80 p-3 md:p-4 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div>
                                                        <div className="text-sm font-semibold text-foreground">
                                                            {g.name}
                                                        </div>
                                                        <div className="text-xs text-foreground/80">
                                                            {members.length}{" "}
                                                            passenger
                                                            {members.length ===
                                                            1
                                                                ? ""
                                                                : "s"}
                                                        </div>
                                                    </div>
                                                    {canEdit && (
                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setActiveGroupId(
                                                                        g.id,
                                                                    );
                                                                    setSelectedStaff(
                                                                        userTeam.supervisor ||
                                                                            null,
                                                                    );
                                                                    setShowAddPassenger(
                                                                        true,
                                                                    );
                                                                }}
                                                                className="et-primary-button !px-3 !py-1 text-xs flex items-center gap-1"
                                                            >
                                                                <User className="h-3 w-3" />
                                                                Add Passenger
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    openGroupSitesModal(
                                                                        g.id,
                                                                    );
                                                                }}
                                                                className="px-2 py-1 rounded-full border border-dashed border-primary/60 bg-background text-foreground hover:bg-base-hover flex items-center gap-1 text-xs"
                                                            >
                                                                <Building className="h-3 w-3" />
                                                                Add Site
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {members.length > 0 ? (
                                                    <div className="space-y-2">
                                                        {members.map((m) => (
                                                            <div
                                                                key={m.id}
                                                                className="p-3 bg-muted/60 border rounded relative"
                                                            >
                                                                <div className="font-medium text-foreground">
                                                                    {m.fullName ||
                                                                        m.name}
                                                                </div>
                                                                <div className="text-sm text-foreground">
                                                                    @
                                                                    {m.username}
                                                                </div>
                                                                {m.staffId && (
                                                                    <div className="text-sm text-foreground">
                                                                        Staff
                                                                        ID:{" "}
                                                                        {
                                                                            m.staffId
                                                                        }
                                                                    </div>
                                                                )}
                                                                {m.id ===
                                                                    user?.id && (
                                                                    <div className="text-xs text-primary font-medium mt-1">
                                                                        (You)
                                                                    </div>
                                                                )}
                                                                {canEdit && (
                                                                    <div className="absolute top-2 right-2 flex gap-1">
                                                                        {/* Remove passenger only from this group (team), not from the supervisor's whole staff list */}
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    const res =
                                                                                        await fetch(
                                                                                            `/api/team/${g.id}/members?teamId=${g.id}&userId=${m.id}`,
                                                                                            {
                                                                                                method: "DELETE",
                                                                                            },
                                                                                        );
                                                                                    if (
                                                                                        !res.ok
                                                                                    )
                                                                                        return;
                                                                                    // Update visibleTeam locally to remove this member from the group only
                                                                                    setVisibleTeam?.(
                                                                                        (
                                                                                            prev: any[] = [],
                                                                                        ) =>
                                                                                            prev.map(
                                                                                                (
                                                                                                    t: any,
                                                                                                ) => {
                                                                                                    if (
                                                                                                        t.id !==
                                                                                                        g.id
                                                                                                    )
                                                                                                        return t;
                                                                                                    const membersArr =
                                                                                                        Array.isArray(
                                                                                                            t.members,
                                                                                                        )
                                                                                                            ? t.members
                                                                                                            : [];
                                                                                                    return {
                                                                                                        ...t,
                                                                                                        members:
                                                                                                            membersArr.filter(
                                                                                                                (
                                                                                                                    mm: any,
                                                                                                                ) =>
                                                                                                                    mm.id !==
                                                                                                                    m.id,
                                                                                                            ),
                                                                                                    };
                                                                                                },
                                                                                            ),
                                                                                    );
                                                                                } catch (e) {
                                                                                    console.error(
                                                                                        "Failed to remove member from group",
                                                                                        e,
                                                                                    );
                                                                                }
                                                                            }}
                                                                            className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                            title="Remove from this group"
                                                                        >
                                                                            <span className="text-xs font-bold">
                                                                                ×
                                                                            </span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedStaff(
                                                                                    userTeam.supervisor ||
                                                                                        null,
                                                                                );
                                                                                openEditPassenger(
                                                                                    m.id,
                                                                                );
                                                                            }}
                                                                            className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                        >
                                                                            <Edit className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-foreground/70 italic">
                                                        No passengers in this
                                                        group yet.
                                                    </div>
                                                )}

                                                {/* Sites belonging to this specific group */}
                                                {groupSites.length > 0 && (
                                                    <div className="mt-4 border-t pt-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h5 className="text-xs font-medium text-foreground flex items-center gap-1">
                                                                <Building className="h-3 w-3" />
                                                                Sites in this
                                                                Group (
                                                                {
                                                                    groupSites.length
                                                                }
                                                                )
                                                            </h5>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {groupSites.map(
                                                                (site) => (
                                                                    <div
                                                                        key={
                                                                            site.id
                                                                        }
                                                                        className="p-2 bg-background border rounded flex items-start justify-between text-xs"
                                                                    >
                                                                        <div>
                                                                            <div className="font-medium text-foreground">
                                                                                {
                                                                                    site.name
                                                                                }
                                                                            </div>
                                                                            <div className="text-foreground">
                                                                                Code:{" "}
                                                                                {
                                                                                    site.siteCode
                                                                                }
                                                                            </div>
                                                                            {site.neNameAndId && (
                                                                                <div className="text-foreground">
                                                                                    NE:{" "}
                                                                                    {
                                                                                        site.neNameAndId
                                                                                    }
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {canEdit && (
                                                                            <div className="flex gap-1 ml-2">
                                                                                <button
                                                                                    onClick={() =>
                                                                                        unlinkGroupSite(
                                                                                            g.id,
                                                                                            site.id,
                                                                                        )
                                                                                    }
                                                                                    className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                                    title="Remove site from this group"
                                                                                >
                                                                                    <X className="h-3 w-3" />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Sites with NEs (supervisor without groups, or non-supervisor roles) */}
                            {teamSites.length > 0 &&
                                !(
                                    user?.role === "supervisor" &&
                                    supervisorGroups.length > 0
                                ) && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-sm font-medium text-foreground flex items-center gap-1">
                                                <Building className="h-4 w-4" />{" "}
                                                Sites & Network Elements (
                                                {filteredTeamSites.length})
                                            </h5>
                                            {canEdit &&
                                                user?.role === "supervisor" && (
                                                    <button
                                                        onClick={async () => {
                                                            setGroupingTeam(
                                                                true,
                                                            );
                                                            const team =
                                                                await ensureStaffTeam();
                                                            setGroupingTeam(
                                                                false,
                                                            );
                                                            if (team) {
                                                                setGroupStatus(
                                                                    `Grouped as team "${team.name}". You can now assign stations to this team.`,
                                                                );
                                                                // After grouping, bring the passengers list into view
                                                                setTimeout(
                                                                    () => {
                                                                        techListRef.current?.scrollIntoView(
                                                                            {
                                                                                behavior:
                                                                                    "smooth",
                                                                                block: "start",
                                                                            },
                                                                        );
                                                                    },
                                                                    50,
                                                                );
                                                            }
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm"
                                                        disabled={groupingTeam}
                                                    >
                                                        <Users className="h-4 w-4" />
                                                        {groupingTeam
                                                            ? "Grouping..."
                                                            : "Group Passengers"}
                                                    </button>
                                                )}
                                        </div>
                                        <div className="space-y-3">
                                            {filteredTeamSites.map((site) => (
                                                <div
                                                    key={site.id}
                                                    className="p-3 bg-background border rounded"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="font-medium text-foreground">
                                                                {site.name}
                                                            </div>
                                                            <div className="text-sm text-foreground">
                                                                Code:{" "}
                                                                {site.siteCode}
                                                            </div>
                                                            {site.neNameAndId && (
                                                                <div className="text-sm text-foreground">
                                                                    NE:{" "}
                                                                    {
                                                                        site.neNameAndId
                                                                    }
                                                                </div>
                                                            )}
                                                            {site.networkElements &&
                                                                site
                                                                    .networkElements
                                                                    .length >
                                                                    0 && (
                                                                    <div className="mt-2">
                                                                        <div className="text-xs font-medium text-foreground mb-1">
                                                                            Network
                                                                            Elements:
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            {site.networkElements.map(
                                                                                (
                                                                                    ne,
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            ne.id
                                                                                        }
                                                                                        className="flex items-center justify-between bg-base-hover p-1 rounded text-xs"
                                                                                    >
                                                                                        <div>
                                                                                            <span className="font-medium">
                                                                                                {
                                                                                                    ne.name
                                                                                                }
                                                                                            </span>
                                                                                            <span className="text-foreground ml-1">
                                                                                                (
                                                                                                {
                                                                                                    ne.neId
                                                                                                }

                                                                                                )
                                                                                            </span>
                                                                                            {ne.type && (
                                                                                                <span className="text-foreground ml-1">
                                                                                                    -{" "}
                                                                                                    {
                                                                                                        ne.type
                                                                                                    }
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        {canEdit &&
                                                                                            user?.role ===
                                                                                                "supervisor" && (
                                                                                                <div className="flex gap-1">
                                                                                                    <button
                                                                                                        onClick={() =>
                                                                                                            setEditingNE(
                                                                                                                ne,
                                                                                                            )
                                                                                                        }
                                                                                                        className="p-0.5 text-foreground hover:bg-background rounded"
                                                                                                    >
                                                                                                        <Edit className="h-2 w-2" />
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() =>
                                                                                                            removeNE(
                                                                                                                ne.id,
                                                                                                                site.id,
                                                                                                            )
                                                                                                        }
                                                                                                        className="p-0.5 text-foreground hover:bg-background rounded"
                                                                                                    >
                                                                                                        <Trash2 className="h-2 w-2" />
                                                                                                    </button>
                                                                                                </div>
                                                                                            )}
                                                                                    </div>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                        {canEdit &&
                                                                            user?.role ===
                                                                                "supervisor" && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setSelectedSiteForNE(
                                                                                            site,
                                                                                        );
                                                                                        setShowAddNE(
                                                                                            true,
                                                                                        );
                                                                                    }}
                                                                                    className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/90"
                                                                                >
                                                                                    <Plus className="h-2 w-2" />{" "}
                                                                                    Add
                                                                                    NE
                                                                                </button>
                                                                            )}
                                                                    </div>
                                                                )}
                                                        </div>
                                                        {canEdit &&
                                                            user?.role ===
                                                                "supervisor" && (
                                                                <div className="flex gap-1 ml-2">
                                                                    <button
                                                                        onClick={() =>
                                                                            setEditingSite(
                                                                                site,
                                                                            )
                                                                        }
                                                                        className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                    >
                                                                        <Edit className="h-3 w-3" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() =>
                                                                            removeSite(
                                                                                site.id,
                                                                            )
                                                                        }
                                                                        className="p-1 text-foreground hover:bg-base-hover rounded"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {teamSites.length === 0 &&
                                userTeam.supervisor.passengers.length ===
                                    0 && (
                                    <div className="text-center py-4 text-foreground italic">
                                        No team members or stations assigned yet
                                    </div>
                                )}
                        </div>
                    </div>
                ) : user?.role === "manager" ? (
                    <div className="space-y-4">
                        <h4 className="text-md font-medium text-foreground">
                            Manager I Manage
                        </h4>
                        {/* Manager filters: region and area */}
                        <div className="flex flex-wrap gap-2 items-center mb-2">
                            <label className="text-sm text-foreground mr-2">
                                Filter:
                            </label>
                            <select
                                value={selectedRegion || ""}
                                onChange={(e) => {
                                    const v = e.target.value || null;
                                    setSelectedRegion(v);
                                    setSelectedArea(null);
                                }}
                                className="p-2 border rounded bg-background text-foreground text-sm"
                            >
                                <option value="">All Regions</option>
                                {Object.keys(organization || {}).map((r) => (
                                    <option key={r} value={r}>
                                        {r}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={selectedArea || ""}
                                onChange={(e) =>
                                    setSelectedArea(e.target.value || null)
                                }
                                className="p-2 border rounded bg-background text-foreground text-sm"
                            >
                                <option value="">All Areas</option>
                                {selectedRegion
                                    ? Object.keys(
                                          (organization as any)[selectedRegion]
                                              ?.areas || {},
                                      ).map((a) => (
                                          <option key={a} value={a}>
                                              {a}
                                          </option>
                                      ))
                                    : // aggregate all areas
                                      Array.from(
                                          new Set(
                                              Object.values(
                                                  organization || {},
                                              ).flatMap((r: any) =>
                                                  Object.keys(r.areas || {}),
                                              ),
                                          ),
                                      ).map((a) => (
                                          <option key={a} value={a}>
                                              {a}
                                          </option>
                                      ))}
                            </select>

                            <button
                                onClick={() => {
                                    setSelectedRegion(null);
                                    setSelectedArea(null);
                                }}
                                className="px-2 py-1 bg-background rounded text-sm hover:bg-base-hover"
                            >
                                Clear
                            </button>
                        </div>

                        {/* Render organization: regions -> areas -> supervisors (filtered) */}
                        {Object.keys(filteredOrganization || {}).length ===
                        0 ? (
                            <div className="text-center py-4 text-foreground italic">
                                No supervisors found in your managed regions.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(filteredOrganization).map(
                                    ([regionCode, region]) => (
                                        <div key={regionCode}>
                                            <button
                                                className="w-full text-left p-3 bg-background border rounded transition hover:bg-base-hover focus:outline-none"
                                                onClick={() =>
                                                    toggleRegion(regionCode)
                                                }
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <MapPin className="h-4 w-4" />
                                                        <div>
                                                            <div className="font-medium">
                                                                {regionCode}
                                                            </div>
                                                            <div className="text-sm text-foreground">
                                                                {region.manager
                                                                    ?.name ||
                                                                    "Manager"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {expandedRegions.has(
                                                            regionCode,
                                                        ) ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        )}
                                                        <span className="text-sm">
                                                            Areas
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                            {expandedRegions.has(
                                                regionCode,
                                            ) && (
                                                <div className="mt-3 space-y-2">
                                                    {Object.entries(
                                                        region.areas || {},
                                                    ).map(
                                                        ([
                                                            areaName,
                                                            supervisors,
                                                        ]) => (
                                                            <div
                                                                key={areaName}
                                                                className="p-2 bg-background/50 rounded"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="font-medium">
                                                                        {
                                                                            areaName
                                                                        }
                                                                    </div>
                                                                    <div className="text-sm text-foreground">
                                                                        {
                                                                            supervisors.length
                                                                        }{" "}
                                                                        supervisors
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                                                    {supervisors.map(
                                                                        (
                                                                            sup: any,
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    sup.id
                                                                                }
                                                                                className="p-3 bg-background border rounded"
                                                                            >
                                                                                <div className="flex items-start justify-between">
                                                                                    <div className="flex-1">
                                                                                        <div className="font-medium">
                                                                                            {
                                                                                                sup.name
                                                                                            }
                                                                                        </div>
                                                                                        <div className="text-sm text-foreground">
                                                                                            {
                                                                                                sup.email
                                                                                            }
                                                                                        </div>
                                                                                        <div className="text-sm text-foreground">
                                                                                            <span className="font-semibold">
                                                                                                Region:
                                                                                            </span>{" "}
                                                                                            {sup.locationCategory ||
                                                                                                regionCode ||
                                                                                                "-"}
                                                                                        </div>
                                                                                        <div className="text-sm text-foreground">
                                                                                            <span className="font-semibold">
                                                                                                Zone:
                                                                                            </span>{" "}
                                                                                            {sup.assignedZone &&
                                                                                            sup
                                                                                                .assignedZone
                                                                                                .length >
                                                                                                0
                                                                                                ? sup.assignedZone.join(
                                                                                                      ", ",
                                                                                                  )
                                                                                                : areaName ||
                                                                                                  "-"}
                                                                                        </div>
                                                                                        <div className="text-sm text-foreground">
                                                                                            Sites:{" "}
                                                                                            {sup
                                                                                                .stations
                                                                                                ?.length ||
                                                                                                0}{" "}
                                                                                            ·
                                                                                            Techs:{" "}
                                                                                            {sup
                                                                                                .passengers
                                                                                                ?.length ||
                                                                                                0}
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex gap-2">
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setSelectedStaff(
                                                                                                    sup,
                                                                                                );
                                                                                                // expand supervisor details
                                                                                                toggleStaff(
                                                                                                    sup.id,
                                                                                                );
                                                                                            }}
                                                                                            className="px-2 py-1 bg-background rounded hover:bg-base-hover text-sm"
                                                                                        >
                                                                                            View
                                                                                        </button>
                                                                                        {user?.role ===
                                                                                            "manager" && (
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setAddTechError(
                                                                                                        "",
                                                                                                    );
                                                                                                    setSelectedStaff(
                                                                                                        sup,
                                                                                                    );
                                                                                                    setShowAddPassenger(
                                                                                                        true,
                                                                                                    );
                                                                                                }}
                                                                                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs sm:text-sm hover:bg-primary/90 whitespace-nowrap"
                                                                                            >
                                                                                                Add
                                                                                                Member
                                                                                            </button>
                                                                                        )}
                                                                                        {/* Assign Site/NE button for managers */}
                                                                                        {user?.role ===
                                                                                            "manager" && (
                                                                                            <a
                                                                                                href={`/manager/stations?supervisorId=${sup.id}`}
                                                                                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs sm:text-sm hover:bg-primary/90 whitespace-nowrap"
                                                                                                title="Assign Sites/NEs to this Staff"
                                                                                                style={{
                                                                                                    textDecoration:
                                                                                                        "none",
                                                                                                }}
                                                                                            >
                                                                                                Assign
                                                                                                Site/NE
                                                                                            </a>
                                                                                        )}
                                                                                        {(roleLower ===
                                                                                            "manager" ||
                                                                                            roleLower ===
                                                                                                "admin") && (
                                                                                            <button
                                                                                                onClick={async () => {
                                                                                                    if (
                                                                                                        confirm(
                                                                                                            "Delete this supervisor user?",
                                                                                                        )
                                                                                                    ) {
                                                                                                        await deleteUser(
                                                                                                            sup.id,
                                                                                                        );
                                                                                                        setOrganization?.(
                                                                                                            (
                                                                                                                o: any,
                                                                                                            ) => {
                                                                                                                const copy =
                                                                                                                    {
                                                                                                                        ...o,
                                                                                                                    };
                                                                                                                for (const rc of Object.keys(
                                                                                                                    copy,
                                                                                                                )) {
                                                                                                                    const reg =
                                                                                                                        copy[
                                                                                                                            rc
                                                                                                                        ];
                                                                                                                    for (const an of Object.keys(
                                                                                                                        reg.areas ||
                                                                                                                            {},
                                                                                                                    )) {
                                                                                                                        reg.areas[
                                                                                                                            an
                                                                                                                        ] =
                                                                                                                            (
                                                                                                                                reg
                                                                                                                                    .areas[
                                                                                                                                    an
                                                                                                                                ] ||
                                                                                                                                []
                                                                                                                            ).filter(
                                                                                                                                (
                                                                                                                                    s: any,
                                                                                                                                ) =>
                                                                                                                                    s.id !==
                                                                                                                                    sup.id,
                                                                                                                            );
                                                                                                                    }
                                                                                                                }
                                                                                                                return copy;
                                                                                                            },
                                                                                                        );
                                                                                                    }
                                                                                                }}
                                                                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                                            >
                                                                                                <Trash2 className="h-4 w-4" />
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {expandedManager.has(
                                                                                    sup.id,
                                                                                ) && (
                                                                                    <div className="mt-3 space-y-2">
                                                                                        {/* Staff stations */}
                                                                                        {Array.isArray(
                                                                                            sup.stations,
                                                                                        ) &&
                                                                                            sup
                                                                                                .stations
                                                                                                .length >
                                                                                                0 && (
                                                                                                <div>
                                                                                                    <div className="text-sm font-medium mb-1">
                                                                                                        Sites
                                                                                                    </div>
                                                                                                    <div className="space-y-1">
                                                                                                        {sup.stations.map(
                                                                                                            (
                                                                                                                site: any,
                                                                                                            ) => (
                                                                                                                <div
                                                                                                                    key={
                                                                                                                        site.id
                                                                                                                    }
                                                                                                                    className="p-2 bg-base-hover rounded text-sm flex items-center justify-between"
                                                                                                                >
                                                                                                                    <div>
                                                                                                                        <div className="font-medium">
                                                                                                                            {
                                                                                                                                site.name
                                                                                                                            }
                                                                                                                        </div>
                                                                                                                        <div className="text-xs text-foreground">
                                                                                                                            {
                                                                                                                                site.siteCode
                                                                                                                            }{" "}
                                                                                                                            ·{" "}
                                                                                                                            {site.neNameAndId ||
                                                                                                                                (Array.isArray(
                                                                                                                                    site.allNeNames,
                                                                                                                                )
                                                                                                                                    ? site.allNeNames.join(
                                                                                                                                          ", ",
                                                                                                                                      )
                                                                                                                                    : "-")}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <div className="flex gap-1">
                                                                                                                        <button
                                                                                                                            onClick={() => {
                                                                                                                                setEditingSite(
                                                                                                                                    site,
                                                                                                                                );
                                                                                                                            }}
                                                                                                                            className="p-1 text-foreground hover:bg-background rounded"
                                                                                                                        >
                                                                                                                            <Edit className="h-3 w-3" />
                                                                                                                        </button>
                                                                                                                        <button
                                                                                                                            onClick={() =>
                                                                                                                                unassignSite(
                                                                                                                                    site,
                                                                                                                                    sup,
                                                                                                                                )
                                                                                                                            }
                                                                                                                            className="p-1 text-red-500 hover:bg-background rounded"
                                                                                                                        >
                                                                                                                            <Trash2 className="h-3 w-3" />
                                                                                                                        </button>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            ),
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}

                                                                                        {user?.role ===
                                                                                            "manager" && (
                                                                                            <div className="mt-1">
                                                                                                <a
                                                                                                    href={`/manager/stations?supervisorId=${sup.id}`}
                                                                                                    className="text-sm text-primary hover:underline"
                                                                                                >
                                                                                                    Assign
                                                                                                    more
                                                                                                    Sites/NEs
                                                                                                </a>
                                                                                            </div>
                                                                                        )}
                                                                                        {/* Staff passengers */}
                                                                                        {Array.isArray(
                                                                                            sup.passengers,
                                                                                        ) &&
                                                                                            sup
                                                                                                .passengers
                                                                                                .length >
                                                                                                0 && (
                                                                                                <div>
                                                                                                    <div className="text-sm font-medium mb-1">
                                                                                                        Passengers
                                                                                                    </div>
                                                                                                    <div className="grid grid-cols-1 gap-1">
                                                                                                        {sup.passengers.map(
                                                                                                            (
                                                                                                                tech: any,
                                                                                                            ) => (
                                                                                                                <div
                                                                                                                    key={
                                                                                                                        tech.id
                                                                                                                    }
                                                                                                                    className="p-2 bg-base-hover rounded text-sm flex items-center justify-between"
                                                                                                                >
                                                                                                                    <div>
                                                                                                                        <div className="font-medium">
                                                                                                                            {
                                                                                                                                tech.name
                                                                                                                            }
                                                                                                                        </div>
                                                                                                                        <div className="text-xs text-foreground">
                                                                                                                            {tech.email ||
                                                                                                                                tech.username}
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                    <div className="flex items-center gap-1">
                                                                                                                        <button
                                                                                                                            onClick={() => {
                                                                                                                                // remember which supervisor we're working with
                                                                                                                                setSelectedStaff(
                                                                                                                                    sup,
                                                                                                                                );
                                                                                                                                openEditPassenger(
                                                                                                                                    tech.id,
                                                                                                                                );
                                                                                                                            }}
                                                                                                                            className="p-1 text-foreground hover:bg-background rounded"
                                                                                                                        >
                                                                                                                            <Edit className="h-3 w-3" />
                                                                                                                        </button>
                                                                                                                        {/* delete icon for managers/supervisors/admins */}
                                                                                                                        {(roleLower ===
                                                                                                                            "manager" ||
                                                                                                                            roleLower ===
                                                                                                                                "supervisor" ||
                                                                                                                            roleLower ===
                                                                                                                                "admin") && (
                                                                                                                            <button
                                                                                                                                onClick={async () => {
                                                                                                                                    if (
                                                                                                                                        confirm(
                                                                                                                                            "Delete this passenger?",
                                                                                                                                        )
                                                                                                                                    ) {
                                                                                                                                        setSelectedStaff(
                                                                                                                                            sup,
                                                                                                                                        );
                                                                                                                                        await deleteUser(
                                                                                                                                            tech.id,
                                                                                                                                        );
                                                                                                                                        // also remove from the local supervisor object so UI updates
                                                                                                                                        sup.passengers =
                                                                                                                                            (
                                                                                                                                                sup.passengers ||
                                                                                                                                                []
                                                                                                                                            ).filter(
                                                                                                                                                (
                                                                                                                                                    t: any,
                                                                                                                                                ) =>
                                                                                                                                                    t.id !==
                                                                                                                                                    tech.id,
                                                                                                                                            );
                                                                                                                                        setOrganization?.(
                                                                                                                                            (
                                                                                                                                                o: any,
                                                                                                                                            ) => {
                                                                                                                                                const copy =
                                                                                                                                                    {
                                                                                                                                                        ...o,
                                                                                                                                                    };
                                                                                                                                                // walk through regions/areas and replace this supervisor's list
                                                                                                                                                for (const rc of Object.keys(
                                                                                                                                                    copy,
                                                                                                                                                )) {
                                                                                                                                                    const reg =
                                                                                                                                                        copy[
                                                                                                                                                            rc
                                                                                                                                                        ];
                                                                                                                                                    for (const an of Object.keys(
                                                                                                                                                        reg.areas ||
                                                                                                                                                            {},
                                                                                                                                                    )) {
                                                                                                                                                        reg.areas[
                                                                                                                                                            an
                                                                                                                                                        ] =
                                                                                                                                                            (
                                                                                                                                                                reg
                                                                                                                                                                    .areas[
                                                                                                                                                                    an
                                                                                                                                                                ] ||
                                                                                                                                                                []
                                                                                                                                                            ).map(
                                                                                                                                                                (
                                                                                                                                                                    s: any,
                                                                                                                                                                ) =>
                                                                                                                                                                    s.id ===
                                                                                                                                                                    sup.id
                                                                                                                                                                        ? {
                                                                                                                                                                              ...s,
                                                                                                                                                                              passengers:
                                                                                                                                                                                  sup.passengers,
                                                                                                                                                                          }
                                                                                                                                                                        : s,
                                                                                                                                                            );
                                                                                                                                                    }
                                                                                                                                                }
                                                                                                                                                return copy;
                                                                                                                                            },
                                                                                                                                        );
                                                                                                                                    }
                                                                                                                                }}
                                                                                                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                                                                                            >
                                                                                                                                <Trash2 className="h-3 w-3" />
                                                                                                                            </button>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            ),
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ),
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8 text-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>
                            {user?.role === "Admin"
                                ? "Team organization is managed by administrators."
                                : "Your team information is not available yet. Please contact your administrator."}
                        </p>
                    </div>
                )}
            </div>

            {/* Add Passenger Modal */}
            {showAddPassenger && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-[min(900px,90vw)] rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                Add New Passenger
                            </h3>

                            {/* Preferred: pick from existing supervisor staff into the active Group */}
                            {roleLower === "supervisor" &&
                                activeGroupId &&
                                (userTeam?.supervisor?.passengers || [])
                                    .length > 0 && (
                                    <div className="mb-5 border rounded-lg p-3 bg-muted/40">
                                        <div className="text-sm font-medium mb-2">
                                            Select from existing staff under
                                            this supervisor
                                        </div>
                                        <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
                                            {(() => {
                                                const teamForActive = (
                                                    visibleTeam || []
                                                ).find(
                                                    (t: any) =>
                                                        t.id === activeGroupId,
                                                );
                                                const memberIds = new Set(
                                                    (
                                                        teamForActive?.members ||
                                                        []
                                                    )
                                                        .map((m: any) => m.id)
                                                        .filter(Boolean),
                                                );

                                                // Passengers already grouped in ANY Group-* for this supervisor
                                                // should not be available to add to another group.
                                                const allStaffGroups = (
                                                    visibleTeam || []
                                                ).filter(
                                                    (t: any) =>
                                                        t.managerId ===
                                                        user?.id,
                                                );
                                                const globallyGroupedIds =
                                                    new Set<string>();
                                                allStaffGroups.forEach(
                                                    (t: any) => {
                                                        (
                                                            t.members || []
                                                        ).forEach((m: any) => {
                                                            if (m?.id) {
                                                                globallyGroupedIds.add(
                                                                    m.id,
                                                                );
                                                            }
                                                        });
                                                    },
                                                );

                                                const availableStaff = (
                                                    (userTeam?.supervisor
                                                        ?.passengers ||
                                                        []) as any[]
                                                ).filter(
                                                    (s: any) =>
                                                        s?.id &&
                                                        !globallyGroupedIds.has(
                                                            s.id,
                                                        ),
                                                );

                                                if (!availableStaff.length) {
                                                    return (
                                                        <div className="text-xs text-foreground/70">
                                                            All passengers
                                                            under this
                                                            supervisor are
                                                            already grouped.
                                                        </div>
                                                    );
                                                }

                                                return availableStaff.map(
                                                    (tech: any) => {
                                                        const inGroup =
                                                            memberIds.has(
                                                                tech.id,
                                                            );
                                                        return (
                                                            <div
                                                                key={tech.id}
                                                                className="flex items-center justify-between rounded border bg-background px-2 py-1"
                                                            >
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">
                                                                        {tech.name ||
                                                                            tech.fullName ||
                                                                            tech.username}
                                                                    </span>
                                                                    <span className="text-xs text-foreground/80">
                                                                        {
                                                                            tech.email
                                                                        }
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    disabled={
                                                                        inGroup ||
                                                                        addingExistingTechId ===
                                                                            tech.id
                                                                    }
                                                                    onClick={async () => {
                                                                        if (
                                                                            !activeGroupId
                                                                        )
                                                                            return;
                                                                        setAddTechError(
                                                                            "",
                                                                        );
                                                                        setAddingExistingTechId(
                                                                            tech.id,
                                                                        );
                                                                        try {
                                                                            const resp =
                                                                                await fetch(
                                                                                    `/api/team/${activeGroupId}/members`,
                                                                                    {
                                                                                        method: "POST",
                                                                                        headers:
                                                                                            {
                                                                                                "Content-Type":
                                                                                                    "application/json",
                                                                                            },
                                                                                        body: JSON.stringify(
                                                                                            {
                                                                                                teamId: activeGroupId,
                                                                                                userId: tech.id,
                                                                                            },
                                                                                        ),
                                                                                    },
                                                                                );
                                                                            if (
                                                                                !resp.ok
                                                                            ) {
                                                                                const data =
                                                                                    await resp
                                                                                        .json()
                                                                                        .catch(
                                                                                            () => ({}),
                                                                                        );
                                                                                setAddTechError(
                                                                                    data.error ||
                                                                                        "Failed to add passenger to group.",
                                                                                );
                                                                                return;
                                                                            }
                                                                            const member =
                                                                                {
                                                                                    id: tech.id,
                                                                                    fullName:
                                                                                        tech.fullName ||
                                                                                        tech.name ||
                                                                                        tech.username ||
                                                                                        tech.email,
                                                                                    username:
                                                                                        tech.username,
                                                                                    staffId:
                                                                                        tech.staffId,
                                                                                };
                                                                            setVisibleTeam?.(
                                                                                (
                                                                                    prev,
                                                                                ) =>
                                                                                    (
                                                                                        prev ||
                                                                                        []
                                                                                    ).map(
                                                                                        (
                                                                                            t: any,
                                                                                        ) =>
                                                                                            t.id ===
                                                                                            activeGroupId
                                                                                                ? {
                                                                                                      ...t,
                                                                                                      members:
                                                                                                          [
                                                                                                              ...(t.members ||
                                                                                                                  []),
                                                                                                              member,
                                                                                                          ].filter(
                                                                                                              (
                                                                                                                  x: any,
                                                                                                                  idx: number,
                                                                                                                  arr: any[],
                                                                                                              ) =>
                                                                                                                  x.id &&
                                                                                                                  arr.findIndex(
                                                                                                                      (
                                                                                                                          y: any,
                                                                                                                      ) =>
                                                                                                                          y.id ===
                                                                                                                          x.id,
                                                                                                                  ) ===
                                                                                                                      idx,
                                                                                                          ),
                                                                                                  }
                                                                                                : t,
                                                                                    ),
                                                                            );
                                                                        } catch (e) {
                                                                            console.error(
                                                                                "Failed to add passenger to group",
                                                                                e,
                                                                            );
                                                                            setAddTechError(
                                                                                "Unexpected error adding passenger to group.",
                                                                            );
                                                                        } finally {
                                                                            setAddingExistingTechId(
                                                                                null,
                                                                            );
                                                                        }
                                                                    }}
                                                                    className="px-2 py-1 text-xs rounded border bg-background hover:bg-base-hover disabled:opacity-50"
                                                                >
                                                                    {inGroup
                                                                        ? "In group"
                                                                        : "Add"}
                                                                </button>
                                                            </div>
                                                        );
                                                    },
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}

                            {/* Manual create form (for non-supervisors) */}
                            {roleLower !== "supervisor" && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Name{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={newPassenger.name}
                                            onChange={(e) =>
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    name: e.target.value,
                                                })
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            placeholder="Enter passenger name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Email{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            required
                                            type="email"
                                            value={newPassenger.email}
                                            onChange={(e) =>
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    email: e.target.value,
                                                })
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            placeholder="Enter email address"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Username{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={newPassenger.username}
                                            onChange={(e) =>
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    username: e.target.value,
                                                })
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            placeholder="Enter username"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Staff ID{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={newPassenger.staffId}
                                            onChange={(e) =>
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    staffId: e.target.value,
                                                })
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            placeholder="Enter staff ID"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Phone{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <input
                                            required
                                            type="tel"
                                            value={newPassenger.phone}
                                            onChange={(e) =>
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    phone: e.target.value,
                                                })
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            placeholder="Enter phone number"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Assigned Region{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <select
                                            required
                                            value={
                                                newPassenger
                                                    .assignedRegion[0] || ""
                                            }
                                            onChange={(e) => {
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    assignedRegion: [
                                                        e.target.value,
                                                    ],
                                                    assignedZone: [], // reset location when region changes
                                                });
                                            }}
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        >
                                            <option value="">
                                                Select region
                                            </option>
                                            {Object.keys(organization).map(
                                                (regionCode) => (
                                                    <option
                                                        key={regionCode}
                                                        value={regionCode}
                                                    >
                                                        {regionCode}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Assigned Location{" "}
                                            <span className="text-red-500">
                                                *
                                            </span>
                                        </label>
                                        <select
                                            required
                                            value={
                                                newPassenger.assignedZone[0] ||
                                                ""
                                            }
                                            onChange={(e) => {
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    assignedZone: [
                                                        e.target
                                                            .value as string,
                                                    ],
                                                });
                                            }}
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            disabled={
                                                !newPassenger.assignedRegion[0]
                                            }
                                        >
                                            <option value="">
                                                {!newPassenger
                                                    .assignedRegion[0]
                                                    ? "Select region first"
                                                    : "Select location"}
                                            </option>
                                            {newPassenger.assignedRegion[0] &&
                                                Object.keys(
                                                    organization[
                                                        newPassenger
                                                            .assignedRegion[0]
                                                    ]?.areas || {},
                                                ).map((areaName) => (
                                                    <option
                                                        key={areaName}
                                                        value={areaName}
                                                    >
                                                        {areaName}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                    {supLocations.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Location (optional)
                                            </label>
                                            <select
                                                value={
                                                    newPassenger.location || ""
                                                }
                                                onChange={(e) =>
                                                    setNewPassenger(
                                                        (prev) => ({
                                                            ...prev,
                                                            location:
                                                                e.target
                                                                    .value ||
                                                                undefined,
                                                        }),
                                                    )
                                                }
                                                className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                            >
                                                <option value="">None</option>
                                                {supLocations.map((l) => (
                                                    <option key={l} value={l}>
                                                        {l}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Role
                                        </label>
                                        <select
                                            value={newPassenger.roleKey}
                                            onChange={(e) =>
                                                setNewPassenger({
                                                    ...newPassenger,
                                                    roleKey: e.target.value,
                                                })
                                            }
                                            className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        >
                                            <option value="Passenger">
                                                Passenger
                                            </option>
                                            <option value="Staff">
                                                Staff
                                            </option>
                                            <option value="Manager">
                                                Manager
                                            </option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {addTechError && (
                                <div className="text-red-600 text-sm mt-2">
                                    {addTechError}
                                </div>
                            )}

                            <div className="flex gap-2 mt-6">
                                {roleLower !== "supervisor" && (
                                    <button
                                        onClick={() => {
                                            // Validation: all required fields
                                            if (
                                                !newPassenger.name ||
                                                !newPassenger.email ||
                                                !newPassenger.username ||
                                                !newPassenger.staffId ||
                                                !newPassenger.phone ||
                                                !newPassenger
                                                    .assignedRegion[0] ||
                                                !newPassenger.assignedZone[0]
                                            ) {
                                                setAddTechError(
                                                    "All required fields must be filled.",
                                                );
                                                return;
                                            }
                                            addPassenger();
                                        }}
                                        className="flex-1 h-9 px-3 text-sm rounded text-foreground [background:var(--button-background)] bg-background hover:[background:var(--button-background)] hover:[color:var(--button-foreground)] transition-colors duration-200"
                                    >
                                        Add Passenger
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowAddPassenger(false);
                                        setNewPassenger({
                                            name: "",
                                            email: "",
                                            phone: "",
                                            username: "",
                                            staffId: "",
                                            assignedRegion: [],
                                            assignedZone: [],
                                            location: undefined,
                                            roleKey: "Passenger",
                                        });
                                    }}
                                    className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Sites Modal: assign existing stations to a supervisor group */}
            {showGroupSitesModal && activeGroupId && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-[min(900px,90vw)] rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                Assign Sites to Group
                            </h3>

                            {/* Only show available stations to add here. Existing
                               group stations are visible on the main card under
                               "Sites & Network Elements" and can be removed
                               there. */}
                            <div>
                                <h4 className="text-sm font-medium mb-2">
                                    Available stations to add
                                </h4>
                                <div className="space-y-2 max-h-80 overflow-auto border rounded p-3 bg-background">
                                    {groupSitesLoading ? (
                                        <div className="text-xs text-foreground/70 italic">
                                            Loading stations...
                                        </div>
                                    ) : groupSiteCandidates.length === 0 ? (
                                        <div className="text-xs text-foreground/70 italic">
                                            All available stations are already
                                            assigned to a group.
                                        </div>
                                    ) : (
                                        groupSiteCandidates.map((s) => (
                                            <div
                                                key={s.id}
                                                className="flex items-center justify-between rounded border bg-background px-3 py-2 text-sm"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {s.name}
                                                    </span>
                                                    <span className="text-foreground/80">
                                                        Code: {s.siteCode}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const resp =
                                                                await fetch(
                                                                    `/api/team/${activeGroupId}/stations`,
                                                                    {
                                                                        method: "POST",
                                                                        credentials:
                                                                            "same-origin",
                                                                        headers:
                                                                            {
                                                                                "Content-Type":
                                                                                    "application/json",
                                                                            },
                                                                        body: JSON.stringify(
                                                                            {
                                                                                siteId: s.id,
                                                                            },
                                                                        ),
                                                                    },
                                                                );
                                                            if (!resp.ok)
                                                                return;
                                                            const created =
                                                                await resp.json();
                                                            setVisibleTeam?.(
                                                                (
                                                                    prev: any[] = [],
                                                                ) =>
                                                                    (
                                                                        prev ||
                                                                        []
                                                                    ).map(
                                                                        (
                                                                            t: any,
                                                                        ) =>
                                                                            t.id ===
                                                                            activeGroupId
                                                                                ? {
                                                                                      ...t,
                                                                                      stations: [
                                                                                          ...(t.stations ||
                                                                                              []),
                                                                                          created,
                                                                                      ].filter(
                                                                                          (
                                                                                              x: any,
                                                                                              idx: number,
                                                                                              arr: any[],
                                                                                          ) =>
                                                                                              x.id &&
                                                                                              arr.findIndex(
                                                                                                  (
                                                                                                      y: any,
                                                                                                  ) =>
                                                                                                      y.id ===
                                                                                                      x.id,
                                                                                              ) ===
                                                                                                  idx,
                                                                                      ),
                                                                                  }
                                                                                : t,
                                                                    ),
                                                            );
                                                            // Refresh the live site list so the
                                                            // main group card shows the newly
                                                            // added site immediately.
                                                            fetchTeamSites();
                                                            // Remove from candidates so it can't be added again.
                                                            setGroupSiteCandidates(
                                                                (prev) =>
                                                                    prev.filter(
                                                                        (cs) =>
                                                                            cs.id !==
                                                                            s.id,
                                                                    ),
                                                            );
                                                        } catch (e) {
                                                            console.error(
                                                                "Failed to attach site to group",
                                                                e,
                                                            );
                                                        }
                                                    }}
                                                    className="px-2 py-1 rounded border bg-background hover:bg-base-hover"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowGroupSitesModal(false);
                                        setGroupSiteCandidates([]);
                                    }}
                                    className="bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Passenger Modal */}
            {editingPassenger && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-[min(900px,90vw)] rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                Edit Passenger
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPassenger.name}
                                        onChange={(e) =>
                                            setEditingPassenger({
                                                ...editingPassenger,
                                                name: e.target.value,
                                            })
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        placeholder="Enter passenger name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={editingPassenger.email || ""}
                                        onChange={(e) =>
                                            setEditingPassenger({
                                                ...editingPassenger,
                                                email: e.target.value,
                                            })
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        placeholder="Enter email address"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPassenger.username}
                                        readOnly
                                        className="w-full h-9 rounded border border-border bg-muted/10 text-foreground px-3 text-sm cursor-not-allowed"
                                        placeholder="Username cannot be changed"
                                    />
                                    <div className="text-xs text-foreground/60 mt-1">
                                        Username is immutable; to change it
                                        contact an administrator.
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Staff ID (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={editingPassenger.staffId || ""}
                                        onChange={(e) =>
                                            setEditingPassenger({
                                                ...editingPassenger,
                                                staffId: e.target.value,
                                            })
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        placeholder="Enter staff ID"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={editPassenger}
                                    className="flex-1 h-9 px-3 text-sm rounded text-foreground [background:var(--button-background)] bg-background hover:[background:var(--button-background)] hover:[color:var(--button-foreground)] transition-colors duration-200"
                                >
                                    Update Passenger
                                </button>
                                <button
                                    onClick={() => setEditingPassenger(null)}
                                    className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Site Modal */}
            {showAddSite && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-full max-w-2xl rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                {isHqStaff
                                    ? "Add New Site (Head Quarter)"
                                    : isRegionStaff
                                      ? "Add New Site (Region)"
                                      : "Add New Site"}
                            </h3>

                            {isHqStaff || isRegionStaff ? (
                                // Manager-style form (includes latitude/longitude)
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        try {
                                            const regionId =
                                                newSite.region || undefined;
                                            const zoneId =
                                                newSite.zone || undefined;
                                            let resolvedRegionId = regionId;
                                            if (!resolvedRegionId && zoneId) {
                                                const z = availableZones.find(
                                                    (zz) => zz.id === zoneId,
                                                );
                                                resolvedRegionId =
                                                    z?.regionId || undefined;
                                            }
                                            if (!resolvedRegionId) {
                                                alert("Region is required");
                                                return;
                                            }
                                            const payload: any = {
                                                name: newSite.name,
                                                siteCode: newSite.siteCode,
                                                neNameAndId:
                                                    newSite.neNameAndId ||
                                                    undefined,
                                                regionId: resolvedRegionId,
                                                zoneId: zoneId || null,
                                                latitude:
                                                    newSite.latitude || null,
                                                longitude:
                                                    newSite.longitude || null,
                                            };
                                            const resp = await fetch(
                                                "/api/stations",
                                                {
                                                    method: "POST",
                                                    headers: {
                                                        "Content-Type":
                                                            "application/json",
                                                    },
                                                    body: JSON.stringify(
                                                        payload,
                                                    ),
                                                },
                                            );
                                            if (!resp.ok) {
                                                const err = await resp
                                                    .json()
                                                    .catch(() => ({}));
                                                throw new Error(
                                                    err.error ||
                                                        "Failed to create site",
                                                );
                                            }
                                            const created = await resp.json();
                                            // Refresh team stations
                                            fetchTeamSites();
                                            setShowAddSite(false);
                                            setNewSite({
                                                name: "",
                                                siteCode: "",
                                                neNameAndId: "",
                                                region: "",
                                                zone: "",
                                                latitude: "",
                                                longitude: "",
                                            });
                                        } catch (err: any) {
                                            alert(
                                                "Failed to add site: " +
                                                    (err?.message || err),
                                            );
                                        }
                                    }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Site Name
                                        </label>
                                        <input
                                            required
                                            value={newSite.name}
                                            onChange={(e) =>
                                                setNewSite({
                                                    ...newSite,
                                                    name: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Site Code
                                        </label>
                                        <input
                                            required
                                            value={newSite.siteCode}
                                            onChange={(e) =>
                                                setNewSite({
                                                    ...newSite,
                                                    siteCode: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            NE Name(s)
                                        </label>
                                        <input
                                            value={newSite.neNameAndId}
                                            onChange={(e) =>
                                                setNewSite({
                                                    ...newSite,
                                                    neNameAndId: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Region select hidden for HQ supervisors */}
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Zone
                                            </label>
                                            <select
                                                value={newSite.zone}
                                                onChange={(e) =>
                                                    setNewSite({
                                                        ...newSite,
                                                        zone: e.target.value,
                                                    })
                                                }
                                                className="w-full p-2 border rounded"
                                            >
                                                <option value="">None</option>
                                                {availableZones
                                                    .filter(
                                                        (z) =>
                                                            !newSite.region ||
                                                            z.regionId ===
                                                                newSite.region,
                                                    )
                                                    .map((z) => (
                                                        <option
                                                            key={z.id}
                                                            value={z.id}
                                                        >
                                                            {z.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>

                                        {/* Latitude + Longitude grouped on the right column */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">
                                                    Latitude
                                                </label>
                                                <input
                                                    value={newSite.latitude}
                                                    onChange={(e) =>
                                                        setNewSite({
                                                            ...newSite,
                                                            latitude:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border rounded"
                                                    placeholder="e.g. 9.002111"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">
                                                    Longitude
                                                </label>
                                                <input
                                                    value={newSite.longitude}
                                                    onChange={(e) =>
                                                        setNewSite({
                                                            ...newSite,
                                                            longitude:
                                                                e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border rounded"
                                                    placeholder="e.g. 38.767056"
                                                />
                                            </div>
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
                                            onClick={() => {
                                                setShowAddSite(false);
                                                setNewSite({
                                                    name: "",
                                                    siteCode: "",
                                                    neNameAndId: "",
                                                    region: "",
                                                    zone: "",
                                                    latitude: "",
                                                    longitude: "",
                                                });
                                            }}
                                            className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                // Staff-style simple form
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Site Name
                                        </label>
                                        <input
                                            type="text"
                                            value={newSite.name}
                                            onChange={(e) =>
                                                setNewSite({
                                                    ...newSite,
                                                    name: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                            placeholder="Enter site name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Site Code
                                        </label>
                                        <input
                                            type="text"
                                            value={newSite.siteCode}
                                            onChange={(e) =>
                                                setNewSite({
                                                    ...newSite,
                                                    siteCode: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                            placeholder="Enter site code"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Network Element (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={newSite.neNameAndId}
                                            onChange={(e) =>
                                                setNewSite({
                                                    ...newSite,
                                                    neNameAndId: e.target.value,
                                                })
                                            }
                                            className="w-full p-2 border rounded"
                                            placeholder="Enter NE name and ID"
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        <button
                                            onClick={addSite}
                                            className="et-primary-button flex-1"
                                        >
                                            Add Site
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowAddSite(false);
                                                setNewSite({
                                                    name: "",
                                                    siteCode: "",
                                                    neNameAndId: "",
                                                    region: "",
                                                    zone: "",
                                                    latitude: "",
                                                    longitude: "",
                                                });
                                            }}
                                            className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Site Modal */}
            {editingSite && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-full max-w-md rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                Edit Site
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Site Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSite.name}
                                        onChange={(e) =>
                                            setEditingSite({
                                                ...editingSite,
                                                name: e.target.value,
                                            })
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        placeholder="Enter site name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Site Code
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSite.siteCode}
                                        onChange={(e) =>
                                            setEditingSite({
                                                ...editingSite,
                                                siteCode: e.target.value,
                                            })
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        placeholder="Enter site code"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">
                                        Network Element (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={editingSite.neNameAndId || ""}
                                        onChange={(e) =>
                                            setEditingSite({
                                                ...editingSite,
                                                neNameAndId: e.target.value,
                                            })
                                        }
                                        className="w-full h-9 rounded border border-border bg-white text-black dark:bg-black dark:text-white px-3 text-sm"
                                        placeholder="Enter NE name and ID"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={editSite}
                                    className="flex-1 px-4 py-2 rounded text-foreground [background:var(--button-background)] hover:[background:var(--button-background)] hover:[color:var(--button-foreground)] transition-colors duration-200"
                                >
                                    Update Site
                                </button>
                                <button
                                    onClick={() => setEditingSite(null)}
                                    className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Network Element Modal */}
            {showAddNE && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-full max-w-md rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                Add Network Element
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        NE Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newNE.name}
                                        onChange={(e) =>
                                            setNewNE({
                                                ...newNE,
                                                name: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Enter network element name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        NE ID
                                    </label>
                                    <input
                                        type="text"
                                        value={newNE.neId}
                                        onChange={(e) =>
                                            setNewNE({
                                                ...newNE,
                                                neId: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Enter network element ID"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Type (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={newNE.type}
                                        onChange={(e) =>
                                            setNewNE({
                                                ...newNE,
                                                type: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Enter NE type (e.g., Router, Switch)"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={addNE}
                                    className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
                                >
                                    Add Network Element
                                </button>
                                <button
                                    onClick={() => {
                                        setShowAddNE(false);
                                        setNewNE({
                                            name: "",
                                            neId: "",
                                            type: "",
                                        });
                                        setSelectedSiteForNE(null);
                                    }}
                                    className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Network Element Modal */}
            {editingNE && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-transparent px-4 isolate">
                    <div className="relative">
                        <div className="absolute -inset-6 rounded-2xl bg-black/40 backdrop-blur-sm" />
                        <div className="relative z-[1001] w-full max-w-md rounded-xl bg-white text-black dark:bg-black dark:text-white p-6 border border-border ring-1 ring-border">
                            <h3 className="text-lg font-semibold mb-4">
                                Edit Network Element
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        NE Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editingNE.name}
                                        onChange={(e) =>
                                            setEditingNE({
                                                ...editingNE,
                                                name: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Enter network element name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        NE ID
                                    </label>
                                    <input
                                        type="text"
                                        value={editingNE.neId}
                                        onChange={(e) =>
                                            setEditingNE({
                                                ...editingNE,
                                                neId: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Enter network element ID"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Type (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={editingNE.type || ""}
                                        onChange={(e) =>
                                            setEditingNE({
                                                ...editingNE,
                                                type: e.target.value,
                                            })
                                        }
                                        className="w-full p-2 border rounded"
                                        placeholder="Enter NE type (e.g., Router, Switch)"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={editNE}
                                    className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
                                >
                                    Update Network Element
                                </button>
                                <button
                                    onClick={() => setEditingNE(null)}
                                    className="flex-1 bg-background text-foreground px-4 py-2 rounded border hover:bg-base-hover"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
