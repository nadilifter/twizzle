/**
 * Feature Toggle Definitions
 *
 * Central source of truth for all plan-based feature toggles.
 * Each feature key maps to a module that can be enabled/disabled per plan,
 * with optional superadmin overrides per organization.
 */

export const FEATURE_KEYS = [
  "events",
  "competitions",
  "sms",
  "emailCampaigns",
  "customDomains",
  "qboIntegration",
  "training",
  "pointOfSale",
  "memberships",
  "waitlists",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureToggles = Record<FeatureKey, boolean>;

/** All features disabled - used as base when no plan is set */
export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  events: false,
  competitions: false,
  sms: false,
  emailCampaigns: false,
  customDomains: false,
  qboIntegration: false,
  training: false,
  pointOfSale: false,
  memberships: false,
  waitlists: false,
};

/** Human-readable labels for each feature */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  events: "Events",
  competitions: "Competitions",
  sms: "SMS Messaging",
  emailCampaigns: "Email Campaigns",
  customDomains: "Custom Domains",
  qboIntegration: "QuickBooks Integration",
  training: "Training",
  pointOfSale: "Point of Sale",
  memberships: "Memberships",
  waitlists: "Waitlists",
};

/** Descriptions shown to admins */
export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  events: "Event management, calendar, and check-in via the Events portal",
  competitions: "Competition management with categories, results tracking, and large-scale participant registration",
  sms: "SMS campaigns, conversations, and messaging via Twilio",
  emailCampaigns: "Email campaign creation and delivery",
  customDomains: "Custom domain configuration for your marketing site",
  qboIntegration: "QuickBooks Online accounting integration",
  training: "Skills tracking, evaluations, levels, and training programs",
  pointOfSale: "Point of Sale terminal and checkout via the POS portal",
  memberships: "Membership management, restrictions, and storefront purchasing",
  waitlists: "Program and session waitlist management with automatic promotion",
};

/**
 * Maps feature keys to the sidebar nav items they control.
 * - sectionTitle: if set, the entire nav section is removed when disabled
 * - subItems: specific sub-item titles within a section to remove
 * - accessPoints: secondary nav access point titles to remove
 */
export const FEATURE_SIDEBAR_MAP: Record<
  FeatureKey,
  {
    sectionTitle?: string;
    subItems?: { section: string; items: string[] }[];
    accessPoints?: string[];
  }
> = {
  events: {
    subItems: [
      {
        section: "Registrations",
        items: ["Events"],
      },
    ],
    accessPoints: ["Events Portal"],
  },
  competitions: {
    sectionTitle: "Competitions",
  },
  sms: {
    subItems: [
      {
        section: "Communication",
        items: ["SMS Campaigns", "SMS Conversations"],
      },
      {
        section: "Usage",
        items: ["SMS"],
      },
    ],
  },
  emailCampaigns: {
    subItems: [
      {
        section: "Communication",
        items: ["Email Campaigns"],
      },
    ],
  },
  customDomains: {
    // Handled at page level within the Website page, no sidebar change
  },
  qboIntegration: {
    subItems: [
      {
        section: "Financials",
        items: ["Integrations"],
      },
    ],
  },
  training: {
    sectionTitle: "Training",
  },
  pointOfSale: {
    subItems: [
      {
        section: "My Organization",
        items: ["Store"],
      },
    ],
    accessPoints: ["Point of Sale"],
  },
  memberships: {
    subItems: [
      {
        section: "Athletes",
        items: ["Memberships"],
      },
    ],
  },
  waitlists: {},
};

/**
 * Maps feature keys to API route prefixes they protect.
 * Used by the requireFeature() guard.
 */
export const FEATURE_API_ROUTES: Record<FeatureKey, string[]> = {
  events: ["/api/events"],
  competitions: ["/api/competitions"],
  sms: ["/api/sms"],
  emailCampaigns: ["/api/email/campaigns"],
  customDomains: [], // Handled inline in website route
  qboIntegration: ["/api/integrations"],
  training: [
    "/api/skills",
    "/api/levels",
    "/api/evaluation-templates",
    "/api/evaluations",
  ],
  pointOfSale: ["/api/pos"],
  memberships: ["/api/memberships", "/api/public/memberships"],
  waitlists: [],
};

/**
 * Validates and normalizes a featureToggles JSON value from the database.
 * Returns a complete FeatureToggles object with defaults for missing keys.
 */
/** Map of legacy feature key names to their current key */
const LEGACY_KEY_MAP: Record<string, FeatureKey> = {
  advancedRegistrations: "competitions",
};

export function parseFeatureToggles(
  raw: unknown
): FeatureToggles {
  const result = { ...DEFAULT_FEATURE_TOGGLES };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    for (const key of FEATURE_KEYS) {
      if (key in obj) {
        const val = obj[key];
        if (typeof val === "boolean") {
          result[key] = val;
        }
      }
    }
    // Handle legacy keys for backward compatibility
    for (const [legacyKey, currentKey] of Object.entries(LEGACY_KEY_MAP)) {
      if (legacyKey in obj && !(currentKey in obj)) {
        const val = obj[legacyKey];
        if (typeof val === "boolean") {
          result[currentKey] = val;
        }
      }
    }
  }
  return result;
}

/**
 * Merges plan defaults with organization overrides.
 * Override values take precedence over plan defaults.
 */
export function mergeFeatureToggles(
  planToggles: FeatureToggles,
  overrides: Partial<FeatureToggles> | null | undefined
): FeatureToggles {
  if (!overrides) return { ...planToggles };
  const result = { ...planToggles };
  for (const key of FEATURE_KEYS) {
    if (key in overrides && typeof overrides[key] === "boolean") {
      result[key] = overrides[key]!;
    }
  }
  return result;
}
