import { notFound } from "next/navigation";
import StaffDetailClientWrapper from "./StaffDetailClientWrapper";

async function fetchStaff(id: string) {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/manager/supervisors`,
    );
    if (!res.ok) return null;
    const supervisors = await res.json();
    return supervisors.find((s: any) => s.id === id) || null;
}

export default async function StaffDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const supervisor = await fetchStaff(params.id);
    if (!supervisor) return notFound();
    return <StaffDetailClientWrapper supervisor={supervisor} />;
}
