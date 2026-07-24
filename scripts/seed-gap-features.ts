import "dotenv/config";
import {
  PrismaClient,
  PaymentStatus,
  PaymentProvider,
  EscrowStatus,
  SeatHoldStatus,
  SeatEventKind,
  SupportPriority,
  TicketStatus,
  ChannelKind,
  LoyaltyTier,
  UserRole,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function resetGapData() {
  // Clear gap-feature demo data in dependency order (children first) so the
  // seed is idempotent and can be re-run safely. Base bus/trip/booking/user
  // data from seed-bus.ts is left untouched.
  await prisma.chatMessage.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.transactionLog.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.seatHold.deleteMany();
  await prisma.seatEvent.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.userLoyalty.deleteMany();
  await prisma.review.deleteMany();
  await prisma.travelBuddy.deleteMany();
  await prisma.safetyReport.deleteMany();
  await prisma.travelInsurance.deleteMany();
  await prisma.cargoBooking.deleteMany();
  await prisma.groupBooking.deleteMany();
  await prisma.ngoBulkBooking.deleteMany();
  await prisma.offlineTicket.deleteMany();
  await prisma.busLocation.deleteMany();
  await prisma.sosAlert.deleteMany();
  await prisma.analyticsEvent.deleteMany();
  await prisma.routeHeatmap.deleteMany();
  await prisma.dynamicPricingRule.deleteMany();
  await prisma.operatorFraudFlag.deleteMany();
  await prisma.agentBookingChannel.deleteMany();
  await prisma.channelSession.deleteMany();
  await prisma.hotelPartner.deleteMany();
  await prisma.corporateAccount.deleteMany();
  await prisma.governmentReport.deleteMany();
}

async function main() {
  await resetGapData();

  const buses = await prisma.bus.findMany({ take: 14 });
  const trips = await prisma.trip.findMany({ take: 10, include: { bus: true, route: { include: { originStation: true, destinationStation: true } } } });
  const users = await prisma.user.findMany();
  const passenger = users.find((u) => u.role === UserRole.PASSENGER) || users[0];
  const bookings = await prisma.booking.findMany({ take: 5 });
  const payments = await prisma.payment.findMany({ take: 5 });

  if (!buses.length || !trips.length) {
    console.warn("No base buses/trips found — run `npm run seed:bus` first.");
    return;
  }

  // Mark some buses with accessibility flags (GAP 12)
  for (const b of buses) {
    await prisma.bus.update({
      where: { id: b.id },
      data: {
        wheelchairAccessible: b.plateNumber.endsWith("3") || b.plateNumber.endsWith("7"),
        womenOnly: b.plateNumber.endsWith("6"),
        hasPrioritySeating: true,
        audioAnnouncements: b.plateNumber.endsWith("1") || b.plateNumber.endsWith("4"),
      },
    });
  }

  // ---- GAP 1: Payments — transaction logs, escrow, refunds ----
  let prevHash: string | null = null;
  for (const p of payments.slice(0, 3)) {
    const log = await prisma.transactionLog.create({
      data: { paymentId: p.id, event: "charge", provider: PaymentProvider.CHAPA, payload: { amount: p.amount }, prevHash, hash: "" },
    });
    const hash = `seedhash_${Math.abs(hashCode((prevHash || "") + log.id))}`;
    await prisma.transactionLog.update({ where: { id: log.id }, data: { hash } });
    prevHash = hash;
  }
  for (const b of bookings.slice(0, 2)) {
    await prisma.escrow.create({
      data: { bookingId: b.id, amount: b.totalPrice, status: EscrowStatus.HELD, heldAt: new Date() },
    });
  }
  if (payments[0]) {
    await prisma.refund.create({
      data: { paymentId: payments[0].id, amount: payments[0].amount / 2, reason: "partial_cancel", status: PaymentStatus.PAID, processedAt: new Date() },
    });
  }

  // ---- GAP 2: Seats — holds + event sourcing ----
  const trip0 = trips[0];
  const seat0 = await prisma.seat.findFirst({ where: { busId: trip0.busId } });
  if (seat0) {
    await prisma.seatHold.create({
      data: { tripId: trip0.id, seatId: seat0.id, userId: passenger?.id, expiresAt: new Date(Date.now() + 10 * 60_000), status: SeatHoldStatus.HELD },
    });
    for (const kind of [SeatEventKind.HOLD, SeatEventKind.BOOK]) {
      await prisma.seatEvent.create({ data: { tripId: trip0.id, seatId: seat0.id, kind, userId: passenger?.id } });
    }
  }

  // ---- GAP 3: Support — tickets, chat, disputes ----
  const ticket = await prisma.supportTicket.create({
    data: {
      userId: passenger?.id,
      subject: "Pickup location unclear",
      priority: SupportPriority.MEDIUM,
      status: TicketStatus.OPEN,
      language: "am",
      dueAt: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });
  await prisma.chatMessage.create({ data: { ticketId: ticket.id, sender: "user", content: "የመግባት ቦታዬ የት ነው?", locale: "am" } });
  await prisma.chatMessage.create({ data: { ticketId: ticket.id, sender: "ai", content: "በAutobus Tera በሩ ላይ ይጠብቁ።", locale: "am" } });
  if (bookings[0]) {
    await prisma.dispute.create({ data: { bookingId: bookings[0].id, userId: passenger?.id, reason: "bus_delayed", status: TicketStatus.OPEN } });
  }

  // ---- GAP 4: Operator — dynamic pricing + fraud flags ----
  const routes = await prisma.route.findMany({ take: 5 });
  for (const r of routes) {
    await prisma.dynamicPricingRule.create({ data: { routeId: r.id, minFillPct: 0, maxFillPct: 30, multiplier: 0.9, active: true } });
    await prisma.dynamicPricingRule.create({ data: { routeId: r.id, minFillPct: 80, maxFillPct: 100, multiplier: 1.15, active: true } });
  }
  await prisma.operatorFraudFlag.create({ data: { busId: buses[0].id, reason: "duplicate_ticket_scan", severity: "medium" } });

  // ---- GAP 5: Channels — agents, offline tickets, sessions ----
  await prisma.agentBookingChannel.createMany({
    data: [
      { agentName: "Marta Shop", phone: "+251911000111", location: "Addis Ababa - Merkato", commissionPct: 2 },
      { agentName: "Selam Kiosk", phone: "+251911000222", location: "Bahir Dar - Central", commissionPct: 2.5 },
    ],
  });
  if (bookings[0]) {
    await prisma.offlineTicket.create({ data: { bookingId: bookings[0].id, qrPayload: `offline://${bookings[0].id}:${Date.now()}` } });
  }
  await prisma.channelSession.create({ data: { channel: ChannelKind.USSD, msisdn: "+251911000333", ussdSession: "sess_1", state: { screen: "menu" } } });

  // ---- GAP 6: Tracking — bus locations + SOS ----
  for (const t of trips.slice(0, 5)) {
    await prisma.busLocation.create({
      data: { busId: t.busId, tripId: t.id, lat: 9.025 + Math.random(), lng: 38.7469 + Math.random(), speed: 60 + Math.round(Math.random() * 30), heading: 180, etaMinutes: 30 + Math.round(Math.random() * 30) },
    });
  }
  await prisma.sosAlert.create({ data: { userId: passenger?.id, bookingId: bookings[0]?.id, busId: buses[0].id, lat: 9.03, lng: 38.75, resolved: false } });

  // ---- GAP 7: Social — reviews, travel buddies, safety ----
  for (const b of bookings.slice(0, 2)) {
    await prisma.review.create({ data: { bookingId: b.id, userId: passenger?.id, rating: 4 + Math.round(Math.random()), comment: "Comfortable ride", verified: true, photoUrls: [] } });
  }
  await prisma.travelBuddy.create({ data: { tripId: trips[0].id, userId: passenger?.id, optedIn: true } });
  await prisma.safetyReport.create({ data: { bookingId: bookings[0]?.id, userId: passenger?.id, category: "speeding", description: "Driver exceeded limit" } });

  // ---- GAP 8: VAS — insurance, cargo, hotels, group ----
  if (bookings[0]) await prisma.travelInsurance.create({ data: { bookingId: bookings[0].id, premium: 2, covered: true } });
  await prisma.cargoBooking.create({ data: { tripId: trips[0].id, senderPhone: "+251911000444", description: "Documents", weightKg: 2, price: 30 } });
  await prisma.hotelPartner.createMany({
    data: [
      { name: "Lakeview Hotel", city: "Hawassa", commissionPct: 8 },
      { name: "Tana Resort", city: "Bahir Dar", commissionPct: 10 },
    ],
  });
  await prisma.groupBooking.create({ data: { tripId: trips[1].id, organizerId: passenger?.id, seatsCount: 8, discountPct: 10 } });

  // ---- GAP 9: Enterprise — corporate, govt report, NGO ----
  await prisma.corporateAccount.create({ data: { name: "Demo Corporate Account", billingEmail: "travel@demo-corp.com", creditLimit: 100000 } });
  await prisma.governmentReport.create({ data: { period: "2026-07", taxCollected: 15420.5, payload: { bookings: 120 } } });
  await prisma.ngoBulkBooking.create({ data: { ngoName: "Red Cross Ethiopia", tripId: trips[2].id, seatsCount: 20, specialPricing: 0.8 } });

  // ---- GAP 10: Analytics — events + heatmap ----
  for (const t of trips.slice(0, 5)) {
    await prisma.analyticsEvent.create({ data: { kind: "trip_search", userId: passenger?.id, meta: { routeId: t.routeId } } });
  }
  for (const r of routes.slice(0, 4)) {
    const fullRoute = await prisma.route.findUnique({ where: { id: r.id }, include: { originStation: true, destinationStation: true } });
    await prisma.routeHeatmap.create({
      data: { routeId: r.id, originCity: fullRoute?.originStation.city || "", destCity: fullRoute?.destinationStation.city || "", intensity: Math.random(), bucket: new Date() },
    });
  }

  // ---- GAP 11: Gamification — loyalty, badges, referral ----
  if (passenger) {
    await prisma.userLoyalty.create({ data: { userId: passenger.id, points: 1250, tier: LoyaltyTier.SILVER } });
  }
  await prisma.badge.createMany({
    data: [
      { code: "first_trip", name: "First Trip", description: "Completed your first booking" },
      { code: "loyal_10", name: "Loyal Traveler", description: "10 completed trips" },
      { code: "reviewer", name: "Reviewer", description: "Left 5 verified reviews" },
    ],
  });
  if (passenger) {
    const badge = await prisma.badge.findFirstOrThrow({ where: { code: "first_trip" } });
    await prisma.userBadge.create({ data: { userId: passenger.id, badgeId: badge.id } });
    await prisma.referral.create({ data: { referrerId: passenger.id, referredEmail: "friend@bus.et", rewardBirr: 50, redeemed: false } });
  }

  console.log("Gap-feature seed completed.");
  console.log(`Buses flagged (accessibility): updated`);
  console.log(`Trips used: ${trips.length}, Bookings used: ${bookings.length}`);
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

main()
  .catch((error) => {
    console.error("Gap seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
