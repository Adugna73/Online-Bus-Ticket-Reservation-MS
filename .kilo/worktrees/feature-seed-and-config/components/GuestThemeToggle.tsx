"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useSession } from "next-auth/react";

export default function GuestThemeToggle({
    inline = false,
}: {
    inline?: boolean;
}) {
    const { data: session } = useSession();
    const { setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Only show for guests
    if (session && session.user) return null;

    const isDark = mounted ? resolvedTheme === "dark" : false;

    const button = (
        <button
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent/60 transition-colors"
        >
            <Sun
                className={`h-4 w-4 ${isDark ? "opacity-40" : "opacity-100"}`}
            />
            <span className="w-10 h-5 rounded-full bg-muted relative">
                <span
                    className={`absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-card shadow transition-transform duration-200 border border-border ${
                        isDark ? "translate-x-5" : "translate-x-0"
                    }`}
                />
            </span>
            <Moon
                className={`h-4 w-4 ${isDark ? "opacity-100" : "opacity-40"}`}
            />
        </button>
    );

    if (inline) return button;

    return <div className="fixed right-4 top-4 z-50">{button}</div>;
}
