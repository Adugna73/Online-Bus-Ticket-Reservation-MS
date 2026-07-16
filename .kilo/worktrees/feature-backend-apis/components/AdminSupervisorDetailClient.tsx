import React, { useState, useEffect } from "react";
// Define Staff, Passenger, and Site interfaces if not already imported
interface Passenger {
    id?: string;
    name: string;
    email: string;
    phone: string;
    username: string;
    staffId: string;
    assignedRegion: string[];
    assignedZone: string[];
    roleKey: string;
}

interface Site {
    id?: string;
    name: string;
    siteCode: string;
    neNameAndId: string;
}

interface Staff {
    id?: string;
    name: string;
    stationName: string;
    areaName: string;
    regionCode: string;
    stations?: Site[];
    passengers?: Passenger[];
}

interface AdminStaffDetailClientProps {
    supervisor: Staff;
    canEdit?: boolean;
}

export default function AdminStaffDetailClient({
    supervisor,
    canEdit = true,
}: AdminStaffDetailClientProps) {
    const [selectedStaff, setSelectedStaff] =
        useState<Staff>(supervisor);
    const [teamSites, setTeamSites] = useState<Site[]>(supervisor.stations || []);
    const [passengers, setPassengers] = useState<Passenger[]>(
        supervisor.passengers || [],
    );
    const [loadingSites, setLoadingSites] = useState(false);
    const [showAddPassenger, setShowAddPassenger] = useState(false);
    const [showAddSite, setShowAddSite] = useState(false);
    const [editingPassenger, setEditingPassenger] =
        useState<Passenger | null>(null);
    const [editingSite, setEditingSite] = useState<Site | null>(null);
    const [newPassenger, setNewPassenger] = useState<Passenger>({
        name: "",
        email: "",
        phone: "",
        username: "",
        staffId: "",
        assignedRegion: supervisor.regionCode ? [supervisor.regionCode] : [],
        assignedZone: supervisor.areaName ? [supervisor.areaName] : [],
        roleKey: "Passenger",
    });
    const [newSite, setNewSite] = useState<Site>({
        name: "",
        siteCode: "",
        neNameAndId: "",
    });

    const isHqStaff =
        String(supervisor.regionCode || "")
            .toLowerCase()
            .includes("head quarter") ||
        String(supervisor.regionCode || "").toLowerCase() === "hq" ||
        String(supervisor.areaName || "")
            .toLowerCase()
            .includes("head quarter");

    // CRUD functions (implement as needed, similar to TeamClient)
    // ...

    return (
        <div className="space-y-4">
            <div className="bg-background p-6 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold mb-2">{supervisor.name}</h2>
                <div className="mb-2">Site: {supervisor.stationName}</div>
                <div className="mb-2">Area: {supervisor.areaName}</div>
                <div className="mb-2">Region: {supervisor.regionCode}</div>

                {/* Passengers CRUD */}
                <div className="mb-4">
                    <h3 className="font-semibold">Passengers</h3>
                    <div>
                        {passengers.map((tech) => (
                            <div
                                key={tech.id}
                                className="flex items-center gap-2"
                            >
                                <span>
                                    {tech.name} ({tech.email})
                                </span>
                                {canEdit && (
                                    <>
                                        <button
                                            onClick={() =>
                                                setEditingPassenger(tech)
                                            }
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                /* delete logic */
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {canEdit && (
                        <button onClick={() => setShowAddPassenger(true)}>
                            Add Passenger
                        </button>
                    )}
                </div>

                {/* Sites CRUD */}
                <div className="mb-4">
                    <h3 className="font-semibold">Sites / NEs</h3>
                    <div>
                        {teamSites.map((site) => (
                            <div
                                key={site.id}
                                className="flex items-center gap-2"
                            >
                                <span>
                                    {site.name} ({site.siteCode})
                                </span>
                                {canEdit && (
                                    <>
                                        <button
                                            onClick={() => setEditingSite(site)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                /* delete logic */
                                            }}
                                        >
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    {canEdit && (
                        <button
                            onClick={() => setShowAddSite(true)}
                            className="ml-auto et-primary-button"
                        >
                            Add New Site
                        </button>
                    )}
                    {/* Add Site Modal */}
                    {showAddSite && (
                        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                            <div className="bg-background p-6 rounded-lg shadow-lg border max-w-lg w-full mx-4">
                                <h3 className="text-lg font-semibold mb-4">
                                    Add Site
                                </h3>
                                <form
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const form = e.target as any;
                                        const siteCode = form.siteCode.value;
                                        const name = form.name.value;
                                        const region = form.region.value;
                                        const zone = form.zone.value;
                                        const latitude = form.latitude.value;
                                        const longitude = form.longitude.value;
                                        const neNameAndId =
                                            form.neNameAndId.value;
                                        await fetch("/api/stations", {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({
                                                siteCode,
                                                name,
                                                region,
                                                zone,
                                                latitude: latitude || null,
                                                longitude: longitude || null,
                                                neNameAndId,
                                            }),
                                        });
                                        setShowAddSite(false);
                                        // Optionally refresh site list here
                                    }}
                                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                                >
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Site Code *
                                        </label>
                                        <input
                                            name="siteCode"
                                            required
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Name *
                                        </label>
                                        <input
                                            name="name"
                                            required
                                            className="w-full p-2 border rounded"
                                        />
                                    </div>
                                    {!isHqStaff && (
                                        <div>
                                            <label className="block text-sm font-medium mb-1">
                                                Region
                                            </label>
                                            <select
                                                name="region"
                                                className="w-full p-2 border rounded"
                                            >
                                                <option value="">
                                                    Select region
                                                </option>
                                                {/* region options (HQ/AAZ removed) */}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Zone
                                        </label>
                                        <select
                                            name="zone"
                                            className="w-full p-2 border rounded"
                                        >
                                            <option value="">
                                                Select zone
                                            </option>
                                            {/* Populate with zones dynamically if available */}
                                        </select>
                                    </div>
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
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">
                                            NE name / ID
                                        </label>
                                        <input
                                            name="neNameAndId"
                                            className="w-full p-2 border rounded"
                                            placeholder="e.g. NE12345"
                                        />
                                    </div>
                                    <div className="md:col-span-2 flex justify-end gap-2 mt-4">
                                        <button
                                            type="button"
                                            className="px-4 py-2 rounded border"
                                            onClick={() =>
                                                setShowAddSite(false)
                                            }
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>

                {/* Add/Edit modals (implement as needed) */}
                {/* ... */}
            </div>
        </div>
    );
}
