"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                storageKey="theme"
            >
                <I18nProvider>{children}</I18nProvider>
            </ThemeProvider>
        </SessionProvider>
    );
}
