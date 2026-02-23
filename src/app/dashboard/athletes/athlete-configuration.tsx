"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { useFamilies } from "@/hooks/use-families"
import { useLevels } from "@/hooks/use-levels"
import type { AthleteStatus, UpdateAthletePayload } from "@/types/athletes"

interface AthleteData {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string | null
  level: string
  status: AthleteStatus
  birthDate: string | null
  gender: string | null
  family?: { id: string; name: string } | null
}

interface AthleteConfigurationProps {
  athlete: AthleteData
  onClose: () => void
  onUpdated?: (data: UpdateAthletePayload) => Promise<unknown>
}

const STATUS_OPTIONS: { value: AthleteStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "TRIAL", label: "Trial" },
  { value: "GRADUATED", label: "Graduated" },
]

export function AthleteConfiguration({ athlete, onClose, onUpdated }: AthleteConfigurationProps) {
  const { families, isLoading: loadingFamilies } = useFamilies()
  const { levels: configuredLevels, isLoading: loadingLevels } = useLevels()

  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState(() => ({
    name: athlete.name || "",
    email: athlete.email || "",
    level: athlete.level || "",
    status: athlete.status || ("ACTIVE" as AthleteStatus),
    birthDate: athlete.birthDate
      ? new Date(athlete.birthDate).toISOString().split("T")[0]
      : "",
    familyId: athlete.family?.id || "",
  }))

  const levelColor = useMemo(() => {
    return configuredLevels.find((l) => l.name === formData.level)?.color ?? null
  }, [configuredLevels, formData.level])

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Athlete name is required")
      return
    }
    if (!formData.level) {
      toast.error("Level is required")
      return
    }

    setIsSaving(true)
    try {
      const payload: UpdateAthletePayload = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        level: formData.level,
        status: formData.status,
        birthDate: formData.birthDate || null,
        familyId: formData.familyId || undefined,
      }

      if (onUpdated) {
        await onUpdated(payload)
      }

      toast.success("Athlete updated successfully")
      onClose()
    } catch {
      toast.error("Failed to update athlete")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-2 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{athlete.name || "Edit Athlete"}</h2>
            <p className="text-sm text-muted-foreground">Update athlete profile and details.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-2xl">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="config-name">Name *</Label>
            <Input
              id="config-name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Athlete name"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="config-email">Email</Label>
            <Input
              id="config-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="athlete@example.com"
            />
          </div>

          {/* Date of Birth & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="config-dob">Date of Birth</Label>
              <Input
                id="config-dob"
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, birthDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value as AthleteStatus }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Level */}
          <div className="space-y-2">
            <Label htmlFor="config-level">Level *</Label>
            <Select
              value={formData.level}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, level: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingLevels ? "Loading..." : "Select level"} />
              </SelectTrigger>
              <SelectContent>
                {configuredLevels.map((level) => (
                  <SelectItem key={level.id} value={level.name}>
                    <span className="flex items-center gap-2">
                      {level.color && (
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: level.color }}
                        />
                      )}
                      {level.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {levelColor && (
              <Badge
                variant="outline"
                className="mt-1"
                style={{ borderColor: levelColor, color: levelColor, backgroundColor: `${levelColor}15` }}
              >
                {formData.level}
              </Badge>
            )}
          </div>

          {/* Family / Guardian */}
          <div className="space-y-2">
            <Label htmlFor="config-family">Guardian Family (Legacy)</Label>
            <Select
              value={formData.familyId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, familyId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingFamilies ? "Loading..." : "Select family"} />
              </SelectTrigger>
              <SelectContent>
                {families.map((family) => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Save */}
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
