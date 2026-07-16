"use client";
import React, { useState } from "react";
import TeamClient from "./TeamClient";
import { useSession } from "next-auth/react";

export default function TeamClientWithState(props: any) {
    const [organization, setOrganization] = useState(props.organization || {});
    const [visibleTeam, setVisibleTeam] = useState(props.visibleTeam || []);
    const { status } = useSession();
    const [error, setError] = useState<string>("");

    // Show loading spinner if session or organization is loading
    if (status === "loading") {
        return (
            <div className="flex items-center justify-center h-64">
                <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mr-2"></span>
                Loading user session...
            </div>
        );
    }
    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                Error: {error}
            </div>
        );
    }
    if (!organization || Object.keys(organization).length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-yellow-400">
                No organization/team data found.
            </div>
        );
    }
    return (
        <TeamClient
            {...props}
            organization={organization}
            setOrganization={setOrganization}
            visibleTeam={visibleTeam}
            setVisibleTeam={setVisibleTeam}
        />
    );
}
