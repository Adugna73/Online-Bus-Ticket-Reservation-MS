"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import Card, { CardContent } from "./ui/card";

export default function AddMemberForm({
    teamId,
    supervisorId,
}: {
    teamId?: string;
    supervisorId?: string;
}) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [staffId, setStaffId] = useState("");
    const [roleKey, setRoleKey] = useState("Passenger");
    const [regionId, setRegionId] = useState("");
    const [zoneId, setZoneId] = useState("");
    const [location, setLocation] = useState<string | undefined>(undefined);
    const [supervisors, setManager] = useState<any[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<
        string | undefined
    >(undefined);
    const [supLocations, setSupLocations] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [regions, setRegions] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        // If we're adding staff under a supervisor, default to passenger.
        if (supervisorId) setRoleKey("Passenger");
    }, [supervisorId]);

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
                // non-fatal; keeps form usable with free text inputs removed
                console.error("Failed to load regions/zones", e);
            }
        })();
    }, []);

    const zonesForRegion = useMemo(() => {
        if (!regionId) return zones;
        return zones.filter(
            (z: any) => String(z.regionId) === String(regionId),
        );
    }, [zones, regionId]);

    // when region/zone picks change we need to load appropriate upper‑level users
    useEffect(() => {
        setSelectedStaffId(undefined);
        setLocation(undefined);
        setSupLocations([]);
        if (!regionId) {
            setManager([]);
            return;
        }
        // determine which role should be considered as "supervisor" for the user we're creating
        let supRole = "supervisor";
        if (roleKey === "manager") supRole = "admin";
        else if (roleKey === "supervisor") supRole = "manager";

        const qs = new URLSearchParams();
        qs.set("role", supRole);
        qs.set("regionId", regionId);
        if (zoneId) qs.set("zoneId", zoneId);
        fetch(`/api/users?${qs.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setManager(data || []);
                // if we already had a supervisorId prop and it matches region, keep it
                if (supervisorId) {
                    const match = (data || []).find(
                        (s: any) => s.id === supervisorId,
                    );
                    if (match) {
                        setSelectedStaffId(supervisorId);
                        setLocation(match.location || undefined);
                    }
                }
            })
            .catch(console.error);
    }, [regionId, zoneId, supervisorId, roleKey]);

    // load subordinate locations whenever supervisor changes
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
                if (locs.length && !locs.includes(location || "")) {
                    setLocation(locs[0] as string);
                }
            })
            .catch(console.error);
    }, [selectedStaffId]);

    const onSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        try {
            // include CSRF token and cookies so APIs authenticate correctly
            const csrfRes = await fetch("/api/auth/csrf");
            const { csrfToken } = await csrfRes.json().catch(() => ({}));

            const r = await fetch("/api/users", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
                },
                credentials: "include",
                body: JSON.stringify({
                    fullName,
                    email,
                    staffId: staffId || undefined,
                    roleKey,
                    teamId: teamId || undefined,
                    immediateStaffId:
                        selectedStaffId || supervisorId || undefined,
                    assignedRegion: regionId ? [regionId] : undefined,
                    assignedZone: zoneId ? [zoneId] : undefined,
                    location: location || undefined,
                }),
            });
            if (r.ok) {
                alert("User created");
                router.back();
            } else {
                const err = await r.json().catch(() => ({}));
                if (r.status === 409 && err.error === "unique_violation") {
                    alert("A user with that email or staff ID already exists.");
                } else {
                    alert(err.error || "Failed");
                }
            }
        } catch (e) {
            console.error(e);
            alert("Error");
        }
        setLoading(false);
    };

    return (
        <Card className="max-w-xl">
            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Full name</label>
                        <Input
                            placeholder="Full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            type="email"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Staff ID (optional)
                        </label>
                        <Input
                            placeholder="Staff ID"
                            value={staffId}
                            onChange={(e) => setStaffId(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role</label>
                            <select
                                value={roleKey}
                                onChange={(e) => setRoleKey(e.target.value)}
                                disabled={!!supervisorId}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option>Passenger</option>
                                <option>Staff</option>
                                <option>Manager</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Region (optional)
                            </label>
                            <select
                                value={regionId}
                                onChange={(e) => {
                                    setRegionId(e.target.value);
                                    setZoneId("");
                                }}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="">None</option>
                                {regions.map((r: any) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Zone (optional)
                        </label>
                        <select
                            value={zoneId}
                            onChange={(e) => setZoneId(e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">None</option>
                            {zonesForRegion.map((z: any) => (
                                <option key={z.id} value={z.id}>
                                    {z.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Staff selector (drives location) */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            {roleKey === "manager"
                                ? "Admin"
                                : roleKey === "supervisor"
                                  ? "Manager"
                                  : "Staff"}{" "}
                            (optional)
                        </label>
                        <select
                            value={selectedStaffId || ""}
                            onChange={(e) => {
                                const id = e.target.value || undefined;
                                setSelectedStaffId(id);
                            }}
                            disabled={supervisors.length === 0 && !supervisorId}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">
                                {supervisors.length === 0
                                    ? "Select region/zone first"
                                    : "None"}
                            </option>
                            {supervisors.map((s: any) => (
                                <option key={s.id} value={s.id}>
                                    {s.fullName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* locations covered by selected supervisor */}
                    {selectedStaffId && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Location (optional)
                            </label>
                            <select
                                value={location || ""}
                                onChange={(e) =>
                                    setLocation(e.target.value || undefined)
                                }
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.back()}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
