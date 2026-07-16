"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const SiteSelect = dynamic(() => import("./SiteSelect"), { ssr: false });

interface Site {
    id: string;
    name: string;
}
interface Staff {
    id: string;
    name: string;
    area: string | null;
    region: string | null;
    station: Site | null;
}
interface Passenger {
    id: string;
    fullName: string;
    email: string;
}
interface Site {
    id: string;
    name: string;
}

export default function StaffDetailClient({
    supervisor,
    onClose,
}: {
    supervisor: Staff;
    onClose: () => void;
}) {
    const [details, setDetails] = useState<{
        passengers: Passenger[];
        stations: Site[];
    }>({ passengers: [], stations: [] });
    const [loading, setLoading] = useState(true);
    const [techForm, setTechForm] = useState<Partial<Passenger>>({});
    const [siteForm, setSiteForm] = useState<Partial<Site>>({});
    const [editingTechId, setEditingTechId] = useState<string | null>(null);
    const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
    // Add dropdowns for role and region
    const [userRole, setUserRole] = useState("manager");
    const [userRegion, setUserRegion] = useState(supervisor.region || "");

    useEffect(() => {
        setLoading(true);
        fetch(
            `/api/manager/supervisor-details?supervisorId=${encodeURIComponent(supervisor.name)}`,
        )
            .then((res) => res.json())
            .then(setDetails)
            .finally(() => setLoading(false));
    }, [supervisor.name]);

    const refresh = async () => {
        setLoading(true);
        const res = await fetch(
            `/api/manager/supervisor-details?supervisorId=${encodeURIComponent(supervisor.name)}`,
        );
        setDetails(await res.json());
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-6xl max-h-[90vh] relative overflow-y-auto">
                <button
                    className="absolute top-4 right-4 text-2xl text-gray-500 hover:text-black"
                    onClick={onClose}
                >
                    ×
                </button>
                <div className="mb-6">
                    <div className="font-bold text-2xl mb-1">
                        {supervisor.name}
                    </div>
                    <div className="text-gray-700 mb-1">
                        <span className="font-semibold">Site:</span>{" "}
                        {supervisor.station?.name || "-"}
                    </div>
                    <div className="text-gray-700 mb-1">
                        <span className="font-semibold">Area:</span>{" "}
                        {supervisor.area || "-"}
                    </div>
                    <div className="text-gray-700 mb-1">
                        <span className="font-semibold">Region:</span>{" "}
                        {supervisor.region || "-"}
                    </div>
                    <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1">
                            <span className="font-semibold">Role:</span>
                            <select
                                className="border p-1 text-xs"
                                value={userRole}
                                onChange={(e) => setUserRole(e.target.value)}
                            >
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-1">
                            <span className="font-semibold">Region:</span>
                            <select
                                className="border p-1 text-xs"
                                value={userRegion}
                                onChange={(e) => setUserRegion(e.target.value)}
                            >
                                <option value="">Select region</option>
                                <option value="WR">WR</option>
                                <option value="ER">ER</option>
                                <option value="SR">SR</option>
                                <option value="AA">AA</option>
                                <option value="OR">OR</option>
                                <option value="">Other</option>
                            </select>
                        </label>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Passengers Card */}
                    <div className="bg-gray-50 rounded-lg shadow p-4">
                        <div className="font-semibold text-lg mb-2 flex items-center justify-between">
                            Passengers
                            <form
                                className="flex gap-1"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    // Only send required fields for passenger
                                    const payload = {
                                        type: "passenger",
                                        supervisorId: supervisor.name,
                                        data: {
                                            fullName:
                                                techForm.fullName?.trim() || "",
                                            email: techForm.email?.trim() || "",
                                        },
                                        userRole,
                                        userRegion,
                                    };
                                    await fetch(
                                        "/api/manager/supervisor-details",
                                        {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify(payload),
                                        },
                                    );
                                    setTechForm({});
                                    refresh();
                                }}
                            >
                                <input
                                    className="border p-1 text-xs"
                                    placeholder="Full Name"
                                    value={techForm.fullName || ""}
                                    onChange={(e) =>
                                        setTechForm((f) => ({
                                            ...f,
                                            fullName: e.target.value,
                                        }))
                                    }
                                    required
                                />
                                <input
                                    className="border p-1 text-xs"
                                    placeholder="Email"
                                    value={techForm.email || ""}
                                    onChange={(e) =>
                                        setTechForm((f) => ({
                                            ...f,
                                            email: e.target.value,
                                        }))
                                    }
                                    required
                                />
                                <button
                                    className="text-xs bg-green-600 text-white px-2 rounded"
                                    type="submit"
                                >
                                    Add
                                </button>
                            </form>
                        </div>
                        {loading ? (
                            <div>Loading...</div>
                        ) : (
                            <ul>
                                {details.passengers.map((t) => (
                                    <li
                                        key={t.id}
                                        className="flex items-center justify-between mb-1 border-b pb-1"
                                    >
                                        {editingTechId === t.id ? (
                                            <form
                                                className="flex gap-1"
                                                onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    await fetch(
                                                        "/api/manager/supervisor-details",
                                                        {
                                                            method: "PUT",
                                                            headers: {
                                                                "Content-Type":
                                                                    "application/json",
                                                            },
                                                            body: JSON.stringify(
                                                                {
                                                                    type: "passenger",
                                                                    id: t.id,
                                                                    data: techForm,
                                                                    userRole,
                                                                    userRegion,
                                                                    supervisorId:
                                                                        supervisor.name,
                                                                },
                                                            ),
                                                        },
                                                    );
                                                    setEditingTechId(null);
                                                    setTechForm({});
                                                    refresh();
                                                }}
                                            >
                                                <input
                                                    className="border p-1 text-xs"
                                                    value={
                                                        techForm.fullName || ""
                                                    }
                                                    onChange={(e) =>
                                                        setTechForm((f) => ({
                                                            ...f,
                                                            fullName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                    required
                                                />
                                                <input
                                                    className="border p-1 text-xs"
                                                    value={techForm.email || ""}
                                                    onChange={(e) =>
                                                        setTechForm((f) => ({
                                                            ...f,
                                                            email: e.target
                                                                .value,
                                                        }))
                                                    }
                                                    required
                                                />
                                                <button
                                                    className="text-green-600 text-xs"
                                                    type="submit"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="text-gray-500 text-xs"
                                                    type="button"
                                                    onClick={() =>
                                                        setEditingTechId(null)
                                                    }
                                                >
                                                    Cancel
                                                </button>
                                            </form>
                                        ) : (
                                            <>
                                                <span>
                                                    {t.fullName} ({t.email})
                                                </span>
                                                <span>
                                                    <button
                                                        className="text-xs text-blue-600 mr-1"
                                                        onClick={() => {
                                                            setEditingTechId(
                                                                t.id,
                                                            );
                                                            setTechForm({
                                                                fullName:
                                                                    t.fullName,
                                                                email: t.email,
                                                            });
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="text-xs text-red-600"
                                                        onClick={async () => {
                                                            await fetch(
                                                                "/api/manager/supervisor-details",
                                                                {
                                                                    method: "DELETE",
                                                                    headers: {
                                                                        "Content-Type":
                                                                            "application/json",
                                                                    },
                                                                    body: JSON.stringify(
                                                                        {
                                                                            type: "passenger",
                                                                            id: t.id,
                                                                            userRole,
                                                                            userRegion,
                                                                            supervisorId:
                                                                                supervisor.name,
                                                                        },
                                                                    ),
                                                                },
                                                            );
                                                            refresh();
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </span>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {/* Sites/NEs Card */}
                    <div className="bg-gray-50 rounded-lg shadow p-4">
                        <div className="font-semibold text-lg mb-2 flex items-center justify-between">
                            Sites / NEs
                            <form
                                className="flex gap-1"
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    // Only send required fields for site/NE
                                    const payload = {
                                        type: "site",
                                        supervisorId: supervisor.name,
                                        data: {
                                            name: siteForm.name?.trim() || "",
                                        },
                                        userRole,
                                        userRegion,
                                    };
                                    await fetch(
                                        "/api/manager/supervisor-details",
                                        {
                                            method: "POST",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify(payload),
                                        },
                                    );
                                    setSiteForm({});
                                    refresh();
                                }}
                            >
                                <SiteSelect
                                    value={siteForm.id}
                                    onChange={(id) =>
                                        setSiteForm((f) => ({ ...f, id }))
                                    }
                                />
                                <input
                                    className="border p-1 text-xs"
                                    placeholder="Site/NE Name"
                                    value={siteForm.name || ""}
                                    onChange={(e) =>
                                        setSiteForm((f) => ({
                                            ...f,
                                            name: e.target.value,
                                        }))
                                    }
                                />
                                <button
                                    className="text-xs bg-green-600 text-white px-2 rounded"
                                    type="submit"
                                >
                                    Add
                                </button>
                            </form>
                        </div>
                        {loading ? (
                            <div>Loading...</div>
                        ) : (
                            <ul>
                                {details.stations.map((s) => (
                                    <li
                                        key={s.id}
                                        className="flex items-center justify-between mb-1 border-b pb-1"
                                    >
                                        {editingSiteId === s.id ? (
                                            <form
                                                className="flex gap-1"
                                                onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    await fetch(
                                                        "/api/manager/supervisor-details",
                                                        {
                                                            method: "PUT",
                                                            headers: {
                                                                "Content-Type":
                                                                    "application/json",
                                                            },
                                                            body: JSON.stringify(
                                                                {
                                                                    type: "site",
                                                                    id: s.id,
                                                                    data: siteForm,
                                                                    userRole,
                                                                    userRegion,
                                                                    supervisorId:
                                                                        supervisor.name,
                                                                },
                                                            ),
                                                        },
                                                    );
                                                    setEditingSiteId(null);
                                                    setSiteForm({});
                                                    refresh();
                                                }}
                                            >
                                                <input
                                                    className="border p-1 text-xs"
                                                    value={siteForm.name || ""}
                                                    onChange={(e) =>
                                                        setSiteForm((f) => ({
                                                            ...f,
                                                            name: e.target
                                                                .value,
                                                        }))
                                                    }
                                                    required
                                                />
                                                <button
                                                    className="text-green-600 text-xs"
                                                    type="submit"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="text-gray-500 text-xs"
                                                    type="button"
                                                    onClick={() =>
                                                        setEditingSiteId(null)
                                                    }
                                                >
                                                    Cancel
                                                </button>
                                            </form>
                                        ) : (
                                            <>
                                                <span>{s.name}</span>
                                                <span>
                                                    <button
                                                        className="text-xs text-blue-600 mr-1"
                                                        onClick={() => {
                                                            setEditingSiteId(
                                                                s.id,
                                                            );
                                                            setSiteForm({
                                                                name: s.name,
                                                            });
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="text-xs text-red-600"
                                                        onClick={async () => {
                                                            await fetch(
                                                                "/api/manager/supervisor-details",
                                                                {
                                                                    method: "DELETE",
                                                                    headers: {
                                                                        "Content-Type":
                                                                            "application/json",
                                                                    },
                                                                    body: JSON.stringify(
                                                                        {
                                                                            type: "site",
                                                                            id: s.id,
                                                                            userRole,
                                                                            userRegion,
                                                                            supervisorId:
                                                                                supervisor.name,
                                                                        },
                                                                    ),
                                                                },
                                                            );
                                                            refresh();
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </span>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
                {/* Region-wide Sites/NEs Table (full CRUD) */}
                <div className="mt-10">
                    <h3 className="font-semibold text-lg mb-2">
                        All Sites / NEs in Region
                    </h3>
                    {supervisor.region && (
                        <div className="bg-gray-50 rounded-lg shadow p-4 overflow-x-auto">
                            {/* Inline region stations CRUD table, no extra header/filters, with edit/delete for manager */}
                            {typeof window !== "undefined" &&
                                (() => {
                                    const React = require("react");
                                    const { useState, useEffect } = React;
                                    const [stations, setSites] = useState([]);
                                    const [loading, setLoading] =
                                        useState(true);
                                    const [editId, setEditId] = useState(null);
                                    const [editData, setEditData] = useState({
                                        name: "",
                                        siteCode: "",
                                        neNameAndId: "",
                                    });
                                    useEffect(() => {
                                        setLoading(true);
                                        const region = supervisor.region ?? "";
                                        fetch(
                                            `/api/stations?region=${encodeURIComponent(region)}`,
                                        )
                                            .then((r) => r.json())
                                            .then(setSites)
                                            .finally(() => setLoading(false));
                                    }, [supervisor.region]);
                                    const refresh = () => {
                                        setLoading(true);
                                        const region = supervisor.region ?? "";
                                        fetch(
                                            `/api/stations?region=${encodeURIComponent(region)}`,
                                        )
                                            .then((r) => r.json())
                                            .then(setSites)
                                            .finally(() => setLoading(false));
                                    };
                                    const handleEdit = (site: any) => {
                                        setEditId(site.id);
                                        setEditData({
                                            name: site.name || "",
                                            siteCode: site.siteCode || "",
                                            neNameAndId: site.neNameAndId || "",
                                        });
                                    };
                                    const handleSave = async (id: any) => {
                                        await fetch("/api/stations", {
                                            method: "PUT",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({
                                                id,
                                                ...editData,
                                            }),
                                        });
                                        setEditId(null);
                                        setEditData({
                                            name: "",
                                            siteCode: "",
                                            neNameAndId: "",
                                        });
                                        refresh();
                                    };
                                    const handleDelete = async (id: any) => {
                                        if (
                                            !window.confirm("Delete this site?")
                                        )
                                            return;
                                        await fetch("/api/stations", {
                                            method: "DELETE",
                                            headers: {
                                                "Content-Type":
                                                    "application/json",
                                            },
                                            body: JSON.stringify({ id }),
                                        });
                                        refresh();
                                    };
                                    return (
                                        <div>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full text-xs md:text-sm">
                                                    <thead className="bg-muted/50">
                                                        <tr>
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
                                                            <th className="px-3 py-2 text-left font-medium">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loading ? (
                                                            <tr>
                                                                <td
                                                                    colSpan={6}
                                                                    className="px-3 py-4 text-center text-muted-foreground"
                                                                >
                                                                    Loading
                                                                    stations...
                                                                </td>
                                                            </tr>
                                                        ) : stations.length ===
                                                          0 ? (
                                                            <tr>
                                                                <td
                                                                    colSpan={6}
                                                                    className="px-3 py-4 text-center text-muted-foreground"
                                                                >
                                                                    No stations
                                                                    found.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            stations.map(
                                                                (s: any) => (
                                                                    <tr
                                                                        key={
                                                                            s.id
                                                                        }
                                                                        className="border-t hover:bg-muted/40"
                                                                    >
                                                                        <td className="px-3 py-2 align-top">
                                                                            {editId ===
                                                                            s.id ? (
                                                                                <input
                                                                                    value={
                                                                                        editData.siteCode
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        setEditData(
                                                                                            (
                                                                                                d: any,
                                                                                            ) => ({
                                                                                                ...d,
                                                                                                siteCode:
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                            }),
                                                                                        )
                                                                                    }
                                                                                    className="border rounded px-1 text-xs w-24"
                                                                                />
                                                                            ) : (
                                                                                s.siteCode ||
                                                                                "-"
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top">
                                                                            {editId ===
                                                                            s.id ? (
                                                                                <input
                                                                                    value={
                                                                                        editData.name
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        setEditData(
                                                                                            (
                                                                                                d: any,
                                                                                            ) => ({
                                                                                                ...d,
                                                                                                name: e
                                                                                                    .target
                                                                                                    .value,
                                                                                            }),
                                                                                        )
                                                                                    }
                                                                                    className="border rounded px-1 text-xs w-24"
                                                                                />
                                                                            ) : (
                                                                                s.name ||
                                                                                "-"
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top">
                                                                            {s
                                                                                .region
                                                                                ?.name ||
                                                                                "-"}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top">
                                                                            {s
                                                                                .zone
                                                                                ?.name ||
                                                                                "-"}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top">
                                                                            {editId ===
                                                                            s.id ? (
                                                                                <input
                                                                                    value={
                                                                                        editData.neNameAndId
                                                                                    }
                                                                                    onChange={(
                                                                                        e,
                                                                                    ) =>
                                                                                        setEditData(
                                                                                            (
                                                                                                d: any,
                                                                                            ) => ({
                                                                                                ...d,
                                                                                                neNameAndId:
                                                                                                    e
                                                                                                        .target
                                                                                                        .value,
                                                                                            }),
                                                                                        )
                                                                                    }
                                                                                    className="border rounded px-1 text-xs w-24"
                                                                                />
                                                                            ) : (
                                                                                s.neNameAndId ||
                                                                                "-"
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-2 align-top">
                                                                            {editId ===
                                                                            s.id ? (
                                                                                <>
                                                                                    <button
                                                                                        className="text-xs text-green-600 mr-1"
                                                                                        onClick={() =>
                                                                                            handleSave(
                                                                                                s.id,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        Save
                                                                                    </button>
                                                                                    <button
                                                                                        className="text-xs text-gray-500"
                                                                                        onClick={() =>
                                                                                            setEditId(
                                                                                                null,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        Cancel
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        className="text-xs text-blue-600 mr-1"
                                                                                        onClick={() =>
                                                                                            handleEdit(
                                                                                                s,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        Edit
                                                                                    </button>
                                                                                    <button
                                                                                        className="text-xs text-red-600"
                                                                                        onClick={() =>
                                                                                            handleDelete(
                                                                                                s.id,
                                                                                            )
                                                                                        }
                                                                                    >
                                                                                        Delete
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ),
                                                            )
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
