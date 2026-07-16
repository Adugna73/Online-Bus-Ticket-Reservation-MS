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

    useEffect(() => {
        if (role === "passenger") {
            router.push("/bookings");
            return;
        }

        const fetchData = async () => {
            try {
                const sessUser: any = session?.user || {};
                const regionParam =
                    Array.isArray(sessUser.assignedRegion) &&
                    sessUser.assignedRegion[0]
                        ? `&regionId=${sessUser.assignedRegion[0]}`
                        : "";
                const zoneParam =
                    Array.isArray(sessUser.assignedZone) &&
                    sessUser.assignedZone[0]
                        ? `&zoneId=${sessUser.assignedZone[0]}`
                        : "";
                const [teamRes, usersRes, stationsRes, templatesRes] =
                    await Promise.all([
                        fetch("/api/team"),
                        // passengers should see only supervisors in the assign list
                        //; region/zone filtering will happen client‑side later depending
                        // on the selected area in the WorkOrderForm.
                        fetch("/api/users?role=supervisor"),
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

        fetchData();
    }, [role, router]);

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
            <div className="max-w-7xl mx-auto py-8 px-6">
                <h1 className="text-2xl font-semibold mb-6">
                    Create New Booking
                </h1>
                <div className="bg-background text-foreground rounded-lg shadow p-6">
                    <WorkOrderForm
                        team={team}
                        users={users}
                        stations={stations}
                        templates={templates}
                        onCreated={(wo) => {
                            router.push(
                                `/passenger/bookings?new=${
                                    wo?.id || wo?.taskNumber
                                }`,
                            );
                        }}
                    />
                </div>
            </div>
        </DashboardShell>
    );
}
