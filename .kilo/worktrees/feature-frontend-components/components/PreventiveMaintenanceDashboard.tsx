"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import SectionCards from "./dashboard/SectionCards";
import DataTable from "./dashboard/DataTable";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LabelList,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts";

export default function PreventiveMaintenanceDashboard() {
    const { data: session } = useSession();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const fetchSeqRef = useRef(0);
    const abortRef = useRef<AbortController | null>(null);
    const [managerSites, setManagerSites] = useState<any[] | null>(null);
    const [managerNeNames, setManagerNeNames] = useState<any[] | null>(null);
    const [managerWorkOrders, setManagerWorkOrders] = useState<any[] | null>(
        null,
    );
    // manual hover tooltip state for Completed vs Scheduled chart
    const [hoverTooltip, setHoverTooltip] = useState<{
        visible: boolean;
        data: any | null;
        label?: string;
    }>({ visible: false, data: null });
    // hovered frequency (for frequency chart arrows)
    const [freqHover, setFreqHover] = useState<{
        label?: string;
        data?: any;
    } | null>(null);
    // expanded card key (e.g. 'freq') to show a full-size overlay of a card
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    // filter states
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
        new Set(),
    );
    const [selectedFrequencies, setSelectedFrequencies] = useState<Set<string>>(
        new Set(),
    );

    const filterQuery = useMemo(() => {
        const p = new URLSearchParams();
        if (selectedYear) p.set("year", String(selectedYear));
        if (selectedMonth !== null && selectedMonth !== undefined)
            p.set("month", String(selectedMonth));
        if (selectedWeek) p.set("week", String(selectedWeek));
        if (selectedStatuses.size)
            p.set("statuses", Array.from(selectedStatuses).sort().join(","));
        if (selectedFrequencies.size)
            p.set(
                "frequencies",
                Array.from(selectedFrequencies).sort().join(","),
            );
        const qs = p.toString();
        return qs ? `?${qs}` : "";
    }, [
        selectedYear,
        selectedMonth,
        selectedWeek,
        selectedStatuses,
        selectedFrequencies,
    ]);

    const loadStats = async () => {
        setLoading(true);
        try {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            const seq = ++fetchSeqRef.current;

            const r = await fetch(`/api/dashboard/stats${filterQuery}`, {
                cache: "no-store",
                signal: controller.signal,
            });
            if (!r.ok) return;
            const data = await r.json();
            // Ignore stale responses (e.g., user clicked 2024 then quickly 2025)
            if (seq !== fetchSeqRef.current) return;
            setStats(data);
        } catch (e) {
            // Ignore aborts; log other errors
            if ((e as any)?.name !== "AbortError") console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, [filterQuery]);

    // Week filter only makes sense with a selected year+month
    useEffect(() => {
        if (
            !selectedYear ||
            selectedMonth === null ||
            selectedMonth === undefined
        ) {
            setSelectedWeek(null);
        }
    }, [selectedYear, selectedMonth]);

    // prepare derived data even while loading so hooks order stays stable
    const totals = stats?.totals || {};
    const roleKey = String(stats?.user?.role || "").toLowerCase();
    const isManager = roleKey === "manager";

    const siteVisitFromApi = isManager ? {} : totals.siteVisitSummary || {};

    useEffect(() => {
        const loadManagerScopeData = async () => {
            if (!isManager) {
                setManagerSites(null);
                setManagerNeNames(null);
                setManagerWorkOrders(null);
                return;
            }

            // For managers, rely on server-side scoping in /api/stations and
            // /api/ne-names based on assignedRegion/assignedZone. Passing
            // multiple region/zone query params currently only uses the first
            // value on the API side, which under-counts AAZ/HQ coverage for
            // managers like Muhaba. So we intentionally omit region/zone
            // filters here.
            const qs = "";

            try {
                const [stationsR, neR] = await Promise.all([
                    fetch(qs ? `/api/stations?${qs}` : "/api/stations", {
                        cache: "no-store",
                    }),
                    fetch(qs ? `/api/ne-names?${qs}` : "/api/ne-names", {
                        cache: "no-store",
                    }),
                ]);
                if (stationsR.ok) {
                    const stationsData = await stationsR.json();
                    setManagerSites(stationsData || []);
                }
                if (neR.ok) {
                    const neData = await neR.json();
                    setManagerNeNames(neData || []);
                }
            } catch (e) {
                // ignore
            }

            try {
                const me = session?.user as any;
                if (!me?.id) return;
                const woParams = new URLSearchParams();
                woParams.set("take", "500");
                woParams.set("archived", "false");
                woParams.set("managerId", me.id);
                if (me.email) woParams.set("managerEmail", me.email);
                const woRes = await fetch(
                    `/api/workorders?${woParams.toString()}`,
                    { cache: "no-store" },
                );
                if (woRes.ok) {
                    const woData = await woRes.json();
                    setManagerWorkOrders(woData || []);
                }
            } catch (e) {
                // ignore
            }
        };

        void loadManagerScopeData();
    }, [isManager, stats?.managerScope, session?.user]);

    const lists = useMemo(() => {
        const rawLists = stats?.workOrdersByStatus || {};
        if (!isManager || !managerWorkOrders) return rawLists;
        const derived: Record<string, any[]> = {
            created: [],
            assigned: [],
            in_progress: [],
            completed: [],
        };
        for (const wo of managerWorkOrders) {
            const key = String(wo.status || "")
                .toLowerCase()
                .replace(" ", "_");
            if (derived[key]) derived[key].push(wo);
        }
        return { ...rawLists, ...derived };
    }, [stats?.workOrdersByStatus, isManager, managerWorkOrders]);

    const idToFreq = useMemo(() => {
        const map = new Map<string | number, string>();
        ["monthly", "weekly", "quarterly", "yearly", "daily"].forEach(
            (freq) => {
                const arr = (lists as any)[freq] || [];
                arr.forEach((wo: any) => map.set(wo.id, freq));
            },
        );
        return map;
    }, [lists]);

    const allWorkOrders = useMemo(() => {
        if (isManager && managerWorkOrders) return managerWorkOrders;
        const statuses = ["created", "assigned", "in_progress", "completed"];
        const merged = statuses.flatMap((st) => (lists as any)[st] || []);
        const seen = new Set<string | number>();
        const uniq: any[] = [];
        for (const wo of merged) {
            if (!seen.has(wo.id)) {
                seen.add(wo.id);
                uniq.push(wo);
            }
        }
        return uniq;
    }, [lists, isManager, managerWorkOrders]);

    const filteredWorkOrders = useMemo(() => {
        const parseDate = (wo: any) => {
            const raw =
                wo.scheduledStartAt || wo.createdAt || wo.updatedAt || null;
            const d = raw ? new Date(raw) : null;
            return d && !isNaN(d.getTime()) ? d : null;
        };
        return allWorkOrders.filter((wo) => {
            const d = parseDate(wo);
            if (selectedYear && (!d || d.getFullYear() !== selectedYear)) {
                return false;
            }
            if (
                selectedMonth !== null &&
                selectedMonth !== undefined &&
                (!d || d.getMonth() !== selectedMonth)
            ) {
                return false;
            }

            if (selectedWeek && d) {
                const day = d.getDate();
                if (selectedWeek === 1 && !(day >= 1 && day <= 7)) return false;
                if (selectedWeek === 2 && !(day >= 8 && day <= 14))
                    return false;
                if (selectedWeek === 3 && !(day >= 15 && day <= 21))
                    return false;
                if (selectedWeek === 4 && !(day >= 22)) return false;
            }

            if (selectedStatuses.size) {
                const statusRaw = String(wo.status || "").toLowerCase();
                const mappedStatus =
                    statusRaw === "assigned" && wo.planned
                        ? "scheduled"
                        : statusRaw;
                const match = Array.from(selectedStatuses).some((s) => {
                    if (s === "scheduled")
                        return (
                            mappedStatus === "scheduled" ||
                            mappedStatus === "assigned"
                        );
                    return mappedStatus === s;
                });
                if (!match) return false;
            }

            if (selectedFrequencies.size) {
                const tag = idToFreq.get(wo.id);
                if (!tag || !selectedFrequencies.has(tag)) return false;
            }

            return true;
        });
    }, [
        allWorkOrders,
        selectedYear,
        selectedMonth,
        selectedStatuses,
        selectedFrequencies,
        idToFreq,
    ]);

    const hasFiltersActive =
        !!selectedYear ||
        selectedMonth !== null ||
        !!selectedWeek ||
        selectedStatuses.size > 0 ||
        selectedFrequencies.size > 0;

    const scopeWorkOrders = hasFiltersActive
        ? filteredWorkOrders
        : allWorkOrders;

    const siteVisitDerived = useMemo(() => {
        const visitedSet = new Set(
            scopeWorkOrders
                .map((wo: any) => wo.siteId)
                .filter((id) => id !== null && id !== undefined),
        );
        return {
            visited: visitedSet.size,
            total:
                siteVisitFromApi.total || totals.siteCount || visitedSet.size,
            neverVisited: Math.max(
                0,
                (siteVisitFromApi.total || totals.siteCount || 0) -
                    visitedSet.size,
            ),
        };
    }, [scopeWorkOrders, siteVisitFromApi.total, totals.siteCount]);

    const filteredCounts = useMemo(() => {
        const countByStatus = (status: string) =>
            scopeWorkOrders.filter(
                (wo: any) =>
                    String(wo.status || "")
                        .toLowerCase()
                        .replace(" ", "_") === status,
            ).length;

        const totalWorkOrders = scopeWorkOrders.length;
        const plannedCount = scopeWorkOrders.filter(
            (wo: any) => wo.planned,
        ).length;
        const completedActiveCount = countByStatus("completed");
        const assignedCount = countByStatus("assigned");
        const inProgressCount = countByStatus("in_progress");
        const createdCount = countByStatus("created");

        // Align completion rate with Reports: include archived completed orders.
        const archivedCompletedCount =
            (totals.archivedComparison?.archived?.completed as number) || 0;
        const completedTotal = completedActiveCount + archivedCompletedCount;
        const denominator =
            inProgressCount + assignedCount + (completedTotal || 0);

        const scheduledPct = totalWorkOrders
            ? Math.round((plannedCount / totalWorkOrders) * 10000) / 100
            : 0;
        const completedPct = denominator
            ? Math.round((completedTotal / denominator) * 10000) / 100
            : 0;

        return {
            totalWorkOrders,
            plannedCount,
            completedCount: completedTotal,
            assignedCount,
            inProgressCount,
            createdCount,
            scheduledPct,
            completedPct,
            archivedCompletedCount,
        };
    }, [scopeWorkOrders]);

    const managerNeCount = useMemo(() => {
        if (!isManager || !managerSites) return null;
        const neSet = new Set<string>();
        for (const s of managerSites) {
            if (s?.neNameAndId) {
                neSet.add(String(s.neNameAndId));
            }
            if (Array.isArray(s?.allNeNames)) {
                for (const ne of s.allNeNames.filter(Boolean)) {
                    neSet.add(String(ne));
                }
            }
        }
        return neSet.size;
    }, [isManager, managerSites]);

    const managerSiteRowCount = useMemo(() => {
        if (!isManager || !managerSites) return null;
        let rows = 0;
        for (const s of managerSites) {
            const perSiteNeSet = new Set<string>();

            if (s?.neNameAndId) {
                perSiteNeSet.add(String(s.neNameAndId));
            }

            if (Array.isArray(s?.allNeNames)) {
                for (const ne of s.allNeNames.filter(Boolean)) {
                    perSiteNeSet.add(String(ne));
                }
            }

            rows += perSiteNeSet.size || 1;
        }
        return rows;
    }, [isManager, managerSites]);

    const effectiveTotals = isManager
        ? {
              ...totals,
              siteCount: managerSiteRowCount ?? totals.siteCount ?? undefined,
              neCount: managerNeCount ?? totals.neCount ?? undefined,
          }
        : totals;

    const displayTotals = {
        ...effectiveTotals,
        ...filteredCounts,
        maintenanceCount:
            isManager && managerWorkOrders
                ? filteredCounts.totalWorkOrders
                : effectiveTotals.maintenanceCount,
        siteCount:
            effectiveTotals.siteCount ||
            siteVisitDerived.total ||
            siteVisitFromApi.total,
    } as any;

    const displaySiteVisit = {
        visited: siteVisitDerived.visited || siteVisitFromApi.visited || 0,
        total:
            siteVisitDerived.total ||
            siteVisitFromApi.total ||
            displayTotals.siteCount ||
            0,
        neverVisited:
            siteVisitDerived.neverVisited || siteVisitFromApi.neverVisited || 0,
        topVisited: siteVisitFromApi.topVisited || [],
        neSitesNoWorkOrders: siteVisitFromApi.neSitesNoWorkOrders ?? 0,
    } as any;

    const managerCreationCounts = useMemo(() => {
        if (!isManager || !managerWorkOrders) return null;
        const counts = { autoScheduler: 0, manual: 0 };
        const source = hasFiltersActive ? scopeWorkOrders : managerWorkOrders;
        for (const row of source) {
            const desc = String(row?.description || "");
            const isAuto = /^Auto-scheduled PM task/.test(desc);
            if (isAuto) counts.autoScheduler += 1;
            else counts.manual += 1;
        }
        return counts;
    }, [isManager, managerWorkOrders, hasFiltersActive, scopeWorkOrders]);

    const creationCounts =
        (isManager && managerCreationCounts) ||
        totals.creationSourceCounts ||
        ({ autoScheduler: 0, manual: 0 } as any);
    const completionByRole =
        totals.completionByRole ||
        ({ supervisor: 0, passenger: 0, other: 0 } as any);
    const neSitesNoWorkOrders = displaySiteVisit.neSitesNoWorkOrders || 0;

    const derivedTopVisited = useMemo(() => {
        const map = new Map<
            string,
            {
                id: string;
                name: string;
                siteCode: string | null;
                visits: number;
            }
        >();
        for (const wo of scopeWorkOrders) {
            if (!wo.siteId) continue;
            const id = String(wo.siteId);
            const title = String(wo.title || "");
            const neHint = title.includes(" - ")
                ? title.split(" - ").slice(1).join(" - ").trim()
                : "";
            const existing = map.get(id) || {
                id,
                name:
                    (wo.site?.name || wo.site?.siteCode || "Unknown site") +
                    (neHint ? ` (${neHint})` : ""),
                siteCode: wo.site?.siteCode || null,
                visits: 0,
            };
            existing.visits += 1;
            map.set(id, existing);
        }
        return Array.from(map.values())
            .sort((a, b) => b.visits - a.visits)
            .slice(0, 8);
    }, [scopeWorkOrders]);

    const topVisitedSites = (displaySiteVisit.topVisited || []).length
        ? displaySiteVisit.topVisited
        : derivedTopVisited;

    const schedulePct =
        Math.round((displayTotals.scheduledPct || 0) * 100) / 100;
    const completedPct =
        Math.round((displayTotals.completedPct || 0) * 100) / 100;

    const _allRows = scopeWorkOrders.map((wo: any) => ({
        id: wo.id,
        title: wo.title,
        status: wo.status,
        team: wo.team?.name,
        site: wo.site?.name,
        assignee: wo.assignedTo?.fullName,
        scheduledStartAt: wo.scheduledStartAt,
        createdAt: wo.createdAt,
    }));
    const seenIds = new Set<string>();
    const tableRows = [] as any[];
    for (const r of _allRows) {
        const key = r && r.id != null ? String(r.id) : JSON.stringify(r);
        if (!seenIds.has(key)) {
            seenIds.add(key);
            tableRows.push(r);
        }
        if (tableRows.length >= 50) break;
    }

    // Build chart series and aggregates (safe to run even if stats missing)
    const {
        chartData,
        frequencySeries,
        overdueByType,
        monthlyCostSeries,
        statusPieData,
    } = useMemo(() => {
        // helper to get month label
        const monthLabel = (d: Date) =>
            d.toLocaleString(undefined, { month: "short", year: "numeric" });

        // last 6 months
        const buckets: { label: string; start: Date; end: Date }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const start = new Date(dt.getFullYear(), dt.getMonth(), 1);
            const end = new Date(dt.getFullYear(), dt.getMonth() + 1, 1);
            buckets.push({ label: monthLabel(start), start, end });
        }

        const allWOs = scopeWorkOrders as any[];

        const chartData = buckets.map((b) => {
            const inBucket = allWOs.filter((wo) => {
                const d = wo.scheduledStartAt
                    ? new Date(wo.scheduledStartAt)
                    : new Date(wo.createdAt || wo.updatedAt || null);
                if (!d || isNaN(d.getTime())) return false;
                return d >= b.start && d < b.end;
            });

            const completed = inBucket.filter(
                (w) => (w.status || "").toLowerCase() === "completed",
            ).length;
            const scheduled = inBucket.filter((w) => !!w.planned).length;

            // compute cost for month from attachments and parts if present
            let monthCost = 0;
            for (const wo of inBucket) {
                if (Array.isArray(wo.attachments)) {
                    for (const a of wo.attachments) {
                        monthCost += Number(
                            a.actualCost || a.estimatedCost || 0,
                        );
                    }
                }
                if (Array.isArray(wo.parts)) {
                    for (const p of wo.parts) {
                        const unit = p?.part?.unitCost || 0;
                        monthCost += unit * (p.quantity || 0);
                    }
                }
            }

            // represent scheduled as 100% baseline when scheduled exists, and compute completed percent
            // If there are scheduled bookings in the month, compute completed% = completed / scheduled
            // Otherwise fallback to completed% = completed / total bookings in the month so we still show progress
            const scheduledPct = inBucket.length && scheduled > 0 ? 100 : 0;
            const completedPct =
                scheduled > 0
                    ? Math.round((completed / scheduled) * 10000) / 100
                    : inBucket.length
                      ? Math.round((completed / inBucket.length) * 10000) / 100
                      : 0;
            // include a hover key set to 100 so the invisible region spans full chart height and reliably captures pointer events
            return {
                month: b.label,
                completed,
                scheduled,
                cost: Math.round(monthCost),
                scheduledPct,
                completedPct,
                hover: 100,
            };
        });

        // frequency series (monthly, weekly, quarterly, yearly)
        const freqKeys = ["monthly", "weekly", "quarterly", "yearly", "daily"];
        const frequencySeries = freqKeys.map((k) => {
            const completed = allWOs.filter(
                (w: any) =>
                    idToFreq.get(w.id) === k &&
                    (w.status || "").toLowerCase() === "completed",
            ).length;
            const scheduled = allWOs.filter(
                (w: any) => idToFreq.get(w.id) === k && !!w.planned,
            ).length;
            return {
                frequency: k.charAt(0).toUpperCase() + k.slice(1),
                completed,
                scheduled,
            };
        });

        // overdue % by checklist type (use checklistTemplate.type/name if available)
        const typeMap: Record<
            string,
            { total: number; overdue: number; completed: number }
        > = {};
        for (const wo of allWOs) {
            let t: string = "Unknown";
            try {
                if (wo.template && wo.template.checklistTemplate) {
                    const ct = wo.template.checklistTemplate;
                    if (typeof ct === "string" && ct.trim()) {
                        t = ct;
                    } else if (typeof ct === "object" && ct !== null) {
                        t =
                            ((ct.type ||
                                ct.name ||
                                ct.checklistType) as string) ||
                            JSON.stringify(ct);
                    }
                } else if (wo.type) {
                    t = wo.type;
                } else if (wo.template && wo.template.name) {
                    t = wo.template.name;
                }
            } catch (e) {
                t = "Unknown";
            }

            if (!typeMap[t])
                typeMap[t] = { total: 0, overdue: 0, completed: 0 };
            typeMap[t].total += 1;
            const s = (wo.status || "").toLowerCase();
            if (s === "overdue") typeMap[t].overdue += 1;
            if (s === "completed") typeMap[t].completed += 1;
        }

        // produce stacked-percent data: overduePercent and otherPercent (non-overdue)
        const overdueByType = Object.entries(typeMap)
            .map(([name, v]) => {
                const overduePct = v.total ? (v.overdue / v.total) * 100 : 0;
                const otherPct = Math.max(0, 100 - overduePct);
                return {
                    name,
                    overdue: Math.round(overduePct * 100) / 100,
                    other: Math.round(otherPct * 100) / 100,
                    total: v.total,
                    overdueCount: v.overdue,
                };
            })
            .sort((a, b) => b.overdue - a.overdue);

        // monthly cost series for larger chart (client fallback)
        const monthlyCostSeries = chartData.map((d) => ({
            month: d.month,
            cost: d.cost,
        }));

        // pie for maintenance by status
        const sourceWos = hasFiltersActive
            ? scopeWorkOrders
            : (allWOs as any[]);
        const countBy = (st: string) =>
            sourceWos.filter(
                (wo: any) =>
                    String(wo.status || "")
                        .toLowerCase()
                        .replace(" ", "_") === st,
            ).length;
        const scheduledCount = sourceWos.filter(
            (wo: any) => !!wo.planned,
        ).length;

        const statusPieData = [
            { name: "Completed", value: countBy("completed") || 0 },
            { name: "Unassigned", value: 0 },
            { name: "In Progress", value: countBy("in_progress") || 0 },
            { name: "Scheduled", value: scheduledCount || 0 },
        ];

        return {
            chartData,
            frequencySeries,
            overdueByType,
            monthlyCostSeries,
            statusPieData,
        };
    }, [lists, scopeWorkOrders, idToFreq, hasFiltersActive]);

    // displayed completed and pct depend on hover (show hovered frequency values) or use totals
    const hoveredCompleted = freqHover?.data
        ? Number(freqHover.data.completed || 0)
        : null;
    const hoveredScheduled = freqHover?.data
        ? Number(freqHover.data.scheduled || 0)
        : null;

    // Custom tooltip to ensure hover shows meaningful values
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null;
        const row = payload[0].payload || {};
        const scheduled = row.scheduled || 0;
        const completed = row.completed || 0;
        const scheduledPct = row.scheduledPct || 0;
        const completedPct = row.completedPct || 0;
        return (
            <div className="bg-card border p-2 rounded shadow-sm text-sm">
                <div className="font-semibold mb-1">{label}</div>
                <div>
                    Scheduled: {scheduled} ({scheduledPct}%)
                </div>
                <div>
                    Completed: {completed} ({completedPct}%)
                </div>
            </div>
        );
    };

    // custom arrow-shaped bar for a more Excel-like visual
    const ArrowBar = (props: any) => {
        const { x, y, width, height, fill } = props;
        // scale triangle height relative to bar height but keep a minimum for visibility
        const triH = Math.min(20, Math.max(8, height * 0.18));
        const rectH = Math.max(0, height - triH);
        const rectX = x + width * 0.2;
        const rectW = width * 0.6;
        const rectY = y + triH;
        const triLeftX = x + width * 0.28;
        const triRightX = x + width * 0.72;
        const triTopX = x + width / 2;
        const triTopY = y;
        const triBaseY = y + triH;
        return (
            <g>
                <rect
                    x={rectX}
                    y={rectY}
                    width={rectW}
                    height={rectH}
                    fill={fill}
                    rx={6}
                />
                <polygon
                    points={`${triLeftX},${triBaseY} ${triRightX},${triBaseY} ${triTopX},${triTopY}`}
                    fill={fill}
                />
            </g>
        );
    };

    // prefer server-provided frequency series when available, but ensure all expected
    // frequency buckets exist and are in a consistent order (Monthly, Weekly, Quarterly, Yearly, Daily)
    const serverFrequency =
        stats?.frequencySeries && Array.isArray(stats.frequencySeries)
            ? stats.frequencySeries
            : null;
    const sourceFrequency = serverFrequency || frequencySeries || [];
    const freqOrder = ["Monthly", "Weekly", "Quarterly", "Yearly", "Daily"];
    const normalizeKey = (f: any) => {
        if (!f) return "";
        const cand = (f.frequency || f.label || f.name || "").toString();
        return cand.trim().toLowerCase();
    };
    const srcMap = new Map<string, any>();
    for (const f of sourceFrequency) {
        const k = normalizeKey(f);
        if (k) srcMap.set(k, f);
    }
    const usedFrequency = freqOrder.map((label) => {
        const key = label.toLowerCase();
        if (srcMap.has(key)) return srcMap.get(key);
        // try to find a best-match in source (in case server used slightly different label)
        for (const [k, v] of srcMap.entries()) {
            if (k.includes(key) || key.includes(k)) return v;
        }
        return { frequency: label, completed: 0, scheduled: 0 };
    });

    const completedVsScheduledData =
        isManager && managerWorkOrders
            ? [
                  {
                      frequency: "Current",
                      completed: filteredCounts.completedCount || 0,
                      scheduled: filteredCounts.plannedCount || 0,
                  },
              ]
            : stats?.archivedComparison
              ? [
                    {
                        frequency: "Ongoing",
                        completed:
                            stats.archivedComparison.ongoing?.completed || 0,
                        scheduled:
                            stats.archivedComparison.ongoing?.scheduled || 0,
                    },
                    {
                        frequency: "Archived",
                        completed:
                            stats.archivedComparison.archived?.completed || 0,
                        scheduled:
                            stats.archivedComparison.archived?.scheduled || 0,
                    },
                ]
              : usedFrequency;

    // compute max for frequency chart y-axis (avoid zero-domain), round up to a nice value
    const rawMax = Math.max(
        10,
        ...(completedVsScheduledData || []).map((f: any) =>
            Math.max(Number(f.completed || 0), Number(f.scheduled || 0)),
        ),
    );
    const freqMax = Math.ceil(rawMax / 5) * 5; // round to nearest 5

    // compute completed total from the normalized frequency series, fallback to server totals
    const completedTotal = totals.completedCount || 0;

    // displayed completed and pct depend on hover (show hovered frequency values) or use totals
    const displayedCompleted =
        hoveredCompleted != null ? hoveredCompleted : completedTotal;
    const displayedPct =
        hoveredScheduled != null
            ? hoveredScheduled > 0
                ? Math.round(
                      ((hoveredCompleted ?? 0) / hoveredScheduled) * 10000,
                  ) / 100
                : 0
            : completedPct;

    // Prefer server-provided series when available
    const serverMonthly = stats?.monthlyCostSeries || null;
    const serverOverdue = stats?.overdueByTypeServer || null;
    const finalMonthlySeries =
        serverMonthly && Array.isArray(serverMonthly)
            ? serverMonthly
            : monthlyCostSeries;
    const rawOverdue =
        serverOverdue && Array.isArray(serverOverdue)
            ? serverOverdue.map((s: any) => ({
                  name: s.name,
                  overduePct:
                      s.overduePct ??
                      (s.total ? (s.overdue / s.total) * 100 : 0),
                  total: s.total || 0,
              }))
            : overdueByType.map((s: any) => ({
                  name: s.name,
                  overduePct: s.overdue || 0,
                  total: s.total || 0,
              }));

    // Normalize checklist/template content into simple categories: Room, Equipment, Room and Equipment
    const normalizeType = (raw: any) => {
        if (!raw && raw !== 0) return "Other";
        try {
            // If it's an object, try common fields
            if (typeof raw === "object") {
                const keys = [
                    "category",
                    "type",
                    "checklistLevel",
                    "checklistType",
                    "name",
                ];
                for (const k of keys) {
                    if (raw[k]) raw = raw[k];
                }
                // If object contains findings or tasks, search their text
                const textParts: string[] = [];
                if (Array.isArray(raw?.findings))
                    textParts.push(...raw.findings.map((f: any) => String(f)));
                if (raw?.task) textParts.push(String(raw.task));
                if (textParts.length) raw = textParts.join(" ");
            }

            // Convert to string and clean up
            const s = String(raw)
                .replace(/[_\n\r]/g, " ")
                .replace(/[^a-zA-Z0-9 ]/g, " ")
                .toLowerCase();

            const hasRoom = /\b(room|room\s|environment|env|site)\b/.test(s);
            const hasEquipment =
                /\b(equip|equipment|rack|filter|fan|pm|maintenance|asset)\b/.test(
                    s,
                );

            if (hasRoom && hasEquipment) return "Room and Equipment";
            if (hasRoom) return "Room";
            if (hasEquipment) return "Equipment";

            // Fallback: look for specific keywords
            if (s.includes("room")) return "Room";
            if (
                s.includes("equipment") ||
                s.includes("rack") ||
                s.includes("filter")
            )
                return "Equipment";
        } catch (e) {
            // ignore and fallback
        }
        return "Other";
    };

    // Use server-provided detailed types when available, otherwise client-side computed list
    const displayOverdueRaw =
        stats?.overdueByTypeServer && Array.isArray(stats.overdueByTypeServer)
            ? stats.overdueByTypeServer.map((s: any) => ({
                  name: s.name,
                  overdue: Number(s.overduePct || s.overdue || 0),
                  total: s.total || 0,
              }))
            : overdueByType;

    // Helper to produce a short, clean label from long checklist/template content
    const cleanLabel = (raw: any) => {
        try {
            if (!raw && raw !== 0) return "Unknown";
            // If looks like JSON string, try parse
            if (typeof raw === "string") {
                const trimmed = raw.trim();
                if (
                    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                    (trimmed.startsWith("[") && trimmed.endsWith("]"))
                ) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        // try common fields
                        if (parsed.name)
                            return String(parsed.name).slice(0, 30);
                        if (parsed.type)
                            return String(parsed.type).slice(0, 30);
                        if (parsed.task)
                            return String(parsed.task).slice(0, 30);
                        // fallback to stringified keys
                        return Object.keys(parsed)
                            .slice(0, 1)
                            .join(", ")
                            .slice(0, 30);
                    } catch (e) {
                        // not JSON
                    }
                }
            }
            // If it's an object, inspect fields
            if (typeof raw === "object") {
                if (raw.name) return String(raw.name).slice(0, 30);
                if (raw.task) return String(raw.task).slice(0, 30);
                if (raw.type) return String(raw.type).slice(0, 30);
                // join a few values
                const vals = Object.values(raw)
                    .slice(0, 3)
                    .map((v) => String(v))
                    .join(" ");
                return vals.slice(0, 30);
            }
            // otherwise, collapse whitespace and take a short prefix before punctuation
            const s = String(raw)
                .replace(/\s+/g, " ")
                .replace(/["'\[\]\{\}]/g, "")
                .trim();
            const parts = s
                .split(/[,;:\n\r\-\|]/)
                .map((p) => p.trim())
                .filter(Boolean);
            const candidate = parts[0] || s;
            return candidate.length > 30
                ? candidate.slice(0, 27) + "..."
                : candidate;
        } catch (e) {
            return "Unknown";
        }
    };

    // Ensure labels exist and sort by overdue desc; attach cleaned short label
    const _finalOverdue = (displayOverdueRaw || [])
        .map((d: any) => ({
            name: d.name || "Unknown",
            label: cleanLabel(d.name),
            overdue: Number(d.overdue || 0),
            other: Math.max(0, 100 - Number(d.overdue || 0)),
            total: d.total || 0,
        }))
        .sort((a: any, b: any) => b.overdue - a.overdue);
    // move a top-level 'All' entry (if present) to the front so it displays first
    const finalOverdueByType = (() => {
        const copy = [..._finalOverdue];
        const idx = copy.findIndex(
            (x) => (x.name || "").toLowerCase() === "all",
        );
        if (idx > 0) {
            const [all] = copy.splice(idx, 1);
            copy.unshift(all);
        }
        return copy;
    })();

    if (loading) return <div>Loading dashboard...</div>;
    if (!stats) return <div className="p-4 bg-background rounded">No data</div>;

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from(
        new Set([currentYear - 2, currentYear - 1, currentYear]),
    ).sort((a, b) => a - b);

    return (
        <div className="min-h-[760px] text-sm">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                {/* Left filters */}
                <aside className="order-2 col-span-12 space-y-4 lg:order-1 lg:col-span-3">
                    <div className="rounded border bg-card p-3 shadow-sm">
                        <h4 className="text-xs font-semibold text-muted-foreground">
                            Year
                        </h4>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                            {yearOptions.map((year) => {
                                const active = selectedYear === year;
                                return (
                                    <button
                                        key={year}
                                        className={`rounded border px-2 py-1 text-sm text-left ${
                                            active
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "text-foreground"
                                        }`}
                                        onClick={() => {
                                            setSelectedYear((prev) =>
                                                prev === year ? null : year,
                                            );
                                            setSelectedMonth(null);
                                            setSelectedWeek(null);
                                        }}
                                    >
                                        {year}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="rounded border bg-card p-3 shadow-sm">
                        <h4 className="text-xs font-semibold text-muted-foreground">
                            Month
                        </h4>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                            {[
                                "Jan",
                                "Feb",
                                "Mar",
                                "Apr",
                                "May",
                                "Jun",
                                "Jul",
                                "Aug",
                                "Sep",
                                "Oct",
                                "Nov",
                                "Dec",
                            ].map((m, idx) => {
                                const active = selectedMonth === idx;
                                return (
                                    <button
                                        key={m}
                                        className={`rounded border px-2 py-1 text-xs ${
                                            active
                                                ? "bg-primary/10 border-primary text-primary"
                                                : "text-foreground"
                                        }`}
                                        onClick={() =>
                                            setSelectedMonth((prev) => {
                                                const next =
                                                    prev === idx ? null : idx;
                                                // reset week when month changes
                                                setSelectedWeek(null);
                                                return next;
                                            })
                                        }
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {selectedYear &&
                        selectedMonth !== null &&
                        selectedMonth !== undefined && (
                            <div className="rounded border bg-card p-3 shadow-sm">
                                <h4 className="text-xs font-semibold text-muted-foreground">
                                    Week
                                </h4>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                    {[1, 2, 3, 4].map((w) => {
                                        const active = selectedWeek === w;
                                        return (
                                            <button
                                                key={w}
                                                className={`rounded border px-2 py-1 text-xs text-left ${
                                                    active
                                                        ? "bg-primary/10 border-primary text-primary"
                                                        : "text-foreground"
                                                }`}
                                                onClick={() =>
                                                    setSelectedWeek((prev) =>
                                                        prev === w ? null : w,
                                                    )
                                                }
                                            >
                                                {`W${w}`}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    <div className="rounded border bg-card p-3 shadow-sm">
                        <h4 className="text-sm font-semibold">Sites Visited</h4>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                            <span>Visited</span>
                            <span>
                                {displaySiteVisit.visited}/
                                {displaySiteVisit.total}
                            </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-2 bg-primary"
                                style={{
                                    width: `${
                                        displaySiteVisit.total
                                            ? Math.min(
                                                  100,
                                                  (displaySiteVisit.visited /
                                                      displaySiteVisit.total) *
                                                      100,
                                              )
                                            : 0
                                    }%`,
                                }}
                            />
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                            <span>Never visited</span>
                            <span>{displaySiteVisit.neverVisited || 0}</span>
                        </div>
                    </div>
                </aside>

                {/* Main content */}
                <section className="order-1 col-span-12 space-y-4 lg:order-2 lg:col-span-9">
                    {/* Top KPI row matching Excel layout */}
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3">
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-[11px] text-muted-foreground">
                                Completed by Manager
                            </div>
                            <div className="text-xl font-semibold">--</div>
                        </div>
                        <div className="flex flex-col gap-1 rounded border p-2">
                            <div className="text-[11px] text-muted-foreground">
                                Completed by Passengers
                            </div>
                            <div className="text-xl font-semibold">--</div>
                        </div>
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                No. of Maintenance
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {displayTotals.maintenanceCount || 0}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                NE Count
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {displayTotals.neCount || 0}
                            </div>
                        </div>
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                Site Count
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {displayTotals.siteCount || 0}
                            </div>
                        </div>
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                Auto Scheduler WOs
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {creationCounts.autoScheduler || 0}
                            </div>
                        </div>
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                Manual WOs
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {creationCounts.manual || 0}
                            </div>
                        </div>
                        <div className="rounded border bg-card p-4 text-center shadow-sm">
                            <div className="text-xs text-muted-foreground">
                                Scheduled %
                            </div>
                            <div className="mt-2 text-2xl font-semibold">
                                {schedulePct}%
                            </div>
                        </div>
                    </div>

                    {roleKey === "admin" && (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            <div className="rounded border bg-card p-4 text-center shadow-sm">
                                <div className="text-xs text-muted-foreground">
                                    Total Users
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {totals.userCount || 0}
                                </div>
                            </div>
                            <div className="rounded border bg-card p-4 text-center shadow-sm">
                                <div className="text-xs text-muted-foreground">
                                    Regions
                                </div>
                                <div
                                    className="mt-2 text-2xl font-semibold"
                                    title={totals.regionNames?.length ? totals.regionNames.join(', ') : undefined}
                                >
                                    {totals.regionCount || 0}
                                </div>
                            </div>
                            <div className="rounded border bg-card p-4 text-center shadow-sm">
                                <div className="text-xs text-muted-foreground">
                                    Zones
                                </div>
                                <div className="mt-2 text-2xl font-semibold" title={totals.zoneNames?.length ? totals.zoneNames.join(', ') : undefined}>
                                    {totals.zoneCount || 0}
                                </div>
                            </div>
                            <div className="rounded border bg-card p-4 text-center shadow-sm">
                                <div className="text-xs text-muted-foreground">
                                    Passengers
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {totals.passengerCount || 0}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                        {/* Center charts area (middle) */}
                        <div className="col-span-12 rounded border bg-card p-4 shadow-sm lg:col-span-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold">
                                    Completed Vs Scheduled
                                </h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setExpandedCard("freq")}
                                        className="text-xs px-2 py-1 rounded border bg-card hover:bg-muted/60"
                                        aria-label="Expand Completed Vs Scheduled"
                                    >
                                        Expand
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3 h-52 relative">
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart
                                        data={completedVsScheduledData}
                                        margin={{
                                            top: 24,
                                            right: 8,
                                            left: 0,
                                            bottom: 8,
                                        }}
                                        barGap={8}
                                        barCategoryGap="32%"
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#f1f1f1"
                                        />
                                        <XAxis
                                            dataKey="frequency"
                                            tick={{ fontSize: 12 }}
                                        />
                                        <YAxis
                                            domain={[0, freqMax]}
                                            tick={{ fontSize: 12 }}
                                            allowDecimals={false}
                                        />
                                        <Tooltip
                                            formatter={(
                                                value: any,
                                                name: any,
                                            ) => [value, name]}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: 12 }}
                                        />
                                        {/* Scheduled as smaller orange arrow (render first so completed overlays it) */}
                                        <Bar
                                            dataKey="scheduled"
                                            fill="#f59e0b"
                                            barSize={26}
                                            shape={ArrowBar}
                                            onMouseEnter={(d: any) =>
                                                setFreqHover({
                                                    label: d?.payload
                                                        ?.frequency,
                                                    data: d?.payload,
                                                })
                                            }
                                            onMouseMove={(d: any) =>
                                                setFreqHover({
                                                    label: d?.payload
                                                        ?.frequency,
                                                    data: d?.payload,
                                                })
                                            }
                                            onMouseLeave={() =>
                                                setFreqHover(null)
                                            }
                                        >
                                            <LabelList
                                                dataKey="scheduled"
                                                position="top"
                                                dy={-6}
                                                style={{
                                                    fill: "#92400e",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}
                                            />
                                        </Bar>
                                        {/* Completed as green arrow (render after so it's on top) */}
                                        <Bar
                                            dataKey="completed"
                                            fill="#10b981"
                                            barSize={34}
                                            shape={ArrowBar}
                                            onMouseEnter={(d: any) =>
                                                setFreqHover({
                                                    label: d?.payload
                                                        ?.frequency,
                                                    data: d?.payload,
                                                })
                                            }
                                            onMouseMove={(d: any) =>
                                                setFreqHover({
                                                    label: d?.payload
                                                        ?.frequency,
                                                    data: d?.payload,
                                                })
                                            }
                                            onMouseLeave={() =>
                                                setFreqHover(null)
                                            }
                                        >
                                            <LabelList
                                                dataKey="completed"
                                                position="top"
                                                style={{
                                                    fill: "#065f46",
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                }}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                                {/* manual tooltip fixed to top-right of chart area so it doesn't get clipped by stacking contexts */}
                                {hoverTooltip.visible && hoverTooltip.data && (
                                    <div className="absolute right-4 top-4 bg-card border p-2 rounded shadow-sm text-sm w-44">
                                        <div className="font-semibold mb-1">
                                            {hoverTooltip.label}
                                        </div>
                                        <div>
                                            Scheduled:{" "}
                                            {hoverTooltip.data.scheduled || 0} (
                                            {hoverTooltip.data.scheduledPct ??
                                                0}
                                            %)
                                        </div>
                                        <div>
                                            Completed:{" "}
                                            {hoverTooltip.data.completed || 0} (
                                            {hoverTooltip.data.completedPct ??
                                                0}
                                            %)
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right small charts area */}
                    </div>

                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                        <div className="col-span-12 rounded border bg-card p-3 shadow-sm lg:col-span-8">
                            <h4 className="text-sm font-semibold">
                                Sites Visited (Top)
                            </h4>
                            <div className="mt-3 h-44">
                                <ResponsiveContainer width="100%" height={190}>
                                    <BarChart
                                        data={topVisitedSites}
                                        margin={{
                                            top: 6,
                                            right: 8,
                                            left: 0,
                                            bottom: 28,
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#e5e7eb"
                                        />
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 7 }}
                                            interval={0}
                                            angle={-35}
                                            textAnchor="end"
                                            height={70}
                                            tickMargin={8}
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <Tooltip
                                            formatter={(v: any) => [
                                                `${v} visits`,
                                                "Visits",
                                            ]}
                                        />
                                        <Bar
                                            dataKey="visits"
                                            fill="#10b981"
                                            barSize={22}
                                        >
                                            <LabelList
                                                dataKey="visits"
                                                position="top"
                                                style={{ fontSize: 7 }}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="col-span-12 rounded border bg-card p-3 shadow-sm lg:col-span-4">
                            <h4 className="text-sm font-semibold">
                                # of Maintenance by Status
                            </h4>
                            <div className="mt-3 h-28 flex items-center">
                                <div className="w-1/2 flex items-center justify-center">
                                    <ResponsiveContainer
                                        width={140}
                                        height={100}
                                    >
                                        <PieChart>
                                            <Pie
                                                data={statusPieData}
                                                dataKey="value"
                                                nameKey="name"
                                                outerRadius={44}
                                                label={false}
                                            >
                                                {(() => {
                                                    // Compute unassignedVal in parent scope
                                                    const findVal = (
                                                        names: string[],
                                                    ) =>
                                                        (
                                                            statusPieData || []
                                                        ).find((s: any) =>
                                                            names.includes(
                                                                String(
                                                                    s.name ||
                                                                        "",
                                                                ).toLowerCase(),
                                                            ),
                                                        )?.value;
                                                    const completedVal =
                                                        findVal([
                                                            "completed",
                                                        ]) ??
                                                        totals.completedCount ??
                                                        completedTotal ??
                                                        0;
                                                    const unassignedVal =
                                                        roleKey === "admin"
                                                            ? scopeWorkOrders.filter(
                                                                  (wo: any) =>
                                                                      !wo.assignedToId &&
                                                                      !wo.assignedTo,
                                                              ).length || 0
                                                            : 0;
                                                    return (
                                                        statusPieData || []
                                                    ).map(
                                                        (
                                                            entry: any,
                                                            idx: number,
                                                        ) => {
                                                            const nm = String(
                                                                entry.name ||
                                                                    "",
                                                            )
                                                                .toLowerCase()
                                                                .trim();
                                                            // Debug: log all pie slice names and values
                                                            if (
                                                                typeof window !==
                                                                "undefined"
                                                            ) {
                                                                // eslint-disable-next-line no-console
                                                                console.log(
                                                                    "Pie slice:",
                                                                    nm,
                                                                    entry.value,
                                                                );
                                                            }
                                                            const colorMap: Record<
                                                                string,
                                                                string
                                                            > = {
                                                                created:
                                                                    "#ef4444",
                                                                unassigned:
                                                                    "#6b7280",
                                                                overdue:
                                                                    "#ef4444",
                                                                assigned:
                                                                    "#f59e0b",
                                                                scheduled:
                                                                    "#f59e0b",
                                                                "in progress":
                                                                    "#3b82f6",
                                                                in_progress:
                                                                    "#3b82f6",
                                                                completed:
                                                                    "#10b981",
                                                            };
                                                            let fill =
                                                                colorMap[nm] ||
                                                                colorMap[
                                                                    nm.replace(
                                                                        /\s+/g,
                                                                        "_",
                                                                    )
                                                                ] ||
                                                                "#6b7280";
                                                            // Final fallback: if this slice's value matches the Unassigned count, force gray
                                                            if (
                                                                nm.includes(
                                                                    "unassigned",
                                                                ) ||
                                                                (typeof unassignedVal !==
                                                                    "undefined" &&
                                                                    entry.value ===
                                                                        unassignedVal)
                                                            ) {
                                                                fill =
                                                                    "#6b7280";
                                                            }
                                                            return (
                                                                <Cell
                                                                    key={`slice-${idx}`}
                                                                    fill={fill}
                                                                />
                                                            );
                                                        },
                                                    );
                                                })()}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="w-1/2 flex flex-col justify-center gap-1 text-xs">
                                    {(() => {
                                        const findVal = (names: string[]) =>
                                            (statusPieData || []).find(
                                                (s: any) =>
                                                    names.includes(
                                                        String(
                                                            s.name || "",
                                                        ).toLowerCase(),
                                                    ),
                                            )?.value;
                                        // prefer explicit values from statusPieData, but fall back to totals or lists where available
                                        const completedVal =
                                            findVal(["completed"]) ??
                                            totals.completedCount ??
                                            completedTotal ??
                                            0;
                                        // Unassigned: for admin, count bookings with no assignedToId or assignedTo, for others use 0
                                        const unassignedVal =
                                            roleKey === "admin"
                                                ? scopeWorkOrders.filter(
                                                      (wo: any) =>
                                                          !wo.assignedToId &&
                                                          !wo.assignedTo,
                                                  ).length || 0
                                                : 0;
                                        const inProgressVal =
                                            findVal([
                                                "in progress",
                                                "in_progress",
                                                "inprogress",
                                            ]) ??
                                            ((lists?.in_progress || [])
                                                .length ||
                                                totals.inProgressCount ||
                                                0);
                                        const scheduledVal =
                                            findVal([
                                                "assigned",
                                                "scheduled",
                                            ]) ??
                                            ((lists?.assigned || []).length ||
                                                totals.scheduledCount ||
                                                totals.plannedCount ||
                                                0);
                                        return [
                                            {
                                                label: "Completed",
                                                color: "#10b981",
                                                value: completedVal,
                                            },
                                            {
                                                label: "Unassigned",
                                                color: "#9ca3af",
                                                value: unassignedVal,
                                            },
                                            {
                                                label: "In Progress",
                                                color: "#3b82f6",
                                                value: inProgressVal,
                                            },
                                            {
                                                label: "Scheduled",
                                                color: "#f59e0b",
                                                value: scheduledVal,
                                            },
                                        ].map((it) => (
                                            <div
                                                key={it.label}
                                                className="flex items-center justify-start gap-3"
                                            >
                                                <span
                                                    className="w-3 h-3 rounded-sm"
                                                    style={{
                                                        background: it.color,
                                                    }}
                                                />
                                                <div>
                                                    <div className="font-medium text-xs">
                                                        {it.label}
                                                    </div>
                                                    <div className="text-muted-foreground text-[11px]">
                                                        {it.value}
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <SectionCards totals={displayTotals} />

                    <div className="rounded border bg-card p-2 shadow-sm">
                        <DataTable rows={tableRows as any} />
                    </div>
                </section>
            </div>

            {/* Overlay for expanded card views */}
            {expandedCard === "freq" && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/50">
                    <div className="bg-card rounded shadow-lg w-[98%] max-w-none max-h-[95vh] overflow-auto p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">
                                Completed Vs Scheduled
                            </h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setExpandedCard(null)}
                                    className="text-sm px-3 py-1 rounded border bg-card hover:bg-muted/60"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                        <div className="h-[480px]">
                            <ResponsiveContainer width="100%" height={440}>
                                <BarChart
                                    data={usedFrequency}
                                    margin={{
                                        top: 32,
                                        right: 12,
                                        left: 0,
                                        bottom: 12,
                                    }}
                                    barGap={12}
                                    barCategoryGap="24%"
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="#f1f1f1"
                                    />
                                    <XAxis
                                        dataKey="frequency"
                                        tick={{ fontSize: 12 }}
                                    />
                                    <YAxis
                                        domain={[0, freqMax]}
                                        tick={{ fontSize: 12 }}
                                        allowDecimals={false}
                                    />
                                    <Tooltip
                                        formatter={(value: any, name: any) => [
                                            value,
                                            name,
                                        ]}
                                    />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Bar
                                        dataKey="scheduled"
                                        fill="#f59e0b"
                                        barSize={34}
                                        shape={ArrowBar}
                                        onMouseEnter={(d: any) =>
                                            setFreqHover({
                                                label: d?.payload?.frequency,
                                                data: d?.payload,
                                            })
                                        }
                                        onMouseMove={(d: any) =>
                                            setFreqHover({
                                                label: d?.payload?.frequency,
                                                data: d?.payload,
                                            })
                                        }
                                        onMouseLeave={() => setFreqHover(null)}
                                    >
                                        <LabelList
                                            dataKey="scheduled"
                                            position="top"
                                            dy={-8}
                                            style={{
                                                fill: "#92400e",
                                                fontSize: 13,
                                                fontWeight: 700,
                                            }}
                                        />
                                    </Bar>
                                    <Bar
                                        dataKey="completed"
                                        fill="#10b981"
                                        barSize={44}
                                        shape={ArrowBar}
                                        onMouseEnter={(d: any) =>
                                            setFreqHover({
                                                label: d?.payload?.frequency,
                                                data: d?.payload,
                                            })
                                        }
                                        onMouseMove={(d: any) =>
                                            setFreqHover({
                                                label: d?.payload?.frequency,
                                                data: d?.payload,
                                            })
                                        }
                                        onMouseLeave={() => setFreqHover(null)}
                                    >
                                        <LabelList
                                            dataKey="completed"
                                            position="top"
                                            style={{
                                                fill: "#065f46",
                                                fontSize: 14,
                                                fontWeight: 800,
                                            }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
