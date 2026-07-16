"use client";

import { Fragment, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Trash2, UserPlus, X, Wrench, Users } from "lucide-react";

type User = {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    role: { key: string } | string;
    createdAt: string;
};

type GarageInfo = {
    id: string;
    name: string;
    city: string | null;
    owner: { id: string; fullName: string; email: string } | null;
    mechanics: { id: string; name: string; position: string; phone: string | null }[];
};

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    STAFF: "Staff",
    GARAGE_OWNER: "Garage Owner",
    DRIVER: "Driver",
    PASSENGER: "Passenger",
};

const ROLE_COLORS: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-700 border-purple-300",
    STAFF: "bg-blue-100 text-blue-700 border-blue-300",
    GARAGE_OWNER: "bg-amber-100 text-amber-700 border-amber-300",
    DRIVER: "bg-sky-100 text-sky-700 border-sky-300",
    PASSENGER: "bg-gray-100 text-gray-700 border-gray-300",
};

const ROLE_OPTIONS = [
    { value: "PASSENGER", label: "Passenger" },
    { value: "DRIVER", label: "Driver" },
    { value: "STAFF", label: "Staff" },
    { value: "GARAGE_OWNER", label: "Garage Owner" },
    { value: "ADMIN", label: "Admin" },
];

function getRoleKey(role: User["role"]): string {
    if (typeof role === "string") return role;
    return role?.key || "PASSENGER";
}

function roleEnumToKey(roleEnum: string): string {
    return roleEnum.toUpperCase();
}

export default function UsersClient() {
    const { data: session } = useSession();
    const role = (session?.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";

    const [users, setUsers] = useState<User[]>([]);
    const [garages, setGarages] = useState<GarageInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [showAddForm, setShowAddForm] = useState(false);
    const [newUser, setNewUser] = useState({
        fullName: "",
        email: "",
        phone: "",
        roleKey: "STAFF",
        password: "",
        garageId: "",
    });
    const [creating, setCreating] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const loadUsers = async () => {
        try {
            const res = await fetch("/api/users");
            if (!res.ok) throw new Error("Failed to load users");
            setUsers(await res.json());
        } catch (err: any) {
            setError(err?.message || "Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    const loadGarages = async () => {
        try {
            const res = await fetch("/api/garages");
            if (!res.ok) return;
            const data = await res.json();
            const enriched = await Promise.all(
                (data || []).map(async (g: any) => {
                    try {
                        const mRes = await fetch(`/api/mechanics?garageId=${g.id}`);
                        const mechanics = mRes.ok ? await mRes.json() : [];
                        return { ...g, mechanics };
                    } catch {
                        return { ...g, mechanics: [] };
                    }
                }),
            );
            setGarages(enriched);
        } catch {}
    };

    useEffect(() => {
        loadUsers();
        loadGarages();
    }, []);

    const handleCreate = async () => {
        setError(null);
        setSuccess(null);
        if (!newUser.fullName.trim() || !newUser.email.trim()) {
            setError("Name and email are required");
            return;
        }
        setCreating(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: newUser.fullName,
                    email: newUser.email,
                    phone: newUser.phone || undefined,
                    roleKey: newUser.roleKey.toLowerCase(),
                    password: newUser.password || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to create user");

            if (newUser.roleKey === "GARAGE_OWNER" && newUser.garageId) {
                await fetch("/api/garages", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: newUser.garageId, ownerId: data.id || data.userId }),
                });
            }

            setSuccess(`User "${newUser.fullName}" created successfully`);
            setNewUser({ fullName: "", email: "", phone: "", roleKey: "STAFF", password: "", garageId: "" });
            setShowAddForm(false);
            await loadUsers();
            await loadGarages();
        } catch (err: any) {
            setError(err?.message || "Failed to create user");
        } finally {
            setCreating(false);
        }
    };

    const handleRoleChange = async (id: string, newRole: string) => {
        setError(null);
        setSuccess(null);
        setUpdatingId(id);
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roleKey: newRole.toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to update role");
            setSuccess(`Role updated to ${ROLE_LABELS[newRole] || newRole}`);
            await loadUsers();
        } catch (err: any) {
            setError(err?.message || "Failed to update role");
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this user?")) return;
        setError(null);
        try {
            const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to delete user");
            await loadUsers();
        } catch (err: any) {
            setError(err?.message || "Failed to delete user");
        }
    };

    if (loading) {
        return (
            <div className="rounded border bg-card p-6 text-center text-muted-foreground">
                Loading users...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    {success}
                </div>
            )}

            {/* Add User Form */}
            {isAdmin && (
                <div className="rounded-lg border bg-card p-4">
                    {!showAddForm ? (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        >
                            <UserPlus className="h-4 w-4" /> Add New User
                        </button>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold">Create New User</h3>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Full name *"
                                    value={newUser.fullName}
                                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                                />
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Email *"
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                />
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Phone"
                                    value={newUser.phone}
                                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                                />
                                <input
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    placeholder="Password (default: bus@12345)"
                                    type="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                />
                                <select
                                    className="h-10 w-full rounded border px-3 text-sm"
                                    value={newUser.roleKey}
                                    onChange={(e) => setNewUser({ ...newUser, roleKey: e.target.value })}
                                >
                                    {ROLE_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                                {newUser.roleKey === "GARAGE_OWNER" && (
                                    <select
                                        className="h-10 w-full rounded border px-3 text-sm"
                                        value={newUser.garageId}
                                        onChange={(e) => setNewUser({ ...newUser, garageId: e.target.value })}
                                    >
                                        <option value="">No garage (assign later)</option>
                                        {garages
                                            .filter((g) => !g.owner)
                                            .map((g) => (
                                                <option key={g.id} value={g.id}>
                                                    {g.name} {g.city ? `(${g.city})` : ""}
                                                </option>
                                            ))}
                                        {garages.filter((g) => !g.owner).length === 0 && (
                                            <option value="" disabled>All garages have owners — create one on Maintenance page</option>
                                        )}
                                    </select>
                                )}
                                <button
                                    onClick={handleCreate}
                                    disabled={creating}
                                    className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {creating ? "Creating..." : "Create User"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Users Table */}
            <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                        <tr className="text-left">
                            <th className="px-3 py-2 font-semibold">Name</th>
                            <th className="px-3 py-2 font-semibold">Email</th>
                            <th className="px-3 py-2 font-semibold">Phone</th>
                            <th className="px-3 py-2 font-semibold">Role</th>
                            {isAdmin && <th className="px-3 py-2 font-semibold">Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {users.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 5 : 4} className="px-3 py-8 text-center text-muted-foreground">
                                    No users found.
                                </td>
                            </tr>
                        ) : (
                            users.map((u) => {
                                const roleKey = getRoleKey(u.role);
                                const isCurrentUser = session?.user?.id === u.id;
                                return (
                                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                                        <td className="px-3 py-2 font-medium">
                                            {u.fullName}
                                            {isCurrentUser && (
                                                <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">{u.email}</td>
                                        <td className="px-3 py-2">{u.phone || "—"}</td>
                                        <td className="px-3 py-2">
                                            {isAdmin && !isCurrentUser ? (
                                                <select
                                                    value={roleEnumToKey(roleKey)}
                                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                    disabled={updatingId === u.id}
                                                    className={`h-8 rounded border px-2 text-xs font-medium disabled:opacity-50 ${
                                                        ROLE_COLORS[roleEnumToKey(roleKey)] || ""
                                                    }`}
                                                >
                                                    {ROLE_OPTIONS.map((r) => (
                                                        <option key={r.value} value={r.value}>{r.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span
                                                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                                        ROLE_COLORS[roleKey] ||
                                                        "bg-gray-100 text-gray-700 border-gray-300"
                                                    }`}
                                                >
                                                    {ROLE_LABELS[roleKey] || roleKey}
                                                </span>
                                            )}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-3 py-2">
                                                {!isCurrentUser && roleKey !== "ADMIN" && (
                                                    <button
                                                        onClick={() => handleDelete(u.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Delete user"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Garage Owners & Mechanics */}
            {isAdmin && garages.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mt-6">
                        <Wrench className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold">Garage Owners & Mechanics</h2>
                    </div>
                    {garages.map((g) => (
                        <div key={g.id} className="rounded-lg border bg-card">
                            <div className="border-b bg-muted/30 px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="font-semibold">{g.name}</span>
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            {g.city || "—"}
                                        </span>
                                    </div>
                                    {g.owner && (
                                        <span className="text-xs text-muted-foreground">
                                            Owner: {g.owner.fullName} ({g.owner.email})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="p-4">
                                {g.mechanics.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No mechanics registered yet.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs text-muted-foreground border-b">
                                                    <th className="pb-2 font-medium">Name</th>
                                                    <th className="pb-2 font-medium">Position</th>
                                                    <th className="pb-2 font-medium">Phone</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {g.mechanics.map((m) => (
                                                    <tr key={m.id} className="border-b last:border-0">
                                                        <td className="py-2">{m.name}</td>
                                                        <td className="py-2">
                                                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                                                {m.position}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-xs text-muted-foreground">
                                                            {m.phone || "—"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
