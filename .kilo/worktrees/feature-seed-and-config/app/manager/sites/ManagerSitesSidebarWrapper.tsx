"use client";
import dynamic from "next/dynamic";

const ManagerSitesSidebar = dynamic(
    () => import("@/components/ManagerSitesSidebar"),
    { ssr: false },
);

export default function ManagerSitesSidebarWrapper() {
    return <ManagerSitesSidebar />;
}
