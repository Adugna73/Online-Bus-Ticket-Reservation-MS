"use client";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { isAazOrHqSite } from "../lib/assignment";
import { generatePmTaskNumber } from "../lib/taskNumber";

type Props = {
    team: any[];
    users: any[];
    stations: any[];
    templates: any[];
    onCreated?: (wo: any) => void;
};

export default function WorkOrderForm({
    team,
    users,
    stations,
    templates,
    onCreated,
}: Props) {
    const normalizeZoneScopeCode = useCallback(
        (value: unknown) =>
            String(value || "")
                .trim()
                .replace(/\s+/g, " ")
                .toUpperCase(),
        [],
    );

    const filterZonesForSelectedRegionName = useCallback(
        (regionName: string, zoneList: Array<{ id: string; name: string }>) => {
            const normalizedRegionName = normalizeZoneScopeCode(regionName);
            if (!normalizedRegionName) return [];

            if (normalizedRegionName === "HQ") {
                return zoneList.filter((zone) => {
                    const normalizedZoneName = normalizeZoneScopeCode(
                        zone.name,
                    );
                    return (
                        normalizedZoneName === "HQ" ||
                        normalizedZoneName.startsWith("HQ-") ||
                        normalizedZoneName.includes("AAZ")
                    );
                });
            }

            return zoneList.filter(
                (zone) =>
                    normalizeZoneScopeCode(zone.name) === normalizedRegionName,
            );
        },
        [normalizeZoneScopeCode],
    );

    const siteMatchesSelectedRegionName = useCallback(
        (site: any, regionName: string) => {
            const normalizedRegionName = normalizeZoneScopeCode(regionName);
            if (!normalizedRegionName) return true;

            const zoneName = normalizeZoneScopeCode(site?.zone?.name);
            const siteRegionName = normalizeZoneScopeCode(site?.region?.name);

            if (normalizedRegionName === "HQ") {
                return (
                    zoneName === "HQ" ||
                    zoneName.startsWith("HQ-") ||
                    zoneName.includes("AAZ") ||
                    siteRegionName === "HQ" ||
                    siteRegionName.includes("AAZ")
                );
            }

            return (
                zoneName === normalizedRegionName ||
                siteRegionName === normalizedRegionName
            );
        },
        [normalizeZoneScopeCode],
    );

    const { data: session } = useSession();
    const router = useRouter();
    const currentUser = session?.user as any;
    // role can be a string (e.g. 'Manager') or an object { key: 'manager' }
    const roleKey = (() => {
        const r = currentUser?.role;
        if (!r) return "";
        if (typeof r === "string") return r.toLowerCase();
        if (typeof r === "object" && r.key) return String(r.key).toLowerCase();
        return "";
    })();
    const rolePath =
        roleKey === "admin"
            ? "admin"
            : roleKey === "manager"
              ? "manager"
              : roleKey === "supervisor"
                ? "supervisor"
                : "passenger";
    const isManagerOrStaff =
        roleKey === "manager" || roleKey === "supervisor";
    const isStaff = roleKey === "supervisor";
    const [zones, setZones] = useState<any[]>([]);
    const [filteredZones, setFilteredZones] = useState<any[]>([]);
    const isHeadQuarterUser = React.useMemo(() => {
        // Consider a user HQ if their locationCategory is 'Head Quarter' or assignedRegion/assignedZone contains 'head quarter'/'hq'
        const locCat = String(
            currentUser?.locationCategory || "",
        ).toLowerCase();
        if (locCat.includes("head quarter") || locCat === "hq") return true;
        const regions = Array.isArray(currentUser?.assignedRegion)
            ? currentUser.assignedRegion
            : [];
        const zonesRaw = Array.isArray(currentUser?.assignedZone)
            ? currentUser.assignedZone
            : [];
        const regionMatch = regions.some(
            (r: any) =>
                String(r || "")
                    .toLowerCase()
                    .includes("head quarter") ||
                String(r || "").toLowerCase() === "hq",
        );
        const zoneMatch = zonesRaw.some((z: any) =>
            String(z || "")
                .toLowerCase()
                .includes("hq"),
        );
        return regionMatch || zoneMatch;
    }, [
        currentUser?.locationCategory,
        currentUser?.assignedRegion,
        currentUser?.assignedZone,
    ]);
    const assignedLabel = isHeadQuarterUser
        ? "Assigned Zone"
        : "Assigned Region";
    const isSeededStaff =
        roleKey === "supervisor" && !!currentUser?.seeded;
    const isZoneManagerOrStaff =
        (roleKey === "manager" || roleKey === "supervisor") &&
        !isHeadQuarterUser;

    // Only show the Muhaba (HQ manager) form for AAZ and HQ supervisors.
    // Detect by locationCategory OR by assignedRegion/assignedZone values
    const isAazOrHqStaff =
        isStaff &&
        (() => {
            const locCat = String(
                currentUser?.locationCategory || "",
            ).toLowerCase();
            if (
                locCat.includes("head quarter") ||
                locCat === "hq" ||
                locCat.includes("aaz")
            )
                return true;
            const regs = Array.isArray(currentUser?.assignedRegion)
                ? currentUser.assignedRegion
                : [];
            const zns = Array.isArray(currentUser?.assignedZone)
                ? currentUser.assignedZone
                : [];
            const regionMatch = regs.some((r: any) => {
                const v = String(r || "").toLowerCase();
                return (
                    v.includes("aaz") ||
                    v.includes("head quarter") ||
                    v === "hq"
                );
            });
            const zoneMatch = zns.some((z: any) => {
                const v = String(z || "").toLowerCase();
                return (
                    v.includes("aaz") || v.startsWith("hq-") || v.includes("hq")
                );
            });
            return regionMatch || zoneMatch;
        })();
    const allowedRegionIds = useMemo(
        () =>
            isManagerOrStaff && Array.isArray(currentUser?.assignedRegion)
                ? currentUser.assignedRegion
                : [],
        [isManagerOrStaff, currentUser?.assignedRegion],
    );
    const allowedZoneIds = useMemo(
        () =>
            isManagerOrStaff && Array.isArray(currentUser?.assignedZone)
                ? currentUser.assignedZone
                : [],
        [isManagerOrStaff, currentUser?.assignedZone],
    );

    const isZoneOnlyUser = useMemo(
        () =>
            isManagerOrStaff &&
            !isHeadQuarterUser &&
            allowedZoneIds.length > 0 &&
            allowedRegionIds.length === 0,
        [
            isManagerOrStaff,
            isHeadQuarterUser,
            allowedZoneIds.length,
            allowedRegionIds.length,
        ],
    );

    const [managerAssignedRegionsRaw, setManagerAssignedRegionsRaw] = useState<
        string[] | null
    >(null);
    const [managerAssignedZonesRaw, setManagerAssignedZonesRaw] = useState<
        string[] | null
    >(null);

    const isSiteAllowed = useCallback(
        (site: any) => {
            // For HQ *managers* only: restrict displayed stations to those in
            // their explicitly assigned zones.  HQ supervisors (including
            // AAZ/HQ supervisors) should be able to choose any zone from the
            // AAZ/HQ pool and therefore must not be limited here.
            if (
                isManagerOrStaff &&
                isHeadQuarterUser &&
                roleKey === "manager"
            ) {
                const assigned =
                    Array.isArray(currentUser?.assignedZone) &&
                    currentUser.assignedZone.length > 0
                        ? currentUser.assignedZone
                        : managerAssignedZonesRaw || [];
                return (
                    Array.isArray(assigned) && assigned.includes(site.zoneId)
                );
            }
            return true;
        },
        [
            isManagerOrStaff,
            isHeadQuarterUser,
            roleKey,
            currentUser?.assignedZone,
            managerAssignedZonesRaw,
        ],
    );

    const isUserAllowed = useCallback(
        (user: any) => {
            if (!isManagerOrStaff) return true;
            // if no area restrictions, allow everyone
            if (allowedRegionIds.length === 0 && allowedZoneIds.length === 0) {
                return true;
            }
            const regionOk = allowedRegionIds.length
                ? user.assignedRegion?.some((id: string) =>
                      allowedRegionIds.includes(id),
                  ) || false
                : false;
            const zoneOk = allowedZoneIds.length
                ? user.assignedZone?.some((id: string) =>
                      allowedZoneIds.includes(id),
                  ) || false
                : false;
            if (isZoneOnlyUser) {
                if (!zoneOk) return false;
            } else {
                if (!(regionOk || zoneOk)) return false;
            }
            if (isHeadQuarterUser) {
                const assignedZones = Array.isArray(user?.assignedZone)
                    ? user.assignedZone
                    : [];
                const assignedRegions = Array.isArray(user?.assignedRegion)
                    ? user.assignedRegion
                    : [];
                if (
                    assignedZones.some((z: string) =>
                        /aaz|hq/i.test(String(z)),
                    ) ||
                    assignedRegions.some((r: string) =>
                        /aaz|hq/i.test(String(r)),
                    )
                ) {
                    return true;
                }
            }
            return true;
        },
        [
            isManagerOrStaff,
            allowedRegionIds,
            allowedZoneIds,
            isZoneOnlyUser,
            isHeadQuarterUser,
        ],
    );

    // Helper to detect passenger roles on a user (role can be string or object)
    const getRoleKeyFromUser = useCallback((u: any) => {
        const r = u?.role;
        if (!r) return "";
        if (typeof r === "string") return r.toLowerCase();
        if (typeof r === "object" && r.key) return String(r.key).toLowerCase();
        return "";
    }, []);
    const isPassenger = useCallback(
        (u: any) => {
            const k = getRoleKeyFromUser(u);
            return (
                k.includes("tech") ||
                k.includes("passenger") ||
                k === "passenger"
            );
        },
        [getRoleKeyFromUser],
    );

    // Apply manager/supervisor user scoping:
    // - Manager may assign to supervisors or passengers
    // - Manager may assign only to passengers
    const applyUserScope = useCallback(
        (list: any[]) => {
            if (!isManagerOrStaff) return list || [];
            const rk = roleKey || "";
            return (list || []).filter((u: any) => {
                // first drop anyone outside the assigned area
                if (!isUserAllowed(u)) return false;

                const k = getRoleKeyFromUser(u) || "";
                if (rk === "manager") {
                    if (k === "manager" && u?.id !== currentUser?.id) {
                        return false;
                    }
                    return (
                        k === "supervisor" ||
                        k === "manager" ||
                        k.includes("tech") ||
                        k.includes("passenger")
                    );
                }
                // supervisor
                if (isHeadQuarterUser) return true;
                return k.includes("tech") || k.includes("passenger");
            });
        },
        [
            isManagerOrStaff,
            getRoleKeyFromUser,
            roleKey,
            isHeadQuarterUser,
            isUserAllowed,
        ],
    );

    const isTeamAllowed = useCallback(
        (team: any) => {
            if (!isManagerOrStaff) return true;
            const managerOk = team.manager
                ? isUserAllowed(team.manager)
                : false;
            const memberOk = Array.isArray(team.members)
                ? team.members.some((member: any) => isUserAllowed(member))
                : false;
            return managerOk || memberOk;
        },
        [isManagerOrStaff, isUserAllowed],
    );
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [descExpanded, setDescExpanded] = useState(false);
    const [type, setType] = useState("pm");
    const [siteId, setSiteId] = useState("");
    const [selectedSiteDetails, setSelectedSiteDetails] = useState<any>(null);
    // initialize empty and sync below so filters run after session/permissions resolve
    const [allSites, setAllSites] = useState<any[]>([]);
    const [filteredSites, setFilteredSites] = useState<any[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
    const [teamId, setTeamId] = useState("");
    const [assignedToId, setAssignedToId] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [checklistScope, setChecklistScope] = useState("full");
    const [scheduledStartAt, setScheduledStartAt] = useState<string | null>(
        null,
    );
    const [scheduledEndAt, setScheduledEndAt] = useState<string | null>(null);
    // Separate date inputs
    const [scheduledStartDate, setScheduledStartDate] = useState<string | null>(
        null,
    );
    const [scheduledEndDate, setScheduledEndDate] = useState<string | null>(
        null,
    );
    // createdAtLocal is used as the origin for planned schedules (calendar start)
    const [createdAtLocal, setCreatedAtLocal] = useState<string>(() => {
        const d = new Date();
        const tzOffset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - tzOffset * 60000);
        return local.toISOString().slice(0, 16);
    });

    // derived default date/time parts from createdAtLocal (format: YYYY-MM-DDTHH:MM)
    const createdDateDefault = createdAtLocal
        ? createdAtLocal.slice(0, 10)
        : "";
    const createdTimeDefault = createdAtLocal
        ? createdAtLocal.slice(11, 16)
        : "";
    const [filteredTeam, setFilteredTeam] = useState<any[]>([]);
    const [availableTeam, setAvailableTeam] = useState<any[]>([]);
    const [teamSites, setTeamSites] = useState<any[]>([]);
    const [teamUsers, setTeamUsers] = useState<any[]>([]);
    const supervisorAssigneeValue = useMemo(() => {
        if (!isStaff) return "";
        if (teamId) return `team:${teamId}`;
        if (assignedToId) return `user:${assignedToId}`;
        return "";
    }, [isStaff, teamId, assignedToId]);
    const supervisorGroupTeam = useMemo(() => {
        if (!isStaff) return [];
        const uid = currentUser?.id;
        if (!uid) return [];

        const scoped = (availableTeam || []).filter((t: any) => {
            const managerId = t.managerId || t.manager?.id;
            const name = String(t.name || "").trim();
            const m = name.match(/^group-(\d+)$/i);
            return managerId === uid && !!m;
        });

        const byName = new Map<string, any>();
        for (const t of scoped) {
            const name = String(t.name || "").trim();
            const m = name.match(/^group-(\d+)$/i);
            if (!m) continue;
            const norm = `group-${m[1]}`;
            if (!byName.has(norm)) byName.set(norm, t);
        }

        const uniqueGroups = Array.from(byName.values()).sort((a, b) => {
            const na = String(a.name || "");
            const nb = String(b.name || "");
            const ma = na.match(/(\d+)/);
            const mb = nb.match(/(\d+)/);
            const ia = ma ? parseInt(ma[1], 10) : 0;
            const ib = mb ? parseInt(mb[1], 10) : 0;
            return ia - ib;
        });

        return uniqueGroups;
    }, [isStaff, availableTeam, currentUser?.id]);
    const [regions, setRegions] = useState<any[]>([]);
    const [neNames, setNeNames] = useState<any[]>([]);
    const [supervisorSites, setStaffSites] = useState<any[]>([]);
    const [supervisorNeNames, setStaffNeNames] = useState<any[]>([]);
    const [selectedRegionId, setSelectedRegionId] = useState("");
    const [selectedZoneId, setSelectedZoneId] = useState("");
    const manualZoneSelectionRef = useRef(false);
    // const [selectedNeName, setSelectedNeName] = useState(""); // Removed duplicate declaration
    // const [submitting, setSubmitting] = useState(false); // Removed duplicate declaration
    // const [error, setError] = useState<string | null>(null); // Removed duplicate declaration

    // Fetch all zones for HQ managers on mount if not already loaded

    // Helper: only auto-set zone when it matches selected region (avoid unexpected HQ defaults)
    // Fix: Always allow explicit zone selection for AAZ/HQ supervisors, do not override with auto-selection
    const safeSetSelectedZoneId = useCallback(
        (zid: string | null) => {
            if (!zid) {
                setSelectedZoneId("");
                return;
            }
            const z = zones.find((zz: any) => zz.id === zid);
            if (!z) return;
            const currentSelectedRegionName = selectedRegionId
                ? regions.find((r: any) => r.id === selectedRegionId)?.name ||
                  ""
                : "";
            const normalizedCurrentSelectedRegionName = normalizeZoneScopeCode(
                currentSelectedRegionName,
            );

            // IMPORTANT: block automatic selection for AAZ/HQ supervisors.
            // They must choose a zone explicitly (Muhaba parity). Manual
            // selection will bypass this function (onChange uses setSelectedZoneId
            // directly for AAZ/HQ supervisors).
            if (isAazOrHqStaff) {
                return;
            }

            // Manager may be locked to a zone; allow them to be auto-set
            if (roleKey === "supervisor") {
                setSelectedZoneId(zid);
                return;
            }
            // For HQ/AAZ selections, allow zone selection without forcing the
            // selected region to match the zone's underlying region record.
            if (
                isHeadQuarterUser ||
                normalizedCurrentSelectedRegionName === "HQ" ||
                normalizedCurrentSelectedRegionName.includes("AAZ")
            ) {
                setSelectedZoneId(zid);
                return;
            }
            // For managers and others, require explicit region selection matching the zone
            if (selectedRegionId && z.regionId === selectedRegionId) {
                setSelectedZoneId(zid);
            }
        },
        [
            zones,
            regions,
            selectedRegionId,
            roleKey,
            isHeadQuarterUser,
            currentUser?.locationCategory,
            isAazOrHqStaff,
            normalizeZoneScopeCode,
        ],
    );

    useEffect(() => {
        // Load zones for managers/supervisors:
        // - For AAZ/HQ supervisors, load *all* zones then filter to AAZ/HQ so they can pick any AAZ/HQ area.
        // - For HQ managers keep the existing assigned-zones behavior.
        if (!isManagerOrStaff || zones.length > 0) return;

        (async () => {
            try {
                if (isAazOrHqStaff) {
                    const res = await fetch("/api/zones");
                    if (!res.ok) return setZones([]);
                    const all = await res.json();
                    const filtered = (Array.isArray(all) ? all : []).filter(
                        (z: any) => {
                            const n = String(z?.name || "").toLowerCase();
                            return (
                                n.includes("aaz") ||
                                n.includes("hq") ||
                                n.startsWith("hq-")
                            );
                        },
                    );
                    setZones(filtered);
                    return;
                }

                // Default: load manager-scoped zones from the manager endpoint
                const zonesRes = await fetch("/api/zones/manager");
                if (!zonesRes.ok) return setZones([]);
                const data = await zonesRes.json();
                if (Array.isArray(data)) setZones(data);
            } catch (err) {
                console.error("[Zone Fetch] error", err);
                setZones([]);
            }
        })();
    }, [
        isManagerOrStaff,
        isAazOrHqStaff,
        zones.length,
        currentUser,
        managerAssignedZonesRaw,
    ]);

    // For HQ managers and AAZ/HQ supervisors, filter stations by selected zone
    // (managers only). Manager are handled by a dedicated effect that
    // queries /api/stations by zone name so the behaviour matches
    // /supervisor/stations exactly.
    useEffect(() => {
        // Manager: handled by supervisor-specific effect
        if (roleKey === "supervisor") return;

        const source = allSites || [];
        if (
            isManagerOrStaff &&
            (isHeadQuarterUser || isAazOrHqStaff)
        ) {
            if (isAazOrHqStaff) {
                // For AAZ/HQ supervisors:
                // - Require an AAZ/HQ zone selection before showing stations.
                // - When a zone is selected, show only stations that belong to
                //   that zone (zoneId match) and are in the AAZ/HQ area. This
                //   matches the behaviour of the /supervisor/stations page where
                //   stations are filtered per zone.
                if (selectedZoneId) {
                    const filtered = source.filter(
                        (site: any) =>
                            site.zoneId === selectedZoneId &&
                            isAazOrHqSite(site.zone?.name, site.region?.name),
                    );
                    setFilteredSites(filtered);
                } else {
                    setFilteredSites([]);
                }
            } else {
                if (selectedZoneId) {
                    const filtered = source.filter(
                        (site: any) => site.zoneId === selectedZoneId,
                    );
                    setFilteredSites(filtered);
                } else {
                    // HQ managers: show all assigned stations until zone is selected
                    setFilteredSites(source);
                }
            }
        } else if (isManagerOrStaff && selectedZoneId) {
            // For non-HQ managers, filter by selected zone
            const filtered = source.filter(
                (site: any) => site.zoneId === selectedZoneId,
            );
            setFilteredSites(filtered);
        } else {
            setFilteredSites(source);
        }
    }, [
        isManagerOrStaff,
        isHeadQuarterUser,
        isAazOrHqStaff,
        selectedZoneId,
        allSites,
        roleKey,
    ]);
    const [selectedNeName, setSelectedNeName] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Staff passenger list used to refine assignable users
    const [supervisorTechs, setStaffTechs] = useState<any[]>([]);
    const supervisorHasTechs = useMemo(
        () => Array.isArray(supervisorTechs) && supervisorTechs.length > 0,
        [supervisorTechs],
    );
    // When supervisor provides a passenger list, scope it further to the current region/zone (CWR area)
    const supervisorScopedTechs = useMemo(() => {
        if (!supervisorHasTechs) return [];
        let list = supervisorTechs || [];
        // apply manager/supervisor area guards first
        // If a user has explicit assignedRegion/assignedZone arrays, enforce them.
        // If an entry lacks those arrays (seeded JSON-only), allow it through so it can be displayed.
        list = list.filter((u: any) => {
            const hasRegionOrZone =
                Array.isArray(u.assignedRegion) ||
                Array.isArray(u.assignedZone);
            if (hasRegionOrZone) return isUserAllowed(u);
            return true; // seeded entry without region/zone: allow
        });

        // narrow by selected zone if present, otherwise by selected region if present
        if (selectedZoneId) {
            const zoneFiltered = list.filter(
                (u: any) =>
                    Array.isArray(u.assignedZone) &&
                    u.assignedZone.includes(selectedZoneId),
            );
            if (zoneFiltered.length > 0) return zoneFiltered;
        }
        if (selectedRegionId) {
            const regionFiltered = list.filter(
                (u: any) =>
                    Array.isArray(u.assignedRegion) &&
                    u.assignedRegion.includes(selectedRegionId),
            );
            if (regionFiltered.length > 0) return regionFiltered;
        }

        // fallback: include passengers and seeded entries lacking role info so seeded staff aren't filtered out
        return list.filter((u: any) => isPassenger(u) || !u.role);
    }, [
        supervisorHasTechs,
        supervisorTechs,
        selectedZoneId,
        selectedRegionId,
        isUserAllowed,
        isPassenger,
    ]);

    useEffect(() => {
        try {
            console.debug(
                "WorkOrderForm: supervisorScopedTechs count",
                (supervisorScopedTechs || []).length,
            );
            const seededCount = (supervisorScopedTechs || []).filter(
                (u: any) =>
                    !Array.isArray(u.assignedRegion) &&
                    !Array.isArray(u.assignedZone),
            ).length;
            console.debug(
                "WorkOrderForm: supervisorScopedTechs seeded entries",
                seededCount,
            );
        } catch (e) {}
    }, [supervisorScopedTechs]);

    // Keep filtered lists in sync when inputs or current user change
    useEffect(() => {
        // debug: show session-related values to diagnose auto-selection
        try {
            console.debug("WorkOrderForm: currentUser", currentUser);
            console.debug("WorkOrderForm: allowedRegionIds", allowedRegionIds);
            console.debug("WorkOrderForm: allowedZoneIds", allowedZoneIds);
            console.debug("WorkOrderForm: regions loaded", regions);
            console.debug("WorkOrderForm: zones loaded", zones);
        } catch (e) {
            /* ignore debug errors */
        }
        try {
            // For AAZ/HQ supervisors we derive filteredSites from `allSites`
            // and the dedicated AAZ/HQ zone effect. Avoid overriding that
            // here so their site list doesn't "pop up then disappear".
            if (!(isManagerOrStaff && isAazOrHqStaff)) {
                setFilteredSites(
                    (stations || []).filter((site: any) => isSiteAllowed(site)),
                );
            }
            const baseUsers = (users || []).filter((user: any) =>
                isUserAllowed(user),
            );
            // If current user is a manager, also include supervisors and their subordinates
            if (roleKey === "manager") {
                (async () => {
                    try {
                        const regionParam =
                            Array.isArray(currentUser?.assignedRegion) &&
                            currentUser.assignedRegion[0]
                                ? `&regionId=${currentUser.assignedRegion[0]}`
                                : "";
                        const zoneParam =
                            Array.isArray(currentUser?.assignedZone) &&
                            currentUser.assignedZone[0]
                                ? `&zoneId=${currentUser.assignedZone[0]}`
                                : "";
                        const supRes = await fetch(
                            `/api/users?role=supervisor${regionParam}${zoneParam}`,
                        );
                        if (supRes.ok) {
                            const sups = await supRes.json();
                            // Limit supervisors to those within the manager's allowed area
                            const allowedSups = (sups || []).filter((u: any) =>
                                isUserAllowed(u),
                            );
                            const supSubordinates: any[] = [];
                            for (const s of allowedSups) {
                                // include any subordinates field if present and within allowed area
                                if (Array.isArray(s.subordinates)) {
                                    for (const sub of s.subordinates) {
                                        if (isUserAllowed(sub))
                                            supSubordinates.push(sub);
                                    }
                                }
                            }
                            // merge and dedupe by id (some entries may be strings from seeded data)
                            const merged = [
                                ...baseUsers,
                                ...allowedSups,
                                ...supSubordinates,
                            ];
                            const seen = new Set();
                            const deduped = merged.filter((u: any) => {
                                const id = u?.id || u?.email || u?.fullName;
                                if (!id) return false;
                                if (seen.has(id)) return false;
                                seen.add(id);
                                return true;
                            });
                            if (!supervisorHasTechs)
                                setFilteredUsers(applyUserScope(deduped));
                        } else {
                            if (!supervisorHasTechs)
                                setFilteredUsers(applyUserScope(baseUsers));
                        }
                    } catch (e) {
                        if (!supervisorHasTechs)
                            setFilteredUsers(applyUserScope(baseUsers));
                    }
                })();
            } else {
                if (!supervisorHasTechs)
                    setFilteredUsers(applyUserScope(baseUsers));
            }
            const scopedTeam = (team || []).filter((team: any) =>
                isTeamAllowed(team),
            );
            setFilteredTeam(scopedTeam);
            setAvailableTeam(scopedTeam);
        } catch (e) {
            // safe fallback
            if (!(isManagerOrStaff && isAazOrHqStaff)) {
                setFilteredSites(stations || []);
            }
            if (!supervisorHasTechs)
                setFilteredUsers(applyUserScope(users || []));
            setFilteredTeam(team || []);
            setAvailableTeam(team || []);
        }
    }, [
        stations,
        users,
        team,
        isSiteAllowed,
        isUserAllowed,
        isTeamAllowed,
        isManagerOrStaff,
        currentUser,
        allowedRegionIds,
        allowedZoneIds,
        regions,
        zones,
        supervisorHasTechs,
        applyUserScope,
        roleKey,
        isAazOrHqStaff,
    ]);
    useEffect(() => {
        (async () => {
            try {
                // For managers, fetch their assigned zones
                if (isManagerOrStaff) {
                    const zonesRes = await fetch("/api/zones/manager");
                    if (zonesRes.ok) {
                        try {
                            const zonesData = await zonesRes.json();
                            setZones(zonesData);
                        } catch (e) {
                            console.error("Failed to parse zones JSON:", e);
                        }
                    }
                    // Fetch regions
                    const regionsRes = await fetch("/api/regions");
                    if (regionsRes.ok) {
                        try {
                            const regionsData = await regionsRes.json();
                            setRegions(regionsData);
                        } catch (e) {
                            console.error("Failed to parse regions JSON:", e);
                        }
                    }
                    return;
                }

                // For others, fetch all
                const [regionsRes, zonesRes] = await Promise.all([
                    fetch("/api/regions"),
                    fetch("/api/zones"),
                ]);
                if (regionsRes.ok) {
                    try {
                        const regionsData = await regionsRes.json();
                        setRegions(regionsData);
                    } catch (e) {
                        console.error("Failed to parse regions JSON:", e);
                    }
                }
                if (zonesRes.ok) {
                    try {
                        const zonesData = await zonesRes.json();
                        setZones(zonesData);
                    } catch (e) {
                        console.error("Failed to parse zones JSON:", e);
                    }
                }
            } catch (e) {
                console.error("Error fetching regions/zones:", e);
            }
        })();
    }, [isManagerOrStaff]);

    // For supervisors, fetch scoped users from authoritative APIs
    useEffect(() => {
        if (roleKey !== "supervisor") return;
        (async () => {
            try {
                // Fetch passengers (server will scope by session)
                const sessUser: any = currentUser || {};
                const regionParam =
                    Array.isArray(sessUser.assignedRegion) &&
                    sessUser.assignedRegion[0]
                        ? `&regionId=${sessUser.assignedRegion[0]}`
                        : "";
                const zoneParam =
                    Array.isArray(sessUser.assignedZone) &&
                    sessUser.assignedZone[0]
                        ? `&zoneId=${sessUser.assignedZone[0]}`
                        : "";
                const usersRes = await fetch(
                    `/api/users?role=passenger${regionParam}${zoneParam}`,
                );
                if (usersRes.ok) {
                    const usersData = await usersRes.json();
                    setFilteredUsers(applyUserScope(usersData || []));
                }
                // Keep team listing scoped by existing local helper
                setFilteredTeam(
                    (team || []).filter((t: any) => isTeamAllowed(t)),
                );
            } catch (e) {
                console.error("Error fetching supervisor scoped data:", e);
            }
        })();
    }, [
        applyUserScope,
        isTeamAllowed,
        roleKey,
        selectedRegionId,
        selectedZoneId,
        team,
    ]);

    // Seeded supervisors often have empty assignedRegion/assignedZone arrays.
    // Force the selector to match their session `locationCategory` and `location`
    // to avoid substring matches like WR -> SWR.
    useEffect(() => {
        if (!isSeededStaff) return;
        if (!currentUser?.locationCategory) return;
        if (regions.length === 0) return;

        const desired = regions.find(
            (r: any) =>
                String(r.name || "").toLowerCase() ===
                String(currentUser.locationCategory || "").toLowerCase(),
        );
        if (desired && selectedRegionId !== desired.id) {
            setSelectedRegionId(desired.id);
        }
    }, [
        isSeededStaff,
        currentUser?.locationCategory,
        regions,
        selectedRegionId,
    ]);

    useEffect(() => {
        if (!isSeededStaff) return;
        if (!currentUser?.location) return;
        if (zones.length === 0) return;

        const locLower = String(currentUser.location || "")
            .toLowerCase()
            .trim();
        if (!locLower) return;

        const inRegion = selectedRegionId
            ? zones.find(
                  (z: any) =>
                      z.regionId === selectedRegionId &&
                      String(z.name || "")
                          .toLowerCase()
                          .includes(locLower),
              )
            : null;
        const anyZone = zones.find((z: any) =>
            String(z.name || "")
                .toLowerCase()
                .includes(locLower),
        );
        const desired = inRegion || anyZone;
        // Prevent auto-select for HQ-microwave-manager and HQ-Microwave
        if (
            desired &&
            selectedZoneId !== desired.id &&
            currentUser?.role !== "HQ-microwave-manager" &&
            currentUser?.role !== "HQ-Microwave"
        ) {
            safeSetSelectedZoneId(desired.id);
        }
    }, [
        isSeededStaff,
        currentUser?.location,
        zones,
        selectedRegionId,
        selectedZoneId,
        currentUser?.role,
        safeSetSelectedZoneId,
    ]);

    // If supervisorTechs is populated, prefer that list for the Users dropdown
    // Only apply this override when the current user is a supervisor —
    // managers should keep their broader user list (including supervisors).
    useEffect(() => {
        if (!isManagerOrStaff) return;
        if (roleKey !== "supervisor") return; // only apply for supervisors
        if (Array.isArray(supervisorTechs) && supervisorTechs.length > 0) {
            try {
                // supervisor-provided list is authoritative — use it directly (already scoped)
                setFilteredUsers(supervisorScopedTechs);
            } catch (e) {
                console.error(
                    "Error applying supervisor techs to filteredUsers:",
                    e,
                );
            }
        }
    }, [
        supervisorTechs,
        isManagerOrStaff,
        supervisorScopedTechs,
        roleKey,
    ]);

    // DEBUG: dump supervisorTechs and filteredUsers to console for runtime verification
    useEffect(() => {
        try {
            console.debug(
                "WorkOrderForm: supervisorTechs count",
                (supervisorTechs || []).length,
            );
            console.debug(
                "WorkOrderForm: filteredUsers count",
                (filteredUsers || []).length,
            );
        } catch (e) {
            /* ignore */
        }
    }, [supervisorTechs, filteredUsers]);

    // Manager/supervisor assigned regions/zones should already be present on `currentUser` (session)
    // Use those values when available; fall back to empty arrays.
    useEffect(() => {
        if (!isManagerOrStaff) return;
        const mgrAssignedRegions = Array.isArray(currentUser?.assignedRegion)
            ? currentUser.assignedRegion
            : [];
        const mgrAssignedZones = Array.isArray(currentUser?.assignedZone)
            ? currentUser.assignedZone
            : [];
        setManagerAssignedRegionsRaw(mgrAssignedRegions);
        setManagerAssignedZonesRaw(mgrAssignedZones);
    }, [
        isManagerOrStaff,
        currentUser?.assignedRegion,
        currentUser?.assignedZone,
    ]);

    // If session is stale or currentUser lacks assigned areas, fetch authoritative user record
    // from the API to pick up recently-applied `assignedRegion`/`assignedZone` values.
    useEffect(() => {
        if (!isManagerOrStaff) return;
        const hasAssigned =
            (Array.isArray(currentUser?.assignedRegion) &&
                currentUser.assignedRegion.length > 0) ||
            (Array.isArray(currentUser?.assignedZone) &&
                currentUser.assignedZone.length > 0);
        if (hasAssigned) return; // session already has data

        (async () => {
            try {
                const meRes = await fetch("/api/users/me");
                if (!meRes.ok) return;
                const me = await meRes.json();
                if (
                    Array.isArray(me.assignedRegion) &&
                    me.assignedRegion.length > 0
                ) {
                    setManagerAssignedRegionsRaw(me.assignedRegion);
                }
                if (
                    Array.isArray(me.assignedZone) &&
                    me.assignedZone.length > 0
                ) {
                    setManagerAssignedZonesRaw(me.assignedZone);
                }
            } catch (e) {
                // ignore
            }
        })();
    }, [
        isManagerOrStaff,
        currentUser?.email,
        currentUser?.assignedRegion,
        currentUser?.assignedZone,
    ]);

    // Fallback for supervisors when region/area are missing or partially assigned
    // Use debug endpoints (seeded JSON + team stations) to derive their areas and
    // passenger lists so that old and newly-seeded supervisors behave uniformly.
    useEffect(() => {
        if (!isManagerOrStaff) return;
        if (roleKey !== "supervisor") return;
        const hasAssignedRegion =
            Array.isArray(currentUser?.assignedRegion) &&
            currentUser.assignedRegion.length > 0;
        const hasAssignedZone =
            Array.isArray(currentUser?.assignedZone) &&
            currentUser.assignedZone.length > 0;
        // If both region and zone are already assigned, keep DB values as
        // authoritative and skip JSON/debug-based fallbacks.
        if (hasAssignedRegion && hasAssignedZone) return;

        (async () => {
            try {
                const mapRes = await fetch("/api/debug/supervisor-mapping");
                if (mapRes.ok) {
                    const mapData = await mapRes.json();
                    const mgrAssignedRegions =
                        mapData?.manager?.assignedRegion ||
                        mapData?.supervisorLocations?.categories ||
                        [];
                    const mgrAssignedZones =
                        mapData?.manager?.assignedZone ||
                        mapData?.supervisorLocations?.locations ||
                        [];
                    // Only fill gaps: if DB already provides a region or zone,
                    // keep it; otherwise use mapping/JSON to auto-select area.
                    if (
                        !hasAssignedRegion &&
                        Array.isArray(mgrAssignedRegions) &&
                        mgrAssignedRegions.length > 0
                    ) {
                        setManagerAssignedRegionsRaw(mgrAssignedRegions);
                    }
                    if (
                        !hasAssignedZone &&
                        Array.isArray(mgrAssignedZones) &&
                        mgrAssignedZones.length > 0
                    ) {
                        setManagerAssignedZonesRaw(mgrAssignedZones);
                    }
                }

                const repRes = await fetch("/api/debug/supervisor-report");
                if (repRes.ok) {
                    const repData = await repRes.json();
                    if (repData?.passengers)
                        setStaffTechs(repData.passengers || []);
                    if (repData?.stations) setStaffSites(repData.stations || []);
                    if (repData?.neNames)
                        setStaffNeNames(repData.neNames || []);
                    if (repData?.team)
                        setFilteredTeam(
                            (repData.team || []).filter((t: any) =>
                                isTeamAllowed(t),
                            ),
                        );
                    if (repData?.stations)
                        setFilteredSites(
                            (repData.stations || []).filter((s: any) =>
                                isSiteAllowed(s),
                            ),
                        );
                    if (repData?.neNames) setNeNames(repData.neNames || []);
                }
            } catch (e) {
                /* ignore fallback errors */
            }
        })();
    }, [
        isManagerOrStaff,
        roleKey,
        currentUser?.assignedRegion,
        currentUser?.assignedZone,
        isTeamAllowed,
        isSiteAllowed,
    ]);

    // Resolve raw assigned region/zone values (ids or names) to loaded region/zone ids
    useEffect(() => {
        if (!isManagerOrStaff) return;
        // resolve region using Region records when available; do not depend on zones
        if (
            regions.length > 0 &&
            !selectedRegionId &&
            managerAssignedRegionsRaw &&
            managerAssignedRegionsRaw.length > 0
        ) {
            for (const val of managerAssignedRegionsRaw) {
                const match = regions.find(
                    (r: any) =>
                        r.id === val ||
                        String(r.name).toLowerCase() ===
                            String(val).toLowerCase(),
                );
                if (match) {
                    setSelectedRegionId(match.id);
                    break;
                }
            }
        }
        // resolve zone only when Zone records exist
        // Do NOT auto-select for HQ managers OR for AAZ/HQ supervisors (they must choose)
        if (
            zones.length > 0 &&
            !selectedZoneId &&
            managerAssignedZonesRaw &&
            managerAssignedZonesRaw.length > 0 &&
            !manualZoneSelectionRef.current &&
            !(isHeadQuarterUser || isAazOrHqStaff)
        ) {
            for (const val of managerAssignedZonesRaw) {
                const match = zones.find(
                    (z: any) =>
                        z.id === val ||
                        String(z.name).toLowerCase() ===
                            String(val).toLowerCase(),
                );
                if (match) {
                    safeSetSelectedZoneId(match.id);
                    break;
                }
            }
        }
    }, [
        managerAssignedRegionsRaw,
        managerAssignedZonesRaw,
        regions,
        zones,
        isManagerOrStaff,
        selectedRegionId,
        selectedZoneId,
        isHeadQuarterUser,
        isAazOrHqStaff, // re-run if supervisor status changes
        safeSetSelectedZoneId,
    ]);

    // If manager-assigned values exist, ensure UI selection matches them (override incorrect prefill)
    useEffect(() => {
        if (!isManagerOrStaff) return;
        if (regions.length === 0 && zones.length === 0) return;
        if (
            regions.length > 0 &&
            managerAssignedRegionsRaw &&
            managerAssignedRegionsRaw.length > 0
        ) {
            // find first manager-assigned region that matches loaded regions
            let resolvedRegionId: string | null = null;
            for (const val of managerAssignedRegionsRaw) {
                const m = regions.find(
                    (r: any) =>
                        r.id === val ||
                        String(r.name).toLowerCase() ===
                            String(val).toLowerCase(),
                );
                if (m) {
                    resolvedRegionId = m.id;
                    break;
                }
            }
            if (resolvedRegionId && !selectedRegionId) {
                setSelectedRegionId(resolvedRegionId);
            }
        }
        if (
            zones.length > 0 &&
            managerAssignedZonesRaw &&
            managerAssignedZonesRaw.length > 0
        ) {
            let resolvedZoneId: string | null = null;
            for (const val of managerAssignedZonesRaw) {
                const m = zones.find(
                    (z: any) =>
                        z.id === val ||
                        String(z.name).toLowerCase() ===
                            String(val).toLowerCase(),
                );
                if (m) {
                    resolvedZoneId = m.id;
                    break;
                }
            }
            if (
                resolvedZoneId &&
                !selectedZoneId &&
                !manualZoneSelectionRef.current &&
                !(isHeadQuarterUser && roleKey === "manager") &&
                !isAazOrHqStaff // do NOT auto-select manager-assigned zone for AAZ/HQ supervisors — require explicit choice (Muhaba parity)
            ) {
                safeSetSelectedZoneId(resolvedZoneId);
            }
        }
    }, [
        managerAssignedRegionsRaw,
        managerAssignedZonesRaw,
        regions,
        zones,
        selectedRegionId,
        selectedZoneId,
        isManagerOrStaff,
        isHeadQuarterUser,
        roleKey,
        isAazOrHqStaff, // keep in sync with guard above
        safeSetSelectedZoneId,
    ]);

    // When manager has an assigned region resolved, fetch all users in that region and show passengers
    useEffect(() => {
        if (!isManagerOrStaff) return;
        if (!selectedRegionId) return;
        (async () => {
            try {
                const params = new URLSearchParams();
                params.set("regionId", selectedRegionId);
                const res = await fetch(`/api/users?${params.toString()}`);
                if (!res.ok) return;
                const usersData = await res.json();
                // keep only passengers
                const techs = (usersData || []).filter((u: any) => {
                    const k = getRoleKeyFromUser(u) || "";
                    return (
                        typeof k === "string" &&
                        (k.includes("tech") || k.includes("passenger"))
                    );
                });
                if (!supervisorHasTechs)
                    setFilteredUsers(applyUserScope(techs));
            } catch (e) {
                console.error("Error fetching region users:", e);
            }
        })();
    }, [
        applyUserScope,
        getRoleKeyFromUser,
        isManagerOrStaff,
        selectedRegionId,
        supervisorHasTechs,
        roleKey,
    ]);

    // Use managerAssignedZonesRaw as a fallback when session's assignedZone is empty/stale
    const effectiveAssignedZoneIds = useMemo(
        () =>
            Array.isArray(currentUser?.assignedZone) &&
            currentUser.assignedZone.length > 0
                ? currentUser.assignedZone
                : managerAssignedZonesRaw || [],
        [currentUser?.assignedZone, managerAssignedZonesRaw],
    );

    // Filter zones based on selected region and manager/supervisor scope
    useEffect(() => {
        const scopedZones = isManagerOrStaff
            ? zones.filter(
                  (zone: any) =>
                      (!allowedRegionIds.length ||
                          allowedRegionIds.includes(zone.regionId)) &&
                      (!allowedZoneIds.length ||
                          allowedZoneIds.includes(zone.id)),
              )
            : zones;

        if (isHeadQuarterUser || isZoneOnlyUser) {
            setFilteredZones(scopedZones);
            return;
        }

        if (!selectedRegionId) {
            setFilteredZones([]);
            safeSetSelectedZoneId(null);
            return;
        }
        // For HQ managers: do NOT filter assigned zones by region; always show all assigned zones
        if (isManagerOrStaff && isHeadQuarterUser) {
            setFilteredZones(
                zones.filter((z) => effectiveAssignedZoneIds.includes(z.id)),
            );
            // Do not auto-select zone
            return;
        }
        // For HQ/AAZ selections, keep the broader compatibility-zone list.
        // For normal regions, keep only the exact matching zone name.
        const selectedRegionName =
            regions.find((r: any) => r.id === selectedRegionId)?.name || "";
        const normalizedRegionName = normalizeZoneScopeCode(selectedRegionName);
        const regionZones =
            normalizedRegionName === "HQ" ||
            normalizedRegionName.includes("AAZ")
                ? filterZonesForSelectedRegionName(
                      selectedRegionName,
                      scopedZones,
                  )
                : scopedZones.filter(
                      (zone: any) => zone.regionId === selectedRegionId,
                  );
        setFilteredZones(regionZones);
        if (
            selectedZoneId &&
            !regionZones.some((z: any) => z.id === selectedZoneId)
        ) {
            safeSetSelectedZoneId(null);
        }
    }, [
        selectedRegionId,
        selectedZoneId,
        zones,
        isManagerOrStaff,
        allowedRegionIds,
        allowedZoneIds,
        isHeadQuarterUser,
        isZoneOnlyUser,
        safeSetSelectedZoneId,
        effectiveAssignedZoneIds,
        regions,
        normalizeZoneScopeCode,
        filterZonesForSelectedRegionName,
    ]);

    // When a region is explicitly selected, fetch zones from the region-scoped
    // endpoint so the dropdown only shows zones for that exact region.
    useEffect(() => {
        if (!selectedRegionId) return;
        (async () => {
            try {
                const res = await fetch(
                    `/api/zones/region?regionId=${selectedRegionId}`,
                );
                if (!res.ok) return;
                try {
                    const data = await res.json();
                    if (!Array.isArray(data)) return;
                    let zoneList = data as any[];
                    // Enforce manager/supervisor allowedZoneIds when present
                    if (
                        isManagerOrStaff &&
                        Array.isArray(allowedZoneIds) &&
                        allowedZoneIds.length > 0
                    ) {
                        zoneList = zoneList.filter((z: any) =>
                            allowedZoneIds.includes(z.id),
                        );
                    }
                    const regionName =
                        regions.find((r) => r.id === selectedRegionId)?.name ||
                        "";
                    const exactZoneList = regionName
                        ? filterZonesForSelectedRegionName(
                              regionName,
                              normalizeZoneScopeCode(regionName) === "HQ"
                                  ? (zones as any[])
                                  : zoneList,
                          )
                        : zoneList;
                    setFilteredZones(exactZoneList);
                    // Keep normal regions region-scoped by default. Only preserve
                    // the zone when it still belongs to the currently selected region.
                    const selectedInList =
                        selectedZoneId &&
                        exactZoneList.some((z: any) => z.id === selectedZoneId);
                    if (!selectedInList) {
                        safeSetSelectedZoneId(null);
                    }
                } catch (e) {
                    console.error("Failed to parse zones JSON:", e);
                }
            } catch (e) {
                // ignore fetch errors
            }
        })();
    }, [
        selectedRegionId,
        isManagerOrStaff,
        allowedZoneIds,
        selectedZoneId,
        safeSetSelectedZoneId,
        regions,
        filterZonesForSelectedRegionName,
        normalizeZoneScopeCode,
        zones,
    ]);

    // Manager: lock to their assigned zone (area) and its region
    useEffect(() => {
        if (!isStaff) return;
        const rawZones =
            Array.isArray(currentUser?.assignedZone) &&
            currentUser.assignedZone.length > 0
                ? currentUser.assignedZone
                : managerAssignedZonesRaw || [];
        if (!rawZones.length || zones.length === 0) return;

        let matchedZone: any | null = null;
        for (const val of rawZones) {
            const m = zones.find(
                (z: any) =>
                    z.id === val ||
                    String(z.name).toLowerCase() === String(val).toLowerCase(),
            );
            if (m) {
                matchedZone = m;
                break;
            }
        }
        if (matchedZone) {
            if (selectedZoneId !== matchedZone.id) {
                // Do not lock AAZ/HQ supervisors to a single assigned zone — allow manual choice
                if (!isAazOrHqStaff) safeSetSelectedZoneId(matchedZone.id);
            }
            if (
                matchedZone.regionId &&
                selectedRegionId !== matchedZone.regionId
            ) {
                setSelectedRegionId(matchedZone.regionId);
            }
        }
    }, [
        isStaff,
        currentUser?.assignedZone,
        zones,
        selectedZoneId,
        selectedRegionId,
        managerAssignedZonesRaw,
        safeSetSelectedZoneId,
    ]);

    // NOTE: removed auto-derive of region from selected zone to require explicit region selection

    // Fetch NE names based on region/zone selection and team filtering
    useEffect(() => {
        (async () => {
            try {
                // Manager should prefer supervisor-scoped NE names when available
                if (
                    roleKey === "supervisor" &&
                    supervisorNeNames &&
                    supervisorNeNames.length > 0
                ) {
                    setNeNames(supervisorNeNames);
                    return;
                }

                let neNamesData: any[] = [];

                if (siteId) {
                    const selectedSite =
                        allSites.find((site: any) => site.id === siteId) ||
                        filteredSites.find((site: any) => site.id === siteId);

                    if (selectedSite) {
                        const neSet = new Set<string>();
                        const single = (selectedSite.neNameAndId ?? "")
                            .toString()
                            .trim();
                        if (single) neSet.add(single);

                        const all = (selectedSite.allNeNames ?? []) as any;
                        if (Array.isArray(all)) {
                            for (const raw of all) {
                                const v = (raw ?? "").toString().trim();
                                if (v) neSet.add(v);
                            }
                        }

                        const unique = [...neSet].sort();
                        neNamesData = unique.map((name) => ({
                            name,
                            value: name,
                        }));
                    }
                } else if (teamId && teamSites.length > 0) {
                    // When a team is selected, get NE names from both the primary
                    // neNameAndId and the aggregated allNeNames array so that
                    // a single physical site with multiple NEs exposes all of
                    // its elements in the dropdown.
                    const neSet = new Set<string>();
                    for (const site of teamSites as any[]) {
                        const single = (site.neNameAndId ?? "")
                            .toString()
                            .trim();
                        if (single) neSet.add(single);

                        const all = (site.allNeNames ?? []) as any;
                        if (Array.isArray(all)) {
                            for (const raw of all) {
                                const v = (raw ?? "").toString().trim();
                                if (v) neSet.add(v);
                            }
                        }
                    }

                    const teamNeNames = [...neSet].sort();
                    neNamesData = teamNeNames.map((name) => ({
                        name,
                        value: name,
                    }));
                } else if (isManagerOrStaff) {
                    // For managers/supervisors, derive NE names from filtered stations (scoped to assigned zones)
                    const stationsForNeNames = filteredSites;

                    const list = Array.isArray(stationsForNeNames)
                        ? stationsForNeNames
                        : [];

                    // Collect NE names from both neNameAndId and allNeNames so
                    // that multi-NE stations are fully represented when managers
                    // or supervisors create bookings.
                    const neSet = new Set<string>();
                    for (const site of list as any[]) {
                        const single = (site.neNameAndId ?? "")
                            .toString()
                            .trim();
                        if (single) neSet.add(single);

                        const all = (site.allNeNames ?? []) as any;
                        if (Array.isArray(all)) {
                            for (const raw of all) {
                                const v = (raw ?? "").toString().trim();
                                if (v) neSet.add(v);
                            }
                        }
                    }

                    const unique = [...neSet].sort();
                    neNamesData = unique.map((name) => ({
                        name,
                        value: name,
                    }));
                } else {
                    // For other roles, fetch NE names with region/zone filters.
                    const params = new URLSearchParams();
                    if (selectedRegionId) {
                        params.set("regionId", selectedRegionId);
                    }
                    if (selectedZoneId) {
                        params.set("zoneId", selectedZoneId);
                    }

                    const qs = params.toString();
                    const url = qs ? `/api/ne-names?${qs}` : "/api/ne-names";
                    const response = await fetch(url);
                    if (response.ok) {
                        try {
                            neNamesData = await response.json();
                        } catch (e) {
                            console.error("Failed to parse NE names JSON:", e);
                            neNamesData = [];
                        }
                    }
                }

                setNeNames(neNamesData);
            } catch (e) {
                console.error("Error fetching NE names:", e);
                setNeNames([]);
            }
        })();
    }, [
        selectedRegionId,
        selectedZoneId,
        regions,
        zones,
        teamId,
        teamSites,
        roleKey,
        filteredSites,
        allSites,
        siteId,
        isManagerOrStaff,
        supervisorNeNames,
    ]);

    // Clear site and NE selection when zone changes and selected site is no longer valid
    useEffect(() => {
        if (siteId && filteredSites.length > 0) {
            const siteStillValid = filteredSites.some(
                (s: any) => s.id === siteId,
            );
            if (!siteStillValid) {
                setSiteId("");
                setSelectedSiteDetails(null);
                setSelectedNeName("");
            }
        }
    }, [selectedZoneId, filteredSites, siteId]);

    // Narrow users when region/zone selected (and manager/supervisor scoping)
    useEffect(() => {
        let scoped = (users || []).filter((user: any) => isUserAllowed(user));

        if (selectedZoneId) {
            const zoneMatched = scoped.filter((u: any) =>
                Array.isArray(u.assignedZone)
                    ? u.assignedZone.includes(selectedZoneId)
                    : false,
            );
            // If no one is explicitly assigned to the zone, fall back to region-level users
            if (zoneMatched.length > 0) {
                scoped = zoneMatched;
            } else if (selectedRegionId) {
                scoped = scoped.filter((u: any) =>
                    Array.isArray(u.assignedRegion)
                        ? u.assignedRegion.includes(selectedRegionId)
                        : false,
                );
            }
        } else if (selectedRegionId) {
            scoped = scoped.filter((u: any) =>
                Array.isArray(u.assignedRegion)
                    ? u.assignedRegion.includes(selectedRegionId)
                    : false,
            );
        }

        if (!supervisorHasTechs) setFilteredUsers(applyUserScope(scoped));
    }, [
        users,
        isUserAllowed,
        selectedRegionId,
        selectedZoneId,
        supervisorHasTechs,
        applyUserScope,
        roleKey,
    ]);

    useEffect(() => {
        (async () => {
            try {
                // Skip if team is selected - team useEffect handles that case
                if (teamId) return;
                const params = new URLSearchParams();
                const selectedRegionNameForSites = selectedRegionId
                    ? regions.find((r) => r.id === selectedRegionId)?.name || ""
                    : "";
                const hqRegionSelected =
                    normalizeZoneScopeCode(selectedRegionNameForSites) === "HQ";

                if (isManagerOrStaff) {
                    // Fetch manager stations from local API filtered by selected region
                    if (selectedRegionId && !hqRegionSelected) {
                        params.set("regionId", selectedRegionId);
                    }
                    const qs = params.toString();
                    const url = qs ? `/api/stations?${qs}` : "/api/stations";
                    const response = await fetch(url);
                    if (response.ok) {
                        try {
                            let stationsData = await response.json();
                            // Apply team filtering if team is selected
                            if (teamId && teamSites.length > 0) {
                                const teamSiteIds = new Set(
                                    teamSites.map((s) => s.id),
                                );
                                stationsData = stationsData.filter((s: any) =>
                                    teamSiteIds.has(s.id),
                                );
                            }
                            // Apply manager/supervisor scope
                            stationsData = stationsData.filter((site: any) =>
                                isSiteAllowed(site),
                            );
                            if (hqRegionSelected) {
                                stationsData = stationsData.filter((site: any) =>
                                    siteMatchesSelectedRegionName(site, "HQ"),
                                );
                            }
                            setAllSites(stationsData);
                            return;
                        } catch (e) {
                            console.error(
                                "Failed to parse stations JSON from external API:",
                                e,
                            );
                            setAllSites([]);
                            return;
                        }
                    } else {
                        console.error(
                            "Failed to fetch stations from external API, status:",
                            response.status,
                        );
                        setAllSites([]);
                        return;
                    }
                } else {
                    if (selectedRegionId && !hqRegionSelected) {
                        params.set("regionId", selectedRegionId);
                    }
                }

                const response = await fetch(`/api/stations?${params.toString()}`);
                if (response.ok) {
                    try {
                        const stationsData = await response.json();

                        // Apply team filtering if team is selected
                        let filteredSitesData = stationsData;
                        if (teamId && teamSites.length > 0) {
                            const teamSiteIds = new Set(
                                teamSites.map((s) => s.id),
                            );
                            filteredSitesData = stationsData.filter((s: any) =>
                                teamSiteIds.has(s.id),
                            );
                        }

                        // Apply manager/supervisor scope (limit to allowed regions/zones)
                        filteredSitesData = filteredSitesData.filter(
                            (site: any) => isSiteAllowed(site),
                        );
                        if (hqRegionSelected) {
                            filteredSitesData = filteredSitesData.filter(
                                (site: any) =>
                                    siteMatchesSelectedRegionName(site, "HQ"),
                            );
                        }

                        setAllSites(filteredSitesData);
                    } catch (e) {
                        console.error(
                            "Failed to parse stations JSON from local API:",
                            e,
                        );
                        setAllSites([]);
                    }
                } else {
                    console.error(
                        "Failed to fetch stations from local API, status:",
                        response.status,
                    );
                    setAllSites([]);
                }
            } catch (e) {
                console.error("Error fetching stations:", e);
                setAllSites([]);
            }
        })();
    }, [
        selectedRegionId,
        regions,
        zones,
        teamId,
        teamSites,
        isSiteAllowed,
        isManagerOrStaff,
        roleKey,
        normalizeZoneScopeCode,
        siteMatchesSelectedRegionName,
    ]);

    // Filter stations based on selected zone for non-manager/supervisor roles.
    // Manager and supervisors (including AAZ/HQ supervisors) are handled by
    // the dedicated `allSites` + role-aware effect above, to avoid conflicts
    // and disappearing site lists.
    useEffect(() => {
        if (isManagerOrStaff) return;

        let filtered = allSites;

        if (selectedZoneId) {
            filtered = filtered.filter(
                (site: any) => site.zoneId === selectedZoneId,
            );
        }

        setFilteredSites(filtered);
    }, [allSites, selectedZoneId, isManagerOrStaff]);

    // For supervisors (including AAZ/HQ), fetch stations directly by the
    // selected zone name so the behaviour exactly matches the
    // /supervisor/stations page and curl tests like
    //   /api/stations?zone=WAAZ
    useEffect(() => {
        if (roleKey !== "supervisor") return;

        if (!selectedZoneId) {
            setFilteredSites([]);
            setAllSites([]);
            return;
        }

        const zone = (zones || []).find((z: any) => z.id === selectedZoneId);
        const zoneName = zone?.name;
        if (!zoneName) {
            setFilteredSites([]);
            setAllSites([]);
            return;
        }

        (async () => {
            try {
                const response = await fetch(
                    `/api/stations?zone=${encodeURIComponent(zoneName)}`,
                );
                if (!response.ok) {
                    setFilteredSites([]);
                    setAllSites([]);
                    return;
                }
                let stationsData = await response.json();

                // Apply team filtering if a team is selected (defensive)
                if (teamId && teamSites.length > 0) {
                    const teamSiteIds = new Set(teamSites.map((s) => s.id));
                    stationsData = stationsData.filter((s: any) =>
                        teamSiteIds.has(s.id),
                    );
                }

                setAllSites(stationsData);
                setFilteredSites(stationsData);
            } catch (e) {
                setFilteredSites([]);
                setAllSites([]);
            }
        })();
    }, [roleKey, selectedZoneId, zones, teamId, teamSites]);
    useEffect(() => {
        if (!isManagerOrStaff) return;
        // Seeded supervisors are driven by CSV/supervisors data instead
        if (isSeededStaff) return;
        // if manager mapping provides authoritative regions/zones, don't auto-select here
        if (managerAssignedRegionsRaw && managerAssignedRegionsRaw.length > 0)
            return;
        // For HQ and zone managers, do not auto-select
        if (isHeadQuarterUser || isZoneOnlyUser) return;
        if (!selectedRegionId && allowedRegionIds.length === 1) {
            setSelectedRegionId(allowedRegionIds[0]);
        }
        if (
            !selectedZoneId &&
            !manualZoneSelectionRef.current &&
            allowedZoneIds.length === 1
        ) {
            // Do NOT auto-select a single allowed zone for AAZ/HQ supervisors —
            // they should be able to pick any AAZ/HQ zone (same UX as Muhaba).
            if (!isAazOrHqStaff) {
                safeSetSelectedZoneId(allowedZoneIds[0]);
            }
        }
    }, [
        isManagerOrStaff,
        allowedRegionIds,
        allowedZoneIds,
        managerAssignedRegionsRaw,
        selectedRegionId,
        selectedZoneId,
        isHeadQuarterUser,
        isSeededStaff,
        roleKey,
        safeSetSelectedZoneId,
        isZoneOnlyUser,
    ]);

    // If user has multiple assigned regions/zones, default to the first available
    // only after regions/zones have been loaded. This ensures the form pre-fills
    // with the manager/supervisor's area when opening the create form.
    useEffect(() => {
        if (!isManagerOrStaff) return;
        // Seeded supervisors use CSV/supervisors mapping instead of allowedRegionIds/allowedZoneIds heuristics
        if (isSeededStaff) return;
        // prefer manager-assigned regions/zones when present
        if (managerAssignedRegionsRaw && managerAssignedRegionsRaw.length > 0)
            return;
        // Prefer preserving an explicit selection
        try {
            console.debug(
                "Auto-select effect: allowedRegionIds",
                allowedRegionIds,
                "allowedZoneIds",
                allowedZoneIds,
                "regions",
                regions.length,
                "zones",
                zones.length,
            );
            console.debug(
                "Current selection: region",
                selectedRegionId,
                "zone",
                selectedZoneId,
            );
        } catch (e) {
            /* ignore */
        }
        if (
            !selectedRegionId &&
            Array.isArray(allowedRegionIds) &&
            allowedRegionIds.length > 0 &&
            regions.length > 0
        ) {
            // pick first allowed region that exists in loaded regions
            // allowedRegionIds may contain names instead of ids; match by id or name (case-insensitive)
            const firstAllowed = allowedRegionIds.find((val: string) =>
                regions.some(
                    (r: any) =>
                        r.id === val ||
                        String(r.name).toLowerCase() ===
                            String(val).toLowerCase(),
                ),
            );
            if (firstAllowed) {
                // if matched by name, find its id
                const matched = regions.find(
                    (r: any) =>
                        r.id === firstAllowed ||
                        String(r.name).toLowerCase() ===
                            String(firstAllowed).toLowerCase(),
                );
                if (matched) setSelectedRegionId(matched.id);
            }
        }

        if (
            !selectedZoneId &&
            !manualZoneSelectionRef.current &&
            Array.isArray(allowedZoneIds) &&
            allowedZoneIds.length > 0 &&
            zones.length > 0
        ) {
            // allowedZoneIds may contain names; match by id or name and prefer zone in selected region
            const zoneInRegionVal = allowedZoneIds.find((val: string) =>
                zones.some(
                    (z: any) =>
                        (z.id === val ||
                            String(z.name).toLowerCase() ===
                                String(val).toLowerCase()) &&
                        (!selectedRegionId || z.regionId === selectedRegionId),
                ),
            );
            const zoneAnyVal = allowedZoneIds.find((val: string) =>
                zones.some(
                    (z: any) =>
                        z.id === val ||
                        String(z.name).toLowerCase() ===
                            String(val).toLowerCase(),
                ),
            );
            const chosenVal = zoneInRegionVal || zoneAnyVal;
            if (chosenVal) {
                const matchedZone = zones.find(
                    (z: any) =>
                        z.id === chosenVal ||
                        String(z.name).toLowerCase() ===
                            String(chosenVal).toLowerCase(),
                );
                if (
                    matchedZone &&
                    !(isHeadQuarterUser && roleKey === "manager")
                )
                    safeSetSelectedZoneId(matchedZone.id);
            }
        }
    }, [
        isManagerOrStaff,
        allowedRegionIds,
        allowedZoneIds,
        regions,
        zones,
        selectedRegionId,
        selectedZoneId,
        managerAssignedRegionsRaw,
    ]);

    // Use supervisor-mapping debug endpoint to derive team areas and auto-fill region/zone and users.
    useEffect(() => {
        if (!isManagerOrStaff) return;
        // For non-seeded managers/supervisors, only run if no explicit selection yet and regions/zones are loaded.
        if (!isSeededStaff) {
            if (
                selectedRegionId ||
                selectedZoneId ||
                regions.length === 0 ||
                zones.length === 0
            )
                return;
        }

        (async () => {
            try {
                const res = await fetch("/api/debug/supervisor-mapping");
                if (!res.ok) return;
                const data = await res.json();
                const teamIds: string[] = data.derivedTeamIds || [];
                const directReports: any[] = data.directReports || [];
                const supervisorLocations = data.supervisorLocations || null;
                const managerAssignedRegions: string[] =
                    data.manager?.assignedRegion || [];
                const managerAssignedZones: string[] =
                    data.manager?.assignedZone || [];

                // collect stations of each team
                const allTeamSites: any[] = [];
                for (const tid of teamIds) {
                    try {
                        const r = await fetch(`/api/team/${tid}/areas`);
                        if (!r.ok) continue;
                        const d = await r.json();
                        if (Array.isArray(d.stations))
                            allTeamSites.push(...d.stations);
                    } catch (e) {
                        // ignore
                    }
                }

                // Use manager's assignedRegion/assignedZone from DB first (authoritative)
                if (
                    !selectedRegionId &&
                    Array.isArray(managerAssignedRegions) &&
                    managerAssignedRegions.length > 0 &&
                    regions.length > 0
                ) {
                    const match = managerAssignedRegions.find((val: string) =>
                        regions.some(
                            (r: any) =>
                                r.id === val ||
                                String(r.name).toLowerCase() ===
                                    String(val).toLowerCase(),
                        ),
                    );
                    if (match) {
                        const matched = regions.find(
                            (r: any) =>
                                r.id === match ||
                                String(r.name).toLowerCase() ===
                                    String(match).toLowerCase(),
                        );
                        if (matched) setSelectedRegionId(matched.id);
                    }
                }

                if (
                    !selectedZoneId &&
                    Array.isArray(managerAssignedZones) &&
                    managerAssignedZones.length > 0 &&
                    zones.length > 0
                ) {
                    const match = managerAssignedZones.find((val: string) =>
                        zones.some(
                            (z: any) =>
                                z.id === val ||
                                String(z.name).toLowerCase() ===
                                    String(val).toLowerCase(),
                        ),
                    );
                    if (match) {
                        const matched = zones.find(
                            (z: any) =>
                                z.id === match ||
                                String(z.name).toLowerCase() ===
                                    String(match).toLowerCase(),
                        );
                        if (matched) safeSetSelectedZoneId(matched.id);
                    }
                }

                // If supervisors.json provided Location Category/Location, try to match by name next
                if (supervisorLocations) {
                    try {
                        const cats = supervisorLocations.categories || [];
                        const locs = supervisorLocations.locations || [];
                        // Try to match region by category/name
                        if (
                            !selectedRegionId &&
                            cats.length &&
                            regions.length
                        ) {
                            for (const cat of cats) {
                                const catLower = String(cat).toLowerCase();
                                // Prefer exact region name match (e.g. "WR") before substring matches like "SWR"
                                let match = regions.find((r: any) => {
                                    const rn = String(
                                        r.name || "",
                                    ).toLowerCase();
                                    return rn === catLower;
                                });
                                if (!match) {
                                    match = regions.find((r: any) => {
                                        const rn = String(
                                            r.name || "",
                                        ).toLowerCase();
                                        return rn.includes(catLower);
                                    });
                                }
                                if (match) {
                                    setSelectedRegionId(match.id);
                                    break;
                                }
                            }
                        }
                        // Try to match zone by location name (prefer the selected region)
                        if (!selectedZoneId && locs.length && zones.length) {
                            for (const locName of locs) {
                                const locLower = String(locName).toLowerCase();
                                // prefer zones in the selected region
                                const inRegion = zones.find((z: any) => {
                                    const zn = String(
                                        z.name || "",
                                    ).toLowerCase();
                                    return (
                                        zn === locLower &&
                                        (!selectedRegionId ||
                                            z.regionId === selectedRegionId)
                                    );
                                });
                                const anyZone = zones.find((z: any) => {
                                    const zn = String(
                                        z.name || "",
                                    ).toLowerCase();
                                    return (
                                        zn === locLower || zn.includes(locLower)
                                    );
                                });
                                const pick = inRegion || anyZone;
                                if (pick) {
                                    safeSetSelectedZoneId(pick.id);
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        // ignore matching errors
                    }
                }

                // derive region/zone ids from team stations
                const regionIds = Array.from(
                    new Set(
                        allTeamSites
                            .map((s: any) => s.regionId)
                            .filter(Boolean),
                    ),
                );
                const zoneIds = Array.from(
                    new Set(
                        allTeamSites.map((s: any) => s.zoneId).filter(Boolean),
                    ),
                );

                // match to loaded regions/zones by id or name
                // compute local choices first to avoid relying on asynchronous state updates
                let chosenRegionId: string | null = null;
                let chosenZoneId: string | null = null;

                if (!selectedRegionId && regionIds.length > 0) {
                    const match = regions.find((r: any) =>
                        regionIds.some(
                            (rid: string) =>
                                r.id === rid ||
                                String(r.name).toLowerCase() ===
                                    String(rid).toLowerCase(),
                        ),
                    );
                    if (match) chosenRegionId = match.id;
                }

                if (
                    !chosenRegionId &&
                    !selectedRegionId &&
                    Array.isArray(managerAssignedRegions) &&
                    managerAssignedRegions.length > 0
                ) {
                    for (const val of managerAssignedRegions) {
                        const match = regions.find(
                            (r: any) =>
                                r.id === val ||
                                String(r.name).toLowerCase() ===
                                    String(val).toLowerCase(),
                        );
                        if (match) {
                            chosenRegionId = match.id;
                            break;
                        }
                    }
                }

                if (
                    !chosenRegionId &&
                    supervisorLocations &&
                    supervisorLocations.categories &&
                    supervisorLocations.categories.length > 0
                ) {
                    for (const cat of supervisorLocations.categories) {
                        const catLower = String(cat).toLowerCase();
                        // Prefer exact region name match first
                        let match = regions.find((r: any) => {
                            const rn = String(r.name || "").toLowerCase();
                            return rn === catLower;
                        });
                        if (!match) {
                            match = regions.find((r: any) => {
                                const rn = String(r.name || "").toLowerCase();
                                return rn.includes(catLower);
                            });
                        }
                        if (match) {
                            chosenRegionId = match.id;
                            break;
                        }
                    }
                }

                // Zone: prefer managerAssignedZones, then supervisorLocations.locations, then team-stations-derived zoneIds
                if (
                    !selectedZoneId &&
                    Array.isArray(managerAssignedZones) &&
                    managerAssignedZones.length > 0
                ) {
                    for (const val of managerAssignedZones) {
                        const match = zones.find(
                            (z: any) =>
                                z.id === val ||
                                String(z.name).toLowerCase() ===
                                    String(val).toLowerCase(),
                        );
                        if (match) {
                            chosenZoneId = match.id;
                            break;
                        }
                    }
                }

                if (
                    !chosenZoneId &&
                    supervisorLocations &&
                    supervisorLocations.locations &&
                    supervisorLocations.locations.length > 0
                ) {
                    for (const locName of supervisorLocations.locations) {
                        const locLower = String(locName).toLowerCase();
                        // prefer zone in the chosenRegionId (or selectedRegionId if chosenRegionId not set)
                        const regionToUse =
                            chosenRegionId || selectedRegionId || null;
                        const inRegion = zones.find((z: any) => {
                            const zn = String(z.name || "").toLowerCase();
                            return (
                                (zn === locLower || zn.includes(locLower)) &&
                                (!regionToUse || z.regionId === regionToUse)
                            );
                        });
                        const anyZone = zones.find((z: any) => {
                            const zn = String(z.name || "").toLowerCase();
                            return zn === locLower || zn.includes(locLower);
                        });
                        const pick = inRegion || anyZone;
                        if (pick) {
                            chosenZoneId = pick.id;
                            break;
                        }
                    }
                }

                if (!chosenZoneId && zoneIds.length > 0) {
                    const match = zones.find((z: any) =>
                        zoneIds.some(
                            (zid: string) =>
                                z.id === zid ||
                                String(z.name).toLowerCase() ===
                                    String(zid).toLowerCase(),
                        ),
                    );
                    if (match) chosenZoneId = match.id;
                }

                // apply chosen selections (for seeded supervisors this can override an earlier default like SWR)
                if (chosenRegionId) setSelectedRegionId(chosenRegionId);
                if (chosenZoneId) safeSetSelectedZoneId(chosenZoneId);

                // restrict users to directReports passengers if present
                if (directReports.length > 0) {
                    // fetch full user records for directReports to check roles
                    const ids = directReports.map((d) => d.id).filter(Boolean);
                    if (ids.length > 0) {
                        const q = ids
                            .map((id) => `id=${encodeURIComponent(id)}`)
                            .join("&");
                        try {
                            const usersRes = await fetch(`/api/users?${q}`);
                            if (usersRes.ok) {
                                const usersData = await usersRes.json();
                                if (!supervisorHasTechs)
                                    setFilteredUsers(
                                        applyUserScope(
                                            (usersData || []).filter((u: any) =>
                                                isUserAllowed(u),
                                            ),
                                        ),
                                    );
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            } catch (err) {
                // ignore
            }
        })();
    }, [
        isManagerOrStaff,
        regions,
        zones,
        selectedRegionId,
        selectedZoneId,
        supervisorHasTechs,
        applyUserScope,
        isUserAllowed,
        isSeededStaff,
        safeSetSelectedZoneId,
    ]);

    // Filter team and users based on selected region/zone plus manager/supervisor scope
    useEffect(() => {
        // For supervisors, keep team/groups stable and do not
        // re-filter them per zone here; the assignee dropdown applies
        // any supervisor-specific zone filtering to users only.
        if (isStaff) return;

        if (!selectedRegionId && !selectedZoneId) {
            const scopedTeam = (team || []).filter(isTeamAllowed);
            setFilteredTeam(scopedTeam);
            setAvailableTeam(scopedTeam);
            if (!supervisorHasTechs)
                setFilteredUsers(
                    applyUserScope((users || []).filter(isUserAllowed)),
                );
            return;
        }

        (async () => {
            try {
                const filteredTeamList: any[] = [];
                for (const team of team) {
                    try {
                        const areasResponse = await fetch(
                            `/api/team/${team.id}/areas`,
                        );
                        if (!areasResponse.ok) continue;
                        const areasData = await areasResponse.json();
                        const stationsOfTeam = Array.isArray(areasData.stations)
                            ? areasData.stations
                            : [];

                        const hasSitesInArea = stationsOfTeam.some((site: any) => {
                            const regionMatch =
                                !selectedRegionId ||
                                site.regionId === selectedRegionId;
                            const zoneMatch =
                                !selectedZoneId ||
                                site.zoneId === selectedZoneId;
                            return (
                                regionMatch && zoneMatch && isSiteAllowed(site)
                            );
                        });

                        if (hasSitesInArea && isTeamAllowed(team)) {
                            filteredTeamList.push(team);
                        }
                    } catch (e) {
                        console.error(
                            `Error checking team ${team.id} areas:`,
                            e,
                        );
                    }
                }

                setFilteredTeam(filteredTeamList);
                setAvailableTeam(filteredTeamList);

                // Filter users who are assigned to the selected region and/or zone and within scope
                const areaUsers = users.filter((user: any) => {
                    const regionMatch =
                        !selectedRegionId ||
                        (user.assignedRegion &&
                            user.assignedRegion.includes(selectedRegionId));
                    const zoneMatch =
                        !selectedZoneId ||
                        (user.assignedZone &&
                            user.assignedZone.includes(selectedZoneId));
                    return regionMatch && zoneMatch && isUserAllowed(user);
                });
                if (!supervisorHasTechs)
                    setFilteredUsers(applyUserScope(areaUsers));
            } catch (e) {
                console.error("Error filtering team/users by region/zone:", e);
                const scopedTeam = (team || []).filter(isTeamAllowed);
                setFilteredTeam(scopedTeam);
                if (!supervisorHasTechs)
                    setFilteredUsers(
                        applyUserScope((users || []).filter(isUserAllowed)),
                    );
                setAvailableTeam(scopedTeam);
            }
        })();
    }, [
        selectedRegionId,
        selectedZoneId,
        team,
        users,
        isTeamAllowed,
        isUserAllowed,
        isSiteAllowed,
        supervisorHasTechs,
        applyUserScope,
    ]);

    // Fetch site details when NE name is selected (find first site whose
    // primary or aggregated NE list includes that NE name)
    useEffect(() => {
        if (!selectedNeName) {
            setSelectedSiteDetails(null);
            return;
        }
        (async () => {
            try {
                // Find a site that matches the selected NE name and current region/zone filters
                const matchingSite = filteredSites.find((site: any) => {
                    if (site.neNameAndId === selectedNeName) return true;
                    if (Array.isArray(site.allNeNames)) {
                        return site.allNeNames.includes(selectedNeName);
                    }
                    return false;
                });
                if (matchingSite) {
                    const r = await fetch(`/api/stations/${matchingSite.id}`);
                    if (r.ok) {
                        try {
                            const siteDetails = await r.json();
                            setSelectedSiteDetails(siteDetails);
                        } catch (e) {
                            console.error(
                                "Failed to parse site details JSON:",
                                e,
                            );
                            setSelectedSiteDetails(null);
                        }
                    } else {
                        setSelectedSiteDetails(null);
                    }
                } else {
                    setSelectedSiteDetails(null);
                }
            } catch (e) {
                console.error("Error fetching site details for NE name:", e);
                setSelectedSiteDetails(null);
            }
        })();
    }, [selectedNeName, filteredSites]);

    // Fetch site details when site is selected directly
    useEffect(() => {
        if (!siteId) {
            setSelectedSiteDetails(null);
            return;
        }
        (async () => {
            try {
                const r = await fetch(`/api/stations/${siteId}`);
                if (r.ok) {
                    try {
                        const siteDetails = await r.json();
                        setSelectedSiteDetails(siteDetails);
                    } catch (e) {
                        console.error("Failed to parse site details JSON:", e);
                        setSelectedSiteDetails(null);
                    }
                } else {
                    setSelectedSiteDetails(null);
                }
            } catch (e) {
                console.error("Error fetching site details:", e);
                setSelectedSiteDetails(null);
            }
        })();
    }, [siteId]);

    // Remove old siteId-based team/user filtering - now done by team selection

    useEffect(() => {
        // For supervisors, team selection is used only for assignment,
        // not for scoping stations/NEs. Avoid resetting stations/NEs when a
        // Group-* team is chosen.
        if (isStaff) return;

        if (!teamId) {
            setTeamSites([]);
            setTeamUsers([]);
            // Reset to cascading filter results but keep current selections
            (async () => {
                try {
                    const params = new URLSearchParams();
                    if (selectedRegionId) {
                        const selectedRegion = regions.find(
                            (r) => r.id === selectedRegionId,
                        );
                        if (selectedRegion)
                            params.set("region", selectedRegion.name);
                    }
                    if (selectedZoneId) {
                        const selectedZone = zones.find(
                            (z) => z.id === selectedZoneId,
                        );
                        if (selectedZone) params.set("zone", selectedZone.name);
                    }

                    const response = await fetch(
                        `/api/stations?${params.toString()}`,
                    );
                    if (response.ok) {
                        const stationsData = await response.json();
                        setFilteredSites(
                            stationsData.filter((site: any) =>
                                isSiteAllowed(site),
                            ),
                        );
                    } else {
                        setFilteredSites([]);
                    }
                } catch (e) {
                    console.error("Error fetching stations:", e);
                    setFilteredSites([]);
                }
            })();
            if (!supervisorHasTechs)
                setFilteredUsers(
                    (users || []).filter((user: any) => isUserAllowed(user)),
                );
            return;
        }

        // Do not clear selections when team changes; we will reconcile below

        (async () => {
            try {
                // Fetch team areas (stations) and team details (users) in parallel
                const [areasResponse, teamResponse] = await Promise.all([
                    fetch(`/api/team/${teamId}/areas`),
                    fetch(`/api/team/${teamId}`),
                ]);

                // Handle stations - combine with cascading filters
                if (areasResponse.ok) {
                    const areasData = await areasResponse.json();
                    if (areasData.stations && Array.isArray(areasData.stations)) {
                        const scopedTeamSites = areasData.stations.filter(
                            (site: any) => isSiteAllowed(site),
                        );
                        setTeamSites(scopedTeamSites);
                        // When team is selected, update allSites to team stations
                        setAllSites(scopedTeamSites);
                    } else {
                        setTeamSites([]);
                        setAllSites([]);
                    }
                } else {
                    setTeamSites([]);
                    setAllSites([]);
                }

                // Handle users
                if (teamResponse.ok) {
                    const teamData = await teamResponse.json();
                    const teamMembers = teamData.members || [];
                    const scopedMembers = teamMembers.filter((member: any) =>
                        isUserAllowed(member),
                    );
                    setTeamUsers(teamMembers);
                    if (!supervisorHasTechs)
                        setFilteredUsers(applyUserScope(scopedMembers));
                } else {
                    setTeamUsers([]);
                    if (!supervisorHasTechs) setFilteredUsers([]);
                }
            } catch (e) {
                console.error("Error fetching team data:", e);
                setTeamSites([]);
                setTeamUsers([]);
                // On error, fall back to all stations (will be filtered by zone)
                setAllSites(
                    (stations || []).filter((site: any) => isSiteAllowed(site)),
                );
                if (!supervisorHasTechs)
                    setFilteredUsers(
                        applyUserScope(
                            (users || []).filter((user: any) =>
                                isUserAllowed(user),
                            ),
                        ),
                    );
            }
        })();
    }, [
        teamId,
        selectedRegionId,
        selectedZoneId,
        selectedNeName,
        stations,
        users,
        regions,
        zones,
        isSiteAllowed,
        isUserAllowed,
        supervisorHasTechs,
        siteId,
        applyUserScope,
        isStaff,
    ]);

    // Clear any residual team selection when the area (region/zone) changes to
    // avoid assigning a group that doesn't belong to the newly selected area.
    const prevAreaRef = useRef<{ regionId: string; zoneId: string } | null>(
        null,
    );
    useEffect(() => {
        const prev = prevAreaRef.current;
        if (
            prev &&
            (prev.regionId !== selectedRegionId ||
                prev.zoneId !== selectedZoneId) &&
            teamId
        ) {
            setTeamId("");
            setTeamSites([]);
            setTeamUsers([]);
        }
        prevAreaRef.current = {
            regionId: selectedRegionId,
            zoneId: selectedZoneId,
        };
    }, [selectedRegionId, selectedZoneId, teamId]);

    // Ensure assignedTo is valid when selected zone/region changes (avoid stale selections
    // for supervisors — e.g., AAZ/HQ supervisors switching zones should only see users
    // from the chosen zone). Clear the selected assignee if it no longer applies.
    useEffect(() => {
        if (!assignedToId) return;
        const currentList =
            roleKey === "supervisor" &&
            teamId &&
            Array.isArray(teamUsers) &&
            teamUsers.length > 0
                ? teamUsers
                : (supervisorHasTechs
                      ? supervisorScopedTechs
                      : filteredUsers) || [];
        const allowedIds = currentList.map((u: any) => u?.id).filter(Boolean);
        if (selectedZoneId) {
            // If a zone is selected for a supervisor, require the assignee to belong to that zone
            const stillAllowed = currentList.some(
                (u: any) =>
                    u?.id === assignedToId &&
                    (Array.isArray(u.assignedZone)
                        ? u.assignedZone.includes(selectedZoneId)
                        : true),
            );
            if (!stillAllowed) setAssignedToId("");
            return;
        }
        // If no zone is selected but the chosen assignee is no longer in the filtered list, clear it
        if (!allowedIds.includes(assignedToId)) {
            setAssignedToId("");
        }
    }, [
        selectedZoneId,
        selectedRegionId,
        filteredUsers,
        supervisorScopedTechs,
        supervisorHasTechs,
        assignedToId,
        roleKey,
        teamId,
        teamUsers,
    ]);

    // Ensure scheduledStartAt defaults to created date
    useEffect(() => {
        if (!scheduledStartDate) {
            setScheduledStartDate(createdDateDefault);
        }
        // Ensure end date does not precede start date
        if (
            scheduledEndDate &&
            scheduledStartDate &&
            new Date(scheduledEndDate) < new Date(scheduledStartDate)
        ) {
            setScheduledEndDate(null);
        }
    }, [createdDateDefault, scheduledStartDate, scheduledEndDate]);

    // Whenever the date fields change, compose the ISO-like datetime for submission
    useEffect(() => {
        if (scheduledStartDate) {
            // Set start time to midnight (00:00:00)
            const startDateTime = new Date(`${scheduledStartDate}T00:00:00`);
            setScheduledStartAt(startDateTime.toISOString());
        } else {
            setScheduledStartAt(null);
        }
    }, [scheduledStartDate]);

    useEffect(() => {
        if (scheduledEndDate) {
            // Set end time to end of day (23:59:59)
            const endDateTime = new Date(`${scheduledEndDate}T23:59:59`);
            setScheduledEndAt(endDateTime.toISOString());
        } else {
            setScheduledEndAt(null);
        }
    }, [scheduledEndDate]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!description || !siteId) {
            setError("Please provide description and site");
            return;
        }
        // For managers/supervisors NE name must be selected
        if (isManagerOrStaff && !selectedNeName) {
            setError("Please select NE Name and ID for your assigned area");
            return;
        }
        setSubmitting(true);
        try {
            const taskNumber = generatePmTaskNumber();
            const titleBase = description.slice(0, 140) || "PM Booking";
            const trimmedNeName = selectedNeName?.trim();
            const title = trimmedNeName
                ? `${titleBase} - ${trimmedNeName}`
                : titleBase;

            const r = await fetch("/api/workorders", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    type,
                    siteId,
                    planned: true,
                    teamId: teamId || undefined,
                    assignedToId: assignedToId || undefined,
                    templateId: templateId || undefined,
                    checklistScope,
                    scheduledStartAt: scheduledStartAt || undefined,
                    scheduledEndAt: scheduledEndAt || undefined,
                    taskNumber,
                }),
            });
            if (!r.ok) {
                let msg = "Failed to create booking";
                try {
                    const body = await r.json();
                    if (body?.error) msg = body.error;
                } catch (_) {
                    // ignore parse errors
                }
                throw new Error(msg);
            }
            const data = await r.json();
            onCreated?.(data);
            // If caller provided an onCreated handler, let it handle navigation.
            // Otherwise, navigate to the main workorders list (not `/all`).
            try {
                if (!onCreated) {
                    if (typeof window !== "undefined") {
                        const path = window.location.pathname || "";
                        if (!path.includes("/bookings")) {
                            router.push(`/${rolePath}/bookings`);
                        }
                    }
                }
            } catch (e) {
                // ignore navigation errors
            }
            setTitle("");
            setDescription("");
            setSelectedRegionId("");
            safeSetSelectedZoneId(null);
            setSelectedNeName("");
            setSiteId("");
            setTeamId("");
            setAssignedToId("");
        } catch (err: any) {
            setError(err?.message || "Error");
        } finally {
            setSubmitting(false);
        }
    };

    const scopedRegions = isManagerOrStaff
        ? regions.filter((r) =>
              allowedRegionIds.length ? allowedRegionIds.includes(r.id) : true,
          )
        : regions;
    const baseScopedZones = isManagerOrStaff
        ? zones.filter(
              (z) =>
                  (!allowedRegionIds.length ||
                      allowedRegionIds.includes(z.regionId)) &&
                  (!allowedZoneIds.length || allowedZoneIds.includes(z.id)),
          )
        : zones;
    const scopedZones =
        isHeadQuarterUser || isZoneOnlyUser ? baseScopedZones : filteredZones;
    const selectedRegionName = selectedRegionId
        ? regions.find((r) => r.id === selectedRegionId)?.name || ""
        : "";
    const normalizedSelectedRegionName =
        normalizeZoneScopeCode(selectedRegionName);
    const keepSelectedRegionOnZoneChange =
        normalizedSelectedRegionName === "HQ" ||
        normalizedSelectedRegionName.includes("AAZ");
    const displayedScopedZones = selectedRegionName
        ? filterZonesForSelectedRegionName(selectedRegionName, scopedZones)
        : scopedZones;

    // Resolve manager-assigned raw values to display names when available
    const resolvedManagerRegionName = (() => {
        if (selectedRegionId)
            return regions.find((r) => r.id === selectedRegionId)?.name;
        if (managerAssignedRegionsRaw && managerAssignedRegionsRaw.length) {
            const v = managerAssignedRegionsRaw[0];
            if (regions.length) {
                const m = regions.find(
                    (r) =>
                        r.id === v ||
                        String(r.name).toLowerCase() ===
                            String(v).toLowerCase(),
                );
                return m?.name || (typeof v === "string" ? v : undefined);
            }
            // If no Region records are loaded yet, fall back to the raw
            // assignedRegion string (e.g. "WR", "AA") so supervisors see
            // their region code instead of a generic placeholder.
            return typeof v === "string" ? v : undefined;
        }
        return undefined;
    })();
    const resolvedManagerZoneName = (() => {
        if (selectedZoneId)
            return zones.find((z) => z.id === selectedZoneId)?.name;
        if (managerAssignedZonesRaw && managerAssignedZonesRaw.length) {
            const v = managerAssignedZonesRaw[0];
            if (zones.length) {
                const m = zones.find(
                    (z) =>
                        z.id === v ||
                        String(z.name).toLowerCase() ===
                            String(v).toLowerCase(),
                );
                return m?.name || (typeof v === "string" ? v : undefined);
            }
            // If no Zone records are loaded yet (e.g. fresh DB seeded only
            // with Region + user-assigned area names like "Bako"), fall
            // back to showing the raw assigned zone value so managers /
            // supervisors still see their area name in the UI.
            return typeof v === "string" ? v : undefined;
        }
        return undefined;
    })();

    // (REMOVED DUPLICATE effectiveAssignedZoneIds DECLARATION)

    // isAazOrHqStaff moved earlier to avoid forward reference in hooks

    return (
        <form
            onSubmit={submit}
            className="bg-background p-4 rounded shadow space-y-3"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full border p-2"
                >
                    <option value="pm">PM</option>
                </select>
                {(isManagerOrStaff && isHeadQuarterUser) ||
                isAazOrHqStaff ? (
                    <>
                        {(() => {
                            const zoneFromZones =
                                zones.find((z) => z.id === selectedZoneId) ||
                                filteredZones.find(
                                    (z) => z.id === selectedZoneId,
                                );
                            // For AAZ/HQ supervisors we must NOT show the manager-assigned
                            // zone as a fallback — require explicit selection.
                            const displayName = selectedZoneId
                                ? zoneFromZones?.name ||
                                  resolvedManagerZoneName ||
                                  "N/A"
                                : isAazOrHqStaff
                                  ? null
                                  : resolvedManagerZoneName || null;
                            return displayName ? (
                                <div className="w-full border p-2 bg-background text-sm text-foreground dark:disabled:bg-gray-800">
                                    Assigned Zone: {displayName}
                                </div>
                            ) : (
                                <div className="w-full border p-2 bg-background text-sm text-foreground dark:disabled:bg-gray-800">
                                    Select Zone
                                </div>
                            );
                        })()}
                        <label className="block text-sm font-medium mb-1">
                            Zone
                        </label>
                        <select
                            value={selectedZoneId}
                            onChange={async (e) => {
                                const zid = e.target.value;
                                manualZoneSelectionRef.current = true;
                                // Explicit user selection bypasses auto-select guard for AAZ/HQ supervisors
                                if (isAazOrHqStaff) setSelectedZoneId(zid);
                                else safeSetSelectedZoneId(zid);
                                const zone = zones.find((z) => z.id === zid);
                                if (
                                    zone &&
                                    zone.regionId &&
                                    !keepSelectedRegionOnZoneChange &&
                                    selectedRegionId !== zone.regionId
                                ) {
                                    setSelectedRegionId(zone.regionId);
                                }
                                // Fetch stations for this zone (manager logic)
                                if (zid) {
                                    try {
                                        const res = await fetch(
                                            `/api/stations?zoneId=${zid}`,
                                        );
                                        if (res.ok) {
                                            const stationsData = await res.json();
                                            setAllSites(stationsData);
                                            setFilteredSites(stationsData);
                                            // Fetch NE names for these stations
                                            const uniqueNes = Array.from(
                                                new Set(
                                                    stationsData
                                                        .map(
                                                            (s: any) =>
                                                                s.neNameAndId,
                                                        )
                                                        .filter(Boolean),
                                                ),
                                            );
                                            setNeNames(
                                                uniqueNes.map((name) => ({
                                                    name,
                                                    value: name,
                                                })),
                                            );
                                        }
                                    } catch {}
                                } else {
                                    setAllSites([]);
                                    setFilteredSites([]);
                                    setNeNames([]);
                                }
                                setSiteId("");
                                setSelectedNeName("");
                            }}
                            className="w-full border p-2"
                        >
                            <option value="">Select Zone</option>
                            {zones
                                .filter((z) => {
                                    if (!z?.name) return false;
                                    const zname = String(z.name).toLowerCase();
                                    // For AAZ/HQ supervisors, allow all zones so they can select any AAZ/HQ area
                                    if (isAazOrHqStaff) return true;
                                    // For HQ managers, keep existing restriction to HQ/AAZ zones
                                    return (
                                        zname.includes("aaz") ||
                                        zname.includes("hq") ||
                                        zname.startsWith("hq-")
                                    );
                                })
                                .map((z) => (
                                    <option key={z.id} value={z.id}>
                                        {z.name}
                                    </option>
                                ))}
                        </select>
                    </>
                ) : isManagerOrStaff ? (
                    <>
                        <select
                            value={selectedRegionId}
                            onChange={(e) => {
                                manualZoneSelectionRef.current = false;
                                const nextRegionId = e.target.value;
                                setSelectedRegionId(nextRegionId);
                                safeSetSelectedZoneId(null);
                                setSiteId("");
                                setSelectedNeName("");
                            }}
                            className="w-full border p-2 bg-background text-foreground dark:bg-black dark:text-white"
                        >
                            <option value="">Select Region</option>
                            {scopedRegions.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedZoneId}
                            onChange={(e) => {
                                const zid = e.target.value;
                                manualZoneSelectionRef.current = true;
                                setSelectedZoneId(zid);
                                const zone = scopedZones.find(
                                    (z) => z.id === zid,
                                );
                                if (
                                    zone &&
                                    zone.regionId &&
                                    !keepSelectedRegionOnZoneChange &&
                                    selectedRegionId !== zone.regionId
                                ) {
                                    setSelectedRegionId(zone.regionId);
                                }
                            }}
                            className="w-full border p-2"
                        >
                            <option value="">Select Zone</option>
                            {displayedScopedZones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    {z.name}
                                </option>
                            ))}
                        </select>
                    </>
                ) : (
                    <React.Fragment>
                        <select
                            value={selectedRegionId}
                            onChange={(e) => {
                                manualZoneSelectionRef.current = false;
                                const nextRegionId = e.target.value;
                                setSelectedRegionId(nextRegionId);
                                safeSetSelectedZoneId(null);
                                setSiteId("");
                                setSelectedNeName("");
                            }}
                            className="w-full border p-2 disabled:opacity-70 disabled:cursor-not-allowed bg-background text-foreground dark:disabled:bg-gray-800"
                        >
                            <option value="">Select Region</option>
                            {scopedRegions.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedZoneId}
                            onChange={(e) => {
                                const zid = e.target.value;
                                manualZoneSelectionRef.current = true;
                                setSelectedZoneId(zid);
                                const zone = scopedZones.find(
                                    (z) => z.id === zid,
                                );
                                if (
                                    zone &&
                                    zone.regionId &&
                                    !keepSelectedRegionOnZoneChange &&
                                    selectedRegionId !== zone.regionId
                                ) {
                                    setSelectedRegionId(zone.regionId);
                                }
                            }}
                            className="w-full border p-2 disabled:opacity-70 disabled:cursor-not-allowed dark:disabled:bg-gray-800"
                            disabled={!selectedRegionId}
                        >
                            <option value="">
                                {selectedRegionId
                                    ? `Zones of ${regions.find((r) => r.id === selectedRegionId)?.name || "Region"}`
                                    : "Select Zone"}
                            </option>
                            {displayedScopedZones.map((z) => (
                                <option key={z.id} value={z.id}>
                                    {z.name}
                                </option>
                            ))}
                        </select>
                    </React.Fragment>
                )}
                <div className="md:col-span-2 space-y-2">
                    <div className="text-xs text-muted-foreground">
                        Select site first, then select NE during booking
                        creation.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                            value={siteId}
                            onChange={(e) => {
                                setSiteId(e.target.value);
                                setSelectedNeName("");
                            }}
                            className="w-full border p-2"
                        >
                            <option value="">Select site</option>
                            {filteredSites.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedNeName}
                            onChange={(e) => setSelectedNeName(e.target.value)}
                            className="w-full border p-2 disabled:opacity-70 disabled:cursor-not-allowed dark:disabled:bg-gray-800"
                            disabled={!siteId || !neNames.length}
                        >
                            <option value="">
                                {!siteId
                                    ? "Select site first to load NE options"
                                    : neNames.length
                                      ? "Select NE Name and ID (optional)"
                                      : "No NE options for selected site"}
                            </option>
                            {neNames.map((ne) => (
                                <option key={ne.value} value={ne.value}>
                                    {ne.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Start and End Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                    <label className="text-sm">Start Date</label>
                    <input
                        type="date"
                        value={scheduledStartDate || ""}
                        onChange={(e) => setScheduledStartDate(e.target.value)}
                        className="w-full border p-2"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-sm">End Date (optional)</label>
                    <input
                        type="date"
                        value={scheduledEndDate || ""}
                        onChange={(e) => setScheduledEndDate(e.target.value)}
                        className="w-full border p-2"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {roleKey === "supervisor" ? (
                    <select
                        value={supervisorAssigneeValue}
                        onChange={(e) => {
                            const value = e.target.value || "";
                            if (!value) {
                                setTeamId("");
                                setAssignedToId("");
                                return;
                            }
                            if (value.startsWith("team:")) {
                                const id = value.slice("team:".length);
                                setTeamId(id);
                                setAssignedToId("");
                                return;
                            }
                            if (value.startsWith("user:")) {
                                const id = value.slice("user:".length);
                                setAssignedToId(id);
                                setTeamId("");
                                return;
                            }
                        }}
                        className="w-full border p-2"
                    >
                        <option value="">
                            {supervisorHasTechs ||
                            (Array.isArray(supervisorGroupTeam) &&
                                supervisorGroupTeam.length > 0)
                                ? "Select passenger or group"
                                : "Assign to (User)"}
                        </option>
                        {Array.isArray(supervisorGroupTeam) &&
                            supervisorGroupTeam.map((t: any) => (
                                <option key={t.id} value={`team:${t.id}`}>
                                    {t.name || "Group"}
                                </option>
                            ))}
                        {(() => {
                            let usersToRender: any[] | undefined;
                            usersToRender = supervisorHasTechs
                                ? supervisorScopedTechs
                                : filteredUsers;
                            if (selectedZoneId) {
                                usersToRender = (usersToRender || []).filter(
                                    (u: any) =>
                                        Array.isArray(u.assignedZone)
                                            ? u.assignedZone.includes(
                                                  selectedZoneId,
                                              )
                                            : !u.assignedZone ||
                                              u.assignedZone.length === 0,
                                );
                            }
                            return (usersToRender || []).map((u: any) => (
                                <option key={u.id} value={`user:${u.id}`}>
                                    {u.fullName || u.username}
                                </option>
                            ));
                        })()}
                    </select>
                ) : (
                    <select
                        value={assignedToId}
                        onChange={(e) => setAssignedToId(e.target.value)}
                        className="w-full border p-2"
                    >
                        <option value="">
                            {isManagerOrStaff
                                ? "Assign to (User)"
                                : selectedRegionId || selectedZoneId
                                  ? `Users in ${
                                        selectedZoneId
                                            ? zones.find(
                                                  (z) =>
                                                      z.id === selectedZoneId,
                                              )?.name
                                            : regions.find(
                                                  (r) =>
                                                      r.id === selectedRegionId,
                                              )?.name || "Area"
                                    }`
                                  : "Assign to (User)"}
                        </option>
                        {(() => {
                            let usersToRender: any[] | undefined;
                            usersToRender = supervisorHasTechs
                                ? supervisorScopedTechs
                                : filteredUsers;
                            return (usersToRender || []).map((u: any) => (
                                <option key={u.id} value={u.id}>
                                    {u.fullName || u.username}
                                </option>
                            ));
                        })()}
                    </select>
                )}
                <div className="flex gap-2 items-center">
                    <select
                        value={templateId}
                        onChange={(e) => setTemplateId(e.target.value)}
                        className="w-full border p-2"
                    >
                        <option value="">Select template (optional)</option>
                        {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!templateId}
                        onClick={() =>
                            templateId &&
                            window.open(`/maintenance/${templateId}`, "_blank")
                        }
                        className="ml-2 px-3 py-1 border rounded text-sm bg-card"
                    >
                        View template
                    </button>
                </div>
                <select
                    value={checklistScope}
                    onChange={(e) => setChecklistScope(e.target.value)}
                    className="w-full border p-2"
                >
                    <option value="full">
                        Checklist scope (full: Equipment + Power & Environment +
                        Room)
                    </option>
                    <option value="room_only">Room only (Room section)</option>
                    <option value="room_equipment">
                        Room + Equipment sections
                    </option>
                    <option value="power">
                        Power & Environment section only
                    </option>
                </select>
            </div>

            <div>
                <label className="sr-only" htmlFor="wo-description">
                    Description
                </label>
                <div className="flex items-start gap-2">
                    <textarea
                        id="wo-description"
                        className={`border w-full resize-none px-2 ${
                            descExpanded ? "py-2" : "py-1"
                        }`}
                        placeholder="Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={descExpanded ? 6 : 2}
                        required
                    ></textarea>
                </div>
            </div>
            {error && <div className="text-foreground">{error}</div>}
            <div className="text-right mt-2">
                <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={submitting}
                >
                    {submitting ? "Creating..." : "Create Booking"}
                </button>
            </div>
        </form>
    );
}
