"use client";
import { redirect } from "next/navigation";

export default function TeamPage() {
    redirect("/manager/team");
    return null;
}

// Optionally, you may want to remove or redirect the old /team/page.tsx to avoid duplicate routes.
// For now, the new /manager/team/page.tsx is the uniform entry point for managers.
