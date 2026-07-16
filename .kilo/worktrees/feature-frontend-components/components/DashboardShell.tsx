"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PanelLeftOpen, PanelLeftClose } from "lucide-react";
import SidebarV2 from "./SidebarV2";

interface DashboardShellProps {
    children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const isNoAccess =
        (session?.user as any)?.role &&
        String((session?.user as any).role).toLowerCase() === "no-access";

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem("sidebar-collapsed");
            if (stored != null) setCollapsed(stored === "true");
        } catch {}
    }, []);

    const toggle = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem("sidebar-collapsed", String(next));
            } catch {}
            return next;
        });
    };

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/login");
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center text-muted-foreground">
                Loading...
            </div>
        );
    }

    return (
        <div className="flex min-h-screen text-[13px] leading-tight">
            {/* Desktop sidebar only; hidden on small screens to avoid overlap with header/mobile menu */}
            {!isNoAccess && (
                <div className="hidden md:block ml-2">
                    <SidebarV2 collapsedOverride={collapsed} />
                </div>
            )}
            <div className="flex flex-1 flex-col">
                {/* Optional local toggle for collapsing desktop sidebar (desktop only) */}
                {!isNoAccess && (
                    <div className="hidden md:flex items-center px-3 pt-2 md:px-5 lg:px-6">
                        <button
                            type="button"
                            onClick={toggle}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background text-muted-foreground hover:bg-muted"
                            aria-label={
                                collapsed
                                    ? "Expand sidebar"
                                    : "Collapse sidebar"
                            }
                        >
                            {collapsed ? (
                                <PanelLeftOpen className="h-4 w-4" />
                            ) : (
                                <PanelLeftClose className="h-4 w-4" />
                            )}
                        </button>
                    </div>
                )}
                <main className="flex-1 px-3 pb-4 pt-2 md:px-5 lg:px-6 overflow-y-auto text-[13px] leading-snug">
                    {children}
                </main>
            </div>
        </div>
    );
}
