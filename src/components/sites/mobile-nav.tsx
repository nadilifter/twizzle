"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

interface NavLink {
  href: string
  label: string
}

interface MobileNavProps {
  links: NavLink[]
  loginUrl: string
  isAuthenticated: boolean
}

export function MobileNav({ links, loginUrl, isAuthenticated }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="border-b border-border/40 px-6 py-4">
            <SheetTitle className="text-left">Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col px-4 py-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          {!isAuthenticated && (
            <div className="mt-auto border-t border-border/40 px-6 py-4 flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/signup">Sign Up</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href={loginUrl}>Login</Link>
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
