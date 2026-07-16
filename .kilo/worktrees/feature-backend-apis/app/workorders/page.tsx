"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WorkOrdersRedirect() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;

        if (session?.user) {
            const role = String((session.user as any).role || "").toLowerCase();
            const rolePath =
                role === "admin"
                    ? "admin"
                    : role === "manager"
                      ? "manager"
                      : role === "supervisor"
                        ? "supervisor"
                        : "passenger";
            router.replace(`/${rolePath}/bookings`);
        } else {
            router.replace("/login");
        }
    }, [session, status, router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-600">Redirecting...</p>
            </div>
        </div>
    );
}
