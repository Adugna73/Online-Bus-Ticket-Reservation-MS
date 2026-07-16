"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ReportAnalysisTable } from "./ReportAnalysisTable";

export default function ReportsClient() {
    const { data: session } = useSession();
    const [start, setStart] = useState("");
    const [end, setEnd] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    function setPreset(period: string) {
        const now = new Date();
        let s: Date | null = null;
        let e: Date = now;
        if (period === "daily") {
            s = new Date(now);
            s.setHours(0, 0, 0, 0);
        } else if (period === "weekly") {
            s = new Date(now);
            s.setDate(now.getDate() - 7);
        } else if (period === "monthly") {
            s = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === "quarter") {
            const q = Math.floor(now.getMonth() / 3);
            s = new Date(now.getFullYear(), q * 3, 1);
        } else if (period === "semi") {
            const half = now.getMonth() < 6 ? 0 : 6;
            s = new Date(now.getFullYear(), half, 1);
        } else if (period === "year") {
            s = new Date(now.getFullYear(), 0, 1);
        }
        if (s) {
            setStart(s.toISOString().slice(0, 10));
            setEnd(e.toISOString().slice(0, 10));
        }
    }

    async function generate() {
        setMessage("");
        setLoading(true);
        try {
            const payload = {
                start: start || undefined,
                end: end || undefined,
            };
            const res = await fetch("/api/reports/manager", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const json = await res
                    .json()
                    .catch(() => ({ error: "unknown" }));
                setMessage(
                    "Failed: " + (json?.error || res.statusText || "error")
                );
                setLoading(false);
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `manager-report-${session?.user?.id || "report"}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setMessage("Report generated and downloaded");
        } catch (err: any) {
            setMessage("Error: " + (err?.message || String(err)));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <ReportAnalysisTable />
        </div>
    );
}
