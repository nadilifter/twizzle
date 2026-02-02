import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { UplifterLogo } from "@/components/uplifter-logo"

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
