"use client";
import React, { useState, useEffect } from "react";
import { X, Save, User, Mail, IdCard, MapPin } from "lucide-react";

interface Region {
    id: string;
    name: string;
}

interface AreaOption {
    id: string;
    name: string;
    regionId: string;
}

type RoleKey = "admin" | "manager" | "supervisor" | "passenger";

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    user?: any; // For editing existing user
    mode: "create" | "edit";
    defaultRole?: RoleKey;
    isAdmin?: boolean;
}

interface FormState {
    fullName: string;
    email: string;
    staffId: string;
    roleKey: RoleKey;
    assignedRegion: string[];
    assignedZone: string[];
    location?: string; // station/city for supervisor
    immediateStaffId?: string;
    password: string;
}

function normalizeSingleAssignment(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const first = value.find((item) => typeof item === "string" && item);
    return first ? [first] : [];
}

function normalizeCode(value: unknown): string {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase();
}

function isCompatibilityZoneName(zoneName: string): boolean {
    const normalized = normalizeCode(zoneName);
    return normalized.includes("AAZ") || normalized.startsWith("HQ");
}

function filterZonesForSelectedRegion(
    regionName: string,
    zoneList: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
    const normalizedRegionName = normalizeCode(regionName);
    if (!normalizedRegionName) return [];

    // Standard regional assignments should only expose the zone that matches
    // the selected region code. This intentionally hides compatibility zones
    // such as NAAZ/WAAZ/CAAZ when editing normal region-scoped users.
    if (normalizedRegionName !== "HQ") {
        return zoneList.filter(
            (zone) => normalizeCode(zone.name) === normalizedRegionName,
        );
    }

    return zoneList.filter((zone) => {
        const normalizedZoneName = normalizeCode(zone.name);
        return (
            normalizedZoneName === "HQ" ||
            normalizedZoneName.startsWith("HQ-") ||
            normalizedZoneName.includes("AAZ")
        );
    });
}

export default function UserForm({
    isOpen,
    onClose,
    onSave,
    user,
    mode,
    defaultRole,
    isAdmin,
}: UserFormProps) {
    const directorEmail = "atnafu.dereje@ethiotelecom.et";
    const [formData, setFormData] = useState<FormState>({
        fullName: "",
        email: "",
        staffId: "",
        roleKey: (defaultRole || "supervisor") as RoleKey,
        assignedRegion: [],
        assignedZone: [],
        password: "",
    });
    const [regions, setRegions] = useState<Region[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [regionLocations, setRegionLocations] = useState<AreaOption[]>([]);
    const [supervisors, setManager] = useState<any[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<
        string | undefined
    >(undefined);
    const [supLocations, setSupLocations] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const supervisorRoleLabel =
        formData.roleKey === "admin" || formData.roleKey === "manager"
            ? "Director"
            : formData.roleKey === "supervisor"
              ? "Manager"
              : "Staff";

    const selectedRegionName = React.useMemo(() => {
        const selectedRegionValue = formData.assignedRegion[0];
        if (!selectedRegionValue) return "";

        const matchingRegion = regions.find(
            (region) =>
                region.id === selectedRegionValue ||
                normalizeCode(region.name) ===
                    normalizeCode(selectedRegionValue),
        );

        return matchingRegion?.name || String(selectedRegionValue);
    }, [regions, formData.assignedRegion]);

    const visibleZones = React.useMemo(
        () => filterZonesForSelectedRegion(selectedRegionName, zones),
        [selectedRegionName, zones],
    );

    const locationOptions = React.useMemo(() => {
        if (formData.roleKey === "supervisor") {
            return regionLocations.map((area) => area.name);
        }

        return supLocations;
    }, [formData.roleKey, regionLocations, supLocations]);

    useEffect(() => {
        if (isOpen) {
            // Load regions when the form opens. Zones are fetched per region.
            fetch("/api/regions")
                .then((res) => res.json())
                .then((data) => setRegions(data))
                .catch(console.error);
            setZones([]);

            // reset supervisor list / location
            setManager([]);
            setSelectedStaffId(undefined);

            // If editing, populate form
            if (mode === "edit" && user) {
                const roleKey = (
                    user.role?.key
                        ? String(user.role.key).toLowerCase()
                        : "supervisor"
                ) as RoleKey;

                setFormData({
                    fullName: user.fullName || "",
                    email: user.email || "",
                    staffId: user.staffId || "",
                    roleKey,
                    assignedRegion: normalizeSingleAssignment(
                        user.assignedRegion,
                    ),
                    assignedZone: normalizeSingleAssignment(user.assignedZone),
                    location: user.location || undefined,
                    immediateStaffId:
                        user.immediateStaffId || undefined,
                    password: "",
                });
                if (user.immediateStaffId) {
                    setSelectedStaffId(user.immediateStaffId);
                }
            } else {
                // Reset form for create mode
                setFormData({
                    fullName: "",
                    email: "",
                    staffId: "",
                    roleKey: (defaultRole || "supervisor") as RoleKey,
                    assignedRegion: [],
                    assignedZone: [],
                    location: undefined,
                    password: "",
                });
            }
        }
    }, [isOpen, mode, user, defaultRole]);

    useEffect(() => {
        const selectedRegionId = formData.assignedRegion[0];

        if (!isOpen || !selectedRegionId) {
            setZones([]);
            return;
        }

        fetch(
            `/api/zones/region?regionId=${encodeURIComponent(selectedRegionId)}`,
        )
            .then((res) => res.json())
            .then((data) => {
                const regionZones = Array.isArray(data) ? data : [];
                setZones(regionZones);
                setFormData((prev) => {
                    const currentZoneId = prev.assignedZone[0];
                    if (!currentZoneId) return prev;

                    const effectiveRegionName = (() => {
                        const matchingRegion = regions.find(
                            (region) =>
                                region.id === selectedRegionId ||
                                normalizeCode(region.name) ===
                                    normalizeCode(selectedRegionId),
                        );

                        return matchingRegion?.name || String(selectedRegionId);
                    })();

                    const allowedZones = filterZonesForSelectedRegion(
                        effectiveRegionName,
                        regionZones,
                    );

                    const zoneStillBelongsToRegion = allowedZones.some(
                        (zone: any) => zone.id === currentZoneId,
                    );

                    if (zoneStillBelongsToRegion) return prev;

                    return {
                        ...prev,
                        assignedZone: [],
                    };
                });
            })
            .catch((error) => {
                console.error(error);
                setZones([]);
            });
    }, [isOpen, formData.assignedRegion, regions]);

    useEffect(() => {
        const selectedRegionId = formData.assignedRegion[0];

        if (!isOpen || !selectedRegionId || formData.roleKey !== "supervisor") {
            setRegionLocations([]);
            return;
        }

        fetch(
            `/api/areas/region?regionId=${encodeURIComponent(selectedRegionId)}`,
        )
            .then((res) => res.json())
            .then((data) => {
                const areas = Array.isArray(data) ? data : [];
                setRegionLocations(areas);
                setFormData((prev) => {
                    const currentLocation = String(prev.location || "").trim();
                    if (!currentLocation) {
                        return areas.length
                            ? { ...prev, location: areas[0].name }
                            : prev;
                    }

                    const locationStillValid = areas.some(
                        (area: AreaOption) => area.name === currentLocation,
                    );

                    if (locationStillValid) return prev;

                    return {
                        ...prev,
                        location: areas[0]?.name,
                    };
                });
            })
            .catch((error) => {
                console.error(error);
                setRegionLocations([]);
            });
    }, [isOpen, formData.assignedRegion, formData.roleKey]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const normalizedPayload = {
            ...formData,
            assignedRegion: normalizeSingleAssignment(formData.assignedRegion),
            assignedZone: normalizeSingleAssignment(formData.assignedZone),
            immediateStaffId:
                selectedStaffId || formData.immediateStaffId,
        };

        try {
            const url =
                mode === "edit" ? `/api/users/${user.id}` : "/api/users";
            const method = mode === "edit" ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(normalizedPayload),
            });

            if (response.ok) {
                onSave();
                onClose();
            } else {
                const error = await response.json();
                alert(error.error || "Failed to save user");
            }
        } catch (error) {
            console.error("Error saving user:", error);
            alert("Error saving user");
        } finally {
            setLoading(false);
        }
    };

    const handleRegionChange = (regionId: string) => {
        setFormData((prev) => ({
            ...prev,
            assignedRegion: [regionId],
            // Region change resets zone and location so the hierarchy stays consistent.
            assignedZone:
                prev.assignedRegion[0] === regionId ? prev.assignedZone : [],
            location:
                prev.assignedRegion[0] === regionId ? prev.location : undefined,
        }));
    };

    const handleZoneChange = (zoneId: string) => {
        setFormData((prev) => ({
            ...prev,
            assignedZone: zoneId ? [zoneId] : [],
            location: undefined,
        }));
    };

    const zonesForRegions = visibleZones;

    // when selected regions/zones change we need to refresh supervisor list
    useEffect(() => {
        setManager([]);
        setSupLocations([]);
        setFormData((prev) => ({ ...prev, location: prev.location }));

        if (formData.roleKey === "admin" || formData.roleKey === "manager") {
            fetch(
                `/api/users?role=admin&email=${encodeURIComponent(directorEmail)}`,
            )
                .then((res) => res.json())
                .then((data) => {
                    const directorList = data || [];
                    setManager(directorList);
                    const director = directorList[0];
                    if (
                        director &&
                        (!selectedStaffId || mode === "create")
                    ) {
                        setSelectedStaffId(director.id);
                        setFormData((prev) => ({
                            ...prev,
                            immediateStaffId: director.id,
                        }));
                    }
                })
                .catch(console.error);
            return;
        }

        if (formData.assignedRegion.length === 0) {
            return;
        }
        // determine role to lookup
        const supRole: "manager" | "supervisor" =
            formData.roleKey === "supervisor" ? "manager" : "supervisor";

        const qs = new URLSearchParams();
        qs.set("role", supRole);
        qs.set("regionId", formData.assignedRegion[0]);
        if (formData.assignedZone[0])
            qs.set("zoneId", formData.assignedZone[0]);
        fetch(`/api/users?${qs.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setManager(data || []);
                if (data?.length) {
                    const existingSelection = (data || []).find(
                        (s: any) => s.id === selectedStaffId,
                    );
                    if (!existingSelection && mode === "create") {
                        setSelectedStaffId(undefined);
                    }
                }
                if (selectedStaffId) {
                    const match = (data || []).find(
                        (s: any) => s.id === selectedStaffId,
                    );
                    if (match)
                        setFormData((prev) => ({
                            ...prev,
                            location: match.location || undefined,
                        }));
                }
            })
            .catch(console.error);
    }, [
        formData.assignedRegion,
        formData.assignedZone,
        formData.roleKey,
        mode,
        selectedStaffId,
    ]);

    // whenever supervisor changes, pull subordinate locations
    useEffect(() => {
        if (!selectedStaffId) {
            setSupLocations([]);
            return;
        }
        fetch(`/api/users?immediateStaffId=${selectedStaffId}`)
            .then((res) => res.json())
            .then((data) => {
                const locs = Array.from(
                    new Set(
                        (data || [])
                            .map((u: any) => u.location)
                            .filter((l: any) => !!l),
                    ),
                );
                setSupLocations(locs as string[]);
                if (locs.length && !locs.includes(formData.location || "")) {
                    setFormData((prev) => ({
                        ...prev,
                        location: locs[0] as string,
                    }));
                }
            })
            .catch(console.error);
    }, [selectedStaffId]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 text-foreground">
            <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background text-foreground shadow-xl">
                <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
                    <h2 className="text-xl font-semibold">
                        {mode === "create" ? "Add New" : "Edit"}{" "}
                        {formData.roleKey}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Full Name *
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    required
                                    value={formData.fullName}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            fullName: e.target.value,
                                        }))
                                    }
                                    className="w-full pl-10 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter full name"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            email: e.target.value,
                                        }))
                                    }
                                    className="w-full pl-10 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter email address"
                                />
                            </div>
                        </div>

                        {/* Staff ID */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Staff ID
                            </label>
                            <div className="relative">
                                <IdCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={formData.staffId}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            staffId: e.target.value,
                                        }))
                                    }
                                    className="w-full pl-10 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter staff ID"
                                />
                            </div>
                        </div>

                        {/* Role */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Role *
                            </label>
                            <select
                                required
                                value={formData.roleKey}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        roleKey: e.target.value as RoleKey,
                                    }))
                                }
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="passenger">Passenger</option>
                                <option value="supervisor">Staff</option>
                                <option value="manager">Manager</option>
                                {isAdmin && (
                                    <option value="admin">Admin</option>
                                )}
                            </select>
                        </div>

                        {/* Password (only for create mode) */}
                        {mode === "create" && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Password (leave empty for default: pm@12345)
                                </label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            password: e.target.value,
                                        }))
                                    }
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter password"
                                />
                            </div>
                        )}
                    </div>

                    {/* Assigned Regions */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            <MapPin className="inline h-4 w-4 mr-1" />
                            Assigned Region
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto border border-border rounded-md p-3 bg-muted/40">
                            {regions.map((region) => (
                                <label
                                    key={region.id}
                                    className="flex items-center space-x-2 text-sm"
                                >
                                    <input
                                        type="radio"
                                        name="assigned-region"
                                        checked={
                                            formData.assignedRegion[0] ===
                                            region.id
                                        }
                                        onChange={() =>
                                            handleRegionChange(region.id)
                                        }
                                        className="border-input text-foreground focus:ring-ring"
                                    />
                                    <span>{region.name}</span>
                                </label>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            A user can only be assigned to one region.
                        </p>
                    </div>

                    {zonesForRegions.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Assigned Zone
                            </label>
                            <select
                                value={formData.assignedZone[0] || ""}
                                onChange={(e) =>
                                    handleZoneChange(e.target.value)
                                }
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">No zone selected</option>
                                {zonesForRegions.map((zone) => (
                                    <option key={zone.id} value={zone.id}>
                                        {zone.name}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-muted-foreground">
                                A user can only be assigned to one zone.
                            </p>
                        </div>
                    )}

                    {/* Immediate supervisor selector */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Immediate {supervisorRoleLabel}
                        </label>
                        <select
                            value={selectedStaffId || ""}
                            onChange={(e) => {
                                const id = e.target.value || undefined;
                                setSelectedStaffId(id);
                                setFormData((prev) => ({
                                    ...prev,
                                    immediateStaffId: id,
                                }));
                            }}
                            disabled={supervisors.length === 0}
                            className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">
                                {supervisors.length === 0
                                    ? `Select assigned region/zone first to load ${supervisorRoleLabel.toLowerCase()}s`
                                    : `Choose ${supervisorRoleLabel.toLowerCase()}`}
                            </option>
                            {supervisors.map((s: any) => (
                                <option key={s.id} value={s.id}>
                                    {s.fullName}
                                    {s.location ? ` - ${s.location}` : ""}
                                    {s.email ? ` (${s.email})` : ""}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Use this to set or change who this user reports to.
                        </p>
                    </div>

                    {/* supervisor location comes from the selected region's towns */}
                    {(locationOptions.length > 0 || formData.location) && (
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                {formData.roleKey === "supervisor"
                                    ? "Main Town"
                                    : "Location (optional)"}
                            </label>
                            <select
                                value={formData.location || ""}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        location: e.target.value || undefined,
                                    }))
                                }
                                className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                <option value="">None</option>
                                {locationOptions.map((l) => (
                                    <option key={l} value={l}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                            {formData.roleKey === "supervisor" && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Select the main town for this supervisor's
                                    assigned region.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="et-secondary-button px-4 py-2 text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center space-x-2 et-primary-button px-4 py-2 text-sm disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            <span>{loading ? "Saving..." : "Save"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
