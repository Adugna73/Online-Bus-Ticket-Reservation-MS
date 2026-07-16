"use client";
import dynamic from "next/dynamic";
const StaffDetailClient = dynamic(
    () => import("../../../../components/StaffDetailClient"),
    { ssr: false },
);
export default function StaffDetailClientWrapper({
    supervisor,
}: {
    supervisor: any;
}) {
    return (
        <StaffDetailClient supervisor={supervisor} onClose={() => {}} />
    );
}
