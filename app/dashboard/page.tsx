"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function DashboardRedirectPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;
        if (!session || !session.user) {
            router.replace("/login");
            return;
        }
        const roleKey = String((session.user as any)?.role || "").toLowerCase();

        const redirectPath =
            roleKey === "admin"
                ? "/admin/dashboard"
                : roleKey === "staff" || roleKey === "supervisor"
                  ? "/supervisor/dashboard"
                  : roleKey === "manager"
                    ? "/manager/managerial-dashboard"
                    : roleKey === "mechanic"
                      ? "/mechanic/tasks"
                      : roleKey === "garage_owner"
                        ? "/garage-owner/dashboard"
                        : roleKey === "driver"
                          ? "/driver/bus"
                          : roleKey === "passenger"
                            ? "/passenger/bookings"
                            : null;

        if (!redirectPath) {
            router.replace("/no-access");
            return;
        }

        router.replace(redirectPath);
    }, [session, status, router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <div>Redirecting to your dashboard...</div>
            </div>
        </div>
    );
}
