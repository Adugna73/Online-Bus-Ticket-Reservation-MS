"use client";
import React, { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
import {
    Home,
    BarChart3,
    Wrench,
    Layers,
    MapPin,
    Archive,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface Site {
    id: string;
    name: string;
    siteCode: string;

}

interface Staff {
    id: string;
    name: string;
    stations: Site[];
}

interface Organization {
    [region: string]: {
        regionCode: string;
        areas: {
            [zone: string]: Staff[];
        };
    };
}

export default function ManagerSitesSidebar() {
    // Sidebar for managers: styled and structured like SidebarV2, with collapse/expand button
    const [collapsed, setCollapsed] = React.useState(false);
    const [user, setUser] = useState<any>(null);
    const [regionName, setRegionName] = useState("");
    const [location, setLocation] = useState("");
    const [role, setRole] = useState("");

    useEffect(() => {
        fetch("/api/users/me")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (data) {
                    setUser(data);
                    setRegionName(
                        Array.isArray(data.assignedRegion) &&
                            data.assignedRegion.length > 0
                            ? data.locationCategory || data.assignedRegion[0]
                            : "",
                    );
                    setLocation(data.location || "");
                    setRole(data.role || "");
                }
            });
    }, []);

    const navItems = [
        {
            label: "Dashboard",
            href: "/manager/managerial-dashboard",
            icon: Home,
        },
        {
            label: "Reports",
            href: "/manager/reports",
            icon: BarChart3,
        },
        {
            label: "Maintenance",
            href: "/manager/maintenance",
            icon: Wrench,
        },
        {
            label: "Bookings",
            href: "/manager/bookings",
            icon: Layers,
        },
        {
            label: "Stations",
            href: "/manager/stations",
            icon: MapPin,
        },
        {
            label: "Archived",
            href: "/manager/archived",
            icon: Archive,
        },
    ];
    return (
        <aside
            className={`bg-background text-foreground border-r border-border h-screen fixed top-0 left-0 z-30 flex flex-col transition-all duration-200 ${collapsed ? "w-16" : "w-64"}`}
            style={{ minHeight: "100vh" }}
        >
            <div className="flex items-center h-14 border-b border-border px-2 relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background text-foreground text-xs font-bold">
                    BUS
                </div>
                <button
                    className="absolute -right-3 top-1/2 -translate-y-1/2 p-2 rounded-full shadow bg-background border border-border hover:bg-muted/50 transition"
                    aria-label={
                        collapsed ? "Expand sidebar" : "Collapse sidebar"
                    }
                    onClick={() => setCollapsed((c) => !c)}
                    style={{ zIndex: 40 }}
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1">
                    {navItems.map((item, idx) => (
                        <li key={item.href}>
                            <a
                                href={item.href}
                                className={`flex items-center px-4 py-2 rounded hover:bg-muted/10 font-medium ${collapsed ? "justify-center" : ""}`}
                            >
                                <item.icon className="h-5 w-5" />
                                {!collapsed && (
                                    <span className="sidebar-label ml-2">
                                        {item.label}
                                    </span>
                                )}
                                {collapsed && (
                                    <span className="sr-only">
                                        {item.label}
                                    </span>
                                )}
                            </a>
                        </li>
                    ))}
                    {/* Role/area indicator under Team */}
                    <li className="mt-2 h-12 flex items-center justify-center md:justify-start">
                        <div className="flex items-center justify-center md:justify-start w-full">
                            <UserCircle
                                className={
                                    collapsed ? "h-6 w-6" : "h-5 w-5 mr-2"
                                }
                            />
                            {!collapsed && (
                                <span className="text-xs text-gray-500">
                                    {[regionName, location, role]
                                        .filter(Boolean)
                                        .join("-")}
                                </span>
                            )}
                        </div>
                    </li>
                </ul>
            </nav>
        </aside>
    );
}
