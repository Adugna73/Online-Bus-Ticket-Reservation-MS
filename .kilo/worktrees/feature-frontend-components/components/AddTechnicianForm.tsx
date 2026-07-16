"use client";
import { useState, useEffect, ChangeEvent, FormEvent } from "react";

interface Region {
    id: string;
    name: string;
    zones: Zone[];
}
interface Zone {
    id: string;
    name: string;
    regionId: string;
    stations?: Site[];
}
interface Site {
    id: string;
    name: string;
}
interface Staff {
    id: string;
    fullName: string;
    supervisorSite?: { regionId?: string };
}
interface Team {
    id: string;
    name: string;
}
interface AddPassengerFormProps {
    organization: { regions: Region[] } | null;
    team: Team[];
    supervisors: Staff[];
    onPassengerAdded?: (passenger: any) => void;
}

export default function AddPassengerForm({
    organization,
    team,
    supervisors,
    onPassengerAdded,
}: AddPassengerFormProps) {
    const [form, setForm] = useState({
        fullName: "",
        email: "",
        staffId: "",
        assignedRegion: "",
        assignedZone: "",
        supervisorFullName: "",
        immediateStaffId: "",
        section: "",
        group: "",
        locationCategory: "",
        location: "",
        jobTitle: "",
        teamId: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const supervisorOptions = supervisors || [];

    // When supervisor changes, set region robustly
    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { name, value } = e.target;
        if (name === "supervisorFullName") {
            const supervisor = supervisorOptions.find(
                (sup) => sup.fullName === value,
            );
            let regionId = "";
            let supervisorId = "";
            if (
                supervisor &&
                supervisor.supervisorSite &&
                supervisor.supervisorSite.regionId
            ) {
                regionId = supervisor.supervisorSite.regionId;
                supervisorId = supervisor.id;
            }
            setForm((prev) => ({
                ...prev,
                supervisorFullName: value,
                immediateStaffId: supervisorId,
                assignedRegion: regionId,
                assignedZone: "",
                location: "",
            }));
        } else {
            setForm((prev) => ({
                ...prev,
                [name]: value,
                ...(name === "assignedRegion"
                    ? { assignedZone: "", location: "" }
                    : {}),
                ...(name === "assignedZone" ? { location: "" } : {}),
            }));
        }
    };

    // On mount or supervisor change, always sync region
    useEffect(() => {
        if (form.immediateStaffId) {
            const supervisor = supervisorOptions.find(
                (sup: Staff) => sup.id === form.immediateStaffId,
            );
            let regionId = "";
            if (
                supervisor &&
                supervisor.supervisorSite &&
                supervisor.supervisorSite.regionId
            ) {
                regionId = supervisor.supervisorSite.regionId;
            }
            if (regionId && form.assignedRegion !== regionId) {
                setForm((prev) => ({
                    ...prev,
                    assignedRegion: regionId,
                    assignedZone: "",
                    location: "",
                }));
            }
        }
    }, [form.immediateStaffId, supervisorOptions]);

    // Prepare select options from data
    const regionOptions = organization?.regions || [];
    const selectedRegion = regionOptions.find(
        (r: Region) => r.id === form.assignedRegion,
    );
    const zoneOptions = selectedRegion?.zones || [];
    const selectedZone = zoneOptions.find(
        (z: Zone) => z.id === form.assignedZone,
    );
    const locationOptions = selectedZone?.stations || [];
    const teamOptions = team || [];

    // Submit handler
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            // You may want to get userRole and userRegion from context/session in a real app
            const userRole = "manager";
            const userRegion = form.assignedRegion;
            const res = await fetch("/api/manager/supervisor-details", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    type: "passenger",
                    supervisorId: form.supervisorFullName.trim(),
                    data: {
                        fullName: form.fullName,
                        email: form.email,
                        username:
                            form.email ||
                            form.fullName.replace(/\s+/g, "").toLowerCase(),
                    },
                    userRole,
                    userRegion,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to add passenger");
            } else {
                const created = await res.json();
                setSuccess("Passenger added successfully!");
                setForm({
                    fullName: "",
                    email: "",
                    staffId: "",
                    assignedRegion: "",
                    assignedZone: "",
                    supervisorFullName: "",
                    immediateStaffId: "",
                    section: "",
                    group: "",
                    locationCategory: "",
                    location: "",
                    jobTitle: "",
                    teamId: "",
                });
                if (typeof onPassengerAdded === "function") {
                    onPassengerAdded(created);
                }
            }
        } catch (err) {
            setError("Network error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mb-8 rounded border border-border bg-background p-4 text-foreground"
        >
            <h2 className="text-lg font-semibold mb-4">Add Passenger</h2>
            {error && <div className="text-red-600 mb-2">{error}</div>}
            {success && <div className="text-green-600 mb-2">{success}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                    placeholder="Full Name"
                    className="input"
                />
                <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder="Email"
                    className="input"
                />
                <input
                    name="staffId"
                    value={form.staffId}
                    onChange={handleChange}
                    required
                    placeholder="Staff ID"
                    className="input"
                />
                <input
                    name="jobTitle"
                    value={form.jobTitle}
                    onChange={handleChange}
                    placeholder="Job Title"
                    className="input"
                />
                <input
                    name="section"
                    value={form.section}
                    onChange={handleChange}
                    placeholder="Section"
                    className="input"
                />
                <input
                    name="group"
                    value={form.group}
                    onChange={handleChange}
                    placeholder="Group"
                    className="input"
                />
                <input
                    name="locationCategory"
                    value={form.locationCategory}
                    onChange={handleChange}
                    placeholder="Location Category"
                    className="input"
                />
                <select
                    name="assignedRegion"
                    value={form.assignedRegion}
                    onChange={handleChange}
                    required
                    className="input"
                    disabled
                >
                    <option value="">Select Region</option>
                    {regionOptions.map((region: Region) => (
                        <option key={region.id} value={region.id}>
                            {region.name}
                        </option>
                    ))}
                </select>
                <select
                    name="assignedZone"
                    value={form.assignedZone}
                    onChange={handleChange}
                    required
                    className="input"
                >
                    <option value="">Select Zone</option>
                    {zoneOptions.map((zone: Zone) => (
                        <option key={zone.id} value={zone.id}>
                            {zone.name}
                        </option>
                    ))}
                </select>
                <select
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    required
                    className="input"
                >
                    <option value="">Select Location</option>
                    {locationOptions.map((site: Site) => (
                        <option key={site.id} value={site.name}>
                            {site.name}
                        </option>
                    ))}
                </select>
                <select
                    name="supervisorFullName"
                    value={form.supervisorFullName}
                    onChange={handleChange}
                    className="input"
                >
                    <option value="">Select Staff</option>
                    {supervisorOptions.map((sup: Staff) => (
                        <option key={sup.id} value={sup.fullName}>
                            {sup.fullName}
                        </option>
                    ))}
                </select>
                <select
                    name="teamId"
                    value={form.teamId}
                    onChange={handleChange}
                    className="input"
                >
                    <option value="">Select Team</option>
                    {teamOptions.map((team: Team) => (
                        <option key={team.id} value={team.id}>
                            {team.name}
                        </option>
                    ))}
                </select>
            </div>
            <button
                type="submit"
                className="mt-4 btn btn-primary"
                disabled={loading}
            >
                {loading ? "Adding..." : "Add Passenger"}
            </button>
        </form>
    );
}
