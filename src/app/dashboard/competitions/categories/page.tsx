"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DemoDataBanner } from "@/components/demo-data-banner"
import { Tag, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface OrgSport {
  id: string
  name: string
  slug: string
}

export default function CategoriesPage() {
  const [orgSports, setOrgSports] = useState<OrgSport[]>([])

  useEffect(() => {
    async function loadOrgSports() {
      try {
        const response = await fetch("/api/organization/sports")
        if (response.ok) {
          setOrgSports(await response.json())
        }
      } catch (error) {
        console.error("Error fetching org sports:", error)
      }
    }
    loadOrgSports()
  }, [])

  return (
    <div className="flex flex-col gap-6 p-6">
      <DemoDataBanner />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Configure competition categories for your organization.
          </p>
          {orgSports.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-muted-foreground">Sports:</span>
              {orgSports.map((sport) => (
                <Badge key={sport.id} variant="secondary" className="text-xs">
                  {sport.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Competition Categories
          </CardTitle>
          <CardDescription>
            Define the categories that athletes can register under for competitions.
            {orgSports.length > 0 && (
              <> Categories will be tailored to your selected sports.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Tag className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-medium text-muted-foreground mb-1">Categories Coming Soon</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This page will allow you to define and manage competition categories such as age groups,
              skill levels, weight classes, and event types. Categories defined here will be available
              when creating competitions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
