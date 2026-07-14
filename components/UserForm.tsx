"use client";
import React, { useState, useEffect } from "react";
import { X, Save, User, Mail, Phone, MapPin } from "lucide-react";

type RoleKey = "admin" | "supervisor" | "passenger" | "mechanic";

interface Station {
    id: string;
    name: string;
    code: string;
}

interface UserFormProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    user?: any;
    mode: "create" | "edit";
    defaultRole?: RoleKey;
    isAdmin?: boolean;
}

interface FormState {
    fullName: string;
    email: string;
    phone: string;
    roleKey: RoleKey;
    stationId: string;
    password: string;
}

const ROLE_LABELS: Record<RoleKey, string> = {
    admin: "Admin",
    supervisor: "Staff",
    passenger: "Passenger",
    mechanic: "Mechanic",
};

function roleKeyToEnum(roleKey: RoleKey): string {
    switch (roleKey) {
        case "admin":
            return "ADMIN";
        case "supervisor":
            return "STAFF";
        case "passenger":
            return "PASSENGER";
        case "mechanic":
            return "MECHANIC";
    }
}

function enumToRoleKey(roleEnum: string): RoleKey {
    const rk = String(roleEnum || "").toUpperCase();
    if (rk === "ADMIN") return "admin";
    if (rk === "STAFF") return "supervisor";
    if (rk === "MECHANIC") return "mechanic";
    return "passenger";
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
    const [formData, setFormData] = useState<FormState>({
        fullName: "",
        email: "",
        phone: "",
        roleKey: (defaultRole || "supervisor") as RoleKey,
        stationId: "",
        password: "",
    });
    const [stations, setStations] = useState<Station[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        fetch("/api/stations")
            .then((res) => res.json())
            .then((data) => setStations(Array.isArray(data) ? data : []))
            .catch(() => setStations([]));

        if (mode === "edit" && user) {
            const roleKey = enumToRoleKey(
                typeof user.role === "string"
                    ? user.role
                    : user.role?.key || "",
            );
            setFormData({
                fullName: user.fullName || "",
                email: user.email || "",
                phone: user.phone || "",
                roleKey,
                stationId: user.stationId || "",
                password: "",
            });
        } else {
            setFormData({
                fullName: "",
                email: "",
                phone: "",
                roleKey: (defaultRole || "supervisor") as RoleKey,
                stationId: "",
                password: "",
            });
        }
    }, [isOpen, mode, user, defaultRole]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload: any = {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone || null,
            roleKey: formData.roleKey,
            stationId: formData.stationId || null,
        };
        if (mode === "create" && formData.password) {
            payload.password = formData.password;
        }

        try {
            const url = mode === "edit" ? `/api/users/${user.id}` : "/api/users";
            const method = mode === "edit" ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
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

    if (!isOpen) return null;

    const showStation = formData.roleKey !== "passenger";

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 text-foreground">
            <div className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-background text-foreground shadow-xl">
                <div className="flex items-center justify-between border-b border-border p-4 sm:p-6">
                    <h2 className="text-xl font-semibold">
                        {mode === "create" ? "Add New" : "Edit"}{" "}
                        {ROLE_LABELS[formData.roleKey]}
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
                                Email *
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    required
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

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1">
                                Phone
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            phone: e.target.value,
                                        }))
                                    }
                                    className="w-full pl-10 pr-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter phone number"
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
                                <option value="mechanic">Mechanic</option>
                                {isAdmin && (
                                    <option value="admin">Admin</option>
                                )}
                            </select>
                        </div>

                        {/* Station (not for passengers) */}
                        {showStation && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    <MapPin className="inline h-4 w-4 mr-1" />
                                    Assigned Station
                                </label>
                                <select
                                    value={formData.stationId}
                                    onChange={(e) =>
                                        setFormData((prev) => ({
                                            ...prev,
                                            stationId: e.target.value,
                                        }))
                                    }
                                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">No station assigned</option>
                                    {stations.map((station) => (
                                        <option
                                            key={station.id}
                                            value={station.id}
                                        >
                                            {station.name} ({station.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Password (only for create mode) */}
                        {mode === "create" && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Password (leave empty for default: bus@12345)
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
