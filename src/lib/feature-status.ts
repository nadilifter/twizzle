/**
 * Feature Status Configuration
 * 
 * This file tracks which features have backend services implemented vs. those
 * still using demo/mock data. Used to display indicators in navigation and
 * show demo data banners on pages.
 * 
 * Status meanings:
 * - "live": Feature has backend API connected and uses real database
 * - "demo": Feature uses mock/demo data for UI demonstration
 * - "partial": Some functionality works with real data, some uses demo
 */

export type FeatureStatus = "live" | "demo" | "partial"

export interface FeatureConfig {
  status: FeatureStatus
  description?: string
  apiRoutes?: string[] // Which API routes power this feature
}

// Map of URL paths to their feature status
// Paths are matched using startsWith, so /dashboard/athletes matches /dashboard/athletes/123
export const featureStatusMap: Record<string, FeatureConfig> = {
  // ========================================
  // LIVE FEATURES (Backend Connected)
  // ========================================
  
  // Authentication & User Management
  "/login": {
    status: "live",
    description: "Authentication with NextAuth.js",
    apiRoutes: ["/api/auth"],
  },
  "/signup": {
    status: "live",
    description: "User registration",
    apiRoutes: ["/api/auth"],
  },
  "/dashboard/organization/users": {
    status: "live",
    description: "User management with full CRUD and permissions",
    apiRoutes: ["/api/users"],
  },
  
  // Super Admin
  "/admin": {
    status: "live",
    description: "Super admin organization management",
    apiRoutes: ["/api/admin"],
  },

  // ========================================
  // DEMO FEATURES (Mock Data)
  // ========================================
  
  // Dashboard
  "/dashboard": {
    status: "live",
    description: "Dashboard overview uses sample metrics",
  },
  "/dashboard/analytics": {
    status: "demo",
    description: "Analytics charts use sample data",
  },

  // Athletes Section
  "/dashboard/athletes": {
    status: "live",
    description: "Athletes directory with full CRUD operations",
    apiRoutes: ["/api/athletes"],
  },
  "/dashboard/athletes/attendance": {
    status: "live",
    description: "Attendance tracking uses mock data",
    apiRoutes: ["/api/attendance"],
  },
  "/dashboard/athletes/families": {
    status: "live",
    description: "Families directory with full CRUD operations",
    apiRoutes: ["/api/families"],
  },
  "/dashboard/athletes/memberships": {
    status: "live",
    description: "Membership management with group instances",
    apiRoutes: ["/api/memberships"],
  },

  // Training Section
  "/dashboard/training": {
    status: "demo",
    description: "Training overview uses sample data",
  },
  "/dashboard/training/plans": {
    status: "demo",
    description: "Lesson plans use local storage",
    apiRoutes: ["/api/lesson-plans"],
  },
  "/dashboard/training/programs": {
    status: "live",
    description: "Programs management with coach assignments and membership requirements",
    apiRoutes: ["/api/programs", "/api/programs/[id]/staff", "/api/programs/[id]/requirements"],
  },
  "/dashboard/training/rotations": {
    status: "demo",
    description: "Rotation scheduling uses mock data",
  },
  "/dashboard/training/skills": {
    status: "live",
    description: "Skills database with difficulty levels and age ranges",
    apiRoutes: ["/api/skills", "/api/skills/[id]"],
  },
  "/dashboard/training/levels": {
    status: "live",
    description: "Skill and program levels management",
    apiRoutes: ["/api/levels"],
  },
  "/dashboard/training/evaluations": {
    status: "live",
    description: "Evaluation templates and results management",
    apiRoutes: ["/api/evaluation-templates", "/api/evaluations"],
  },

  // Competitions Section
  "/dashboard/competitions": {
    status: "live",
    description: "Competitions management with categories, results tracking, and large-scale participant registration.",
    apiRoutes: ["/api/competitions", "/api/competitions/[id]", "/api/competitions/[id]/entries", "/api/competitions/[id]/results"],
  },
  "/dashboard/competitions/categories": {
    status: "live",
    description: "Competition category management with sport presets and custom categories",
    apiRoutes: ["/api/competition-categories"],
  },
  "/dashboard/competitions/marketing": {
    status: "live",
    description: "Marketing site configuration for competitions page visibility and content",
    apiRoutes: ["/api/organization/website"],
  },

  // Events Section
  "/dashboard/events": {
    status: "live",
    description: "Event management with creation, scheduling, and staff assignments",
    apiRoutes: ["/api/events"],
  },

  // Communication Section
  "/dashboard/communication/announcements": {
    status: "live",
    description: "Announcements use mock data. API ready at /api/announcements",
    apiRoutes: ["/api/announcements"],
  },
  "/dashboard/communication/chat": {
    status: "live",
    description: "SMS conversations with Twilio two-way messaging",
    apiRoutes: ["/api/sms/conversations"],
  },
  "/dashboard/communication/sms": {
    status: "live",
    description: "SMS campaigns with targeting, placeholders, and Twilio integration",
    apiRoutes: ["/api/sms/campaigns", "/api/sms/campaigns/preview", "/api/sms/campaigns/recipients"],
  },
  "/dashboard/usage/email": {
    status: "live",
    description: "Email management uses sample data",
  },
  "/dashboard/communication/notifications": {
    status: "live",
    description: "Notification rules management with templates and recipient configuration",
    apiRoutes: ["/api/notifications/rules", "/api/notifications/placeholders", "/api/notifications/preview", "/api/notifications/logs"],
  },
  "/dashboard/usage/sms": {
    status: "live",
    description: "SMS messaging with Twilio integration, usage tracking, and campaigns",
    apiRoutes: ["/api/sms", "/api/sms/sync", "/api/sms/campaigns", "/api/twilio/webhook", "/api/organization/sms-usage"],
  },

  // Organization Section
  "/dashboard/organization": {
    status: "demo",
    description: "Organization settings use sample data",
  },
  "/dashboard/organization/overview": {
    status: "live",
    description: "Organization overview with real data",
    apiRoutes: ["/api/organization/details", "/api/organization/sports", "/api/sports"],
  },
  "/dashboard/organization/app": {
    status: "demo",
    description: "App configuration uses sample data",
  },
  "/dashboard/organization/certifications": {
    status: "live",
    description: "Certification management with CRUD and member assignment",
  },
  "/dashboard/organization/facilities": {
    status: "live",
    description: "Facility management with full CRUD operations",
  },
  "/dashboard/athletes/medical": {
    status: "live",
    description: "Medical form configuration and custom questions management",
    apiRoutes: ["/api/organization/medical-config", "/api/organization/medical-questions", "/api/athletes/[id]/medical"],
  },
  "/dashboard/organization/schedules": {
    status: "live",
    description: "Schedule management uses sample data",
  },
  "/dashboard/organization/staff": {
    status: "live",
    description: "Staff management uses sample data",
  },
  "/dashboard/organization/store": {
    status: "live",
    description: "Product catalog and inventory management",
    apiRoutes: ["/api/products"],
  },
  "/dashboard/organization/website": {
    status: "live",
    description: "Website builder with CMS capabilities",
  },
  "/dashboard/organization/features": {
    status: "live",
    description: "Feature toggle management with plan defaults and superadmin overrides",
    apiRoutes: ["/api/organization/features", "/api/superadmin/organizations/[id]/features"],
  },

  // Financials Section
  "/dashboard/financials": {
    status: "demo",
    description: "Financial overview with real-time metrics",
    apiRoutes: ["/api/financials/overview"],
  },
  "/dashboard/financials/discounts": {
    status: "live",
    description: "Discount management with validation API",
    apiRoutes: ["/api/discounts"],
  },
  "/dashboard/financials/integrations": {
    status: "demo",
    description: "Integration settings preview (hidden from sidebar)",
  },
  "/dashboard/financials/invoices": {
    status: "live",
    description: "Invoice management with full CRUD",
    apiRoutes: ["/api/invoices"],
  },
  "/dashboard/financials/ledgers": {
    status: "demo",
    description: "General ledger and GL codes management",
    apiRoutes: ["/api/ledgers", "/api/ledgers/entries"],
  },
  "/dashboard/financials/onboarding": {
    status: "demo",
    description: "Payment onboarding preview",
  },
  "/dashboard/financials/payouts": {
    status: "demo",
    description: "Payout tracking and settlement history",
    apiRoutes: ["/api/payouts"],
  },
  "/dashboard/financials/recurring": {
    status: "demo",
    description: "Recurring billing management",
    apiRoutes: ["/api/recurring"],
  },
  "/dashboard/financials/transactions": {
    status: "live",
    description: "Transaction history from Adyen",
    apiRoutes: ["/api/transactions"],
  },

  // Forms Section
  "/dashboard/forms": {
    status: "demo",
    description: "Forms management uses sample data",
  },
  "/dashboard/forms/surveys": {
    status: "demo",
    description: "Survey builder uses sample data",
  },
  "/dashboard/athletes/waivers": {
    status: "live",
    description: "Waiver management with WYSIWYG builder and digital signatures",
    apiRoutes: ["/api/waivers", "/api/waivers/[id]", "/api/waivers/[id]/sign", "/api/waivers/check"],
  },

  // Usage Section
  "/dashboard/usage/billing": {
    status: "live",
    description: "Subscription billing with plan management",
    apiRoutes: ["/api/organization/subscription"],
  },

  // Bulk Upload
  "/dashboard/bulk-upload": {
    status: "demo",
    description: "Bulk upload preview",
  },

  // Feedback
  "/dashboard/feedback": {
    status: "live",
    description: "Feedback and feature requests",
    apiRoutes: ["/api/feedback"],
  },
  
  // Feedback Portal (public)
  "/feedback": {
    status: "live",
    description: "Public feedback portal for feature requests and voting",
    apiRoutes: ["/api/feedback", "/api/feedback/categories"],
  },
  
  // Superadmin Feedback Management
  "/superadmin/feedback": {
    status: "live",
    description: "Superadmin feedback management with submissions and live features",
    apiRoutes: ["/api/superadmin/feedback"],
  },

  // ========================================
  // COACH PORTAL
  // ========================================
  "/coach": {
    status: "live",
    description: "Coach portal overview",
  },
  "/coach/evaluations": {
    status: "live",
    description: "Coach evaluation management with template assignment and skill recording",
    apiRoutes: ["/api/evaluations", "/api/evaluation-templates"],
  },
  "/coach/athletes": {
    status: "live",
    description: "Coach athlete roster",
    apiRoutes: ["/api/coach/athletes"],
  },
  "/coach/programs": {
    status: "live",
    description: "Coach program assignments",
    apiRoutes: ["/api/coach/programs"],
  },

  // ========================================
  // ATHLETE PORTAL
  // ========================================
  "/athletes": {
    status: "live",
    description: "Athlete/parent portal dashboard",
    apiRoutes: ["/api/athletes"],
  },
  "/athletes/evaluations": {
    status: "live",
    description: "Athlete evaluation results and history",
    apiRoutes: ["/api/athletes/[id]/evaluations"],
  },
  "/athletes/skills": {
    status: "live",
    description: "Athlete skill progress tracking",
    apiRoutes: ["/api/athletes/[id]/skills"],
  },
}

/**
 * Get the feature status for a given pathname
 * Matches the most specific path first
 */
export function getFeatureStatus(pathname: string): FeatureConfig | null {
  // First try exact match
  if (featureStatusMap[pathname]) {
    return featureStatusMap[pathname]
  }

  // Then try matching parent paths (most specific first)
  const pathParts = pathname.split("/").filter(Boolean)
  while (pathParts.length > 0) {
    const testPath = "/" + pathParts.join("/")
    if (featureStatusMap[testPath]) {
      return featureStatusMap[testPath]
    }
    pathParts.pop()
  }

  return null
}

/**
 * Check if a path is using demo data
 */
export function isDemoFeature(pathname: string): boolean {
  const config = getFeatureStatus(pathname)
  return config?.status === "demo" || config?.status === "partial"
}

/**
 * Get all paths that have a specific status
 */
export function getPathsByStatus(status: FeatureStatus): string[] {
  return Object.entries(featureStatusMap)
    .filter(([_, config]) => config.status === status)
    .map(([path]) => path)
}
