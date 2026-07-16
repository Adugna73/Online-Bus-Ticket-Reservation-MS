"use client";
import dynamic from "next/dynamic";
const SitesClient = dynamic(() => import("@/components/SitesClient"), {
    ssr: false,
});

export default function SitesClientWrapper() {
    return <SitesClient />;
}
