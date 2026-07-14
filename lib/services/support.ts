import { prisma } from "@/lib/prisma";
import { SupportPriority, TicketStatus } from "@prisma/client";

// GAP 3: Support & Dispute Resolution — fully DB-backed.
// AI replies use a simple rule-based responder (no external API).

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketState = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type Sender = "user" | "agent" | "ai" | "operator";

const PRIORITY_VALUES = new Set<Priority>([
    "LOW",
    "MEDIUM",
    "HIGH",
    "URGENT",
]);
const STATUS_VALUES = new Set<TicketState>([
    "OPEN",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
]);

function normalizePriority(value?: string | null): SupportPriority {
    const raw = String(value || "").trim().toUpperCase();
    if (PRIORITY_VALUES.has(raw as Priority)) {
        return raw as SupportPriority;
    }
    return SupportPriority.MEDIUM;
}

function normalizeStatus(value?: string | null): TicketStatus {
    const raw = String(value || "").trim().toUpperCase();
    if (STATUS_VALUES.has(raw as TicketState)) {
        return raw as TicketStatus;
    }
    return TicketStatus.OPEN;
}

// Rule-based AI responder (keyword match). No external API.
export function ruleBasedReply(content: string): string {
    const text = String(content || "").toLowerCase();
    if (text.includes("refund")) {
        return "Refund request noted, agent will respond within 24h.";
    }
    if (text.includes("delay") || text.includes("late")) {
        return "We're checking with the operator...";
    }
    return "Thanks for contacting support. An agent will assist shortly.";
}

export async function createTicket(
    userId: string,
    subject: string,
    priority?: string | null,
    bookingId?: string | null,
    language?: string | null,
) {
    const dueAt = new Date(Date.now() + 24 * 60 * 60_000); // 24h SLA
    const ticket = await prisma.supportTicket.create({
        data: {
            userId,
            subject: String(subject || "").trim() || "Support request",
            priority: normalizePriority(priority),
            bookingId: bookingId ? String(bookingId).trim() : null,
            language: String(language || "en").trim() || "en",
            dueAt,
        },
    });
    return ticket;
}

export async function listTickets(userId?: string, role?: string) {
    const roleKey = String(role || "").toLowerCase();
    const where: any = {};
    if (roleKey !== "staff" && roleKey !== "admin") {
        where.userId = userId;
    }
    const tickets = await prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return tickets;
}

export async function getTicket(ticketId: string, userId?: string, role?: string) {
    const roleKey = String(role || "").toLowerCase();
    const where: any = { id: ticketId };
    if (roleKey !== "staff" && roleKey !== "admin") {
        where.userId = userId;
    }
    const ticket = await prisma.supportTicket.findFirst({
        where,
        include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return ticket;
}

export async function addMessage(
    ticketId: string,
    sender: string,
    content: string,
    locale?: string | null,
) {
    const lang = String(locale || "en").trim() || "en";
    const message = await prisma.chatMessage.create({
        data: {
            ticketId,
            sender: String(sender || "user"),
            content: String(content || "").trim(),
            locale: lang,
        },
    });

    // If the message is from the user, auto-append an AI reply.
    if (String(sender || "user") === "user") {
        const reply = ruleBasedReply(content);
        const aiMessage = await prisma.chatMessage.create({
            data: {
                ticketId,
                sender: "ai",
                content: reply,
                locale: lang,
            },
        });
        // Move ticket to in_progress if still open.
        await prisma.supportTicket
            .update({
                where: { id: ticketId },
                data: { status: TicketStatus.IN_PROGRESS },
            })
            .catch(() => undefined);
        return { message, aiMessage };
    }

    return { message, aiMessage: null };
}

export async function updateTicketStatus(ticketId: string, status: string) {
    const next = normalizeStatus(status);
    const ticket = await prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: next },
    });
    return ticket;
}

export async function createDispute(
    bookingId: string,
    userId: string,
    reason: string,
) {
    const dispute = await prisma.dispute.create({
        data: {
            bookingId: String(bookingId).trim(),
            userId,
            reason: String(reason || "").trim(),
        },
    });
    return dispute;
}

export async function listDisputes(userId?: string, role?: string) {
    const roleKey = String(role || "").toLowerCase();
    const where: any = {};
    if (roleKey !== "staff" && roleKey !== "admin") {
        where.userId = userId;
    }
    const disputes = await prisma.dispute.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    return disputes;
}

export async function resolveDispute(
    disputeId: string,
    resolution: string,
) {
    const dispute = await prisma.dispute.update({
        where: { id: disputeId },
        data: {
            resolution: String(resolution || "").trim(),
            status: TicketStatus.RESOLVED,
            resolvedAt: new Date(),
        },
    });
    return dispute;
}
