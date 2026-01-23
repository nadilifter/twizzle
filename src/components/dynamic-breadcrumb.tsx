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

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function DynamicBreadcrumb() {
  const pathname = usePathname()
  
  // Split pathname and filter out empty strings
  const segments = pathname.split("/").filter((segment) => segment !== "")
  
  // If we are on the home page, we might not want breadcrumbs or just Home
  if (segments.length === 0) {
    return null
  }

  // Generate breadcrumb items
  const breadcrumbItems = segments.map((segment, index) => {
    // Build the URL for this breadcrumb
    const href = `/${segments.slice(0, index + 1).join("/")}`
    
    // Format the title: capitalize and replace hyphens with spaces
    const title = segment
      .split("-")
      .map((word) => capitalize(word))
      .join(" ")

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






