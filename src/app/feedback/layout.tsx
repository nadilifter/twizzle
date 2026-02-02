import { Metadata } from "next"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { UplifterLogo } from "@/components/uplifter-logo"

export const metadata: Metadata = {
  title: "Product Feedback & Roadmap | Uplifter",
  description: "See what features are in development, vote on your favorites, and suggest new features for the Uplifter platform. Shape the future of sports club management software.",
  keywords: ["product roadmap", "feature requests", "feedback", "uplifter", "sports management", "club software"],
  openGraph: {
    title: "Product Feedback & Roadmap | Uplifter",
    description: "See what features are in development, vote on your favorites, and suggest new features for the Uplifter platform.",
    type: "website",
    siteName: "Uplifter",
  },
  twitter: {
    card: "summary_large_image",
    title: "Product Feedback & Roadmap | Uplifter",
    description: "See what features are in development, vote on your favorites, and suggest new features for the Uplifter platform.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <UplifterLogo width={90} height={24} className="h-6" />
          <AnimatedThemeToggler />
        </div>
      </header>
      <main className="container mx-auto max-w-5xl p-4">
        {children}
      </main>
    </div>
  )
}
