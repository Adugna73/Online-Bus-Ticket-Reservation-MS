"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Eye, EyeOff, User, Lock } from "lucide-react";

export default function LoginForm({ showCard = true }: { showCard?: boolean }) {
    const { data: session, status } = useSession();
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [themeMounted, setThemeMounted] = useState(false);
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loginMode, setLoginMode] = useState<null | "single">(null);
    const [error, setError] = useState("");
    const [isResetting, setIsResetting] = useState(false);
    const [resetSuccess, setResetSuccess] = useState("");
    // Identifier for password reset flow
    const [identifier, setIdentifier] = useState("");
    const [isSignup, setIsSignup] = useState(false);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // If logged in redirect to role-specific dashboard or workorders
    useEffect(() => {
        if (status === "authenticated" && session?.user) {
            const role = String((session.user as any).role || "").toLowerCase();
            const redirectPath =
                role === "admin"
                    ? "/admin/dashboard"
                    : role === "staff" || role === "supervisor"
                      ? "/supervisor/dashboard"
                      : role === "manager"
                        ? "/manager/managerial-dashboard"
                        : role === "mechanic"
                          ? "/mechanic/tasks"
                          : role === "garage_owner"
                            ? "/garage-owner/dashboard"
                            : role === "driver"
                              ? "/driver/bus"
                              : "/passenger/bookings";
            router.replace(redirectPath);
        }
    }, [status, session, router]);

    useEffect(() => setThemeMounted(true), []);

    const isDark = themeMounted ? resolvedTheme === "dark" : false;

    const isEmail = (value: string) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

    const attemptPassengerLogin = async () => {
        if (isLoading) return;
        const hasRequiredFields = email.trim() && password.trim();
        if (!hasRequiredFields) {
            setError("Please enter your email and password");
            return;
        }
        if (!isEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }
        setResetSuccess("");
        setIsLoading(true);
        setLoginMode("single");
        setError("");

        const emailValue = email.trim().toLowerCase();
        const callbackUrl = "/dashboard";

        try {
            type SignInResponse = {
                error?: string;
                ok?: boolean;
                status?: number;
                url?: string;
            };

            const result = (await signIn("credentials", {
                email: emailValue,
                password,
                redirect: false,
                callbackUrl,
            })) as SignInResponse;

            if (result?.error) {
                if (typeof window !== "undefined")
                    window.sessionStorage.removeItem("passengerLoginTarget");
                const raw = result.error;
                if (raw?.toLowerCase().includes("role_mismatch"))
                    setError(
                        "You do not have permission for this login. Contact your administrator.",
                    );
                else if (raw?.toLowerCase().includes("passenger_not_found"))
                    setError("We couldn't find an account for that user ID.");
                else if (raw?.toLowerCase().includes("not_seeded_no_access"))
                    setError(
                        "Authenticated by AD but not authorized in this app — contact your administrator.",
                    );
                else if (raw?.toLowerCase().includes("invalid_password"))
                    setError(
                        "Incorrect password. Please try again or reset it.",
                    );
                else setError("Invalid employee ID or password");
            } else {
                if (typeof window !== "undefined") {
                    // single login mode; keep ability to extend later if needed
                    window.sessionStorage.setItem(
                        "passengerLoginTarget",
                        "single",
                    );
                    window.localStorage.setItem(
                        "passengerDashboardView",
                        "single",
                    );
                }
                router.replace(callbackUrl);
            }
        } catch {
            if (typeof window !== "undefined")
                window.sessionStorage.removeItem("passengerLoginTarget");
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
            setLoginMode(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSignup) {
            void handleSignup();
            return;
        }
        void attemptPassengerLogin();
    };

    const handleSignup = async () => {
        if (isLoading) return;
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            setError("Full name, email, and password are required.");
            return;
        }
        if (!isEmail(email)) {
            setError("Please enter a valid email address");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        setResetSuccess("");
        setIsLoading(true);
        setError("");
        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    email: email.trim().toLowerCase(),
                    phone: phone.trim(),
                    password,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                if (text.includes("email_exists")) {
                    setError("Email already exists. Please sign in.");
                } else if (text.includes("invalid_email")) {
                    setError("Please enter a valid email address");
                } else {
                    setError(text || "Failed to create account.");
                }
                return;
            }
            await attemptPassengerLogin();
        } catch (err) {
            setError("Failed to create account.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePassengerReset = async () => {
        if (isResetting) return;
        if (!identifier || !identifier.trim()) {
            setError("Enter your user ID before requesting a reset");
            setResetSuccess("");
            return;
        }
        setIsResetting(true);
        setError("");
        setResetSuccess("");
        try {
            const response = await fetch("/api/auth/passenger-reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: identifier.trim().toLowerCase(),
                }),
            });
            const data = (await response.json().catch(() => ({}))) as {
                resetLink?: string;
                error?: string;
            };
            if (!response.ok) {
                setError(
                    typeof data?.error === "string"
                        ? data.error
                        : "Unable to start the reset process. Please try again.",
                );
                return;
            }
            if (data?.resetLink) {
                window.location.assign(data.resetLink);
                return;
            }
            setResetSuccess(
                "Reset instructions have been sent. Check your email.",
            );
        } catch (err) {
            console.error("passenger reset request failed", err);
            setError("Unable to start the reset process. Please try again.");
        } finally {
            setIsResetting(false);
        }
    };

    // form inner contents reused for both wrapped and bare variants
    const innerForm = (
        <>
            {error && (
                <div className="border border-red-400 bg-background text-foreground p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}
            {!error && resetSuccess && (
                <div className="border border-emerald-400 bg-background text-foreground p-3 rounded-lg text-sm">
                    {resetSuccess}
                </div>
            )}

            {isSignup && (
                <div className="space-y-2">
                    <label htmlFor="fullName" className="sr-only">
                        Full name
                    </label>
                    <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground dark:text-slate-500" />
                        <input
                            id="fullName"
                            type="text"
                            placeholder="Full name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="h-14 w-full rounded-2xl border border-slate-300/80 bg-background pl-12 pr-4 text-[10px] sm:text-xs placeholder:text-[9px] sm:placeholder:text-xs text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:ring-offset-slate-950"
                            required
                        />
                    </div>
                </div>
            )}

            {isSignup && (
                <div className="space-y-2">
                    <label htmlFor="phone" className="sr-only">
                        Phone
                    </label>
                    <div className="relative">
                        <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground dark:text-slate-500" />
                        <input
                            id="phone"
                            type="tel"
                            placeholder="Phone"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="h-14 w-full rounded-2xl border border-slate-300/80 bg-background pl-12 pr-4 text-[10px] sm:text-xs placeholder:text-[9px] sm:placeholder:text-xs text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:ring-offset-slate-950"
                        />
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <label htmlFor="employeeId" className="sr-only">
                    Email address
                </label>
                <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground dark:text-slate-500" />
                    <input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-14 w-full rounded-2xl border border-slate-300/80 bg-background pl-12 pr-4 text-[10px] sm:text-xs placeholder:text-[9px] sm:placeholder:text-xs text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:ring-offset-slate-950"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor="password" className="sr-only">
                    Password
                </label>
                <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground dark:text-slate-500" />
                    <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-14 w-full rounded-2xl border border-slate-300/80 bg-background pl-12 pr-4 text-[10px] sm:text-xs placeholder:text-[9px] sm:placeholder:text-xs text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:ring-offset-slate-950"
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label="Toggle password visibility"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground dark:text-slate-500 dark:hover:text-slate-200"
                    >
                        {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                        ) : (
                            <Eye className="h-4 w-4" />
                        )}
                    </button>
                </div>
                <div className="text-right">
                    <button
                        type="button"
                        onClick={handlePassengerReset}
                        disabled={isLoading || isResetting}
                        className="text-xs font-medium text-foreground hover:underline disabled:opacity-50"
                    >
                        {isResetting
                            ? "Sending reset link..."
                            : "Forgot password?"}
                    </button>
                </div>
            </div>

            {isSignup && (
                <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="sr-only">
                        Confirm password
                    </label>
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground dark:text-slate-500" />
                        <input
                            id="confirmPassword"
                            type={showPassword ? "text" : "password"}
                            placeholder="Confirm password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="h-14 w-full rounded-2xl border border-slate-300/80 bg-background pl-12 pr-4 text-[10px] sm:text-xs placeholder:text-[9px] sm:placeholder:text-xs text-foreground shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-1 focus:ring-offset-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-emerald-400 dark:focus:ring-emerald-500/30 dark:focus:ring-offset-slate-950"
                            required
                        />
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="et-primary-button w-full text-base rounded-2xl px-6 py-3"
                >
                    {isLoading
                        ? isSignup
                            ? "Creating..."
                            : "Signing in..."
                        : isSignup
                          ? "Create Account"
                          : "Sign in"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setIsSignup((prev) => !prev);
                        setError("");
                        setResetSuccess("");
                    }}
                    className="text-xs text-emerald-600 hover:underline"
                >
                    {isSignup
                        ? "Already have an account? Sign in"
                        : "New passenger? Create an account"}
                </button>
            </div>
            <div className="text-xs text-foreground dark:text-slate-400 pt-1">
                Staff and admin accounts must be created by your organization.
            </div>
        </>
    );

    return (
        <>
            <div className="mb-6">
                <div className="flex items-center gap-4">
                    {/* <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-slate-200/80 bg-background text-foreground shadow-md shadow-slate-200/80 dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-black/40">
                        <Image
                            src={
                                isDark
                                    ? "/images/et-logo-text-dark.png"
                                    : "/images/et-logo-light.png"
                            }
                            alt="Bus Ticket Reservation"
                            width={48}
                            height={48}
                        />
                    </div> */}
                    <div>
                        <h3 className="text-2xl font-semibold tracking-tight">
                            Bus ticket portal
                        </h3>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                            Online Bus Ticket Reservation Management System
                        </div>
                    </div>
                </div>
            </div>

            {showCard ? (
                <div className="relative rounded-3xl border border-slate-200/80 bg-background p-8 sm:p-10 shadow-xl shadow-slate-200/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-black/40">
                    <div className="max-w-full w-full">
                        <form onSubmit={handleSubmit} className="grid gap-4">
                            {innerForm}
                        </form>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="grid gap-4">
                    {innerForm}
                </form>
            )}
        </>
    );
}
