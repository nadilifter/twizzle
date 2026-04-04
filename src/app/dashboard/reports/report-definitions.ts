import {
  DollarSign,
  UserPlus,
  TrendingDown,
  CalendarCheck,
  BarChart3,
  FileText,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface ReportDefinition {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    slug: "revenue",
    title: "Revenue Summary",
    description:
      "Monthly revenue breakdown by source including programs, store, memberships, and events.",
    icon: DollarSign,
  },
  {
    slug: "enrollment",
    title: "Enrollment Summary",
    description:
      "New and cancelled enrollments over time with net growth trends and per-program breakdowns.",
    icon: UserPlus,
  },
  {
    slug: "retention",
    title: "Retention & Churn",
    description:
      "Member retention rates, churn analysis, and cohort retention curves over configurable periods.",
    icon: TrendingDown,
  },
  {
    slug: "attendance",
    title: "Attendance",
    description:
      "Attendance rates by program, trends over time, and no-show tracking across sessions.",
    icon: CalendarCheck,
  },
  {
    slug: "program-performance",
    title: "Program Performance",
    description:
      "Revenue and utilization per program with capacity analysis and comparison metrics.",
    icon: BarChart3,
  },
  {
    slug: "accounts-receivable",
    title: "Accounts Receivable",
    description:
      "Outstanding invoices with aging buckets (30/60/90 days) and collection rate tracking.",
    icon: FileText,
  },
  {
    slug: "tax-collection",
    title: "Tax Collection",
    description:
      "Tax amounts collected by type and jurisdiction for compliance and reconciliation.",
    icon: Receipt,
  },
  {
    slug: "membership-growth",
    title: "Membership Growth",
    description: "Active memberships over time, growth rate trends, and membership type breakdown.",
    icon: Users,
  },
];

export const REPORT_BY_SLUG = Object.fromEntries(
  REPORT_DEFINITIONS.map((r) => [r.slug, r])
) as Record<string, ReportDefinition>;

export const COMING_SOON_BADGE_CLASS =
  "text-[10px] font-medium text-amber-600 bg-amber-50 border-amber-200";
