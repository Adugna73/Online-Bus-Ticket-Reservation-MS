"use client";

import Link from "next/link";
import { useState } from "react";
import { Trash2, Users } from "lucide-react";

type AdminTeamCardProps = {
    team: any;
};

export default function AdminTeamCard({ team }: AdminTeamCardProps) {
    const [deleting, setDeleting] = useState(false);

    const onDelete = async () => {
        if (!confirm(`Delete team ${team.name}?`)) return;
        setDeleting(true);

        const res = await fetch(`/api/team/${team.id}`, {
            method: "DELETE",
            credentials: "same-origin",
        });

        if (res.ok) {
            window.location.reload();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Failed to delete team");
            setDeleting(false);
        }
    };

    return (
        <div className="relative p-4 bg-background border rounded hover:border-primary transition">
            <Link
                href={`/admin/team/${team.id}`}
                className="block h-full w-full"
            >
                <div className="font-bold text-lg mb-1 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {team.name}
                </div>
                <div className="text-sm text-foreground mb-1">
                    Staff: {team.manager?.fullName || "-"}
                </div>
                <div className="text-sm text-foreground">
                    Members: {team.members?.length ?? 0}
                </div>
            </Link>

            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDelete();
                }}
                className="absolute top-2 right-2 p-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                title={`Delete ${team.name}`}
                disabled={deleting}
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}
