"use client";

import Image from "next/image";
// Update the import path if LoginForm is located elsewhere, for example:
import LoginForm from "../components/LoginForm";
import GuestThemeToggle from "../components/GuestThemeToggle";
// Or, if the file extension is needed:
// import LoginForm from "../../components/LoginForm.tsx";

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground">
            {/* Global header is used; local header removed to avoid duplication */}

            <main className="flex-1 flex flex-col lg:flex-row items-stretch">
                {/* Left image section, hidden on mobile (match login page style) */}
                <div className="hidden lg:block lg:w-3/5">
                    <div className="relative w-full h-full min-h-full overflow-hidden items-center justify-center p-8">
                        <div className="relative w-full h-full max-w-[1200px] max-h-[600px] bg-background text-foreground flex items-center justify-center">
                            <Image
                                src="/images/new_image.png"
                                alt="Bus reservation illustration"
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
