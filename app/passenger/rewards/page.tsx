"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Gift, Award, Users, Plus, CheckCircle2, Lock } from "lucide-react";

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

type Loyalty = {
    id: string;
    userId: string;
    points: number;
    tier: string;
    updatedAt: string;
};

type BadgeItem = {
    id: string;
    code: string;
    name: string;
    description: string | null;
    awarded: boolean;
    awardedAt: string | null;
};

type Referral = {
    id: string;
    referrerId: string;
    referredEmail: string;
    rewardBirr: number;
    redeemed: boolean;
    createdAt: string;
};

const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const TIER_MIN: Record<string, number> = {
    BRONZE: 0,
    SILVER: 100,
    GOLD: 500,
    PLATINUM: 1000,
    DIAMOND: 3000,
};

function tierVariant(tier: string) {
    switch (tier) {
        case "DIAMOND":
            return "default" as const;
        case "PLATINUM":
            return "default" as const;
        case "GOLD":
            return "default" as const;
        case "SILVER":
            return "secondary" as const;
        default:
            return "outline" as const;
    }
}

function progressToNext(points: number, tier: string) {
    const idx = TIER_ORDER.indexOf(tier);
    if (idx < 0 || idx >= TIER_ORDER.length - 1) {
        return { pct: 100, next: null, remaining: 0 };
    }
    const currentMin = TIER_MIN[tier];
    const nextTier = TIER_ORDER[idx + 1];
    const nextMin = TIER_MIN[nextTier];
    const span = nextMin - currentMin;
    const done = points - currentMin;
    const pct = span > 0 ? Math.min(100, Math.round((done / span) * 100)) : 100;
    return { pct, next: nextTier, remaining: Math.max(0, nextMin - points) };
}

function formatDate(value?: string | null) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString();
}

export default function PassengerRewardsPage() {
    const { toast } = useToast();
    const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
    const [badges, setBadges] = useState<BadgeItem[]>([]);
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [referredEmail, setReferredEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [redeemingId, setRedeemingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/gamification");
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to load rewards.");
            }
            const data = (await res.json()) as {
                loyalty: Loyalty;
                badges: BadgeItem[];
                referrals: Referral[];
            };
            setLoyalty(data.loyalty);
            setBadges(data.badges || []);
            setReferrals(data.referrals || []);
        } catch (err: any) {
            setError(err?.message || "Failed to load rewards.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const handleCreateReferral = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = referredEmail.trim();
        if (!trimmed) {
            toast({
                title: "Email required",
                description: "Please enter the email of the person you are referring.",
                variant: "destructive",
            });
            return;
        }
        try {
            setSubmitting(true);
            const res = await fetch("/api/gamification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "referral",
                    referredEmail: trimmed,
                }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to create referral.");
            }
            const created = (await res.json()) as Referral;
            toast({
                title: "Referral created",
                description: `Invited ${trimmed}. Earn 50 points when redeemed.`,
            });
            setReferredEmail("");
            setReferrals((prev) => [created, ...prev]);
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to create referral.",
                variant: "destructive",
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRedeem = async (id: string) => {
        try {
            setRedeemingId(id);
            const res = await fetch("/api/gamification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "redeem", id }),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(text || "Failed to redeem referral.");
            }
            toast({
                title: "Referral redeemed",
                description: "50 loyalty points added to your account.",
            });
            await load();
        } catch (err: any) {
            toast({
                title: "Error",
                description: err?.message || "Failed to redeem referral.",
                variant: "destructive",
            });
        } finally {
            setRedeemingId(null);
        }
    };

    const progress =
        loyalty != null ? progressToNext(loyalty.points, loyalty.tier) : null;

    return (
        <DashboardShell>
            <div className="w-full max-w-none px-4 py-6 md:px-8 lg:px-10 bg-background text-foreground">
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                        <Gift className="h-3.5 w-3.5" />
                        Rewards & Loyalty
                    </div>
                    <h1
                        className="mt-3 text-2xl font-semibold tracking-tight"
                        style={{
                            fontFamily:
                                '"Space Grotesk", "DM Serif Display", serif',
                        }}
                    >
                        Rewards Center
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Earn points with every booking, unlock badges, and refer
                        friends for bonus rewards.
                    </p>
                </div>

                {loading && (
                    <div className="rounded border bg-card p-6 text-center text-muted-foreground text-sm">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Loading your rewards...
                    </div>
                )}

                {!loading && error && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-6">
                        {/* Loyalty card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between gap-2">
                                    <CardTitle>Loyalty Status</CardTitle>
                                    {loyalty && (
                                        <Badge variant={tierVariant(loyalty.tier)}>
                                            {loyalty.tier}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {loyalty ? (
                                    <>
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <div className="text-3xl font-bold">
                                                    {loyalty.points}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    loyalty points
                                                </div>
                                            </div>
                                            {progress?.next ? (
                                                <div className="text-right">
                                                    <div className="text-sm font-medium">
                                                        Next: {progress.next}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {progress.remaining} points
                                                        to go
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-right text-sm font-medium text-emerald-600">
                                                    Max tier reached
                                                </div>
                                            )}
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-emerald-500"
                                                style={{
                                                    width: `${progress?.pct ?? 100}%`,
                                                }}
                                            />
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {TIER_ORDER.map((t) => (
                                                <Badge
                                                    key={t}
                                                    variant={
                                                        loyalty.tier === t
                                                            ? "default"
                                                            : "outline"
                                                    }
                                                    className="text-[11px]"
                                                >
                                                    {t}
                                                </Badge>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No loyalty record yet.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Badges grid */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Award className="h-4 w-4" />
                                    <CardTitle>Badges</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {badges.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">
                                        No badges available yet.
                                    </p>
                                ) : (
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        {badges.map((b) => (
                                            <div
                                                key={b.id}
                                                className={`rounded-lg border p-4 ${
                                                    b.awarded
                                                        ? "border-emerald-300 bg-emerald-50/50"
                                                        : "border-border bg-muted/30 opacity-70"
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div
                                                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                                                            b.awarded
                                                                ? "bg-emerald-500 text-white"
                                                                : "bg-muted text-muted-foreground"
                                                        }`}
                                                    >
                                                        {b.awarded ? (
                                                            <CheckCircle2 className="h-5 w-5" />
                                                        ) : (
                                                            <Lock className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <Badge
                                                        variant={
                                                            b.awarded
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                        className="text-[10px]"
                                                    >
                                                        {b.awarded
                                                            ? "Unlocked"
                                                            : "Locked"}
                                                    </Badge>
                                                </div>
                                                <div className="mt-3 text-sm font-semibold">
                                                    {b.name}
                                                </div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {b.description ||
                                                        "No description."}
                                                </div>
                                                {b.awarded && b.awardedAt && (
                                                    <div className="mt-2 text-[10px] text-muted-foreground">
                                                        Unlocked{" "}
                                                        {formatDate(b.awardedAt)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Referrals */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    <CardTitle>Referrals</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <form
                                    onSubmit={handleCreateReferral}
                                    className="flex flex-col gap-2 sm:flex-row sm:items-end"
                                >
                                    <div className="flex-1 space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Refer a friend by email
                                        </label>
                                        <Input
                                            type="email"
                                            value={referredEmail}
                                            onChange={(e) =>
                                                setReferredEmail(e.target.value)
                                            }
                                            placeholder="friend@example.com"
                                            required
                                        />
                                    </div>
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={submitting}
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                Create Referral
                                            </>
                                        )}
                                    </Button>
                                </form>

                                {referrals.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">
                                        No referrals yet. Invite a friend to earn
                                        50 points when they redeem.
                                    </p>
                                ) : (
                                    <div className="divide-y rounded-md border">
                                        {referrals.map((r) => (
                                            <div
                                                key={r.id}
                                                className="flex flex-wrap items-center justify-between gap-2 p-3"
                                            >
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium">
                                                        {r.referredEmail}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {formatDate(r.createdAt)}{" "}
                                                        · Reward:{" "}
                                                        {r.rewardBirr} Birr
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant={
                                                            r.redeemed
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                        className="text-[11px]"
                                                    >
                                                        {r.redeemed
                                                            ? "Redeemed"
                                                            : "Pending"}
                                                    </Badge>
                                                    {!r.redeemed && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={
                                                                redeemingId ===
                                                                r.id
                                                            }
                                                            onClick={() =>
                                                                handleRedeem(
                                                                    r.id,
                                                                )
                                                            }
                                                        >
                                                            {redeemingId ===
                                                            r.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                "Redeem"
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </DashboardShell>
    );
}
