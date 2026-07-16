import React from "react";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import DashboardShell from "@/components/DashboardShell";

export default async function ChecklistAttachmentsPage() {
    const session = (await getServerSession(authOptions as any)) as any;
    const roleKey = String(session?.user?.role || "").toLowerCase();
    const isManager = roleKey === "manager" || roleKey === "supervisor";
    if (!session?.user?.id) {
        return (
            <div className="p-4">
                <h2 className="text-lg font-semibold">Booking Attachments</h2>
                <p className="text-sm text-gray-600">You are not signed in.</p>
            </div>
        );
    }

    if (!isManager) {
        return (
            <div className="p-4">
                <h2 className="text-lg font-semibold">Booking Attachments</h2>
                <p className="text-sm text-gray-600">
                    You are not authorized to view booking attachments.
                </p>
            </div>
        );
    }

    const managerId = String(session.user.id);

    // Build manager-scoped where clause (similar to /api/workorders route)
    const team = await prisma.team.findMany({
        where: { managerId },
        select: { id: true },
    });
    const teamIds = team.map((t) => t.id);
    const directReports = await prisma.user.findMany({
        where: { immediateStaffId: managerId },
        select: { id: true, teamId: true },
    });
    const directIds = directReports.map((u) => u.id);
    const directTeamIds = directReports
        .map((u) => u.teamId)
        .filter(Boolean) as string[];

    let workWhere: any = {};
    if (teamIds.length > 0) {
        const orParts: any[] = [{ teamId: { in: teamIds } }];
        if (directTeamIds.length > 0)
            orParts.push({ teamId: { in: directTeamIds } });
        if (directIds.length > 0) {
            orParts.push({ assignedToId: { in: directIds } });
            orParts.push({ createdById: { in: directIds } });
        }
        workWhere.OR = orParts;
    } else if (directIds.length > 0) {
        if (directTeamIds.length > 0) {
            workWhere.OR = [
                { teamId: { in: directTeamIds } },
                { createdById: { in: directIds } },
                { assignedToId: { in: directIds } },
            ];
        } else {
            workWhere.OR = [
                { createdById: { in: directIds } },
                { assignedToId: { in: directIds } },
            ];
        }
    } else {
        // fallback: no team or direct reports — show nothing
        workWhere.teamId = { in: [] };
    }

    // Fetch bookings in manager scope and include checklist and stored attachments
    const workOrders = await prisma.workOrder.findMany({
        where: workWhere,
        include: {
            checklist: true,
            attachments: true,
            site: true,
            assignedTo: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
    });

    // Map to rows from workOrders that have a checklist
    const rows = workOrders
        .filter((w) => w.checklist)
        .map((w) => {
            const c = w.checklist as any;
            const items = (c.items as any[]) || [];
            const attachments: {
                url: string;
                fileName?: string;
                itemIndex?: number | null;
            }[] = [];
            items.forEach((it, idx) => {
                const atts = Array.isArray(it.attachments)
                    ? it.attachments
                    : [];
                for (const a of atts) {
                    const url =
                        typeof a === "string"
                            ? a
                            : (a?.url ?? (a as any)?.fileUrl);
                    if (url)
                        attachments.push({
                            url,
                            fileName:
                                typeof a === "object" ? a.fileName : undefined,
                            itemIndex: idx,
                        });
                }
            });
            // also include WorkOrderAttachment rows (saved via attachments upload)
            const storedAtts = (w.attachments || []).map((x: any) => ({
                url: x.fileUrl,
                fileName: x.fileName,
                itemIndex: null,
            }));
            const allAttachments = [...attachments, ...storedAtts];
            return {
                workOrderId: w.id,
                taskNumber: w.taskNumber ?? w.id,
                siteId: w.siteId ?? null,
                siteName: w.site?.name ?? null,
                siteCode: w.site?.siteCode ?? null,
                assignedToName: w.assignedTo?.fullName ?? null,
                // use workorder checkInTime if present
                checkInTime: w.checkInTime ? String(w.checkInTime) : null,
                passengerLatitude: w.passengerLatitude ?? null,
                passengerLongitude: w.passengerLongitude ?? null,
                hasAttachments: allAttachments.length > 0,
                attachments: allAttachments,
            };
        });

    return (
        <DashboardShell>
            <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                        Booking Attachments
                    </h2>
                    <div className="text-sm text-gray-600">
                        Showing latest {rows.length} bookings
                    </div>
                </div>

                <div className="bg-white rounded shadow overflow-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left">Booking</th>
                                <th className="p-2 text-left">Booking Ref</th>
                                <th className="p-2 text-left">Station Name</th>
                                <th className="p-2 text-left">Station Code</th>
                                <th className="p-2 text-left">
                                    Assigned Staff
                                </th>
                                <th className="p-2 text-left">Check-in Time</th>
                                <th className="p-2 text-left">Longitude</th>
                                <th className="p-2 text-left">Latitude</th>
                                <th className="p-2 text-left">
                                    Has Attachments
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.workOrderId} className="border-t">
                                    <td className="p-2">
                                        <Link
                                            className="text-blue-600 underline"
                                            href={`/bookings/${r.workOrderId}`}
                                        >
                                            View
                                        </Link>
                                    </td>
                                    <td className="p-2">{r.taskNumber}</td>
                                    <td className="p-2">{r.siteName ?? "-"}</td>
                                    <td className="p-2">{r.siteCode ?? "-"}</td>
                                    <td className="p-2">
                                        {r.assignedToName ?? "-"}
                                    </td>
                                    <td className="p-2">
                                        {r.checkInTime
                                            ? new Date(
                                                  r.checkInTime,
                                              ).toLocaleString()
                                            : r.passengerLatitude ||
                                                r.passengerLongitude
                                              ? "Checked"
                                              : "-"}
                                    </td>
                                    <td className="p-2">
                                        {r.passengerLongitude ?? "-"}
                                    </td>
                                    <td className="p-2">
                                        {r.passengerLatitude ?? "-"}
                                    </td>
                                    <td className="p-2">
                                        {r.hasAttachments ? "Yes" : "No"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardShell>
    );
}
