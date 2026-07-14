"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Loader2,
    Star,
    Users,
    ShieldAlert,
    MessageSquare,
    CheckCircle2,
} from "lucide-react";

import DashboardShell from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
    CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type RouteInfo = {
    id: string;
    origin: { name: string; code: string } | null;
    destination: { name: string; code: string } | null;
};

type TripInfo = {
    id: string;
    departAt: string;
    arriveAt: string;
    status: string;
    route: RouteInfo | null;
};

type BookingItem = {
    id: string;
    bookingRef: string;
    status: string;
    trip: TripInfo | null;
};

type ReviewItem = {
    id: string;
    bookingId: string;
    userId: string | null;
    rating: number;
    comment: string | null;
    verified: boolean;
    createdAt: string;
    user: { id: string; fullName: string } | null;
    booking: {
        id: string;
        bookingRef: string;
        trip: {
            id: string;
            departAt: string;
            route: RouteInfo | null;
        } | null;
    } | null;
};

type BuddyItem = {
    id: string;
    tripId: string;
    userId: string;
    optedIn: boolean;
    createdAt: string;
    user: { id: string; fullName: string } | null;
};

type SafetyItem = {
    id: string;
    bookingId: string | null;
    userId: string | null;
    category: string;
    description: string | null;
    createdAt: string;
    user: { id: string; fullName: string } | null;
};

const SAFETY_CATEGORIES = [
    "Harassment",
    "Unsafe driving",
    "Theft",
    "Vehicle condition",
    "Security incident",
    "Other",
] as const;

function formatDateTime(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
}

function routeLabel(route: RouteInfo | null) {
    if (!route) return "-";
    const o = route.origin ? `${route.origin.name}` : "-";
    const d = route.destination ? `${route.destination.name}` : "-";
    return `${o} → ${d}`;
}

function Stars({
    value,
    onChange,
    size = "h-4 w-4",
}: {
    value: number;
    onChange?: (v: number) => void;
    size?: string;
}) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    disabled={!onChange}
                    onClick={() => onChange?.(n)}
                    className={`${
                        onChange
                            ? "cursor-pointer hover:scale-110"
                            : "cursor-default"
                    } transition-transform`}
                    aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                    <Star
                        className={`${size} ${
                            n <= value
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                        }`}
                    />
                </button>
            ))}
        </div>
    );
}

export default function PassengerSocialPage() {
    const { toast } = useToast();

    const [bookings, setBookings] = useState<BookingItem[]>([]);
    const [reviews, setReviews] = useState<ReviewItem[]>([]);
    const [safetyReports, setSafetyReports] = useState<SafetyItem[]>([]);
    const [buddiesByTrip, setBuddiesByTrip] = useState<
        Record<string, BuddyItem[]>
    >({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Review form state
    const [reviewBookingId, setReviewBookingId] = useState("");
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);

    // Safety form state
    const [safetyCategory, setSafetyCategory] = useState<string>(
        SAFETY_CATEGORIES[0],
    );
    const [safetyBookingId, setSafetyBookingId] = useState("");
    const [safetyDescription, setSafetyDescription] = useState("");
    const [submittingSafety, setSubmittingSafety] = useState(false);

    // Buddy state
    const [buddyTripId, setBuddyTripId] = useState("");
    const [buddyBusy, setBuddyBusy] = useState(false);

    const loadAll = useCallback(async () => {
        try {
            setLoading(true);
            const [bookingsRes, reviewsRes, safetyRes] = await Promise.all([
                fetch("/api/bookings"),
                fetch("/api/social"),
                fetch("/api/social?safety=1"),
            ]);

            if (bookingsRes.ok) {
                const data = (await bookingsRes.json()) as BookingItem[];
                setBookings(data || []);
            }
            if (reviewsRes.ok) {
                const data = (await reviewsRes.json()) as {
                    reviews: ReviewItem[];
                };
                setReviews(data?.reviews || []);
            }
            if (safetyRes.ok) {
                const data = (await safetyRes.json()) as {
                    safetyReports: SafetyItem[];
                };
                setSafetyReports(data?.safetyReports || []);
            }
        } catch (err: any) {
            setError(err?.message || "Failed to load data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const completedBookings = bookings.filter(
        (b) => b.status === "COMPLETED",
    );
    const upcomingBookings = bookings.filter(
        (b) =>
            b.status === "CONFIRMED" &&
            b.trip &&
            new Date(b.trip.departAt).getTime() > Date.now(),
    );

    const reviewedBookingIds = new Set(reviews.map((r) => r.bookingId));
    const reviewableBookings = completedBookings.filter(
        (b) => !reviewedBookingIds.has(b.id),
    );

    const loadBuddies = useCallback(async (tripId: string) => {
        try {
            const res = await fetch(
                `/api/social?buddies=1&tripId=${encodeURIComponent(tripId)}`,
            );
            if (!res.ok) return;
            const data = (await res.json()) as { buddies: BuddyItem[] };
            setBuddiesByTrip((prev) => ({
                ...prev,
                [tripId]: data?.buddies || [],
            }));
        } catch {
            // ignore
        }
    }, []);

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewBookingId) {
            toast({
                title: "Booking required",
                description: "Select a completed booking to review.",
                variant: "destructive",
            });
            return;
        }
        if (reviewRating < 1) {
            toast({
                title: "Rating required",
                description: "Please select a rating from 1 to 5 stars.",
                variant: "destructive",
            });
            return;
        }
        try {
            setSubmittingReview(true);
            const res = await fetch("/api/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "review",
                    bookingId: reviewBookingId,
                    rating: reviewRating,
                    comment: reviewComment.trim() || undefined,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to submit review.");
            }
            const created = (await res.json()) as ReviewItem;
            toast({
                title: "Review submitted",
                description: created.verified
                    ? "Your verified review has been posted."
                    : "Your review has been posted.",
            });
            setReviews((prev) => [created, ...prev]);
            setReviewBookingId("");
            setReviewRating(0);
            setReviewComment("");
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to submit review.",
                variant: "destructive",
            });
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleSafetySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setSubmittingSafety(true);
            const res = await fetch("/api/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "safety",
                    category: safetyCategory,
                    bookingId: safetyBookingId || undefined,
                    description: safetyDescription.trim() || undefined,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to file safety report.");
            }
            const created = (await res.json()) as SafetyItem;
            toast({
                title: "Report filed",
                description: "Your safety report has been submitted.",
            });
            setSafetyReports((prev) => [created, ...prev]);
            setSafetyCategory(SAFETY_CATEGORIES[0]);
            setSafetyBookingId("");
            setSafetyDescription("");
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to file safety report.",
                variant: "destructive",
            });
        } finally {
            setSubmittingSafety(false);
        }
    };

    const handleBuddyToggle = async (tripId: string, optIn: boolean) => {
        try {
            setBuddyBusy(true);
            const res = await fetch("/api/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: optIn ? "buddy" : "buddyOut",
                    tripId,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to update buddy status.");
            }
            toast({
                title: optIn ? "Opted in" : "Opted out",
                description: optIn
                    ? "You are now visible as a travel buddy for this trip."
                    : "You have opted out of travel buddy matching.",
            });
            await loadBuddies(tripId);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to update buddy status.",
                variant: "destructive",
            });
        } finally {
            setBuddyBusy(false);
        }
    };

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        <Users className="h-3.5 w-3.5" />
                        Social & Community
                    </div>
                    <h1
                        className="mt-3 text-2xl font-semibold tracking-tight"
                        style={{
                            fontFamily:
                                '"Space Grotesk", "DM Serif Display", serif',
                        }}
                    >
                        Reviews, Travel Buddies & Safety
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Share verified reviews, find travel buddies for
                        upcoming trips, and report safety concerns.
                    </p>
                </div>

                {loading && (
                    <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading...
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-8">
                        {/* Write a review */}
                        <section>
                            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                                <Star className="h-5 w-5 text-amber-400" />
                                Write a Review
                            </h2>
                            {reviewableBookings.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">
                                            No completed bookings to review
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Complete a trip to leave a verified
                                            review.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Review a completed trip</CardTitle>
                                        <CardDescription>
                                            Select a booking, rate your
                                            experience, and add a comment.
                                        </CardDescription>
                                    </CardHeader>
                                    <form onSubmit={handleReviewSubmit}>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Booking
                                                </label>
                                                <select
                                                    value={reviewBookingId}
                                                    onChange={(e) =>
                                                        setReviewBookingId(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    <option value="">
                                                        Select a booking
                                                    </option>
                                                    {reviewableBookings.map(
                                                        (b) => (
                                                            <option
                                                                key={b.id}
                                                                value={b.id}
                                                            >
                                                                {b.bookingRef}{" "}
                                                                —{" "}
                                                                {routeLabel(
                                                                    b.trip
                                                                        ?.route ||
                                                                        null,
                                                                )}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Rating
                                                </label>
                                                <Stars
                                                    value={reviewRating}
                                                    onChange={setReviewRating}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Comment (optional)
                                                </label>
                                                <textarea
                                                    value={reviewComment}
                                                    onChange={(e) =>
                                                        setReviewComment(
                                                            e.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                    placeholder="Share your experience..."
                                                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            </div>
                                        </CardContent>
                                        <CardFooter className="justify-end">
                                            <Button
                                                type="submit"
                                                size="sm"
                                                disabled={submittingReview}
                                            >
                                                {submittingReview ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    "Submit Review"
                                                )}
                                            </Button>
                                        </CardFooter>
                                    </form>
                                </Card>
                            )}
                        </section>

                        {/* Browse reviews */}
                        <section>
                            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                                <MessageSquare className="h-5 w-5" />
                                Recent Reviews
                            </h2>
                            {reviews.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">
                                            No reviews yet
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Be the first to share your trip
                                            experience.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {reviews.map((review) => (
                                        <Card
                                            key={review.id}
                                            className="flex flex-col"
                                        >
                                            <CardHeader>
                                                <div className="flex items-center justify-between gap-2">
                                                    <CardTitle className="truncate">
                                                        {review.user
                                                            ?.fullName
                                                            ? review.user
                                                                  .fullName
                                                            : "Anonymous"}
                                                    </CardTitle>
                                                    {review.verified && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-[11px]"
                                                        >
                                                            Verified
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="mt-1">
                                                    <Stars
                                                        value={review.rating}
                                                    />
                                                </div>
                                            </CardHeader>
                                            <CardContent className="flex-1 text-sm">
                                                {review.comment ? (
                                                    <p className="whitespace-pre-wrap break-words">
                                                        {review.comment}
                                                    </p>
                                                ) : (
                                                    <p className="text-muted-foreground">
                                                        No comment provided.
                                                    </p>
                                                )}
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    {routeLabel(
                                                        review.booking?.trip
                                                            ?.route || null,
                                                    )}
                                                </p>
                                            </CardContent>
                                            <CardFooter className="text-[11px] text-muted-foreground">
                                                {formatDateTime(
                                                    review.createdAt,
                                                )}
                                            </CardFooter>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Travel buddies */}
                        <section>
                            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                                <Users className="h-5 w-5" />
                                Travel Buddies
                            </h2>
                            {upcomingBookings.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center">
                                        <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">
                                            No upcoming trips
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Book a trip to find travel buddies
                                            heading the same way.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    {upcomingBookings.map((b) => {
                                        const tripId = b.trip!.id;
                                        const buddies =
                                            buddiesByTrip[tripId] || [];
                                        return (
                                            <Card
                                                key={b.id}
                                                className="flex flex-col"
                                            >
                                                <CardHeader>
                                                    <CardTitle className="truncate">
                                                        {routeLabel(
                                                            b.trip?.route ||
                                                                null,
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Departs{" "}
                                                        {formatDateTime(
                                                            b.trip?.departAt,
                                                        )}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent className="flex-1 text-sm">
                                                    <div className="mb-2 text-xs text-muted-foreground">
                                                        Booking{" "}
                                                        {b.bookingRef}
                                                    </div>
                                                    {buddies.length === 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            No buddies opted in
                                                            yet.
                                                        </p>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {buddies.map(
                                                                (bd) => (
                                                                    <Badge
                                                                        key={
                                                                            bd.id
                                                                        }
                                                                        variant="outline"
                                                                        className="text-[11px]"
                                                                    >
                                                                        {bd.user
                                                                            ?.fullName ||
                                                                            "Traveler"}
                                                                    </Badge>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                                </CardContent>
                                                <CardFooter className="flex-col items-stretch gap-2">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="flex-1"
                                                            disabled={buddyBusy}
                                                            onClick={() => {
                                                                setBuddyTripId(
                                                                    tripId,
                                                                );
                                                                handleBuddyToggle(
                                                                    tripId,
                                                                    true,
                                                                );
                                                            }}
                                                        >
                                                            Opt In
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1"
                                                            disabled={
                                                                buddyBusy &&
                                                                buddyTripId !==
                                                                    tripId
                                                            }
                                                            onClick={() => {
                                                                setBuddyTripId(
                                                                    tripId,
                                                                );
                                                                handleBuddyToggle(
                                                                    tripId,
                                                                    false,
                                                                );
                                                            }}
                                                        >
                                                            Opt Out
                                                        </Button>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="w-full"
                                                        onClick={() =>
                                                            loadBuddies(tripId)
                                                        }
                                                    >
                                                        Refresh Buddies
                                                    </Button>
                                                </CardFooter>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Safety report */}
                        <section>
                            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                                <ShieldAlert className="h-5 w-5 text-rose-500" />
                                File a Safety Report
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Report a concern</CardTitle>
                                        <CardDescription>
                                            Safety reports are reviewed by our
                                            team. Your identity stays on file
                                            for follow-up.
                                        </CardDescription>
                                    </CardHeader>
                                    <form onSubmit={handleSafetySubmit}>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Category
                                                </label>
                                                <select
                                                    value={safetyCategory}
                                                    onChange={(e) =>
                                                        setSafetyCategory(
                                                            e.target.value,
                                                        )
                                                    }
                                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                >
                                                    {SAFETY_CATEGORIES.map(
                                                        (c) => (
                                                            <option
                                                                key={c}
                                                                value={c}
                                                            >
                                                                {c}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Related booking (optional)
                                                </label>
                                                <select
                                                    value={safetyBookingId}
                                                    onChange={(e) =>
                                                        setSafetyBookingId(
                                                            e.target.value,
                                                        )
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
                                                            {b.bookingRef} —{" "}
                                                            {routeLabel(
                                                                b.trip?.route ||
                                                                    null,
                                                            )}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">
                                                    Description (optional)
                                                </label>
                                                <textarea
                                                    value={safetyDescription}
                                                    onChange={(e) =>
                                                        setSafetyDescription(
                                                            e.target.value,
                                                        )
                                                    }
                                                    rows={3}
                                                    placeholder="Describe what happened..."
                                                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            </div>
                                        </CardContent>
                                        <CardFooter className="justify-end">
                                            <Button
                                                type="submit"
                                                size="sm"
                                                disabled={submittingSafety}
                                            >
                                                {submittingSafety ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Submitting...
                                                    </>
                                                ) : (
                                                    "Submit Report"
                                                )}
                                            </Button>
                                        </CardFooter>
                                    </form>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Your safety reports</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {safetyReports.length === 0 ? (
                                            <p className="py-6 text-center text-sm text-muted-foreground">
                                                No safety reports filed.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {safetyReports.map((r) => (
                                                    <div
                                                        key={r.id}
                                                        className="rounded-md border p-3"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Badge
                                                                variant="destructive"
                                                                className="text-[11px]"
                                                            >
                                                                {r.category}
                                                            </Badge>
                                                            <span className="text-[11px] text-muted-foreground">
                                                                {formatDateTime(
                                                                    r.createdAt,
                                                                )}
                                                            </span>
                                                        </div>
                                                        {r.description && (
                                                            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                                                                {r.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
