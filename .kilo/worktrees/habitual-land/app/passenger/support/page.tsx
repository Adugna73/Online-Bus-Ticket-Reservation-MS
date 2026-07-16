"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, MessageSquare, Plus, ArrowLeft, Send } from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ChatMessage = {
    id: string;
    sender: string;
    content: string;
    locale: string;
    createdAt: string;
};

type Ticket = {
    id: string;
    subject: string;
    priority: string;
    status: string;
    bookingId: string | null;
    language: string;
    dueAt: string | null;
    createdAt: string;
    updatedAt: string;
    messages?: ChatMessage[];
};

type BookingOption = {
    id: string;
    bookingRef: string;
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function priorityVariant(priority: string) {
    switch (priority) {
        case "URGENT":
            return "destructive" as const;
        case "HIGH":
            return "default" as const;
        case "MEDIUM":
            return "secondary" as const;
        default:
            return "outline" as const;
    }
}

function statusVariant(status: string) {
    switch (status) {
        case "RESOLVED":
        case "CLOSED":
            return "secondary" as const;
        case "IN_PROGRESS":
            return "default" as const;
        default:
            return "outline" as const;
    }
}

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

function senderLabel(sender: string) {
    switch (sender) {
        case "ai":
            return "AI";
        case "agent":
            return "Agent";
        case "operator":
            return "Operator";
        default:
            return "You";
    }
}

export default function PassengerSupportPage() {
    const { toast } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [bookings, setBookings] = useState<BookingOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [subject, setSubject] = useState("");
    const [priority, setPriority] = useState<string>("MEDIUM");
    const [bookingId, setBookingId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [threadLoading, setThreadLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const loadTickets = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/support");
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to load tickets.");
            }
            const data = (await res.json()) as Ticket[];
            setTickets(data || []);
        } catch (err: any) {
            setError(err?.message || "Failed to load tickets.");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadBookings = useCallback(async () => {
        try {
            const res = await fetch("/api/bookings");
            if (!res.ok) return;
            const data = (await res.json()) as BookingOption[];
            setBookings(data || []);
        } catch {
            // bookings are optional for ticket creation
        }
    }, []);

    useEffect(() => {
        loadTickets();
        loadBookings();
    }, [loadTickets, loadBookings]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = subject.trim();
        if (!trimmed) {
            toast({
                title: "Subject required",
                description: "Please enter a subject for your ticket.",
                variant: "destructive",
            });
            return;
        }
        try {
            setSubmitting(true);
            const res = await fetch("/api/support", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "ticket",
                    subject: trimmed,
                    priority,
                    bookingId: bookingId || undefined,
                    language: "en",
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to create ticket.");
            }
            const created = (await res.json()) as Ticket;
            toast({
                title: "Ticket created",
                description: "Your support ticket has been submitted.",
            });
            setSubject("");
            setPriority("MEDIUM");
            setBookingId("");
            setShowForm(false);
            setTickets((prev) => [created, ...prev]);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to create ticket.",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const openTicket = async (ticket: Ticket) => {
        setActiveTicket(ticket);
        setMessage("");
        if (ticket.messages && ticket.messages.length > 0) return;
        try {
            setThreadLoading(true);
            const res = await fetch(`/api/support/${ticket.id}`);
            if (!res.ok) {
                throw new Error("Failed to load conversation.");
            }
            const data = (await res.json()) as Ticket;
            setActiveTicket(data);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to load conversation.",
                variant: "destructive",
            });
        } finally {
            setThreadLoading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTicket) return;
        const trimmed = message.trim();
        if (!trimmed) return;
        try {
            setSending(true);
            const res = await fetch("/api/support", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "message",
                    ticketId: activeTicket.id,
                    content: trimmed,
                    sender: "user",
                    locale: "en",
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to send message.");
            }
            const result = (await res.json()) as {
                message: ChatMessage;
                aiMessage: ChatMessage | null;
            };
            setActiveTicket((prev) => {
                if (!prev) return prev;
                const nextMessages = [
                    ...(prev.messages || []),
                    result.message,
                ];
                if (result.aiMessage) nextMessages.push(result.aiMessage);
                return { ...prev, messages: nextMessages };
            });
            setMessage("");
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to send message.",
                variant: "destructive",
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                            <MessageSquare className="h-3.5 w-3.5" />
                            Support & Disputes
                        </div>
                        <h1
                            className="mt-3 text-2xl font-semibold tracking-tight"
                            style={{
                                fontFamily:
                                    '"Space Grotesk", "DM Serif Display", serif',
                            }}
                        >
                            Support Center
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Create a support ticket and chat with our team.
                            Replies arrive within 24 hours.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!showForm && !activeTicket && (
                            <Button
                                size="sm"
                                onClick={() => setShowForm(true)}
                            >
                                <Plus className="h-4 w-4" />
                                New Ticket
                            </Button>
                        )}
                    </div>
                </div>

                {/* Create ticket form */}
                {showForm && !activeTicket && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Create a new support ticket</CardTitle>
                        </CardHeader>
                        <form onSubmit={handleCreate}>
                            <CardContent className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">
                                        Subject
                                    </label>
                                    <Input
                                        value={subject}
                                        onChange={(e) =>
                                            setSubject(e.target.value)
                                        }
                                        placeholder="Briefly describe your issue"
                                        required
                                    />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Priority
                                        </label>
                                        <select
                                            value={priority}
                                            onChange={(e) =>
                                                setPriority(e.target.value)
                                            }
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            {PRIORITIES.map((p) => (
                                                <option key={p} value={p}>
                                                    {p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Related booking (optional)
                                        </label>
                                        <select
                                            value={bookingId}
                                            onChange={(e) =>
                                                setBookingId(e.target.value)
                                            }
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <option value="">
                                                None
                                            </option>
                                            {bookings.map((b) => (
                                                <option
                                                    key={b.id}
                                                    value={b.id}
                                                >
                                                    {b.bookingRef}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="justify-end gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowForm(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        "Submit Ticket"
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Card>
                )}

                {/* Chat thread view */}
                {activeTicket && (
                    <Card className="mb-6">
                        <CardHeader>
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <CardTitle className="truncate">
                                        {activeTicket.subject}
                                    </CardTitle>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        <Badge
                                            variant={priorityVariant(
                                                activeTicket.priority,
                                            )}
                                            className="text-[11px]"
                                        >
                                            {activeTicket.priority}
                                        </Badge>
                                        <Badge
                                            variant={statusVariant(
                                                activeTicket.status,
                                            )}
                                            className="text-[11px]"
                                        >
                                            {activeTicket.status}
                                        </Badge>
                                        <span className="text-[11px] text-muted-foreground">
                                            Due:{" "}
                                            {formatDateTime(
                                                activeTicket.dueAt,
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveTicket(null)}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-[420px] min-h-[200px] space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-3">
                                {threadLoading && (
                                    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading conversation...
                                    </div>
                                )}
                                {!threadLoading &&
                                    (!activeTicket.messages ||
                                        activeTicket.messages.length === 0) && (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                            No messages yet. Send a message to
                                            start the conversation.
                                        </div>
                                    )}
                                {!threadLoading &&
                                    activeTicket.messages &&
                                    activeTicket.messages.map((msg) => {
                                        const isUser = msg.sender === "user";
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                            >
                                                <div
                                                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                                        isUser
                                                            ? "bg-primary text-primary-foreground"
                                                            : "bg-card border"
                                                    }`}
                                                >
                                                    <div className="mb-0.5 text-[10px] font-semibold opacity-80">
                                                        {senderLabel(
                                                            msg.sender,
                                                        )}
                                                    </div>
                                                    <div className="whitespace-pre-wrap break-words">
                                                        {msg.content}
                                                    </div>
                                                    <div className="mt-0.5 text-[10px] opacity-60">
                                                        {formatDateTime(
                                                            msg.createdAt,
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </CardContent>
                        <CardFooter>
                            <form
                                onSubmit={handleSend}
                                className="flex w-full items-center gap-2"
                            >
                                <Input
                                    value={message}
                                    onChange={(e) =>
                                        setMessage(e.target.value)
                                    }
                                    placeholder="Type your message..."
                                    disabled={sending}
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={sending || !message.trim()}
                                >
                                    {sending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </form>
                        </CardFooter>
                    </Card>
                )}

                {/* Ticket list */}
                {!activeTicket && (
                    <>
                        {loading && (
                            <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                                Loading your tickets...
                            </div>
                        )}

                        {!loading && error && (
                            <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {!loading && !error && tickets.length === 0 && (
                            <Card>
                                <CardContent className="py-10 text-center">
                                    <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                    <p className="text-sm font-medium">
                                        No support tickets yet
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Create a ticket to get help with a
                                        booking or any issue.
                                    </p>
                                    {!showForm && (
                                        <Button
                                            size="sm"
                                            className="mt-4"
                                            onClick={() => setShowForm(true)}
                                        >
                                            <Plus className="h-4 w-4" />
                                            New Ticket
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {!loading && !error && tickets.length > 0 && (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {tickets.map((ticket) => (
                                    <Card
                                        key={ticket.id}
                                        className="flex flex-col"
                                    >
                                        <CardHeader>
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="truncate">
                                                    {ticket.subject}
                                                </CardTitle>
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <Badge
                                                    variant={priorityVariant(
                                                        ticket.priority,
                                                    )}
                                                    className="text-[11px]"
                                                >
                                                    {ticket.priority}
                                                </Badge>
                                                <Badge
                                                    variant={statusVariant(
                                                        ticket.status,
                                                    )}
                                                    className="text-[11px]"
                                                >
                                                    {ticket.status}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-1 text-xs text-muted-foreground">
                                            <div>
                                                Created:{" "}
                                                {formatDateTime(
                                                    ticket.createdAt,
                                                )}
                                            </div>
                                            <div>
                                                Due:{" "}
                                                {formatDateTime(ticket.dueAt)}
                                            </div>
                                            <div>
                                                Messages:{" "}
                                                {ticket.messages?.length || 0}
                                            </div>
                                            {ticket.bookingId && (
                                                <div className="truncate">
                                                    Booking:{" "}
                                                    {ticket.bookingId}
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="w-full"
                                                onClick={() =>
                                                    openTicket(ticket)
                                                }
                                            >
                                                Open Conversation
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardShell>
    );
}
