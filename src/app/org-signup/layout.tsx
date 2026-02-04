import { GradientBackground } from "@/components/ui/gradient-background"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { UplifterLogo } from "@/components/uplifter-logo"
import Link from "next/link"
import { getLoginUrl } from "@/lib/env-domains"

export const metadata = {
  title: "Sign Up - Uplifter",
  description: "Create your organization on Uplifter - The complete platform for sports clubs and organizations",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function SignupsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const loginUrl = getLoginUrl()  // Uses environment-aware domain config
  
  return (
    <div className="flex flex-col min-h-screen bg-background relative overflow-hidden">
      <GradientBackground className="z-0" />
      
      {/* Header */}
      <header className="relative z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <UplifterLogo width={90} height={24} className="h-6" />
          </Link>
          <div className="flex items-center gap-4">
            <Link 
              href={loginUrl} 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Already have an account? Sign in
            </Link>
            <AnimatedThemeToggler />
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 py-8 z-10">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Uplifter Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
