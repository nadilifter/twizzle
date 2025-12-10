import { BeamsUpstream } from "@/components/ui/beams-upstream"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-background relative overflow-hidden">
      <BeamsUpstream className="z-0" />
      <div className="absolute top-4 right-4 z-50">
        <AnimatedThemeToggler />
      </div>
      
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 text-center z-10">
        {children}
      </main>
    </div>
  )
}


