"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Filter, Plus, Edit, Trash2 } from "lucide-react";

import UserForm from "./UserForm";

type Region = { id: string; name: string };
type Zone = { id: string; name: string; regionId: string };

type RoleFilter = "" | "admin" | "manager" | "supervisor" | "passenger";

export default function UsersClient() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const scope = searchParams?.get("scope") || "";
    const createUserParam = searchParams?.get("createUser") || "";
    const defaultRoleParam = searchParams?.get("defaultRole") || "";
    const hasScopedQuery = Boolean(
        searchParams?.get("regionName") ||
        searchParams?.get("regionId") ||
        searchParams?.get("zoneName") ||
        searchParams?.get("zoneId") ||
        searchParams?.get("location") ||
        searchParams?.get("focusUserId") ||
        createUserParam ||
        defaultRoleParam ||
        scope,
    );

    const [users, setUsers] = useState<any[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
    const [regionFilter, setRegionFilter] = useState<string>("");
    const [zoneFilter, setZoneFilter] = useState<string>("");
    const [locationFilter, setLocationFilter] = useState<string>("");

    const [showUserForm, setShowUserForm] = useState(false);
    const [userFormMode, setUserFormMode] = useState<"create" | "edit">(
        "create",
    );
    const [userFormDefaultRole, setUserFormDefaultRole] = useState<
        "admin" | "manager" | "supervisor" | "passenger"
    >("supervisor");
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [queryInitialized, setQueryInitialized] = useState(false);
    const [openedFocusUserId, setOpenedFocusUserId] = useState<string | null>(
        null,
    );
    const [openedCreateQuery, setOpenedCreateQuery] = useState<string | null>(
        null,
    );

    const roleLower = String((session?.user as any)?.role || "").toLowerCase();
    const isAdmin = roleLower === "admin";
    const canManage = isAdmin || roleLower === "manager";
    // scoped admin users (Buzayehu/Fekadu) should NOT be allowed to manage other admin
    const canManageAdmins = (() => {
        const user = session?.user || {};
        try {
            const { canManageAdminUsers } = require("../lib/scopedAdmin");
            return canManageAdminUsers(user);
        } catch {
            return isAdmin;
        }
    })();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (roleFilter) params.set("role", roleFilter);
            if (regionFilter) {
                params.set("regionId", regionFilter);
            }
            if (zoneFilter) {
                params.set("zoneId", zoneFilter);
            }
            if (locationFilter && scope !== "manager") {
                params.set("location", locationFilter);
            }
            const res = await fetch(`/api/users?${params.toString()}`);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Failed to load users");
            }
            const data = await res.json();
            setUsers(data || []);
        } catch (e: any) {
            setError(e?.message || "Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const [regionsR, zonesR] = await Promise.all([
                    fetch("/api/regions"),
                    fetch("/api/zones"),
                ]);
                if (regionsR.ok) setRegions(await regionsR.json());
                if (zonesR.ok) setZones(await zonesR.json());
            } catch (e) {
                // ignore; filters just won't populate
            }
        })();
    }, []);

    useEffect(() => {
        if (queryInitialized) return;
        if (regions.length === 0 && zones.length === 0) return;

        const queryRole = searchParams?.get("role") || "";
        const queryRegionId = searchParams?.get("regionId") || "";
        const queryRegionName = searchParams?.get("regionName") || "";
        const queryZoneId = searchParams?.get("zoneId") || "";
        const queryZoneName = searchParams?.get("zoneName") || "";
        const queryLocation = searchParams?.get("location") || "";

        if (queryRole) setRoleFilter(queryRole as RoleFilter);

        if (queryRegionId) {
            setRegionFilter(queryRegionId);
        } else if (queryRegionName) {
            const region = regions.find(
                (r) => r.name.toLowerCase() === queryRegionName.toLowerCase(),
            );
            if (region) setRegionFilter(region.id);
        }

        if (queryZoneId) {
            setZoneFilter(queryZoneId);
        } else if (queryZoneName) {
            const zone = zones.find(
                (z) => z.name.toLowerCase() === queryZoneName.toLowerCase(),
            );
            if (zone) setZoneFilter(zone.id);
        }

        if (queryLocation) setLocationFilter(queryLocation);

        setQueryInitialized(true);
    }, [queryInitialized, regions, zones, searchParams]);

    useEffect(() => {
        if (hasScopedQuery && !queryInitialized) return;
        void fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        roleFilter,
        regionFilter,
        zoneFilter,
        locationFilter,
        hasScopedQuery,
        queryInitialized,
    ]);

    useEffect(() => {
        const focusUserId = searchParams?.get("focusUserId") || "";
        if (!focusUserId || openedFocusUserId === focusUserId) return;
        void openEditUser(focusUserId);
        setOpenedFocusUserId(focusUserId);
    }, [openedFocusUserId, searchParams]);

    useEffect(() => {
        const shouldOpenCreate =
            createUserParam === "1" || createUserParam.toLowerCase() === "true";
        const createKey = `${createUserParam}:${defaultRoleParam}`;

        if (!shouldOpenCreate || openedCreateQuery === createKey) return;

        const normalizedRole = String(
            defaultRoleParam || "supervisor",
        ).toLowerCase();
        const resolvedRole: "admin" | "manager" | "supervisor" | "passenger" =
            normalizedRole === "admin"
                ? "admin"
                : normalizedRole === "manager"
                  ? "manager"
                  : normalizedRole === "passenger"
                    ? "passenger"
                    : "supervisor";

        openCreateUser(resolvedRole);
        setOpenedCreateQuery(createKey);
    }, [createUserParam, defaultRoleParam, openedCreateQuery]);

    const openCreateUser = (
        role: "admin" | "manager" | "supervisor" | "passenger",
    ) => {
        setUserFormMode("create");
        setUserFormDefaultRole(role);
        setEditingUser(null);
        setShowUserForm(true);
    };

    const openEditUser = async (userId: string) => {
        try {
            const res = await fetch(`/api/users/${userId}`);
            if (!res.ok) return;
            const u = await res.json();
            setEditingUser(u);
            setUserFormMode("edit");
            const key = u.role?.key
                ? String(u.role.key).toLowerCase()
                : "supervisor";
            setUserFormDefaultRole(
                key === "manager"
                    ? "manager"
                    : key === "passenger"
                      ? "passenger"
                      : "supervisor",
            );
            setShowUserForm(true);
        } catch (e) {
            // ignore for now
        }
    };

    const closeUserForm = () => {
        setShowUserForm(false);
        setEditingUser(null);
    };

    const handleUserSaved = () => {
        void fetchUsers();
    };

    const regionsById = React.useMemo(() => {
        const m = new Map<string, string>();
        regions.forEach((r) => m.set(r.id, r.name));
        return m;
    }, [regions]);

    const zonesById = React.useMemo(() => {
        const m = new Map<string, string>();
        zones.forEach((z) => m.set(z.id, z.name));
        return m;
    }, [zones]);

    const uniqueLocations = React.useMemo(() => {
        const locations = new Set<string>();
        users.forEach((u) => {
            if (u.location) locations.add(u.location);
        });
        return Array.from(locations).sort();
    }, [users]);

    const filteredZones = zones.filter((z) =>
        regionFilter ? z.regionId === regionFilter : true,
    );

    const scopedUsers = React.useMemo(() => {
        let result = [...users];
        const queryRegionName = searchParams?.get("regionName") || "";
        const queryZoneName = searchParams?.get("zoneName") || "";
        const queryLocation = searchParams?.get("location") || "";

        if (queryRegionName) {
            result = result.filter((u) => {
                const locCat = String(u.locationCategory || "").toLowerCase();
                const assignedRegionNames = Array.isArray(u.assignedRegion)
                    ? (u.assignedRegion as string[]).map(
                          (id) => regionsById.get(id) || id,
                      )
                    : [];
                return (
                    locCat === queryRegionName.toLowerCase() ||
                    assignedRegionNames.some(
                        (name) =>
                            String(name).toLowerCase() ===
                            queryRegionName.toLowerCase(),
                    )
                );
            });
        }

        if (queryZoneName) {
            result = result.filter((u) => {
                const assignedZoneNames = Array.isArray(u.assignedZone)
                    ? (u.assignedZone as string[]).map(
                          (id) => zonesById.get(id) || id,
                      )
                    : [];
                return assignedZoneNames.some(
                    (name) =>
                        String(name).toLowerCase() ===
                        queryZoneName.toLowerCase(),
                );
            });
        }

        if (queryLocation && scope !== "manager") {
            result = result.filter(
                (u) =>
                    String(u.location || "").toLowerCase() ===
                    queryLocation.toLowerCase(),
            );
        }

        return result;
    }, [scope, searchParams, users, regionsById, zonesById]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Users</h1>
                    <p className="text-sm text-muted-foreground">
                        Filter by role, region, and location. Admins and
                        managers can add new users.
                    </p>
                </div>
                {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                        {canManageAdmins && (
                            <button
                                type="button"
                                onClick={() => openCreateUser("admin")}
                                className="et-primary-button text-xs py-1 px-2"
                            >
                                <Plus className="h-3 w-3" /> Add Admin
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => openCreateUser("manager")}
                            className="et-primary-button text-xs py-1 px-2"
                        >
                            <Plus className="h-3 w-3" /> Add Manager
                        </button>
                        <button
                            type="button"
                            onClick={() => openCreateUser("supervisor")}
                            className="et-primary-button text-xs py-1 px-2"
                        >
                            <Plus className="h-3 w-3" /> Add Staff
                        </button>
                        <button
                            type="button"
                            onClick={() => openCreateUser("passenger")}
                            className="et-primary-button text-xs py-1 px-2"
                        >
                            <Plus className="h-3 w-3" /> Add Passenger
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2 text-xs md:text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Filter className="h-3 w-3" /> Filters
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) =>
                        setRoleFilter(e.target.value as RoleFilter)
                    }
                    className="h-8 rounded border px-2 text-xs md:text-sm bg-input text-foreground"
                >
                    <option value="">All roles</option>
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="supervisor">Staff</option>
                    <option value="passenger">Passenger</option>
                </select>
                <select
                    value={regionFilter}
                    onChange={(e) => {
                        setRegionFilter(e.target.value);
                        setZoneFilter(""); // Clear zone filter when region changes
                        setLocationFilter("");
                    }}
                    className="h-8 rounded border px-2 text-xs md:text-sm bg-input text-foreground"
                >
                    <option value="">All regions</option>
                    {regions.map((r) => (
                        <option key={r.id} value={r.id}>
                            {r.name}
                        </option>
                    ))}
                </select>
                <select
                    value={zoneFilter}
                    onChange={(e) => {
                        setZoneFilter(e.target.value);
                        setLocationFilter("");
                    }}
                    className="h-8 rounded border px-2 text-xs md:text-sm bg-input text-foreground"
                >
                    <option value="">All zones</option>
                    {zones
                        .filter(
                            (z) => !regionFilter || z.regionId === regionFilter,
                        )
                        .map((z) => (
                            <option key={z.id} value={z.id}>
                                {z.name}
                            </option>
                        ))}
                </select>
                <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="h-8 rounded border px-2 text-xs md:text-sm bg-input text-foreground"
                >
                    <option value="">All locations</option>
                    {uniqueLocations.map((location) => (
                        <option key={location} value={location}>
                            {location}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto rounded-md border bg-card">
                <table className="min-w-full text-xs md:text-sm">
                    <thead className="bg-muted/50">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">
                                Name
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Email
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Role
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Regions
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Zones
                            </th>
                            <th className="px-3 py-2 text-left font-medium">
                                Locations
                            </th>
                            {canManage && (
                                <th className="px-3 py-2 text-right font-medium">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={canManage ? 7 : 6}
                                    className="px-3 py-4 text-center text-muted-foreground"
                                >
                                    Loading users...
                                </td>
                            </tr>
                        ) : scopedUsers.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={canManage ? 7 : 6}
                                    className="px-3 py-4 text-center text-muted-foreground"
                                >
                                    No users found.
                                </td>
                            </tr>
                        ) : (
                            scopedUsers.map((u) => {
                                const roleKey =
                                    typeof u.role?.key === "string"
                                        ? u.role.key
                                        : u.role || "";
                                const regionsNames = Array.isArray(
                                    u.assignedRegion,
                                )
                                    ? (u.assignedRegion as string[])
                                          .map(
                                              (id) => regionsById.get(id) || id,
                                          )
                                          .join(", ")
                                    : "";
                                const zonesNames = Array.isArray(u.assignedZone)
                                    ? (u.assignedZone as string[])
                                          .map((id) => zonesById.get(id) || id)
                                          .join(", ")
                                    : "";
                                const locationName = u.location || "-";
                                return (
                                    <tr
                                        key={u.id}
                                        className="border-t hover:bg-muted/40"
                                    >
                                        <td className="px-3 py-2 align-top">
                                            {u.fullName}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            {u.email}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            {roleKey || "-"}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            {regionsNames || "-"}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            {zonesNames || "-"}
                                        </td>
                                        <td className="px-3 py-2 align-top">
                                            {locationName}
                                        </td>
                                        {canManage && (
                                            <td className="px-3 py-2 align-top text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openEditUser(u.id)
                                                        }
                                                        title={`Edit ${u.fullName}`}
                                                        aria-label={`Edit ${u.fullName}`}
                                                        className="inline-flex items-center justify-center rounded border px-2 py-1 hover:bg-muted"
                                                    >
                                                        <Edit className="h-3 w-3" />
                                                    </button>
                                                    {isAdmin &&
                                                        canManageAdmins && (
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    if (
                                                                        !confirm(
                                                                            `Delete user ${u.fullName}?`,
                                                                        )
                                                                    )
                                                                        return;
                                                                    try {
                                                                        const res =
                                                                            await fetch(
                                                                                `/api/users/${u.id}`,
                                                                                {
                                                                                    method: "DELETE",
                                                                                },
                                                                            );
                                                                        if (
                                                                            res.ok
                                                                        ) {
                                                                            void fetchUsers();
                                                                        } else {
                                                                            console.error(
                                                                                "Failed to delete user",
                                                                            );
                                                                        }
                                                                    } catch (e) {
                                                                        console.error(
                                                                            "Error deleting user",
                                                                            e,
                                                                        );
                                                                    }
                                                                }}
                                                                title={`Delete ${u.fullName}`}
                                                                aria-label={`Delete ${u.fullName}`}
                                                                className="inline-flex items-center justify-center rounded border px-2 py-1 text-red-600 hover:bg-red-50"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
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

            {showUserForm && (
                <UserForm
                    isOpen={showUserForm}
                    onClose={closeUserForm}
                    onSave={handleUserSaved}
                    user={editingUser}
                    mode={userFormMode}
                    defaultRole={userFormDefaultRole}
                    isAdmin={isAdmin}
                />
            )}
        </div>
    );
}
