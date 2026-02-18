"use client"

import * as React from "react"
import { ExternalLink, LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  isLoading,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    external?: boolean
  }[]
  isLoading?: boolean
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <SidebarMenuItem key={i}>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            ))
          ) : (
            items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <a 
                    href={item.url}
                    {...(item.external && { target: "_blank", rel: "noopener noreferrer" })}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                    {item.external && <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
