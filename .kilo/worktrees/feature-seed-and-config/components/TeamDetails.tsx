"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function TeamDetails({ id }: { id: string }) {
    const [team, setTeam] = useState<any | null>(null);
    const [assignments, setAssignments] = useState<Record<string, any>>({});
    const [editingAssignmentFor, setEditingAssignmentFor] = useState<
        string | null
    >(null);
    const [neOptions, setNeOptions] = useState<Record<string, any[]>>({});
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    const [regions, setRegions] = useState<any[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [stations, setSites] = useState<any[]>([]);
    const router = useRouter();
    const { data: session } = useSession();

    useEffect(() => {
        (async () => {
            try {
                const teamRes = await fetch(`/api/team/${id}`);
                if (teamRes.ok) {
                    setTeam(await teamRes.json());
                }

                const assignmentsRes = await fetch(
                    `/api/team-assignments?teamId=${id}`,
                );
                if (assignmentsRes.ok) {
                    const arr = await assignmentsRes.json();
                    const map: Record<string, any> = {};
                    (arr as any[]).forEach((it: any) => {
                        if (it?.userId) map[it.userId] = it;
                    });
                    setAssignments(map);
                }

                const w = await fetch(`/api/workorders?teamId=${id}`);
                if (w.ok) setWorkOrders(await w.json());

                const [regionsR, zonesR, stationsR] = await Promise.all([
                    fetch("/api/regions"),
                    fetch("/api/zones"),
                    fetch("/api/stations"),
                ]);

                if (regionsR.ok) setRegions(await regionsR.json());
                if (zonesR.ok) setZones(await zonesR.json());
                if (stationsR.ok) setSites(await stationsR.json());
            } catch (e) {
                console.error("Failed to load team details", e);
            }
        })();
    }, [id]);

    const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
    const formatLocalFromEmail = (emailOrLocal: string) => {
        const local = emailOrLocal.split("@")[0];
        return titleCase(local.replace(/[._\-]+/g, " ").trim());
    };
    const memberDisplayName = (m: any) => {
        // prefer full name that isn't 'Unnamed' and not an email
        if (
            m?.fullName &&
            m.fullName.trim() &&
            m.fullName !== "Unnamed" &&
            !m.fullName.includes("@")
        )
            return m.fullName;
        // If fullName contains email, derive from local part
        if (m?.fullName && m.fullName.includes("@"))
            return formatLocalFromEmail(m.fullName);
        if (m?.email) return formatLocalFromEmail(m.email);
        if (m?.username && !m.username.startsWith("user_")) {
            if (m.username.includes("@"))
                return formatLocalFromEmail(m.username);
            // try split by dot/underscore and join
            if (m.username.includes(".") || m.username.includes("_"))
                return titleCase(m.username.replace(/[._\-]+/g, " "));
            return m.username;
        }
        if (m?.staffId) return m.staffId;
        return "Unnamed";
    };

    if (!team) return <div>Loading...</div>;
    const user = (session?.user as any) || {};
    const canManageAssignments =
        String(user.role).toLowerCase() === "admin" ||
        user.id === team.manager?.id ||
        (String(user.role).toLowerCase() === "supervisor" &&
            (team.members || []).some((m: any) => m.id === user.id));
    // Determine which members to show based on current user's role
    const membersToShow = (team.members || []).filter((m: any) => {
        // If current user is a Staff, do not show any members whose role is Staff
        if (
            String(user.role).toLowerCase() === "supervisor" &&
            m.role?.key === "Staff"
        )
            return false;
        return true;
    });

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded shadow">
                <h2 className="font-semibold">{team.name}</h2>
                <div className="text-sm text-gray-600">
                    {String(user.role).toLowerCase() === "supervisor"
                        ? team.manager?.fullName || "-"
                        : `Staff: ${team.manager?.fullName || "-"}`}
                </div>
                {(session?.user as any)?.id === team.manager?.id && (
                    <div className="mt-2">
                        <button
                            className="ossBtn"
                            onClick={() =>
                                router.push(`/team/${id}/add-member`)
                            }
                        >
                            Add Member
                        </button>
                    </div>
                )}
            </div>
            <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-2">Members</h3>
                <ul className="space-y-1">
                    {membersToShow.map((m: any) => (
                        <React.Fragment key={m.id}>
                            <li className="flex justify-between items-center">
                                <div>
                                    <div className="font-medium">
                                        {memberDisplayName(m)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {m.role?.displayName ||
                                            m.role?.key ||
                                            "Passenger"}
                                    </div>
                                    {m.email && (
                                        <div className="text-xs text-gray-400">
                                            {m.email}
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-400">
                                        {m.assignedZone && m.assignedZone[0]
                                            ? zones.find(
                                                  (z) =>
                                                      z.id ===
                                                      m.assignedZone[0],
                                              )?.name || m.assignedZone[0]
                                            : ""}
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500 text-right space-y-1">
                                    <div>{m.staffId || ""}</div>
                                    <div className="flex gap-2 justify-end items-center">
                                        {/* Staff: shows actions if current session user is manager or immediate supervisor of this member */}
                                        {((session?.user as any)?.id ===
                                            team.manager?.id ||
                                            (session?.user as any)?.id ===
                                                m.immediateStaffId) && (
                                            <>
                                                <button
                                                    className="ossBtn"
                                                    onClick={() =>
                                                        router.push(
                                                            `/team/${id}/add-member?supervisor=${m.id}`,
                                                        )
                                                    }
                                                >
                                                    Add Staff
                                                </button>
                                                <button
                                                    className="ossBtn"
                                                    onClick={() =>
                                                        router.push(
                                                            `/team/${id}/edit-member?userId=${m.id}`,
                                                        )
                                                    }
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="ossBtn"
                                                    onClick={async () => {
                                                        if (
                                                            !confirm(
                                                                "Delete staff?",
                                                            )
                                                        )
                                                            return;
                                                        const r = await fetch(
                                                            `/api/users/${m.id}`,
                                                            {
                                                                method: "DELETE",
                                                            },
                                                        );
                                                        if (r.ok) {
                                                            setTeam(
                                                                (t: any) => ({
                                                                    ...t,
                                                                    members:
                                                                        t.members.filter(
                                                                            (
                                                                                mm: any,
                                                                            ) =>
                                                                                mm.id !==
                                                                                m.id,
                                                                        ),
                                                                }),
                                                            );
                                                        } else {
                                                            alert(
                                                                "Failed to delete",
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                                <button
                                                    className="ossBtn"
                                                    onClick={() =>
                                                        router.push(
                                                            `/bookings/new?assignedToId=${m.id}&teamId=${id}`,
                                                        )
                                                    }
                                                >
                                                    Assign Task
                                                </button>
                                            </>
                                        )}

                                        {/* Assignment controls for manager/supervisor */}
                                        {canManageAssignments && (
                                            <div className="flex flex-col items-end">
                                                <div className="text-xs">
                                                    Group:{" "}
                                                    {assignments[m.id]
                                                        ?.groupName || "-"}
                                                </div>
                                                <div className="text-xs">
                                                    NE:{" "}
                                                    {assignments[m.id]
                                                        ?.assignedNe || "-"}
                                                </div>
                                                <div className="flex gap-1 mt-1">
                                                    <button
                                                        className="ossBtn"
                                                        onClick={async () => {
                                                            // toggle edit
                                                            if (
                                                                editingAssignmentFor ===
                                                                m.id
                                                            ) {
                                                                setEditingAssignmentFor(
                                                                    null,
                                                                );
                                                                return;
                                                            }
                                                            // fetch NE options for this member (scoped)
                                                            const regionId =
                                                                m
                                                                    .assignedRegion?.[0];
                                                            const zoneId =
                                                                m
                                                                    .assignedZone?.[0];
                                                            const qs =
                                                                new URLSearchParams();
                                                            if (regionId)
                                                                qs.set(
                                                                    "regionId",
                                                                    regionId,
                                                                );
                                                            if (zoneId)
                                                                qs.set(
                                                                    "zoneId",
                                                                    zoneId,
                                                                );
                                                            const r =
                                                                await fetch(
                                                                    `/api/ne-names?${qs.toString()}`,
                                                                );
                                                            if (r.ok) {
                                                                const json =
                                                                    await r.json();
                                                                setNeOptions(
                                                                    (s) => ({
                                                                        ...s,
                                                                        [m.id]: json,
                                                                    }),
                                                                );
                                                            }
                                                            setEditingAssignmentFor(
                                                                m.id,
                                                            );
                                                        }}
                                                    >
                                                        {editingAssignmentFor ===
                                                        m.id
                                                            ? "Close"
                                                            : "Edit Assignment"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </li>

                            {/* Assignment editor */}
                            {editingAssignmentFor === m.id && (
                                <div
                                    className="w-full p-3 bg-white border-b"
                                    key={`editor-${m.id}`}
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                                        <input
                                            defaultValue={
                                                assignments[m.id]?.groupName ||
                                                ""
                                            }
                                            placeholder="Group name (e.g. Group 1)"
                                            id={`group-${m.id}`}
                                            className="border rounded px-2 py-1"
                                        />
                                        <select
                                            defaultValue={
                                                assignments[m.id]?.assignedNe ||
                                                ""
                                            }
                                            id={`ne-${m.id}`}
                                            className="border rounded px-2 py-1"
                                        >
                                            <option value="">
                                                -- assign NE --
                                            </option>
                                            {(neOptions[m.id] || []).map(
                                                (n: any) => (
                                                    <option
                                                        key={n.value}
                                                        value={n.value}
                                                    >
                                                        {n.name}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    const group = (
                                                        document.getElementById(
                                                            `group-${m.id}`,
                                                        ) as HTMLInputElement
                                                    ).value;
                                                    const ne = (
                                                        document.getElementById(
                                                            `ne-${m.id}`,
                                                        ) as HTMLSelectElement
                                                    ).value;
                                                    // save via API
                                                    const r = await fetch(
                                                        "/api/team-assignments",
                                                        {
                                                            method: "POST",
                                                            body: JSON.stringify(
                                                                {
                                                                    teamId: id,
                                                                    userId: m.id,
                                                                    groupName:
                                                                        group,
                                                                    assignedNe:
                                                                        ne,
                                                                },
                                                            ),
                                                            headers: {
                                                                "Content-Type":
                                                                    "application/json",
                                                            },
                                                        },
                                                    );
                                                    if (r.ok) {
                                                        const res =
                                                            await r.json();
                                                        setAssignments(
                                                            (s: any) => ({
                                                                ...s,
                                                                [m.id]: res,
                                                            }),
                                                        );
                                                        setEditingAssignmentFor(
                                                            null,
                                                        );
                                                    } else {
                                                        alert(
                                                            "Failed to save assignment",
                                                        );
                                                    }
                                                }}
                                                className="ossBtn"
                                            >
                                                Save
                                            </button>
                                            {assignments[m.id]?.id && (
                                                <button
                                                    onClick={async () => {
                                                        if (
                                                            !confirm(
                                                                "Remove assignment?",
                                                            )
                                                        )
                                                            return;
                                                        const r = await fetch(
                                                            `/api/team-assignments/${
                                                                assignments[
                                                                    m.id
                                                                ].id
                                                            }`,
                                                            {
                                                                method: "DELETE",
                                                            },
                                                        );
                                                        if (r.ok) {
                                                            setAssignments(
                                                                (s: any) => {
                                                                    const n = {
                                                                        ...s,
                                                                    };
                                                                    delete n[
                                                                        m.id
                                                                    ];
                                                                    return n;
                                                                },
                                                            );
                                                            setEditingAssignmentFor(
                                                                null,
                                                            );
                                                        } else
                                                            alert(
                                                                "Failed to delete",
                                                            );
                                                    }}
                                                    className="ossBtn"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </ul>
            </div>
            <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-2">Bookings for team</h3>
                <div>
                    {workOrders.map((wo) => (
                        <div key={wo.id} className="py-2 border-b">
                            <Link
                                href={`/bookings/${wo.id}`}
                                className="block"
                            >
                                {wo.title}
                            </Link>
                            <div className="text-sm text-gray-600">
                                {wo.status} — Assigned:{" "}
                                {wo.assignedTo?.fullName || "-"}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
