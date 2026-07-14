"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type RouteOption = {
  id: string;
  origin: { name: string; code: string } | null;
  destination: { name: string; code: string } | null;
};

type BusOption = { id: string; plateNumber: string };

type PricingRule = {
  id: string;
  routeId: string | null;
  minFillPct: number;
  maxFillPct: number;
  multiplier: number;
  active: boolean;
  createdAt: string;
  route?: { id: string; origin: string; destination: string } | null;
};

type FraudFlag = {
  id: string;
  busId: string | null;
  conductorId: string | null;
  reason: string;
  severity: string;
  createdAt: string;
  bus?: { id: string; plateNumber: string } | null;
};

type Dashboard = {
  totalRevenue: number;
  bookingsCount: number;
  paidBookingsCount: number;
  byRoute: {
    routeId: string;
    origin: string;
    destination: string;
    revenue: number;
    bookings: number;
  }[];
};

type OperatorData = {
  dashboard: Dashboard;
  rules: PricingRule[];
  flags: FraudFlag[];
};

const emptyDashboard: Dashboard = {
  totalRevenue: 0,
  bookingsCount: 0,
  paidBookingsCount: 0,
  byRoute: [],
};

function severityVariant(sev: string): "default" | "secondary" | "destructive" {
  const s = String(sev || "").toLowerCase();
  if (s === "high" || s === "critical") return "destructive";
  if (s === "medium") return "default";
  return "secondary";
}

function routeLabel(r: RouteOption): string {
  const o = r.origin?.name ?? "?";
  const d = r.destination?.name ?? "?";
  return `${o} → ${d}`;
}

export default function OperatorToolsPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OperatorData | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [buses, setBuses] = useState<BusOption[]>([]);

  // Rule form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ruleRouteId, setRuleRouteId] = useState<string>("");
  const [minFill, setMinFill] = useState<string>("0");
  const [maxFill, setMaxFill] = useState<string>("100");
  const [multiplier, setMultiplier] = useState<string>("1.0");
  const [ruleActive, setRuleActive] = useState<boolean>(true);
  const [savingRule, setSavingRule] = useState(false);

  // Flag form state
  const [flagBusId, setFlagBusId] = useState<string>("");
  const [flagConductor, setFlagConductor] = useState<string>("");
  const [flagReason, setFlagReason] = useState<string>("");
  const [flagSeverity, setFlagSeverity] = useState<string>("low");
  const [savingFlag, setSavingFlag] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/operator");
      if (!res.ok) throw new Error("Failed to load operator data.");
      const json = (await res.json()) as OperatorData;
      setData(json);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Load failed." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    (async () => {
      await loadData();
      try {
        const [routesRes, busesRes] = await Promise.all([
          fetch("/api/routes"),
          fetch("/api/buses"),
        ]);
        if (routesRes.ok) setRoutes((await routesRes.json()) as RouteOption[]);
        if (busesRes.ok) setBuses((await busesRes.json()) as BusOption[]);
      } catch {
        /* non-fatal */
      }
    })();
  }, [loadData]);

  function resetRuleForm() {
    setEditingId(null);
    setRuleRouteId("");
    setMinFill("0");
    setMaxFill("100");
    setMultiplier("1.0");
    setRuleActive(true);
  }

  function startEdit(rule: PricingRule) {
    setEditingId(rule.id);
    setRuleRouteId(rule.routeId || "");
    setMinFill(String(rule.minFillPct));
    setMaxFill(String(rule.maxFillPct));
    setMultiplier(String(rule.multiplier));
    setRuleActive(rule.active);
  }

  async function saveRule() {
    setSavingRule(true);
    try {
      const payload = {
        routeId: ruleRouteId || null,
        minFillPct: Number(minFill),
        maxFillPct: Number(maxFill),
        multiplier: Number(multiplier),
        active: ruleActive,
      };
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/operator/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/operator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "rule", ...payload }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Save failed.");
      }
      toast({
        title: editingId ? "Rule updated" : "Rule created",
        description: "Dynamic pricing rule saved.",
      });
      resetRuleForm();
      await loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Save failed." });
    } finally {
      setSavingRule(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this pricing rule?")) return;
    try {
      const res = await fetch(`/api/operator/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      toast({ title: "Rule deleted" });
      await loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Delete failed." });
    }
  }

  async function saveFlag() {
    if (!flagReason.trim()) {
      toast({ title: "Error", description: "Reason is required." });
      return;
    }
    setSavingFlag(true);
    try {
      const res = await fetch("/api/operator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "flag",
          busId: flagBusId || null,
          conductorId: flagConductor || null,
          reason: flagReason,
          severity: flagSeverity,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Save failed.");
      }
      toast({ title: "Flag created", description: "Fraud flag recorded." });
      setFlagBusId("");
      setFlagConductor("");
      setFlagReason("");
      setFlagSeverity("low");
      await loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Save failed." });
    } finally {
      setSavingFlag(false);
    }
  }

  const dashboard = data?.dashboard ?? emptyDashboard;
  const rules = data?.rules ?? [];
  const flags = data?.flags ?? [];

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-7xl px-2 py-6">
        <h1 className="text-lg font-semibold mb-4">Operator Tools</h1>

        {/* Revenue summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.totalRevenue.toLocaleString(undefined, {
                  style: "currency",
                  currency: "ETB",
                  maximumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.bookingsCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Paid Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.paidBookingsCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue by route */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Revenue by Route</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : dashboard.byRoute.length === 0 ? (
              <p className="text-muted-foreground">No revenue data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Route</th>
                      <th className="py-2 pr-4">Bookings</th>
                      <th className="py-2 pr-4">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.byRoute.map((r) => (
                      <tr key={r.routeId} className="border-t">
                        <td className="py-2 pr-4">
                          {r.origin} → {r.destination}
                        </td>
                        <td className="py-2 pr-4">{r.bookings}</td>
                        <td className="py-2 pr-4">
                          {r.revenue.toLocaleString(undefined, {
                            style: "currency",
                            currency: "ETB",
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic pricing rules */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit Pricing Rule" : "New Pricing Rule"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-5 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Route</label>
                <select
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  value={ruleRouteId}
                  onChange={(e) => setRuleRouteId(e.target.value)}
                >
                  <option value="">All routes (global)</option>
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {routeLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Min Fill %
                </label>
                <Input
                  type="number"
                  value={minFill}
                  onChange={(e) => setMinFill(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Max Fill %
                </label>
                <Input
                  type="number"
                  value={maxFill}
                  onChange={(e) => setMaxFill(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Multiplier
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={multiplier}
                  onChange={(e) => setMultiplier(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Active</label>
                <select
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  value={ruleActive ? "1" : "0"}
                  onChange={(e) => setRuleActive(e.target.value === "1")}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveRule} disabled={savingRule}>
                {savingRule ? "Saving..." : editingId ? "Update Rule" : "Add Rule"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={resetRuleForm}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dynamic Pricing Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : rules.length === 0 ? (
              <p className="text-muted-foreground">
                No pricing rules configured.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Route</th>
                      <th className="py-2 pr-4">Fill Band</th>
                      <th className="py-2 pr-4">Multiplier</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="border-t">
                        <td className="py-2 pr-4">
                          {rule.route
                            ? `${rule.route.origin} → ${rule.route.destination}`
                            : "All routes"}
                        </td>
                        <td className="py-2 pr-4">
                          {rule.minFillPct}% – {rule.maxFillPct}%
                        </td>
                        <td className="py-2 pr-4">{rule.multiplier}</td>
                        <td className="py-2 pr-4">
                          <Badge
                            variant={rule.active ? "default" : "secondary"}
                          >
                            {rule.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(rule)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteRule(rule.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fraud flags */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New Fraud Flag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Bus</label>
                <select
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  value={flagBusId}
                  onChange={(e) => setFlagBusId(e.target.value)}
                >
                  <option value="">None</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.plateNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Conductor ID
                </label>
                <Input
                  value={flagConductor}
                  onChange={(e) => setFlagConductor(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  Severity
                </label>
                <select
                  className="h-9 rounded-md border bg-transparent px-2 text-sm"
                  value={flagSeverity}
                  onChange={(e) => setFlagSeverity(e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Reason</label>
                <Input
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Reason"
                />
              </div>
            </div>
            <Button onClick={saveFlag} disabled={savingFlag}>
              {savingFlag ? "Saving..." : "Add Flag"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fraud Flags</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : flags.length === 0 ? (
              <p className="text-muted-foreground">No fraud flags recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-4">Bus</th>
                      <th className="py-2 pr-4">Conductor</th>
                      <th className="py-2 pr-4">Reason</th>
                      <th className="py-2 pr-4">Severity</th>
                      <th className="py-2 pr-4">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flags.map((f) => (
                      <tr key={f.id} className="border-t">
                        <td className="py-2 pr-4">
                          {f.bus?.plateNumber ?? "—"}
                        </td>
                        <td className="py-2 pr-4">{f.conductorId ?? "—"}</td>
                        <td className="py-2 pr-4">{f.reason}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={severityVariant(f.severity)}>
                            {f.severity}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          {new Date(f.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
