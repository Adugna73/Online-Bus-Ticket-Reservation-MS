"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Users, Plus, Pencil, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type Mechanic = {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    position: string;
    _count: { maintenances: number };
};

const POSITION_OPTIONS = [
    "General Mechanic",
    "Electrician",
    "Body Work",
    "Painter",
    "Engine Specialist",
    "Transmission Specialist",
    "Brake Specialist",
    "AC Specialist",
    "Diagnostic Technician",
    "Tire Specialist",
];

export default function MechanicsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { toast } = useToast();
    const [mechanics, setMechanics] = useState<Mechanic[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [position, setPosition] = useState("");

    const loadMechanics = async () => {
        try {
            const res = await fetch("/api/mechanics", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to load");
            setMechanics(await res.json());
        } catch (e) {
            toast({ title: "Error", description: "Failed to load mechanics", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === "unauthenticated") { router.replace("/login"); return; }
        if (status !== "authenticated") return;
        loadMechanics();
    }, [status, router]);

    const resetForm = () => {
        setName(""); setPhone(""); setEmail(""); setPosition("");
        setEditId(null); setShowForm(false);
    };

    const handleEdit = (m: Mechanic) => {
        setName(m.name);
        setPhone(m.phone || "");
        setEmail(m.email || "");
        setPosition(m.position);
        setEditId(m.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !position) return;

        setSubmitting(true);
        try {
            const method = editId ? "PATCH" : "POST";
            const body = editId
                ? JSON.stringify({ id: editId, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, position })
                : JSON.stringify({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, position });

            const res = await fetch("/api/mechanics", {
                method,
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body,
            });

            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d?.error || "Failed");
            }

            toast({ title: editId ? "Mechanic updated" : "Mechanic added" });
            resetForm();
            await loadMechanics();
        } catch (err: any) {
            toast({ title: "Error", description: err?.message || "Failed", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remove this mechanic?")) return;
        try {
            const res = await fetch(`/api/mechanics?id=${id}`, { method: "DELETE", credentials: "include" });
            if (!res.ok) throw new Error("Failed");
            toast({ title: "Mechanic removed" });
            await loadMechanics();
        } catch {
            toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-semibold text-blue-700">
                            <Users className="h-3.5 w-3.5" /> Mechanics
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-tight">My Mechanics</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Manage your repair team.</p>
                    </div>
                    <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="sm">
                        <Plus className="h-4 w-4" /> Add Mechanic
                    </Button>
                </div>

                {showForm && (
                    <Card className="mb-6">
                        <CardHeader><CardTitle>{editId ? "Edit Mechanic" : "Add Mechanic"}</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Name *</label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Position *</label>
                                    <select
                                        className="h-10 w-full rounded border px-3 text-sm bg-background"
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        required
                                    >
                                        <option value="">Select position</option>
                                        {POSITION_OPTIONS.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Phone</label>
                                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Email *</label>
                                    <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mechanic@example.com" type="email" required />
                                </div>
                                <div className="md:col-span-2 flex justify-end gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
                                    <Button type="submit" size="sm" disabled={submitting}>
                                        {submitting ? "Saving..." : editId ? "Update" : "Add"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {mechanics.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                            <p className="font-medium">No mechanics yet</p>
                            <p className="mt-1 text-xs">Add your first mechanic to start assigning tasks.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {mechanics.map((m) => (
                            <Card key={m.id}>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{m.name}</CardTitle>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
                                                <Trash2 className="h-3 w-3 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="text-xs text-muted-foreground space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[10px]">{m.position}</Badge>
                                        <Badge variant="outline" className="text-[10px]">{m._count.maintenances} tasks</Badge>
                                    </div>
                                    {m.phone && <div>Phone: {m.phone}</div>}
                                    {m.email && <div>Email: {m.email}</div>}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
