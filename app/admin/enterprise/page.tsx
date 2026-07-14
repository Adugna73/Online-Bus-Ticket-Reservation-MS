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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type Corporate = {
  id: string;
  name: string;
  billingEmail: string | null;
  creditLimit: number;
  createdAt: string;
};

type GovReport = {
  id: string;
  period: string;
  taxCollected: number;
  payload: any;
  generatedAt: string;
};

type NgoBooking = {
  id: string;
  ngoName: string;
  tripId: string;
  seatsCount: number;
  specialPricing: number | null;
  createdAt: string;
  trip?: { id: string; departAt: string } | null;
};

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EnterprisePage() {
  const { toast } = useToast();

  const [corporates, setCorporates] = useState<Corporate[]>([]);
  const [reports, setReports] = useState<GovReport[]>([]);
  const [ngoBookings, setNgoBookings] = useState<NgoBooking[]>([]);

  const [loadingCorp, setLoadingCorp] = useState(true);
  const [loadingGov, setLoadingGov] = useState(true);
  const [loadingNgo, setLoadingNgo] = useState(true);

  // Corporate form
  const [corpName, setCorpName] = useState("");
  const [corpEmail, setCorpEmail] = useState("");
  const [corpCredit, setCorpCredit] = useState("");
  const [savingCorp, setSavingCorp] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Gov form
  const [period, setPeriod] = useState(currentPeriod());
  const [generating, setGenerating] = useState(false);

  // NGO form
  const [ngoName, setNgoName] = useState("");
  const [ngoTripId, setNgoTripId] = useState("");
  const [ngoSeats, setNgoSeats] = useState("");
  const [ngoPricing, setNgoPricing] = useState("");
  const [savingNgo, setSavingNgo] = useState(false);

  const loadCorporates = useCallback(async () => {
    setLoadingCorp(true);
    try {
      const res = await fetch("/api/enterprise?kind=corporate");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "load_failed");
      setCorporates(json.corporates || []);
    } catch (e: any) {
      toast({ title: "Failed to load corporate accounts", description: e?.message });
    } finally {
      setLoadingCorp(false);
    }
  }, [toast]);

  const loadGov = useCallback(async () => {
    setLoadingGov(true);
    try {
      const res = await fetch("/api/enterprise?kind=gov");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "load_failed");
      setReports(json.reports || []);
    } catch (e: any) {
      toast({ title: "Failed to load government reports", description: e?.message });
    } finally {
      setLoadingGov(false);
    }
  }, [toast]);

  const loadNgo = useCallback(async () => {
    setLoadingNgo(true);
    try {
      const res = await fetch("/api/enterprise?kind=ngo");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "load_failed");
      setNgoBookings(json.bookings || []);
    } catch (e: any) {
      toast({ title: "Failed to load NGO bookings", description: e?.message });
    } finally {
      setLoadingNgo(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCorporates();
    loadGov();
    loadNgo();
  }, [loadCorporates, loadGov, loadNgo]);

  function resetCorpForm() {
    setCorpName("");
    setCorpEmail("");
    setCorpCredit("");
    setEditingId(null);
  }

  function startEdit(c: Corporate) {
    setEditingId(c.id);
    setCorpName(c.name);
    setCorpEmail(c.billingEmail || "");
    setCorpCredit(String(c.creditLimit));
  }

  async function submitCorporate(e: React.FormEvent) {
    e.preventDefault();
    const name = corpName.trim();
    if (!name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSavingCorp(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/enterprise/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            billingEmail: corpEmail.trim() || null,
            creditLimit: Number(corpCredit || 0),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "update_failed");
        toast({ title: "Corporate account updated" });
      } else {
        const res = await fetch("/api/enterprise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "corporate",
            name,
            billingEmail: corpEmail.trim() || null,
            creditLimit: Number(corpCredit || 0),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "create_failed");
        toast({ title: "Corporate account created" });
      }
      resetCorpForm();
      await loadCorporates();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingCorp(false);
    }
  }

  async function generateReport(e: React.FormEvent) {
    e.preventDefault();
    const p = period.trim();
    if (!/^\d{4}-\d{2}$/.test(p)) {
      toast({ title: "Period must be YYYY-MM", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "gov", period: p }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "generate_failed");
      toast({
        title: "Government report generated",
        description: `Tax collected: ${fmtMoney(json.report.taxCollected)}`,
      });
      await loadGov();
    } catch (e: any) {
      toast({ title: "Generate failed", description: e?.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function submitNgo(e: React.FormEvent) {
    e.preventDefault();
    const name = ngoName.trim();
    const tripId = ngoTripId.trim();
    if (!name) {
      toast({ title: "NGO name is required", variant: "destructive" });
      return;
    }
    if (!tripId) {
      toast({ title: "Trip ID is required", variant: "destructive" });
      return;
    }
    setSavingNgo(true);
    try {
      const res = await fetch("/api/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ngo",
          ngoName: name,
          tripId,
          seatsCount: Number(ngoSeats || 0),
          specialPricing: ngoPricing === "" ? null : Number(ngoPricing),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "create_failed");
      toast({ title: "NGO bulk booking created" });
      setNgoName("");
      setNgoTripId("");
      setNgoSeats("");
      setNgoPricing("");
      await loadNgo();
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSavingNgo(false);
    }
  }

  return (
    <DashboardShell>
      <div className="max-w-7xl mx-auto py-6 px-2 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Enterprise &amp; Government</h1>
          <p className="text-xs text-muted-foreground">
            Corporate accounts, government tax reports, and NGO bulk bookings.
          </p>
        </div>

        {/* Corporate accounts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Corporate Accounts</CardTitle>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetCorpForm}>
                Cancel edit
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={submitCorporate}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={corpName}
                  onChange={(e) => setCorpName(e.target.value)}
                  placeholder="Company name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Billing email</label>
                <Input
                  value={corpEmail}
                  onChange={(e) => setCorpEmail(e.target.value)}
                  placeholder="billing@company.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Credit limit (ETB)</label>
                <Input
                  type="number"
                  value={corpCredit}
                  onChange={(e) => setCorpCredit(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button type="submit" disabled={savingCorp}>
                {savingCorp ? "Saving..." : editingId ? "Update account" : "Add account"}
              </Button>
            </form>

            {loadingCorp ? (
              <p className="text-xs text-muted-foreground">Loading corporate accounts...</p>
            ) : corporates.length === 0 ? (
              <p className="text-xs text-muted-foreground">No corporate accounts yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Billing email</TableHead>
                    <TableHead>Credit limit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corporates.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.billingEmail || "—"}</TableCell>
                      <TableCell>{fmtMoney(c.creditLimit)}</TableCell>
                      <TableCell>{fmtDate(c.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(c)}
                          disabled={editingId === c.id}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Government reports */}
        <Card>
          <CardHeader>
            <CardTitle>Government Tax Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={generateReport}
              className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Period (YYYY-MM)</label>
                <Input
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="2026-07"
                />
              </div>
              <Button type="submit" disabled={generating} className="md:col-span-2 md:w-fit">
                {generating ? "Generating..." : "Generate report"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              Tax collected is computed as 15% of all PAID payments in the selected period.
            </p>

            {loadingGov ? (
              <p className="text-xs text-muted-foreground">Loading government reports...</p>
            ) : reports.length === 0 ? (
              <p className="text-xs text-muted-foreground">No government reports yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Tax collected</TableHead>
                    <TableHead>Gross revenue</TableHead>
                    <TableHead>Paid payments</TableHead>
                    <TableHead>Generated at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((r) => {
                    const payload = (r.payload || {}) as any;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="secondary">{r.period}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {fmtMoney(r.taxCollected)}
                        </TableCell>
                        <TableCell>{fmtMoney(payload.grossRevenue ?? 0)}</TableCell>
                        <TableCell>{payload.paidPaymentsCount ?? "—"}</TableCell>
                        <TableCell>{fmtDate(r.generatedAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* NGO bulk bookings */}
        <Card>
          <CardHeader>
            <CardTitle>NGO Bulk Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={submitNgo}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end"
            >
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">NGO name</label>
                <Input
                  value={ngoName}
                  onChange={(e) => setNgoName(e.target.value)}
                  placeholder="Organization name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Trip ID</label>
                <Input
                  value={ngoTripId}
                  onChange={(e) => setNgoTripId(e.target.value)}
                  placeholder="trip id"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Seats count</label>
                <Input
                  type="number"
                  value={ngoSeats}
                  onChange={(e) => setNgoSeats(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Special pricing (ETB)</label>
                <Input
                  type="number"
                  value={ngoPricing}
                  onChange={(e) => setNgoPricing(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <Button type="submit" disabled={savingNgo} className="md:col-span-4 md:w-fit">
                {savingNgo ? "Saving..." : "Create bulk booking"}
              </Button>
            </form>

            {loadingNgo ? (
              <p className="text-xs text-muted-foreground">Loading NGO bookings...</p>
            ) : ngoBookings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No NGO bulk bookings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NGO name</TableHead>
                    <TableHead>Trip</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead>Special pricing</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ngoBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.ngoName}</TableCell>
                      <TableCell>
                        {b.trip ? (
                          <span>
                            {b.trip.id.slice(0, 8)}… ({fmtDate(b.trip.departAt)})
                          </span>
                        ) : (
                          <span>{b.tripId.slice(0, 8)}…</span>
                        )}
                      </TableCell>
                      <TableCell>{b.seatsCount}</TableCell>
                      <TableCell>
                        {b.specialPricing === null ? "—" : fmtMoney(b.specialPricing)}
                      </TableCell>
                      <TableCell>{fmtDate(b.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
