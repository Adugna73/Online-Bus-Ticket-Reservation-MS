"use client";
import AddMemberForm from "@/components/AddMemberForm";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AddMemberPageContent() {
    const sp = useSearchParams();
    const teamId = sp?.get("teamId") || "";
    const supervisorId = sp?.get("supervisor") || "";
    return (
        <div className="max-w-7xl mx-auto py-8 px-6">
            <h1 className="text-2xl font-semibold mb-4">Add member to team</h1>
            <AddMemberForm teamId={teamId} supervisorId={supervisorId} />
        </div>
    );
}

export default function AddMemberPage({ searchParams }: any) {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AddMemberPageContent />
        </Suspense>
    );
}
