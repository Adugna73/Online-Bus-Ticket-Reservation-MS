import React from "react";
import AddMemberForm from "../../../../components/AddMemberForm";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ supervisor?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id) return <div className="p-4">Not authorized</div>;
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return <div className="p-4">Team not found</div>;
    const supervisorId = sp?.supervisor;
    const allowed =
        session.user.id === team.managerId || supervisorId === session.user.id;
    if (!allowed)
        return <div className="p-4">Not authorized to add members</div>;
    return (
        <div className="p-4">
            <h2 className="font-semibold mb-2">Add Member to {team.name}</h2>
            <AddMemberForm teamId={id} supervisorId={supervisorId} />
        </div>
    );
}
