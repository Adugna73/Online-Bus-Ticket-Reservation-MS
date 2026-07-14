"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    Clipboard,
    Home,
    Layers,
    MapPin,
    Users,
    Wrench,
    User,
    CreditCard,
    Headphones,
    Radio,
    Accessibility,
    Sparkles,
    Package,
    Compass,
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/lib/i18n/I18nProvider";

type MenuItem = {
    titleKey: string;
    labelKeyOverride?: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    roles?: Array<
        "admin" | "staff" | "passenger" | "manager" | "supervisor" | "mechanic"
    >;
};

function mapRolePath(roleKey: string) {
    if (roleKey === "admin") return "admin";
    if (roleKey === "staff") return "supervisor";
    if (roleKey === "passenger") return "passenger";
    if (roleKey === "mechanic") return "mechanic";
    return roleKey || "passenger";
}

export default function SidebarV2({
    mobile,
    collapsedOverride,
    onNavigate,
}: {
    mobile?: boolean;
    collapsedOverride?: boolean;
    onNavigate?: () => void;
} = {}) {
    const { data: session } = useSession();
    const path = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { t } = useI18n();

    const roleKey = String((session?.user as any)?.role || "").toLowerCase();
    if (roleKey === "no-access") return null;

    const rolePath = mapRolePath(roleKey);
    const dashboardHref = `/${rolePath}/dashboard`;

    useEffect(() => {
        try {
            const v = localStorage.getItem("sidebar-collapsed");
            if (v !== null) setCollapsed(v === "true");
        } catch (e) {
            // ignore persisted state errors
        }
    }, []);

    useEffect(() => {
        if (typeof collapsedOverride === "boolean") {
            setCollapsed(collapsedOverride);
        }
    }, [collapsedOverride]);

    if (!session || !session.user) return null;

    const menu: MenuItem[] = [
        {
            titleKey: "nav.dashboard",
            href: dashboardHref,
            icon: Home,
            roles: ["admin", "staff", "manager", "supervisor"],
        },
        {
            titleKey: "nav.maintenance",
            href: `/${rolePath}/maintenance`,
            icon: Wrench,
            roles: ["admin", "staff", "manager", "supervisor", "mechanic"],
        },
        {
            titleKey: "nav.bookNow",
            labelKeyOverride:
                roleKey === "passenger" ? undefined : "nav.bookForPassenger",
            href: "/passenger/book-now",
            icon: Compass,
            roles: ["passenger", "admin", "staff", "supervisor"],
        },
        {
            titleKey: "nav.myBookings",
            labelKeyOverride:
                roleKey === "passenger" ? undefined : "nav.bookings",
            href:
                roleKey === "passenger"
                    ? "/passenger/bookings"
                    : `/${rolePath}/bookings`,
            icon: Clipboard,
            roles: ["admin", "staff", "manager", "supervisor", "passenger"],
        },
        {
            titleKey: "nav.payments",
            href: "/passenger/payments",
            icon: CreditCard,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.tracking",
            href: "/passenger/tracking",
            icon: Radio,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.support",
            href: "/passenger/support",
            icon: Headphones,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.rewards",
            href: "/passenger/rewards",
            icon: Sparkles,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.social",
            href: "/passenger/social",
            icon: Users,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.services",
            href: "/passenger/services",
            icon: Package,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.accessibility",
            href: "/passenger/accessibility",
            icon: Accessibility,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.channels",
            href: "/passenger/channels",
            icon: Radio,
            roles: ["passenger"],
        },
        {
            titleKey: "nav.features",
            href: "/features",
            icon: Layers,
            roles: ["admin", "staff", "manager", "supervisor", "passenger"],
        },
        {
            titleKey: "nav.buses",
            href: `/${rolePath}/buses`,
            icon: Layers,
            roles: ["admin", "staff", "supervisor"],
        },
        {
            titleKey: "nav.routes",
            href: `/${rolePath}/routes`,
            icon: MapPin,
            roles: ["admin", "staff", "manager", "supervisor"],
        },
        {
            titleKey: "nav.reports",
            href: `/${rolePath}/reports`,
            icon: BarChart3,
            roles: ["admin", "staff", "manager", "supervisor"],
        },
        {
            titleKey: "nav.users",
            href: "/admin/users",
            icon: Layers,
            roles: ["admin"],
        },
        {
            titleKey: "nav.profile",
            href: "/passenger/profile",
            icon: User,
            roles: ["passenger"],
        },
    ];

    const visibleMenu = menu.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        return item.roles.includes(roleKey as any);
    });

    const handleNavigate = () => {
        try {
            onNavigate && onNavigate();
        } catch (e) {
            // ignore navigation callback errors
        }
    };

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        try {
            localStorage.setItem("sidebar-collapsed", String(next));
        } catch (e) {
            // ignore persisted state errors
        }
    };

    return (
        <Sidebar
            className={mobile ? "w-full" : ""}
            collapsible={collapsed ? "icon" : "none"}
        >
            <SidebarHeader>
                <div className="flex items-center justify-between">
                    {!collapsed && (
                        <div className="text-sm font-semibold">Navigation</div>
                    )}
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded border text-xs text-muted-foreground hover:bg-muted"
                        aria-label={
                            collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                        title={collapsed ? "Expand" : "Collapse"}
                    >
                        {collapsed ? ">" : "<"}
                    </button>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {visibleMenu.map((item) => {
                        const Icon = item.icon;
                        const isActive =
                            path === item.href ||
                            path?.startsWith(`${item.href}/`);
                        return (
                            <SidebarMenuItem key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={handleNavigate}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`flex items-center gap-3 px-2 py-2 rounded border border-transparent transition ${
                                        isActive
                                            ? "bg-muted/30 border-muted text-foreground"
                                            : "hover:bg-muted/10"
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {!collapsed && (
                                        <span className="sidebar-label">
                                            {t(item.labelKeyOverride || item.titleKey)}
                                        </span>
                                    )}
                                </Link>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
    );
}
