"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";

type ProfileResponse = {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
    role?: string;
};

export default function PassengerProfilePage() {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    useEffect(() => {
        if (status !== "authenticated") return;

        const seededName = String((session?.user as any)?.name || "").trim();
        const seededEmail = String((session?.user as any)?.email || "").trim();
        const seededPhone = String((session?.user as any)?.phone || "").trim();
        if (seededName) setFullName(seededName);
        if (seededEmail) setEmail(seededEmail);
        if (seededPhone) setPhone(seededPhone);

        let active = true;
        (async () => {
            try {
                setLoading(true);
                const res = await fetch("/api/profile");
                if (!res.ok) {
                    const text = await res.text().catch(() => "");
                    throw new Error(text || "Failed to load profile.");
                }
                const data = (await res.json()) as ProfileResponse;
                if (!active) return;
                setFullName(data.fullName || "");
                setEmail(data.email || "");
                setPhone(data.phone || "");
            } catch (err: any) {
                if (active) setError(err?.message || "Failed to load profile.");
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [status, session]);

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (saving) return;
        setError("");
        setSuccess("");

        if (!fullName.trim() || !email.trim()) {
            setError("Full name and email are required.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        try {
            setSaving(true);
            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    phone: phone.trim(),
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                if (text.includes("email_exists")) {
                    throw new Error("This email is already in use.");
                }
                throw new Error(text || "Failed to update profile.");
            }

            setSuccess("Profile updated successfully.");
            await update();
        } catch (err: any) {
            setError(err?.message || "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <DashboardShell>
            <div className="w-full max-w-2xl px-4 py-4 md:px-8 lg:px-10">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                            My Profile
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Update your contact details for bookings.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.back()}
                    >
                        Back
                    </Button>
                </div>

                {loading && (
                    <div className="mt-4 rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        Loading profile...
                    </div>
                )}

                {!loading && error && (
                    <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <form
                        onSubmit={handleSave}
                        className="mt-4 rounded-2xl border bg-card p-6 space-y-4"
                    >
                        <div>
                            <label className="text-xs font-medium">
                                Full name
                            </label>
                            <input
                                value={fullName}
                                onChange={(event) =>
                                    setFullName(event.target.value)
                                }
                                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                                placeholder="Your full name"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">
                                Email address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium">
                                Phone number
                            </label>
                            <input
                                value={phone}
                                onChange={(event) =>
                                    setPhone(event.target.value)
                                }
                                className="mt-1 w-full rounded border bg-background px-3 py-2 text-sm"
                                placeholder="Optional"
                            />
                        </div>

                        {success && (
                            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                {success}
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <Button type="submit" disabled={saving}>
                                {saving ? "Saving..." : "Save changes"}
                            </Button>
                            <span className="text-xs text-muted-foreground">
                                Your booking form will use these details.
                            </span>
                        </div>
                    </form>
                )}
            </div>
        </DashboardShell>
    );
}
