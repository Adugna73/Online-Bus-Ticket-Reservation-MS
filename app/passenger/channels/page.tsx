"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Smartphone, Phone, UserCog, QrCode, MessageSquare } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type OfflineTicket = {
  id: string;
  bookingId: string;
  qrPayload: string;
  issuedAt: string;
  booking: {
    id: string;
    bookingRef: string;
    status: string;
    totalPrice: number;
    passengerFullName: string | null;
    passengerPhone: string | null;
    trip: {
      id: string;
      departAt: string;
      route: {
        originStation: { name: string; city: string } | null;
        destinationStation: { name: string; city: string } | null;
      } | null;
    } | null;
  } | null;
};

type Agent = {
  id: string;
  agentName: string;
  phone: string | null;
  location: string | null;
  commissionPct: number;
};

type ChannelSession = {
  id: string;
  channel: string;
  msisdn: string | null;
  ussdSession: string | null;
  state: any;
  createdAt: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function ChannelsPage() {
  const { status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [offlineTickets, setOfflineTickets] = useState<OfflineTicket[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<ChannelSession[]>([]);

  // agent form
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [agentLocation, setAgentLocation] = useState("");
  const [agentCommission, setAgentCommission] = useState("0");
  const [savingAgent, setSavingAgent] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  // offline issue form
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [issuing, setIssuing] = useState(false);

  // USSD simulator
  const [ussdSessionId, setUssdSessionId] = useState<string | null>(null);
  const [ussdPrompt, setUssdPrompt] = useState("");
  const [ussdInput, setUssdInput] = useState("");
  const [ussdBusy, setUssdBusy] = useState(false);
  const [ussdDone, setUssdDone] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/channels");
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load channels data.");
      }
      const data = await res.json();
      setIsAdmin(Boolean(data.isAdmin));
      setOfflineTickets(data.offlineTickets || []);
      setAgents(data.agents || []);
      setSessions(data.sessions || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load channels data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status !== "authenticated") return;
    loadData();
  }, [status, router, loadData]);

  const handleSaveAgent = async () => {
    if (!agentName.trim()) {
      toast({ title: "Agent name is required", variant: "destructive" });
      return;
    }
    try {
      setSavingAgent(true);
      if (editingAgentId) {
        const res = await fetch(`/api/channels/${editingAgentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName,
            phone: agentPhone,
            location: agentLocation,
            commissionPct: Number(agentCommission) || 0,
          }),
        });
        if (!res.ok) throw new Error("Failed to update agent.");
        toast({ title: "Agent updated" });
      } else {
        const res = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "agent",
            agentName,
            phone: agentPhone,
            location: agentLocation,
            commissionPct: Number(agentCommission) || 0,
          }),
        });
        if (!res.ok) throw new Error("Failed to create agent.");
        toast({ title: "Agent created" });
      }
      setAgentName("");
      setAgentPhone("");
      setAgentLocation("");
      setAgentCommission("0");
      setEditingAgentId(null);
      await loadData();
    } catch (err: any) {
      toast({ title: err?.message || "Error saving agent", variant: "destructive" });
    } finally {
      setSavingAgent(false);
    }
  };

  const startEditAgent = (a: Agent) => {
    setEditingAgentId(a.id);
    setAgentName(a.agentName);
    setAgentPhone(a.phone || "");
    setAgentLocation(a.location || "");
    setAgentCommission(String(a.commissionPct));
  };

  const cancelEditAgent = () => {
    setEditingAgentId(null);
    setAgentName("");
    setAgentPhone("");
    setAgentLocation("");
    setAgentCommission("0");
  };

  const handleIssueOffline = async () => {
    if (!bookingIdInput.trim()) {
      toast({ title: "Booking ID is required", variant: "destructive" });
      return;
    }
    try {
      setIssuing(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "offline", bookingId: bookingIdInput.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to issue offline ticket.");
      }
      toast({ title: "Offline QR ticket issued" });
      setBookingIdInput("");
      await loadData();
    } catch (err: any) {
      toast({ title: err?.message || "Error issuing ticket", variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  const startUssd = async () => {
    try {
      setUssdBusy(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "session", channel: "USSD" }),
      });
      if (!res.ok) throw new Error("Failed to start USSD session.");
      const data = await res.json();
      setUssdSessionId(data.session.id);
      setUssdPrompt("Welcome to Bus Booking.\n1) Book a ticket\n2) My Tickets");
      setUssdInput("");
      setUssdDone(false);
    } catch (err: any) {
      toast({ title: err?.message || "Error starting USSD", variant: "destructive" });
    } finally {
      setUssdBusy(false);
    }
  };

  const sendUssd = async () => {
    if (!ussdSessionId) return;
    try {
      setUssdBusy(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ussd", sessionId: ussdSessionId, input: ussdInput }),
      });
      if (!res.ok) throw new Error("USSD request failed.");
      const data = await res.json();
      setUssdPrompt(data.prompt || "");
      setUssdDone(Boolean(data.done));
      setUssdInput("");
    } catch (err: any) {
      toast({ title: err?.message || "USSD error", variant: "destructive" });
    } finally {
      setUssdBusy(false);
    }
  };

  const channelInfo = [
    {
      icon: MessageSquare,
      title: "SMS",
      desc: "Book a ticket by texting the booking shortcode. Mock gateway — no real SMS sent.",
    },
    {
      icon: Smartphone,
      title: "USSD",
      desc: "Dial the USSD code (*787#) on any phone. A guided menu walks you through booking offline.",
    },
    {
      icon: Phone,
      title: "Voice (IVR)",
      desc: "Call the IVR line and book by voice in your language. Mock speech recognition.",
    },
    {
      icon: UserCog,
      title: "Agent Network",
      desc: "Authorized agents sell tickets for cash and earn commission in areas without internet.",
    },
  ];

  return (
    <DashboardShell>
      <div className="w-full max-w-none px-2 py-4 md:px-4 lg:px-6 bg-background text-foreground">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            <Smartphone className="h-3.5 w-3.5" />
            Digital Divide / Channels
          </div>
          <h1
            className="mt-3 text-2xl font-semibold tracking-tight"
            style={{ fontFamily: '"Space Grotesk", "DM Serif Display", serif' }}
          >
            Offline & Alternative Booking Channels
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            SMS, USSD, voice, agent network, and offline QR tickets for passengers without internet access.
          </p>
        </div>

        {loading && (
          <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Loading channels...
          </div>
        )}

        {!loading && error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Channel info */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {channelInfo.map((c) => (
                <Card key={c.title}>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <c.icon className="h-4 w-4 text-emerald-600" />
                      <CardTitle>{c.title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Offline QR tickets */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-emerald-600" />
                  <CardTitle>Offline QR Tickets</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {offlineTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    You have no offline QR tickets yet.
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {offlineTickets.map((t) => {
                      const trip = t.booking?.trip;
                      const origin = trip?.route?.originStation?.city || "-";
                      const dest = trip?.route?.destinationStation?.city || "-";
                      return (
                        <div
                          key={t.id}
                          className="rounded-lg border p-3"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{t.booking?.bookingRef || "-"}</Badge>
                            <Badge variant="secondary">{t.booking?.status || "-"}</Badge>
                          </div>
                          <div className="mt-2 text-sm font-medium">
                            {origin} → {dest}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Departs: {formatDateTime(trip?.departAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Issued: {formatDateTime(t.issuedAt)}
                          </div>
                          <div className="mt-3">
                            <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                              QR Payload
                            </div>
                            <pre className="max-h-28 overflow-auto rounded bg-muted p-2 text-[10px] whitespace-pre-wrap break-all">
                              {t.qrPayload}
                            </pre>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isAdmin && (
                  <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-xs text-muted-foreground">Booking ID</label>
                      <Input
                        value={bookingIdInput}
                        onChange={(e) => setBookingIdInput(e.target.value)}
                        placeholder="Enter booking ID to issue offline QR"
                      />
                    </div>
                    <Button onClick={handleIssueOffline} disabled={issuing}>
                      {issuing ? "Issuing..." : "Issue Offline Ticket"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin: agent management + USSD simulator */}
            {isAdmin && (
              <div className="grid gap-6 xl:grid-cols-2">
                {/* Agent management */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-emerald-600" />
                      <CardTitle>Agent Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {agents.length === 0 && (
                        <p className="text-sm text-muted-foreground">No agents registered.</p>
                      )}
                      {agents.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between rounded border p-2"
                        >
                          <div>
                            <div className="text-sm font-medium">{a.agentName}</div>
                            <div className="text-xs text-muted-foreground">
                              {a.phone || "no phone"} · {a.location || "no location"} ·{" "}
                              {a.commissionPct}% commission
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditAgent(a)}
                          >
                            Edit
                          </Button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 border-t pt-4 space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        {editingAgentId ? "Edit agent" : "Add agent"}
                      </div>
                      <Input
                        value={agentName}
                        onChange={(e) => setAgentName(e.target.value)}
                        placeholder="Agent name"
                      />
                      <Input
                        value={agentPhone}
                        onChange={(e) => setAgentPhone(e.target.value)}
                        placeholder="Phone"
                      />
                      <Input
                        value={agentLocation}
                        onChange={(e) => setAgentLocation(e.target.value)}
                        placeholder="Location"
                      />
                      <Input
                        type="number"
                        value={agentCommission}
                        onChange={(e) => setAgentCommission(e.target.value)}
                        placeholder="Commission %"
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleSaveAgent} disabled={savingAgent}>
                          {savingAgent
                            ? "Saving..."
                            : editingAgentId
                              ? "Update Agent"
                              : "Add Agent"}
                        </Button>
                        {editingAgentId && (
                          <Button variant="outline" onClick={cancelEditAgent}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* USSD simulator */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-emerald-600" />
                      <CardTitle>USSD Simulator</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!ussdSessionId ? (
                      <Button onClick={startUssd} disabled={ussdBusy}>
                        {ussdBusy ? "Starting..." : "Start USSD Session"}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded bg-black p-3 text-sm text-green-400 font-mono whitespace-pre-wrap min-h-[80px]">
                          {ussdPrompt || "(no prompt)"}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={ussdInput}
                            onChange={(e) => setUssdInput(e.target.value)}
                            placeholder="Enter choice"
                            disabled={ussdDone}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !ussdBusy && !ussdDone) sendUssd();
                            }}
                          />
                          <Button onClick={sendUssd} disabled={ussdBusy || ussdDone}>
                            {ussdBusy ? "..." : "Send"}
                          </Button>
                        </div>
                        {ussdDone && (
                          <Button variant="outline" size="sm" onClick={startUssd}>
                            New Session
                          </Button>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Session: {ussdSessionId.slice(0, 8)}…
                        </div>
                      </div>
                    )}

                    {sessions.length > 0 && (
                      <div className="mt-4 border-t pt-3">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">
                          Recent sessions
                        </div>
                        <div className="space-y-1 max-h-40 overflow-auto">
                          {sessions.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between text-xs"
                            >
                              <Badge variant="outline">{s.channel}</Badge>
                              <span className="text-muted-foreground">
                                {s.msisdn || "-"}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDateTime(s.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
