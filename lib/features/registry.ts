// Central registry of the 12 ecosystem-gap features. Used by the features hub
// UI, API discovery, and status dashboards. Each entry maps a gap to its
// scaffolded service module, API route prefix, and UI page.

export type FeatureStatus = "stub" | "planned" | "active";
export type FeaturePriority = "high" | "medium" | "low";

export type FeatureDef = {
  id: string; // "gap1" ... "gap12"
  number: number;
  i18nKey: string; // translation key prefix under features.*
  priority: FeaturePriority;
  status: FeatureStatus;
  impact: string;
  apiPrefix: string; // e.g. "/api/payments"
  serviceModule: string; // e.g. "lib/services/payments"
  uiPath: string; // e.g. "/passenger/payments"
  capabilities: string[];
};

export const FEATURES: FeatureDef[] = [
  {
    id: "gap1", number: 1, i18nKey: "features.gap1", priority: "high", status: "stub", impact: "Trust",
    apiPrefix: "/api/payments", serviceModule: "lib/services/payments", uiPath: "/passenger/payments",
    capabilities: ["multi-provider fallback", "escrow", "instant refunds", "audit log", "SMS/USSD pay", "cash via agent"],
  },
  {
    id: "gap2", number: 2, i18nKey: "features.gap2", priority: "high", status: "stub", impact: "Reliability",
    apiPrefix: "/api/seats", serviceModule: "lib/services/seats", uiPath: "/passenger/book-now",
    capabilities: ["real-time WebSocket", "atomic seat locks", "event sourcing", "double-booking prevention", "seat status states"],
  },
  {
    id: "gap3", number: 3, i18nKey: "features.gap3", priority: "high", status: "stub", impact: "Customer Service",
    apiPrefix: "/api/support", serviceModule: "lib/services/support", uiPath: "/passenger/support",
    capabilities: ["AI chat (am/om/en)", "operator-passenger chat", "dispute workflow", "24h SLA", "GPS pickup pin", "ticket priorities"],
  },
  {
    id: "gap4", number: 4, i18nKey: "features.gap4", priority: "medium", status: "stub", impact: "Adoption",
    apiPrefix: "/api/operator", serviceModule: "lib/services/operator", uiPath: "/manager/operator",
    capabilities: ["revenue dashboard", "dynamic pricing", "fraud detection", "30-day trial", "onboarding", "training videos", "competitor pricing"],
  },
  {
    id: "gap5", number: 5, i18nKey: "features.gap5", priority: "high", status: "stub", impact: "Accessibility",
    apiPrefix: "/api/channels", serviceModule: "lib/services/channels", uiPath: "/passenger/channels",
    capabilities: ["SMS booking", "USSD (*787#)", "voice (5555)", "agent network", "offline QR", "printed tickets"],
  },
  {
    id: "gap6", number: 6, i18nKey: "features.gap6", priority: "medium", status: "stub", impact: "Experience",
    apiPrefix: "/api/tracking", serviceModule: "lib/services/tracking", uiPath: "/passenger/tracking",
    capabilities: ["GPS tracking", "live map", "predictive ETA", "push notifications", "driver chat", "safety check-in", "SOS"],
  },
  {
    id: "gap7", number: 7, i18nKey: "features.gap7", priority: "low", status: "stub", impact: "Engagement",
    apiPrefix: "/api/social", serviceModule: "lib/services/social", uiPath: "/passenger/social",
    capabilities: ["travel buddies", "verified reviews", "photo evidence", "safety ratings", "referrals", "loyalty tiers", "badges"],
  },
  {
    id: "gap8", number: 8, i18nKey: "features.gap8", priority: "low", status: "stub", impact: "Revenue",
    apiPrefix: "/api/vas", serviceModule: "lib/services/vas", uiPath: "/passenger/services",
    capabilities: ["travel insurance", "cargo booking", "hotel combos", "rest stops", "group booking", "food preorder", "tour packages"],
  },
  {
    id: "gap9", number: 9, i18nKey: "features.gap9", priority: "low", status: "stub", impact: "Scale",
    apiPrefix: "/api/enterprise", serviceModule: "lib/services/enterprise", uiPath: "/admin/enterprise",
    capabilities: ["corporate accounts", "government tax API", "immigration manifest", "disaster dispatch", "NGO bulk booking", "audit trail"],
  },
  {
    id: "gap10", number: 10, i18nKey: "features.gap10", priority: "medium", status: "stub", impact: "Growth",
    apiPrefix: "/api/analytics", serviceModule: "lib/services/analytics", uiPath: "/admin/analytics",
    capabilities: ["behavior tracking", "heatmaps", "demand forecasting", "competitor intelligence", "revenue forecast", "churn analysis"],
  },
  {
    id: "gap11", number: 11, i18nKey: "features.gap11", priority: "low", status: "stub", impact: "Retention",
    apiPrefix: "/api/gamification", serviceModule: "lib/services/gamification", uiPath: "/passenger/rewards",
    capabilities: ["loyalty tiers", "achievement badges", "referrals", "spin & win", "monthly challenges", "birthday specials"],
  },
  {
    id: "gap12", number: 12, i18nKey: "features.gap12", priority: "medium", status: "stub", impact: "Inclusivity",
    apiPrefix: "/api/accessibility", serviceModule: "lib/services/accessibility", uiPath: "/passenger/accessibility",
    capabilities: ["wheelchair filter", "elderly priority", "terminal assistance", "audio announcements", "women-only", "SOS", "female crew preference"],
  },
];

export function getFeature(id: string): FeatureDef | undefined {
  return FEATURES.find((f) => f.id === id);
}

export const FEATURE_STATUS_LABEL: Record<FeatureStatus, string> = {
  stub: "features.status.stub",
  planned: "features.status.planned",
  active: "features.status.active",
};
