"use client"

import { usePathname } from "next/navigation"
import { Fragment } from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useBreadcrumbOverrides } from "@/components/breadcrumb-context"

const sectionOnlyPaths = new Set([
  "/dashboard/communication",
  "/dashboard/usage",
  "/dashboard/organization",
])

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function DynamicBreadcrumb() {
  const pathname = usePathname()
  const { overrides } = useBreadcrumbOverrides()
  
  const segments = pathname.split("/").filter((segment) => segment !== "")
  
  if (segments.length === 0) {
    return null
  }

  const breadcrumbItems = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`
    
    const title = overrides[href]
      ?? segment.split("-").map((word) => capitalize(word)).join(" ")

    const isLast = index === segments.length - 1

    return {
      href,
      title,
      isLast,
    }
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Always start with Uplifter or Dashboard? 
            If the first segment is 'dashboard', we can treat it as the root or show Home before it.
            Let's assume 'Uplifter' is the home/root context, but if we are in /dashboard, 
            usually Dashboard is the first visible crumb or after Home.
            Let's mimic the previous hardcoded one: Uplifter > Dashboard > ...
        */}
        
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href="/">Uplifter</BreadcrumbLink>
        </BreadcrumbItem>
        
        {breadcrumbItems.length > 0 && <BreadcrumbSeparator className="hidden md:block" />}

        {breadcrumbItems.map((item, index) => (
          <Fragment key={item.href}>
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage>{item.title}</BreadcrumbPage>
              ) : sectionOnlyPaths.has(item.href) ? (
                <span className="font-normal text-muted-foreground">{item.title}</span>
              ) : (
                <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!item.isLast && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}


