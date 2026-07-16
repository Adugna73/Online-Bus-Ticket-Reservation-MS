import { prisma } from "@/lib/prisma";
import type { LoyaltyTier, Badge, UserBadge, Referral, UserLoyalty } from "@prisma/client";

// GAP 11: Gamification — loyalty tiers, badges, referrals.
// Fully DB-backed.

export type Tier = LoyaltyTier;

const TIERS: { tier: Tier; min: number }[] = [
    { tier: "BRONZE", min: 0 },
    { tier: "SILVER", min: 100 },
    { tier: "GOLD", min: 500 },
    { tier: "PLATINUM", min: 1000 },
    { tier: "DIAMOND", min: 3000 },
];

export function tierForPoints(points: number): Tier {
    let tier: Tier = "BRONZE";
    for (const t of TIERS) if (points >= t.min) tier = t.tier;
    return tier;
}

export function nextTier(tier: Tier): { tier: Tier; min: number } | null {
    const idx = TIERS.findIndex((t) => t.tier === tier);
    if (idx < 0 || idx >= TIERS.length - 1) return null;
    return TIERS[idx + 1];
}

const DEFAULT_BADGES: { code: string; name: string; description: string }[] = [
    {
        code: "FIRST_BOOKING",
        name: "First Booking",
        description: "Awarded when you complete your first booking.",
    },
    {
        code: "FREQUENT_TRAVELER",
        name: "Frequent Traveler",
        description: "Awarded after completing 10 bookings.",
    },
    {
        code: "REFERRAL_PRO",
        name: "Referral Pro",
        description: "Awarded after 3 successful referrals.",
    },
    {
        code: "LOYAL_GOLD",
        name: "Loyal Gold",
        description: "Awarded when you reach the Gold loyalty tier.",
    },
];

export async function ensureBadges(): Promise<void> {
    for (const b of DEFAULT_BADGES) {
        await prisma.badge.upsert({
            where: { code: b.code },
            update: { name: b.name, description: b.description },
            create: b,
        });
    }
}

export async function getLoyalty(userId: string): Promise<UserLoyalty> {
    await ensureBadges();
    return prisma.userLoyalty.upsert({
        where: { userId },
        update: {},
        create: { userId, points: 0, tier: "BRONZE" },
    });
}

export async function addPoints(userId: string, pts: number): Promise<UserLoyalty> {
    const current = await prisma.userLoyalty.upsert({
        where: { userId },
        update: {},
        create: { userId, points: 0, tier: "BRONZE" },
    });
    const newPoints = Math.max(0, current.points + pts);
    const tier = tierForPoints(newPoints);
    return prisma.userLoyalty.update({
        where: { userId },
        data: { points: newPoints, tier },
    });
}

export async function awardBadge(
    userId: string,
    code: string,
): Promise<UserBadge | null> {
    const badge = await prisma.badge.findUnique({ where: { code } });
    if (!badge) return null;
    return prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: {},
        create: { userId, badgeId: badge.id },
    });
}

export type BadgeWithAwarded = Badge & { awarded: boolean; awardedAt: Date | null };

export async function listBadges(userId: string): Promise<BadgeWithAwarded[]> {
    await ensureBadges();
    const badges = await prisma.badge.findMany();
    const userBadges = await prisma.userBadge.findMany({ where: { userId } });
    const awardedMap = new Map(userBadges.map((ub) => [ub.badgeId, ub.awardedAt]));
    return badges.map((b) => ({
        ...b,
        awarded: awardedMap.has(b.id),
        awardedAt: awardedMap.get(b.id) ?? null,
    }));
}

export async function createReferral(
    referrerId: string,
    referredEmail: string,
): Promise<Referral> {
    return prisma.referral.create({
        data: { referrerId, referredEmail },
    });
}

export async function listReferrals(referrerId: string): Promise<Referral[]> {
    return prisma.referral.findMany({
        where: { referrerId },
        orderBy: { createdAt: "desc" },
    });
}

export async function redeemReferral(id: string): Promise<Referral | null> {
    const referral = await prisma.referral.findUnique({ where: { id } });
    if (!referral || referral.redeemed) return referral;
    await prisma.referral.update({
        where: { id },
        data: { redeemed: true },
    });
    await addPoints(referral.referrerId, 50);
    return prisma.referral.findUnique({ where: { id } });
}
