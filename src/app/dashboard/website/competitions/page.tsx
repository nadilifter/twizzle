"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, Globe, Trophy, Type, FileText } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"

export default function CompetitionsMarketingPage() {
  const [config, setConfig] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/organization/website")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error("Website config error:", data.error)
          setConfig({})
          setLoading(false)
          return
        }
        setConfig(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        toast.error("Failed to load website configuration")
        setLoading(false)
      })
  }, [])

  const updateConfig = (key: string, value: any) => {
    setConfig((prev: any) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/organization/website", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showCompetitions: config.showCompetitions,
          competitionsHeading: config.competitionsHeading,
          competitionsDescription: config.competitionsDescription,
          competitionsCtaText: config.competitionsCtaText,
        }),
      })
      if (!res.ok) throw new Error("Failed to save")
      const data = await res.json()
      setConfig(data)
      toast.success("Marketing site settings saved")
    } catch (error) {
      toast.error("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competitions - Marketing Site</h1>
          <p className="text-muted-foreground">
            Configure how competitions appear on your public marketing site.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>

      {/* Visibility Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>Page Visibility</CardTitle>
          </div>
          <CardDescription>
            Control whether the Competitions page is visible on your marketing site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Show Competitions Page</Label>
              <p className="text-sm text-muted-foreground">
                Display the competitions page and navigation link on your public site.
              </p>
            </div>
            <Switch
              checked={config.showCompetitions ?? false}
              onCheckedChange={(c) => updateConfig("showCompetitions", c)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Text Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Type className="h-5 w-5 text-primary" />
            <CardTitle>Content Settings</CardTitle>
          </div>
          <CardDescription>
            Customize the text displayed on the competitions page of your marketing site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="competitionsHeading">Section Heading</Label>
            <Input
              id="competitionsHeading"
              placeholder="Competitions"
              value={config.competitionsHeading || ""}
              onChange={(e) => updateConfig("competitionsHeading", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The main heading displayed at the top of the competitions page. Defaults to &quot;Competitions&quot;.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="competitionsDescription">Section Description</Label>
            <Textarea
              id="competitionsDescription"
              placeholder="Browse our upcoming competitions and register today."
              value={config.competitionsDescription || ""}
              onChange={(e) => updateConfig("competitionsDescription", e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              A brief description displayed below the heading on the competitions page.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="competitionsCtaText">CTA Button Text</Label>
            <Input
              id="competitionsCtaText"
              placeholder="Register Now"
              value={config.competitionsCtaText || ""}
              onChange={(e) => updateConfig("competitionsCtaText", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The text displayed on the registration button for each competition card. Defaults to &quot;Register Now&quot;.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
