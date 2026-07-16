"use client";
import React, { useEffect, useState } from "react";

export default function MaintenanceClient() {
    const [categories, setCategories] = useState<any[]>([]);
    const [team, setTeam] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        null,
    );
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [teamId, setTeamId] = useState("");
    const [assignedToId, setAssignedToId] = useState("");
    const [planned, setPlanned] = useState(true);
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        (async () => {
            const [cR, tR, uR, tmplR] = await Promise.all([
                fetch("/api/maintenance/categories"),
                fetch("/api/team"),
                fetch("/api/users"),
                fetch("/api/maintenance/templates"),
            ]);
            if (cR.ok) setCategories(await cR.json());
            if (tR.ok) setTeam(await tR.json());
            if (uR.ok) setUsers(await uR.json());
            if (tmplR.ok) setTemplates(await tmplR.json());
        })();
    }, []);

    useEffect(() => {
        if (!selectedCategory) return;
        fetch(`/api/workorders?type=${encodeURIComponent(selectedCategory)}`)
            .then((r) => r.json())
            .then((d) => setWorkOrders(d || []));
    }, [selectedCategory]);

    const createWorkOrder = async () => {
        setLoading(true);
        try {
            if (!title) return alert("title required");
            const body = {
                title,
                description,
                type: selectedCategory || "pm",
                planned,
                teamId: teamId || undefined,
                assignedToId: assignedToId || undefined,
                siteId: "",
            };
            const r = await fetch("/api/workorders", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!r.ok) {
                const t = await r.text();
                alert("failed: " + t);
                setLoading(false);
                return;
            }
            const created = await r.json();
            setWorkOrders((cur) => [created, ...cur]);
            setTitle("");
            setDescription("");
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <div className="bg-background text-foreground p-4 rounded shadow">
                <h3 className="font-semibold mb-3">
                    Maintenance Categories & Create Task
                </h3>
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="w-full md:w-1/3">
                        <select
                            className="w-full"
                            value={selectedCategory || ""}
                            onChange={(e) =>
                                setSelectedCategory(e.target.value || null)
                            }
                        >
                            <option value="">Select category</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                        <div className="mt-2">
                            <div className="flex gap-2 items-center">
                                <select
                                    value={""}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                    }}
                                    className="w-full"
                                >
                                    <option value="">Use template</option>
                                    {templates.map((tm) => (
                                        <option key={tm.id} value={tm.name}>
                                            {tm.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="text-sm text-muted-foreground">
                                    {templates.length > 0 ? (
                                        <div className="flex gap-2 flex-wrap">
                                            {templates
                                                .slice(0, 5)
                                                .map((t: any) => (
                                                    <a
                                                        key={t.id}
                                                        href={`/maintenance/${t.id}`}
                                                        className="underline text-primary"
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        View {t.name}
                                                    </a>
                                                ))}
                                            {templates.length > 5 ? (
                                                <span className="text-xs">
                                                    +{templates.length - 5} more
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <span className="text-xs">
                                            No templates
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1">
                        <input
                            className="w-full mb-2"
                            placeholder="Title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                        <textarea
                            className="w-full mb-2"
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select
                                value={teamId}
                                onChange={(e) => setTeamId(e.target.value)}
                            >
                                <option value="">Select team</option>
                                {team.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={assignedToId}
                                onChange={(e) =>
                                    setAssignedToId(e.target.value)
                                }
                            >
                                <option value="">Assign to</option>
                                {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.fullName || u.username}
                                    </option>
                                ))}
                            </select>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={planned}
                                    onChange={(e) =>
                                        setPlanned(e.target.checked)
                                    }
                                />{" "}
                                Planned
                            </label>
                        </div>
                        <div className="pt-2">
                            <button
                                className="ossBtn"
                                onClick={createWorkOrder}
                                disabled={loading}
                            >
                                {loading ? "Creating..." : "Create Task"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-3">
                    Bookings for {selectedCategory || "All"}
                </h3>
                <div>
                    {workOrders.map((wo) => (
                        <div
                            key={wo.id}
                            className="py-2 border-b last:border-b-0"
                        >
                            <div className="font-medium">{wo.title}</div>
                            <div className="text-sm text-gray-600">
                                {wo.type} — {wo.status}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
