import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Home, Users, ClipboardList, Shield, CreditCard, FileText, CalendarDays } from "lucide-react"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

export default async function AthletesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    redirect("/login?callbackUrl=/athletes")
  }
  
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/80 backdrop-blur-sm border-b p-4 flex justify-between items-center sticky top-0 z-10">
         <Link href="/athletes" className="font-bold text-xl text-primary hover:opacity-80 transition-opacity">
           My Portal
         </Link>
         <div className="flex gap-4 items-center">
            <span className="text-sm text-muted-foreground hidden md:inline-block">{session.user.name}</span>
            <AnimatedThemeToggler />
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                {session.user.name?.[0]}
            </div>
         </div>
      </header>

      {/* Desktop sidebar navigation */}
      <div className="flex">
        <aside className="hidden md:flex flex-col w-56 border-r min-h-[calc(100vh-57px)] p-4 gap-1">
          <Link href="/athletes" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Home className="h-4 w-4" />
            My Athletes
          </Link>
          <Link href="/athletes/registrations" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <ClipboardList className="h-4 w-4" />
            Registrations
          </Link>
          <Link href="/athletes/guardian-requests" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Shield className="h-4 w-4" />
            Guardian Requests
          </Link>

          <div className="border-t my-3" />
          <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Coming Soon</p>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed">
            <CreditCard className="h-4 w-4" />
            Invoices
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed">
            <FileText className="h-4 w-4" />
            Waivers
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 cursor-not-allowed">
            <CalendarDays className="h-4 w-4" />
            Schedules
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-6 max-w-5xl pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t p-2 flex justify-around md:hidden">
        <Link href="/athletes" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <Home className="h-5 w-5" />
          <span>Athletes</span>
        </Link>
        <Link href="/athletes/registrations" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <ClipboardList className="h-5 w-5" />
          <span>Registrations</span>
        </Link>
        <Link href="/athletes/guardian-requests" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <Shield className="h-5 w-5" />
          <span>Requests</span>
        </Link>
      </nav>
    </div>
  )
}
