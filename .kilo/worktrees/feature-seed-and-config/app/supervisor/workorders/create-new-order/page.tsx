"use client";

import WorkOrderForm from "@/components/WorkOrderForm";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";

export default function CreateWorkOrderPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [team, setTeam] = useState([]);
    const [users, setUsers] = useState([]);
    const [stations, setSites] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    const roleRaw = (session?.user as any)?.role ?? "";
    const role = String(roleRaw).toLowerCase();
    const rolePath =
        role === "admin"
            ? "admin"
            : role === "manager"
              ? "manager"
              : role === "supervisor"
                ? "supervisor"
                : "passenger";

    // Muhaba-style data loading: fetch full lists and let WorkOrderForm
    // apply all manager/supervisor scoping (including AAZ/HQ supervisors).
    const fetchData = async () => {
        try {
            const [teamRes, usersRes, stationsRes, templatesRes] =
                await Promise.all([
                    fetch("/api/team"),
                    fetch("/api/users"),
                    fetch("/api/stations"),
                    fetch("/api/maintenance/templates"),
                ]);

            if (teamRes.ok) setTeam(await teamRes.json());
            if (usersRes.ok) setUsers(await usersRes.json());
            if (stationsRes.ok) setSites(await stationsRes.json());
            if (templatesRes.ok) setTemplates(await templatesRes.json());
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (role === "passenger") {
            router.push(`/${rolePath}/bookings`);
            return;
        }

        fetchData();

        // Keep supervisor lists fresh when they return to the tab
        const handleFocus = () => fetchData();
        window.addEventListener("focus", handleFocus);
        return () => window.removeEventListener("focus", handleFocus);
    }, [role, rolePath, router]);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-8 px-6">
                <div className="text-center">
                    <p className="text-foreground bg-background">Loading...</p>
                </div>
            </div>
        );
    }

    if (role === "passenger") {
        return null; // Will redirect
    }

    return (
        <DashboardShell>
            <div className="max-w-7xl mx-auto py-0 px-6">
                <h1 className="text-2xl font-semibold mb-2">
                    Create New Booking
                </h1>
                <div className="bg-background text-foreground rounded-lg shadow p-6">
                    <div className="flex justify-end mb-2">
                        <button
                            type="button"
                            onClick={() => {
                                setLoading(true);
                                fetchData();
                            }}
                            className="text-xs text-primary hover:underline"
                        >
                            Refresh lists
                        </button>
                    </div>
                    <WorkOrderForm
                        team={team}
                        users={users}
                        stations={stations}
                        templates={templates}
                        onCreated={(wo) => {
                            router.push(
                                `/${rolePath}/bookings?new=${wo?.id || wo?.taskNumber}`,
                            );
                        }}
                    />
                </div>
            </div>
        </DashboardShell>
    );
}
