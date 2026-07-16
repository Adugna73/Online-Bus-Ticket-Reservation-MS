"use client";

import React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, LogOut, Menu } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { createPortal } from "react-dom";
import LocaleSwitcher from "./LocaleSwitcher";
import { useI18n } from "@/lib/i18n/I18nProvider";

export default function Header() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const { data: session } = useSession();
    const [mounted, setMounted] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { t } = useI18n();

    useEffect(() => setMounted(true), []);
    const router = useRouter();

    const roleKey = String((session?.user as any)?.role || "").toLowerCase();
    const homeHref =
        roleKey === "garage_owner" ? "/garage-owner/dashboard" :
        roleKey === "admin" ? "/admin/dashboard" :
        roleKey === "supervisor" || roleKey === "staff" ? "/supervisor/dashboard" :
        roleKey === "mechanic" ? "/mechanic/tasks" :
        "/passenger/bookings";

    const isDark = mounted ? resolvedTheme === "dark" : false;
    const { toast } = useToast();

    const handleSignOut = async () => {
        try {
            window.localStorage.removeItem("passengerDashboardView");
        } catch (e) {}
        try {
            await signOut({ redirect: false });
        } catch (e) {
            // still try to navigate
        }
        try {
            // show a quick toast then navigate so user sees confirmation
            try {
                toast({ title: t("auth.signedOut") });
            } catch (e) {}
        } catch (e) {}
        setTimeout(() => router.replace("/login"), 700);
    };

    // If not authenticated, render a minimal header (keep hooks order stable)
    if (!session || !session.user) {
        return (
            <header
                className={`py-4 px-6 bg-background text-foreground backdrop-blur-sm`}
            >
                <div className="w-full flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3">
                        <span className="font-semibold text-lg">
                            {t("common.appName")}
                        </span>
                    </Link>
                    <nav>
                        <ul className="flex items-center gap-4">
                            <li><LocaleSwitcher compact /></li>
                            <li>
                                <div className="flex items-center gap-4">
                                    <button
                                        aria-label={
                                            isDark
                                                ? "Switch to light mode"
                                                : "Switch to dark mode"
                                        }
                                        onClick={() =>
                                            setTheme(isDark ? "light" : "dark")
                                        }
                                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent/60 transition-colors"
                                    >
                                        <Sun
                                            className={`h-4 w-4 ${
                                                isDark
                                                    ? "opacity-40"
                                                    : "opacity-100"
                                            }`}
                                        />
                                        <span className="w-10 h-5 rounded-full bg-muted relative">
                                            <span
                                                className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-card shadow transition-transform duration-200 border border-border ${
                                                    isDark
                                                        ? "translate-x-5"
                                                        : "translate-x-0"
                                                }`}
                                            />
                                        </span>
                                        <Moon
                                            className={`h-4 w-4 ${
                                                isDark
                                                    ? "opacity-100"
                                                    : "opacity-40"
                                            }`}
                                        />
                                    </button>
                                </div>
                            </li>
                        </ul>
                    </nav>
                </div>
            </header>
        );
    }

    return (
        <header
            className={`py-4 px-6 bg-background text-foreground backdrop-blur-sm`}
        >
            <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Mobile burger button */}
                    <button
                        className="md:hidden p-2 rounded hover:bg-base-hover bg-background"
                        aria-label="Open menu"
                        onClick={() => setMobileOpen(true)}
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    {/* Hide left logo on mobile to avoid duplication with center logo */}
                    <Link
                        href={homeHref}
                        className="hidden md:flex items-center gap-3"
                    >
                        <span className="font-semibold text-lg">
                            {t("common.appName")}
                        </span>
                    </Link>
                </div>

                <nav>
                    <ul className="flex items-center gap-4">
                        <li className="flex items-center gap-2">
                            {/* Welcome message with username + countdown */}
                            <span className="text-base md:text-lg font-semibold text-primary">
                                {t("auth.welcome")}
                                {session.user?.name ? (
                                    <>
                                        <span className="md:hidden">
                                            {`, ${
                                                String(session.user.name)
                                                    .trim()
                                                    .split(/\s+/)[0]
                                            }`}
                                        </span>
                                        <span className="hidden md:inline">
                                            {`, ${session.user.name}`}
                                        </span>
                                    </>
                                ) : (
                                    ""
                                )}
                            </span>
                        </li>
                        {!session && (
                            <li>
                                <Link
                                    href="/login"
                                    className="text-sm text-muted"
                                >
                                    {t("auth.login")}
                                </Link>
                            </li>
                        )}
                        {session && (
                            <li>
                                <div className="flex items-center gap-2">
                                    <button
                                        aria-label="Logout"
                                        onClick={handleSignOut}
                                        className="inline-flex items-center justify-center gap-1 rounded-full border border-destructive bg-destructive/10 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/30 transition-colors"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        <span className="hidden sm:inline">
                                            {t("auth.logout")}
                                        </span>
                                    </button>
                                </div>
                            </li>
                        )}
                        <li><LocaleSwitcher compact /></li>
                        <li>
                            <button
                                aria-label={
                                    isDark
                                        ? "Switch to light mode"
                                        : "Switch to dark mode"
                                }
                                onClick={() =>
                                    setTheme(isDark ? "light" : "dark")
                                }
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent/60 transition-colors"
                            >
                                <Sun
                                    className={`h-4 w-4 ${
                                        isDark ? "opacity-40" : "opacity-100"
                                    }`}
                                />
                                <span className="w-10 h-5 rounded-full bg-muted relative">
                                    <span
                                        className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-card shadow transition-transform duration-200 border border-border ${
                                            isDark
                                                ? "translate-x-5"
                                                : "translate-x-0"
                                        }`}
                                    />
                                </span>
                                <Moon
                                    className={`h-4 w-4 ${
                                        isDark ? "opacity-100" : "opacity-40"
                                    }`}
                                />
                            </button>
                        </li>
                    </ul>
                </nav>
            </div>
            {/* Mobile sidebar drawer is rendered here so it layers under header */}
            <React.Suspense fallback={null}>
                {mobileOpen && (
                    // dynamic import to avoid circular during SSR
                    // use client-only component
                    <MobileSidebarWrapper
                        onClose={() => setMobileOpen(false)}
                    />
                )}
            </React.Suspense>
        </header>
    );
}

function MobileSidebarWrapper({ onClose }: { onClose: () => void }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    // lazy require to avoid server import and potential SSR issues
    const MobileSidebar = require("./MobileSidebar").default;

    return createPortal(
        <MobileSidebar open={true} onClose={onClose} />,
        document.body,
    );
}
