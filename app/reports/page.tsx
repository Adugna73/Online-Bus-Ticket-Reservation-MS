"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ReportsRedirectPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;
        if (!session || !session.user) {
            router.replace("/login");
            return;
        }
        const roleKey = String((session.user as any)?.role || "").toLowerCase();
        const rolePath =
            roleKey === "admin"
                ? "admin"
                : roleKey === "manager"
                ? "manager"
                : roleKey === "supervisor"
                ? "supervisor"
                : "passenger";

        router.replace(`/${rolePath}/reports`);
    }, [session, status, router]);

    return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <div>Redirecting to reports...</div>
            </div>
        </div>
    );
}
