import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { SiteHeaderActions } from "@/components/site-header-actions"

export function SiteHeader() {
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <DynamicBreadcrumb />
        <div className="ml-auto flex items-center gap-2">
          <SiteHeaderActions />
          <AnimatedThemeToggler />
        </div>
      </div>
    </header>
  )
}
