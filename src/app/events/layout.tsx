import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { CalendarCheck, ScanLine, Search, LayoutDashboard } from "lucide-react"

export default async function EventsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAuthSession()
  
  if (!session) {
    redirect("/login?callbackUrl=/events")
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
      <header className="bg-white dark:bg-slate-800 border-b p-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/events" className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-primary">Events Portal</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          <Link 
            href="/events" 
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            Schedule
          </Link>
          <Link 
            href="/events/scan" 
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ScanLine className="h-4 w-4" />
            Scan QR
          </Link>
          <Link 
            href="/events/search" 
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden md:inline-block">
            {session.user.organizationName || session.user.name}
          </span>
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            {session.user.name?.[0]?.toUpperCase() || "U"}
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation */}
      <nav className="md:hidden bg-white dark:bg-slate-800 border-b px-2 py-2 flex justify-around">
        <Link 
          href="/events" 
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <LayoutDashboard className="h-5 w-5" />
          Schedule
        </Link>
        <Link 
          href="/events/scan" 
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ScanLine className="h-5 w-5" />
          Scan
        </Link>
        <Link 
          href="/events/search" 
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Search className="h-5 w-5" />
          Search
        </Link>
      </nav>
      
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
