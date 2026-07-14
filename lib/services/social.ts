import { prisma } from "@/lib/prisma";

// GAP 7: Social & Community — fully DB-backed.
// Reviews, travel buddies, and safety reports.
// Note: Review/TravelBuddy/SafetyReport models have no Prisma relations,
// so related user/booking data is fetched separately and joined in code.

type UserRef = { id: string; fullName: string };
type RouteRef = {
    id: string;
    originStation: { name: string; code: string } | null;
    destinationStation: { name: string; code: string } | null;
};

export type ReviewWithUser = {
    id: string;
    bookingId: string;
    userId: string | null;
    rating: number;
    comment: string | null;
    photoUrls: any;
    verified: boolean;
    createdAt: Date;
    user: UserRef | null;
    booking: {
        id: string;
        bookingRef: string;
        trip: {
            id: string;
            departAt: Date;
            route: RouteRef | null;
        } | null;
    } | null;
};

export type BuddyWithUser = {
    id: string;
    tripId: string;
    userId: string;
    optedIn: boolean;
    createdAt: Date;
    user: UserRef | null;
};

export type SafetyReportRow = {
    id: string;
    bookingId: string | null;
    userId: string | null;
    category: string;
    description: string | null;
    createdAt: Date;
    user: UserRef | null;
};

async function fetchUsers(ids: string[]): Promise<Map<string, UserRef>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map();
    const users = await prisma.user.findMany({
        where: { id: { in: unique } },
        select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u]));
}

async function fetchBookingsForReviews(
    bookingIds: string[],
): Promise<Map<string, ReviewWithUser["booking"]>> {
    const unique = Array.from(new Set(bookingIds.filter(Boolean)));
    if (unique.length === 0) return new Map();
    const bookings = await prisma.booking.findMany({
        where: { id: { in: unique } },
        select: {
            id: true,
            bookingRef: true,
            trip: {
                select: {
                    id: true,
                    departAt: true,
                    route: {
                        select: {
                            id: true,
                            originStation: { select: { name: true, code: true } },
                            destinationStation: { select: { name: true, code: true } },
                        },
                    },
                },
            },
        },
    });
    return new Map(bookings.map((b) => [b.id, b as ReviewWithUser["booking"]]));
}

function attachReviewRelations(
    review: any,
    userMap: Map<string, UserRef>,
    bookingMap: Map<string, ReviewWithUser["booking"]>,
): ReviewWithUser {
    return {
        ...review,
        user: review.userId ? userMap.get(review.userId) || null : null,
        booking: bookingMap.get(review.bookingId) || null,
    };
}

// Create a review for a booking. Only allowed if the booking exists and
// belongs to the user. A review is marked verified when the booking is
// completed (i.e. the trip actually happened).
export async function createReview(
    bookingId: string,
    userId: string,
    rating: number,
    comment?: string | null,
    photoUrls?: string[] | null,
): Promise<ReviewWithUser> {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
    });
    if (!booking) {
        throw new Error("booking_not_found");
    }
    if (booking.userId !== userId) {
        throw new Error("not_authorized");
    }

    const normalizedRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)));
    if (normalizedRating < 1) {
        throw new Error("invalid_rating");
    }

    const verified = booking.status === "COMPLETED";

    const review = await prisma.review.upsert({
        where: { bookingId },
        create: {
            bookingId,
            userId,
            rating: normalizedRating,
            comment: comment ? String(comment).trim() : null,
            photoUrls: photoUrls && photoUrls.length > 0 ? photoUrls : undefined,
            verified,
        },
        update: {
            userId,
            rating: normalizedRating,
            comment: comment ? String(comment).trim() : null,
            photoUrls: photoUrls && photoUrls.length > 0 ? photoUrls : undefined,
            verified,
        },
    });

    const [userMap, bookingMap] = await Promise.all([
        fetchUsers([userId]),
        fetchBookingsForReviews([bookingId]),
    ]);
    return attachReviewRelations(review, userMap, bookingMap);
}

// List reviews, optionally filtered by routeId or tripId.
export async function listReviews(
    routeId?: string | null,
    tripId?: string | null,
): Promise<ReviewWithUser[]> {
    const where: any = {};
    if (tripId) {
        where.booking = { tripId: String(tripId) };
    } else if (routeId) {
        where.booking = { trip: { routeId: String(routeId) } };
    }

    const reviews = await prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });

    const [userMap, bookingMap] = await Promise.all([
        fetchUsers(reviews.map((r) => r.userId).filter(Boolean) as string[]),
        fetchBookingsForReviews(reviews.map((r) => r.bookingId)),
    ]);

    return reviews.map((r) => attachReviewRelations(r, userMap, bookingMap));
}

// Opt in to travel buddy matching for a trip.
export async function optInBuddy(
    tripId: string,
    userId: string,
): Promise<BuddyWithUser> {
    const buddy = await prisma.travelBuddy.upsert({
        where: { tripId_userId: { tripId, userId } },
        create: { tripId, userId, optedIn: true },
        update: { optedIn: true },
    });
    const userMap = await fetchUsers([userId]);
    return { ...buddy, user: userMap.get(userId) || null };
}

// Opt out of travel buddy matching for a trip.
export async function optOutBuddy(
    tripId: string,
    userId: string,
): Promise<BuddyWithUser> {
    const buddy = await prisma.travelBuddy.upsert({
        where: { tripId_userId: { tripId, userId } },
        create: { tripId, userId, optedIn: false },
        update: { optedIn: false },
    });
    const userMap = await fetchUsers([userId]);
    return { ...buddy, user: userMap.get(userId) || null };
}

// List opted-in travel buddies for a trip.
export async function listBuddies(tripId: string): Promise<BuddyWithUser[]> {
    const buddies = await prisma.travelBuddy.findMany({
        where: { tripId, optedIn: true },
        orderBy: { createdAt: "asc" },
    });
    const userMap = await fetchUsers(
        buddies.map((b) => b.userId).filter(Boolean) as string[],
    );
    return buddies.map((b) => ({
        ...b,
        user: userMap.get(b.userId) || null,
    }));
}

// Create a safety report. bookingId is optional.
export async function createSafetyReport(
    userId: string,
    bookingId?: string | null,
    category?: string | null,
    description?: string | null,
): Promise<SafetyReportRow> {
    const cat = String(category || "").trim();
    if (!cat) {
        throw new Error("category_required");
    }

    const report = await prisma.safetyReport.create({
        data: {
            userId,
            bookingId: bookingId ? String(bookingId).trim() : null,
            category: cat,
            description: description ? String(description).trim() : null,
        },
    });

    const userMap = await fetchUsers([userId]);
    return { ...report, user: userMap.get(userId) || null };
}

// List safety reports. Staff/admin see all; passengers see only their own.
export async function listSafetyReports(
    role?: string | null,
    userId?: string | null,
): Promise<SafetyReportRow[]> {
    const roleKey = String(role || "").toLowerCase();
    const where: any = {};
    if (roleKey !== "staff" && roleKey !== "admin") {
        where.userId = userId;
    }

    const reports = await prisma.safetyReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });

    const userMap = await fetchUsers(
        reports.map((r) => r.userId).filter(Boolean) as string[],
    );
    return reports.map((r) => ({
        ...r,
        user: r.userId ? userMap.get(r.userId) || null : null,
    }));
}

// Delete a review. Only the review author (or staff/admin) may delete it.
export async function deleteReview(
    reviewId: string,
    userId: string,
    role?: string | null,
): Promise<{ id: string }> {
    const roleKey = String(role || "").toLowerCase();
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) {
        throw new Error("not_found");
    }
    if (roleKey !== "staff" && roleKey !== "admin" && review.userId !== userId) {
        throw new Error("not_authorized");
    }
    await prisma.review.delete({ where: { id: reviewId } });
    return { id: reviewId };
}
