import "./globals.css";
import { ReactNode, Suspense } from "react";
import Header from "../components/Header";
import Providers from "../components/Providers";
import Script from "next/script";

export const metadata = {
    title: "Online Bus Ticket Reservation System",
    description:
        "Online Bus Ticket Reservation Management System for Ethiopian bus stations",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
            </head>
            <body className="antialiased min-h-screen bg-background text-foreground transition-colors duration-300">
                {/* This script ensures the initial theme is applied prior to hydration so server and client don't mismatch */}
                <script
                    id="theme-init"
                    dangerouslySetInnerHTML={{
                        __html: `(() => {
                    try {
                        const storageKey = 'theme';
                        let theme = null;
                        try { theme = localStorage.getItem(storageKey); } catch (e) { theme = null; }
                        const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                        if (!theme || theme === 'system') {
                            theme = prefersDark ? 'dark' : 'light';
                        }
                        if (theme) {
                            document.documentElement.classList.add(theme);
                            try { document.documentElement.style.colorScheme = theme; } catch (e) {}
                        }
                    } catch (e) {}
                })();`,
                    }}
                />
                <Providers>
                    <Header />
                    <main className="flex-1 overflow-y-auto">{children}</main>
                </Providers>
            </body>
        </html>
    );
}
