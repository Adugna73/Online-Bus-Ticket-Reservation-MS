"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import LoginForm from "@/components/LoginForm";
import GuestThemeToggle from "@/components/GuestThemeToggle";

export default function LoginPage() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = mounted ? resolvedTheme === "dark" : false;
    const { data: session } = useSession();

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            {/* Global header handles logo and theme toggle; local header removed */}

            <main className="flex-1 flex flex-col lg:flex-row items-stretch">
                {/* Left image section, hidden on mobile */}
                <div className="hidden lg:block lg:w-3/5">
                    <div className="relative w-full h-full min-h-full overflow-hidden items-center justify-center p-8">
                        <div className="relative w-full h-full max-w-[1200px] max-h-[600px] bg-background text-foreground flex items-center justify-center">
                            <Image
                                src="/images/zzz.png"
                                alt="PM task image"
                                fill
                                style={{
                                    objectFit: "contain",
                                    objectPosition: "left center",
                                }}
                                className=""
                            />
                        </div>
                    </div>
                </div>

                {/* Login form section */}
                <div className="w-full lg:w-3/6 flex items-center justify-end bg-background text-foreground px-6 py-12 sm:px-8 md:px-12 lg:px-20">
                    <div className="w-full max-w-[720px] ml-auto lg:pr-50">
                        <LoginForm />
                    </div>
                </div>
            </main>
        </div>
    );
}

// ImageFallback removed — explicit Pm-Task-image.png is used instead
