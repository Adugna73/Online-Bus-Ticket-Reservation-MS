import React from "react";
import EditMemberForm from "../../../../components/EditMemberForm";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ userId?: string }>;
}) {
    const { id } = await params;
    const sp = await searchParams;
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user?.id) return <div className="p-4">Not authorized</div>;
    const userId = sp.userId;
    if (!userId) return <div className="p-4">No user specified</div>;
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return <div className="p-4">User not found</div>;
    const team = target.teamId
        ? await prisma.team.findUnique({ where: { id: target.teamId } })
        : null;
    const allowed =
        session.user.id === target.immediateStaffId ||
        (team && session.user.id === team.managerId);
    if (!allowed)
        return <div className="p-4">Not authorized to edit this user</div>;
    return (
        <div className="p-4">
            <h2 className="font-semibold mb-2">
                Edit {target.fullName || target.email}
            </h2>
            <EditMemberForm userId={userId} />
        </div>
    );
}
