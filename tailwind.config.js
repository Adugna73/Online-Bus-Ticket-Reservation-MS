/** @type {import('tailwindcss').Config} */
import tailwindcssAnimate from "tailwindcss-animate";

const config = {
    darkMode: ["class", "class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,css}",
        "./app/globals.css",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx,css}",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "oklch(var(--background) / <alpha-value>)",
                foreground: "oklch(var(--foreground) / <alpha-value>)",
                card: {
                    DEFAULT: "oklch(var(--card) / <alpha-value>)",
                    foreground: "oklch(var(--card-foreground) / <alpha-value>)",
                },
                border: "oklch(var(--border) / <alpha-value>)",
                muted: {
                    DEFAULT: "oklch(var(--muted) / <alpha-value>)",
                    foreground:
                        "oklch(var(--muted-foreground) / <alpha-value>)",
                },
                accent: {
                    DEFAULT: "oklch(var(--accent) / <alpha-value>)",
                    foreground:
                        "oklch(var(--accent-foreground) / <alpha-value>)",
                },
                primary: {
                    DEFAULT: "oklch(var(--primary) / <alpha-value>)",
                    foreground:
                        "oklch(var(--primary-foreground) / <alpha-value>)",
                },
                secondary: {
                    DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
                    foreground:
                        "oklch(var(--secondary-foreground) / <alpha-value>)",
                },
                destructive: {
                    DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
                    foreground:
                        "oklch(var(--destructive-foreground) / <alpha-value>)",
                },
                popover: {
                    DEFAULT: "oklch(var(--popover) / <alpha-value>)",
                    foreground:
                        "oklch(var(--popover-foreground) / <alpha-value>)",
                },
                input: "oklch(var(--input) / <alpha-value>)",
                ring: "oklch(var(--ring) / <alpha-value>)",
                chart: {
                    1: "oklch(var(--chart-1) / <alpha-value>)",
                    2: "oklch(var(--chart-2) / <alpha-value>)",
                    3: "oklch(var(--chart-3) / <alpha-value>)",
                    4: "oklch(var(--chart-4) / <alpha-value>)",
                    5: "oklch(var(--chart-5) / <alpha-value>)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
        },
    },
    plugins: [tailwindcssAnimate, require("tailwindcss-animate")],
};

export default config;
