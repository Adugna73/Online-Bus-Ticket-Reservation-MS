"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AddMemberForm() {
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("PASSENGER");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const csrfRes = await fetch("/api/auth/csrf");
            const csrfData = await csrfRes.json();

            const res = await fetch("/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-token": csrfData.csrfToken,
                },
                body: JSON.stringify({ fullName, email, role, phone, password }),
            });

            if (!res.ok) {
                const data = await res.json();
                if (data.error === "unique_violation") {
                    alert("A user with that email or staff ID already exists.");
                } else {
                    alert(data.error || "Failed to create user");
                }
                setLoading(false);
                return;
            }

            router.push("/admin/users");
            router.refresh();
        } catch (err) {
            alert("Failed to create user");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
            />
            <Input
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <select
                className="h-10 w-full rounded border px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
            >
                <option value="PASSENGER">Passenger</option>
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
            </select>
            <Input
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
            />
            <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create"}
            </Button>
        </form>
    );
}
