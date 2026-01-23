"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"

export function WaiverBuilder() {
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [requireInitials, setRequireInitials] = React.useState(false)

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="waiver-title" className="text-lg font-semibold">
            Waiver Title
          </Label>
          <Input
            id="waiver-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., General Liability Waiver"
            className="text-lg"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="waiver-content" className="text-lg font-semibold">
              Waiver Text
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Enter the full legal text of the waiver below.
            </p>
            <Textarea
              id="waiver-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="I, the undersigned, hereby release..."
              className="min-h-[400px] font-mono text-sm"
            />
          </div>
          
          <Separator className="my-4" />
          
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2">
                <Switch
                    id="require-initials"
                    checked={requireInitials}
                    onCheckedChange={setRequireInitials}
                />
                <Label htmlFor="require-initials">Require initials on each page/section (Future Feature)</Label>
             </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
        <Button onClick={() => alert("Waiver saved! (Mock action)")}>
          Save Waiver
        </Button>
      </div>
    </div>
  )
}












