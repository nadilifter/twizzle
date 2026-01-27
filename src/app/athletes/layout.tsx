import { getAuthSession } from "@/lib/auth"
import { redirect } from "next/navigation"

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
    </div>
  )
}
