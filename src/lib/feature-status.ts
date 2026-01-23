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
  "/dashboard/settings/users": {
    status: "live",
    description: "User management with RBAC",
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
    status: "demo",
    description: "Dashboard overview uses sample metrics",
  },
  "/dashboard/analytics": {
    status: "demo",
    description: "Analytics charts use sample data",
  },

  // Athletes Section
  "/dashboard/athletes": {
    status: "demo",
    description: "Athletes directory uses mock data. API ready at /api/athletes",
    apiRoutes: ["/api/athletes"],
  },
  "/dashboard/athletes/attendance": {
    status: "demo",
    description: "Attendance tracking uses mock data",
    apiRoutes: ["/api/attendance"],
  },
  "/dashboard/athletes/families": {
    status: "demo",
    description: "Families directory uses mock data. API ready at /api/families",
    apiRoutes: ["/api/families"],
  },
  "/dashboard/athletes/memberships": {
    status: "demo",
    description: "Membership management uses mock data",
    apiRoutes: ["/api/enrollments"],
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
    status: "demo",
    description: "Programs list uses mock data. API ready at /api/programs",
    apiRoutes: ["/api/programs"],
  },
  "/dashboard/training/rotations": {
    status: "demo",
    description: "Rotation scheduling uses mock data",
  },
  "/dashboard/training/skills": {
    status: "demo",
    description: "Skills database uses mock data. API ready at /api/skills",
    apiRoutes: ["/api/skills"],
  },

  // Events Section
  "/dashboard/events": {
    status: "demo",
    description: "Events and calendar use mock data. API ready at /api/events",
    apiRoutes: ["/api/events"],
  },

  // Communication Section
  "/dashboard/communication/announcements": {
    status: "demo",
    description: "Announcements use mock data. API ready at /api/announcements",
    apiRoutes: ["/api/announcements"],
  },
  "/dashboard/communication/chat": {
    status: "demo",
    description: "Chat feature uses sample conversations",
  },
  "/dashboard/communication/email": {
    status: "demo",
    description: "Email management uses sample data",
  },
  "/dashboard/communication/notifications": {
    status: "demo",
    description: "Notifications use sample data",
  },
  "/dashboard/communication/sms": {
    status: "demo",
    description: "SMS management uses sample data",
  },

  // Organization Section
  "/dashboard/organization": {
    status: "demo",
    description: "Organization settings use sample data",
  },
  "/dashboard/organization/app": {
    status: "demo",
    description: "App configuration uses sample data",
  },
  "/dashboard/organization/facility": {
    status: "demo",
    description: "Facility management uses sample data",
  },
  "/dashboard/organization/schedules": {
    status: "demo",
    description: "Schedule management uses sample data",
  },
  "/dashboard/organization/staff": {
    status: "demo",
    description: "Staff management uses sample data",
  },
  "/dashboard/organization/website": {
    status: "demo",
    description: "Website builder uses sample content",
  },

  // Financials Section
  "/dashboard/financials": {
    status: "demo",
    description: "Financial overview uses sample metrics",
  },
  "/dashboard/financials/discounts": {
    status: "demo",
    description: "Discount management uses sample data",
  },
  "/dashboard/financials/integrations": {
    status: "demo",
    description: "Integration settings preview",
  },
  "/dashboard/financials/invoices": {
    status: "demo",
    description: "Invoices use mock data. API ready at /api/invoices",
    apiRoutes: ["/api/invoices"],
  },
  "/dashboard/financials/ledgers": {
    status: "demo",
    description: "Ledger and GL codes use sample data",
  },
  "/dashboard/financials/onboarding": {
    status: "demo",
    description: "Payment onboarding preview",
  },
  "/dashboard/financials/payouts": {
    status: "demo",
    description: "Payouts use sample data",
  },
  "/dashboard/financials/pos": {
    status: "demo",
    description: "Point of sale uses sample data",
  },
  "/dashboard/financials/recurring": {
    status: "demo",
    description: "Recurring billing uses sample data",
  },
  "/dashboard/financials/transactions": {
    status: "demo",
    description: "Transactions use mock data. API ready at /api/payments",
    apiRoutes: ["/api/payments"],
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
  "/dashboard/forms/waivers": {
    status: "demo",
    description: "Waiver management uses sample data",
  },

  // Campaigns Section
  "/campaigns": {
    status: "demo",
    description: "Campaigns overview uses sample data",
  },
  "/campaigns/advertising": {
    status: "demo",
    description: "Advertising campaigns use sample data",
  },
  "/campaigns/donation": {
    status: "demo",
    description: "Donation campaigns use sample data",
  },
  "/campaigns/merchandise": {
    status: "demo",
    description: "Merchandise store uses sample data",
  },
  "/campaigns/sponsorship": {
    status: "demo",
    description: "Sponsorship management uses sample data",
  },

  // Settings Section
  "/dashboard/settings": {
    status: "demo",
    description: "General settings use sample data",
  },
  "/dashboard/settings/billing": {
    status: "demo",
    description: "Billing settings preview",
  },

  // Bulk Upload
  "/dashboard/bulk-upload": {
    status: "demo",
    description: "Bulk upload preview",
  },

  // Feedback
  "/dashboard/feedback": {
    status: "demo",
    description: "Feedback and feature requests",
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
