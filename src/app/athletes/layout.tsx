import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Home, Heart, ClipboardCheck, CalendarDays, Star } from "lucide-react"

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b p-4 flex justify-between items-center sticky top-0 z-10">
         <span className="font-bold text-xl text-primary">My Portal</span>
         <div className="flex gap-4 items-center">
            <span className="text-sm text-muted-foreground hidden md:inline-block">The Smith Family</span>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                {session.user.name?.[0]}
            </div>
         </div>
      </header>
      <main className="p-4 max-w-4xl mx-auto pb-20">
        {children}
      </main>
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t p-2 flex justify-around md:hidden">
        <Link href="/athletes" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <Home className="h-5 w-5" />
          <span>Home</span>
        </Link>
        <Link href="/athletes/evaluations" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <ClipboardCheck className="h-5 w-5" />
          <span>Evaluations</span>
        </Link>
        <Link href="/athletes/skills" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <Star className="h-5 w-5" />
          <span>Skills</span>
        </Link>
        <Link href="/athletes/attendance" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <CalendarDays className="h-5 w-5" />
          <span>Attendance</span>
        </Link>
        <Link href="/athletes/medical" className="flex flex-col items-center gap-1 text-xs p-2 text-muted-foreground hover:text-primary">
          <Heart className="h-5 w-5" />
          <span>Medical</span>
        </Link>
      </nav>
    </div>
  )
}
