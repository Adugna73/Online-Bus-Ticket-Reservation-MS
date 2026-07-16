"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Card, { CardContent } from "@/components/ui/card";

export default function EditMemberForm({ userId }: { userId: string }) {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [staffId, setStaffId] = useState("");
    const [roleKey, setRoleKey] = useState("Passenger");
    const [regionId, setRegionId] = useState("");
    const [zoneId, setZoneId] = useState("");
    const [location, setLocation] = useState<string | undefined>(undefined);
    const [regions, setRegions] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [supervisors, setManager] = useState<any[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState<
        string | undefined
    >(undefined);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        (async () => {
            const r = await fetch(`/api/users/${userId}`);
            if (r.ok) {
                const j = await r.json();
                setFullName(j.fullName || "");
                setEmail(j.email || "");
                setStaffId(j.staffId || "");
                setRoleKey(j.role?.key || "Passenger");
                setRegionId((j.assignedRegion && j.assignedRegion[0]) || "");
                setZoneId((j.assignedZone && j.assignedZone[0]) || "");
                setLocation(j.location || undefined);
            }
        })();
    }, [userId]);

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

    // load supervisors when region/zone changes
    useEffect(() => {
        setManager([]);
        setSelectedStaffId(undefined);
        setLocation(undefined);
        if (!regionId) {
            return;
        }
        const qs = new URLSearchParams();
        qs.set("role", "supervisor");
        qs.set("regionId", regionId);
        if (zoneId) qs.set("zoneId", zoneId);
        fetch(`/api/users?${qs.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                setManager(data || []);
                if (selectedStaffId) {
                    const match = (data || []).find(
                        (s: any) => s.id === selectedStaffId,
                    );
                    if (match) setLocation(match.location || undefined);
                }
            })
            .catch(console.error);
    }, [regionId, zoneId]);

    const onSubmit = async (e: any) => {
        e.preventDefault();
        setLoading(true);
        try {
            const r = await fetch(`/api/users/${userId}`, {
                method: "PUT", // API expects PUT
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    fullName,
                    email,
                    staffId,
                    roleKey,
                    assignedRegion: regionId ? [regionId] : [],
                    assignedZone: zoneId ? [zoneId] : [],
                    location: location || undefined,
                }),
            });
            if (r.ok) {
                alert("Updated");
                router.back();
            } else {
                alert("Failed to update");
            }
        } catch (e) {
            console.error(e);
            alert("Error");
        }
        setLoading(false);
    };

    return (
        <Card className="max-w-xl bg-background text-foreground">
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
                            type="email"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Staff ID</label>
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Staff (optional)
                        </label>
                        <select
                            value={selectedStaffId || ""}
                            onChange={(e) => {
                                const id = e.target.value || undefined;
                                setSelectedStaffId(id);
                                const sup = supervisors.find(
                                    (s: any) => s.id === id,
                                );
                                setLocation(sup?.location || undefined);
                            }}
                            disabled={supervisors.length === 0}
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
                                    {s.location ? ` - ${s.location}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {location && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                Location (auto)
                            </label>
                            <Input value={location} disabled />
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
                            {loading ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
