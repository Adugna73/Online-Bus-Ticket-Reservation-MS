"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";

type TemplateItem = {
    no: number;
    category: string;
    task: string;
    possibleAction?: string;
    checklistLevel?: string;
    attachment?: string;
    findings?: string[];
    remark?: string;
};

export default function MaintenanceTemplatePage({
    params,
}: {
    params: { id: string };
}) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [template, setTemplate] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // `params` may be a Promise in client components (Next.js 16+); unwrap with React.use when available
    // fallback to `params` for older runtimes.
    const resolvedParams = (React as any).use
        ? (React as any).use(params)
        : params;
    const templateId = resolvedParams?.id ?? params?.id;

    useEffect(() => {
        if (status === "loading") return;
        if (!session || !session.user) {
            router.replace("/login");
            return;
        }

        const id = templateId;
        (async () => {
            try {
                const res = await fetch(`/api/maintenance/templates`);
                if (!res.ok)
                    throw new Error(`failed to load templates (${res.status})`);
                const templates = await res.json();
                const found = (templates || []).find((t: any) => t.id === id);
                if (!found) {
                    setError("Template not found");
                    setTemplate(null);
                } else {
                    setTemplate(found);
                    setError(null);
                }
            } catch (err: any) {
                setError(err?.message || String(err));
                setTemplate(null);
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [templateId, session, status]);

    return (
        <DashboardShell>
            <div className="max-w-5xl mx-auto py-8 px-4">
                {loading ? (
                    <div className="text-muted-foreground">
                        Loading template...
                    </div>
                ) : error ? (
                    <div className="text-destructive">{error}</div>
                ) : template ? (
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold">
                                    {template.name}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {template.description}
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground border-b">
                                        <th className="py-2 pr-4">#</th>
                                        <th className="py-2 pr-4">Category</th>
                                        <th className="py-2 pr-4">Task</th>
                                        <th className="py-2 pr-4">
                                            Checklist level
                                        </th>
                                        <th className="py-2 pr-4">
                                            Attachment
                                        </th>
                                        <th className="py-2 pr-4">Findings</th>
                                        <th className="py-2 pr-4">Remark</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.isArray(template.items) &&
                                    template.items.length ? (
                                        template.items.map(
                                            (it: TemplateItem) => (
                                                <tr
                                                    key={it.no}
                                                    className="border-b last:border-b-0"
                                                >
                                                    <td className="py-2 pr-4 align-top">
                                                        {it.no}
                                                    </td>
                                                    <td className="py-2 pr-4 align-top">
                                                        {it.category}
                                                    </td>
                                                    <td className="py-2 pr-4 align-top max-w-[40ch]">
                                                        {it.task}
                                                        {it.possibleAction ? (
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                {
                                                                    it.possibleAction
                                                                }
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                    <td className="py-2 pr-4 align-top">
                                                        {it.checklistLevel ||
                                                            "-"}
                                                    </td>
                                                    <td className="py-2 pr-4 align-top">
                                                        {it.attachment || "-"}
                                                    </td>
                                                    <td className="py-2 pr-4 align-top">
                                                        {Array.isArray(
                                                            it.findings,
                                                        )
                                                            ? it.findings.join(
                                                                  ", ",
                                                              )
                                                            : "-"}
                                                    </td>
                                                    <td className="py-2 pr-4 align-top">
                                                        {it.remark || "-"}
                                                    </td>
                                                </tr>
                                            ),
                                        )
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="py-4 text-muted-foreground"
                                            >
                                                No items in this template.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-sm text-muted-foreground">
                            This template is viewable by all authenticated
                            users.
                        </div>
                    </div>
                ) : null}
            </div>
        </DashboardShell>
    );
}
