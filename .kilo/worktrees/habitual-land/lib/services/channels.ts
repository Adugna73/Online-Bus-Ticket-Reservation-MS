import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { ChannelKind, Prisma } from "@prisma/client";

// GAP 5: Digital Divide — SMS, USSD, voice, agent network, offline QR.
// Fully DB-backed with mock SMS/USSD/voice (no external gateway).

// ---------------------------------------------------------------------------
// Agent booking channels
// ---------------------------------------------------------------------------

export async function listAgents() {
  return prisma.agentBookingChannel.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createAgent(data: {
  agentName: string;
  phone?: string | null;
  location?: string | null;
  commissionPct?: number | null;
}) {
  return prisma.agentBookingChannel.create({
    data: {
      agentName: String(data.agentName).trim(),
      phone: data.phone ? String(data.phone).trim() : null,
      location: data.location ? String(data.location).trim() : null,
      commissionPct:
        typeof data.commissionPct === "number" && Number.isFinite(data.commissionPct)
          ? data.commissionPct
          : 0,
    },
  });
}

export async function updateAgent(
  id: string,
  data: {
    agentName?: string;
    phone?: string | null;
    location?: string | null;
    commissionPct?: number | null;
  },
) {
  const update: any = {};
  if (data.agentName !== undefined) update.agentName = String(data.agentName).trim();
  if (data.phone !== undefined) update.phone = data.phone ? String(data.phone).trim() : null;
  if (data.location !== undefined)
    update.location = data.location ? String(data.location).trim() : null;
  if (data.commissionPct !== undefined && data.commissionPct !== null) {
    const n = Number(data.commissionPct);
    if (Number.isFinite(n)) update.commissionPct = n;
  }
  return prisma.agentBookingChannel.update({ where: { id }, data: update });
}

// ---------------------------------------------------------------------------
// Offline QR tickets
// ---------------------------------------------------------------------------

export async function issueOfflineTicket(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, bookingRef: true },
  });
  if (!booking) {
    return { ok: false as const, error: "booking_not_found" };
  }

  const issuedAt = new Date();
  const token = randomUUID();
  const qrPayload = JSON.stringify({
    bookingRef: booking.bookingRef,
    issuedAt: issuedAt.toISOString(),
    token,
  });

  const ticket = await prisma.offlineTicket.upsert({
    where: { bookingId: booking.id },
    update: { qrPayload, issuedAt },
    create: { bookingId: booking.id, qrPayload, issuedAt },
  });

  return { ok: true as const, ticket };
}

export async function listOfflineTickets(opts?: { userId?: string }) {
  const where: Prisma.OfflineTicketWhereInput = {};
  let bookingFilter: Prisma.BookingWhereInput | undefined;
  if (opts?.userId) {
    bookingFilter = { userId: opts.userId };
  }

  const tickets = await prisma.offlineTicket.findMany({
    where,
    orderBy: { issuedAt: "desc" },
  });

  if (tickets.length === 0) return [];

  const bookingIds = tickets.map((t) => t.bookingId);
  const bookings = await prisma.booking.findMany({
    where: { id: { in: bookingIds }, ...(bookingFilter || {}) },
    select: {
      id: true,
      bookingRef: true,
      status: true,
      totalPrice: true,
      passengerFullName: true,
      passengerPhone: true,
      trip: {
        select: {
          id: true,
          departAt: true,
          route: {
            select: {
              originStation: { select: { name: true, city: true } },
              destinationStation: { select: { name: true, city: true } },
            },
          },
        },
      },
    },
  });

  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  return tickets.map((t) => ({
    ...t,
    booking: bookingById.get(t.bookingId) || null,
  }));
}

// ---------------------------------------------------------------------------
// Channel sessions (SMS / USSD / voice)
// ---------------------------------------------------------------------------

export async function startSession(channel: ChannelKind, msisdn?: string | null) {
  const state = { step: channel === "USSD" ? "menu" : "idle", data: {} };
  return prisma.channelSession.create({
    data: {
      channel,
      msisdn: msisdn ? String(msisdn).trim() : null,
      ussdSession: channel === "USSD" ? randomUUID() : null,
      state: state as any,
    },
  });
}

export async function listSessions() {
  return prisma.channelSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ---------------------------------------------------------------------------
// USSD state machine
// Steps: menu -> origin -> destination -> trip -> confirm -> done
// State stored in ChannelSession.state as { step, data }
// ---------------------------------------------------------------------------

export type UssdResult = {
  prompt: string;
  done: boolean;
  session: {
    id: string;
    state: any;
  };
};

export async function simulateUssd(sessionId: string, input: string): Promise<UssdResult> {
  const session = await prisma.channelSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return {
      prompt: "Session not found. Please start a new session.",
      done: true,
      session: { id: sessionId, state: null },
    };
  }

  const state: any = (session.state as any) || { step: "menu", data: {} };
  if (!state.data) state.data = {};
  const rawInput = String(input || "").trim();
  const next = (step: string, data?: any) => ({ ...state, step, data: data ?? state.data });

  let prompt = "";
  let done = false;

  switch (state.step) {
    case "menu": {
      const choice = rawInput;
      if (choice === "1") {
        state.step = "origin";
        prompt = "Enter origin city:";
      } else if (choice === "2") {
        prompt = "My Tickets: this is a mock channel. No bookings linked to this USSD session.";
        done = true;
      } else {
        prompt = "Welcome to Bus Booking.\n1) Book a ticket\n2) My Tickets";
      }
      break;
    }

    case "origin": {
      if (!rawInput) {
        prompt = "Enter origin city:";
        break;
      }
      state.data.origin = rawInput;
      state.step = "destination";
      prompt = `Origin: ${rawInput}\nEnter destination city:`;
      break;
    }

    case "destination": {
      if (!rawInput) {
        prompt = "Enter destination city:";
        break;
      }
      state.data.destination = rawInput;
      // Look up matching trips by station city.
      const trips = await prisma.trip.findMany({
        where: {
          status: "SCHEDULED",
          route: {
            originStation: { city: { equals: state.data.origin, mode: "insensitive" } },
            destinationStation: {
              city: { equals: rawInput, mode: "insensitive" },
            },
          },
        },
        take: 9,
        orderBy: { departAt: "asc" },
        include: {
          route: {
            include: {
              originStation: { select: { city: true } },
              destinationStation: { select: { city: true } },
            },
          },
        },
      });
      state.data.trips = trips.map((t, i) => ({
        index: i + 1,
        id: t.id,
        departAt: t.departAt.toISOString(),
        price: t.basePrice,
      }));
      state.step = "trip";
      if (trips.length === 0) {
        prompt = `No scheduled trips from ${state.data.origin} to ${rawInput}.\n0) Start over`;
      } else {
        const lines = trips.map(
          (t, i) =>
            `${i + 1}) ${new Date(t.departAt).toLocaleString()} - ${t.basePrice.toFixed(2)} ETB`,
        );
        prompt = `Select trip:\n${lines.join("\n")}`;
      }
      break;
    }

    case "trip": {
      const trips: any[] = state.data.trips || [];
      if (rawInput === "0" || !trips.length) {
        state.step = "menu";
        state.data = {};
        prompt = "Welcome to Bus Booking.\n1) Book a ticket\n2) My Tickets";
        break;
      }
      const idx = Number(rawInput);
      const trip = trips.find((t) => t.index === idx);
      if (!trip) {
        const lines = trips.map(
          (t) => `${t.index}) ${new Date(t.departAt).toLocaleString()} - ${t.price.toFixed(2)} ETB`,
        );
        prompt = `Invalid selection.\nSelect trip:\n${lines.join("\n")}`;
        break;
      }
      state.data.selectedTrip = trip;
      state.step = "confirm";
      prompt = `Trip on ${new Date(trip.departAt).toLocaleString()} for ${trip.price.toFixed(
        2,
      )} ETB.\n1) Confirm\n2) Cancel`;
      break;
    }

    case "confirm": {
      if (rawInput === "1") {
        const trip = state.data.selectedTrip;
        const ref = `USSD-${Date.now().toString(36).toUpperCase()}`;
        state.data.bookingRef = ref;
        state.step = "done";
        prompt = `Booking confirmed! Ref: ${ref}\nTrip: ${trip ? new Date(trip.departAt).toLocaleString() : "-"}`;
        done = true;
      } else {
        state.step = "menu";
        state.data = {};
        prompt = "Booking cancelled.\n1) Book a ticket\n2) My Tickets";
      }
      break;
    }

    default: {
      state.step = "menu";
      state.data = {};
      prompt = "Welcome to Bus Booking.\n1) Book a ticket\n2) My Tickets";
      break;
    }
  }

  const updated = await prisma.channelSession.update({
    where: { id: sessionId },
    data: { state: state as any },
  });

  return { prompt, done, session: { id: updated.id, state: updated.state } };
}

// ---------------------------------------------------------------------------
// Mock SMS / voice helpers (no external gateway)
// ---------------------------------------------------------------------------

export async function smsBook(msisdn: string, message: string) {
  const session = await startSession(ChannelKind.SMS, msisdn);
  return {
    ok: true,
    sessionId: session.id,
    reply: `SMS received from ${msisdn}: "${message}". Mock booking channel active.`,
  };
}

export async function voiceBook(callId: string, speech: string, locale = "am") {
  const session = await startSession(ChannelKind.VOICE, callId);
  return {
    ok: true,
    sessionId: session.id,
    reply: `Voice call ${callId} (${locale}) heard: "${speech}". Mock IVR active.`,
  };
}
