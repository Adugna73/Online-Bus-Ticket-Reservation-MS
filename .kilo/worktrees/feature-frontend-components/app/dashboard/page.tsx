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
        const seeded = Boolean((session.user as any)?.seeded);

        // Only allow known roles to be redirected. Treat missing/unknown role as
        // no-access so seeded staff aren't defaulted to 'passenger'.
        if (
            !roleKey ||
            ![
                "admin",
                "staff",
                "passenger",
                "manager",
                "supervisor",
                "passenger",
            ].includes(roleKey)
        ) {
            router.replace("/no-access");
            return;
        }

        const rolePath =
            roleKey === "admin"
                ? "admin"
                : roleKey === "staff"
                  ? "supervisor"
                  : roleKey === "passenger"
                    ? "passenger"
                    : roleKey === "manager"
                      ? "manager"
                      : roleKey === "supervisor"
                        ? "supervisor"
                        : "passenger";

        if (rolePath === "manager") {
            router.replace(`/${rolePath}/managerial-dashboard`);
        } else {
            router.replace(`/${rolePath}/dashboard`);
        }
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
