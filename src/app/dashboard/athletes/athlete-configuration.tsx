"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { useGuardians } from "@/hooks/use-guardians";
import { useLevels } from "@/hooks/use-levels";
import type { AthleteStatus, UpdateAthletePayload } from "@/types/athletes";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { athleteDisplayName } from "@/lib/athlete-name";

interface AthleteData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  level: string;
  status: AthleteStatus;
  birthDate: string | null;
  gender: string | null;
  guardian?: { id: string; name: string | null; email: string } | null;
  federationName?: string | null;
  federationMemberNumber?: string | null;
  federationMemberExpiresAt?: string | null;
}

const FEDERATION_OPTIONS: { value: string; label: string }[] = [
  { value: "SKATE_CANADA", label: "Skate Canada" },
  { value: "USFS", label: "U.S. Figure Skating" },
  { value: "ISU", label: "ISU" },
];

const FEDERATION_NONE = "__none__";

interface AthleteConfigurationProps {
  athlete: AthleteData;
  onClose: () => void;
  onUpdated?: (data: UpdateAthletePayload) => Promise<unknown>;
}

const STATUS_OPTIONS: { value: AthleteStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "TRIAL", label: "Trial" },
  { value: "GRADUATED", label: "Graduated" },
];

export function AthleteConfiguration({ athlete, onClose, onUpdated }: AthleteConfigurationProps) {
  const { guardians, isLoading: loadingGuardians } = useGuardians();
  const { levels: configuredLevels, isLoading: loadingLevels } = useLevels();

  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState(() => ({
    firstName: athlete.firstName || "",
    lastName: athlete.lastName || "",
    email: athlete.email || "",
    level: athlete.level || "",
    status: athlete.status || ("ACTIVE" as AthleteStatus),
    birthDate: athlete.birthDate ? new Date(athlete.birthDate).toISOString().split("T")[0] : "",
    guardianUserId: athlete.guardian?.id || "",
    federationName: athlete.federationName || "",
    federationMemberNumber: athlete.federationMemberNumber || "",
    federationMemberExpiresAt: athlete.federationMemberExpiresAt
      ? new Date(athlete.federationMemberExpiresAt).toISOString().split("T")[0]
      : "",
  }));

  const levelColor = useMemo(() => {
    return configuredLevels.find((l) => l.name === formData.level)?.color ?? null;
  }, [configuredLevels, formData.level]);

  const handleSave = async () => {
    if (!formData.firstName.trim()) {
      toast.error("Athlete first name is required");
      return;
    }
    if (!formData.level) {
      toast.error("Level is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload: UpdateAthletePayload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim() || null,
        level: formData.level,
        status: formData.status,
        birthDate: formData.birthDate || null,
        guardianUserId: formData.guardianUserId || undefined,
        federationName: formData.federationName || null,
        federationMemberNumber: formData.federationMemberNumber.trim() || null,
        federationMemberExpiresAt: formData.federationMemberExpiresAt || null,
      };

      if (onUpdated) {
        await onUpdated(payload);
      }

      toast.success("Athlete updated successfully");
      onClose();
    } catch {
      toast.error("Failed to update athlete");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-6 pb-2 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {athleteDisplayName(athlete) || "Edit Athlete"}
            </h2>
            <p className="text-sm text-muted-foreground">Update athlete profile and details.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-2xl">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="config-first-name">First Name *</Label>
              <Input
                id="config-first-name"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-last-name">Last Name</Label>
              <Input
                id="config-last-name"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
              />
            </div>
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
              <Label>Date of Birth</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.birthDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.birthDate
                      ? format(new Date(formData.birthDate + "T12:00:00Z"), "PPP")
                      : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      formData.birthDate ? new Date(formData.birthDate + "T12:00:00Z") : undefined
                    }
                    onSelect={(date) =>
                      setFormData((prev) => ({
                        ...prev,
                        birthDate: date ? format(date, "yyyy-MM-dd") : "",
                      }))
                    }
                    captionLayout="dropdown"
                    fromYear={1940}
                    toYear={new Date().getFullYear()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="config-status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, status: value as AthleteStatus }))
                }
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
                style={{
                  borderColor: levelColor,
                  color: levelColor,
                  backgroundColor: `${levelColor}15`,
                }}
              >
                {formData.level}
              </Badge>
            )}
          </div>

          {/* Guardian User */}
          <div className="space-y-2">
            <Label htmlFor="config-guardian">Guardian</Label>
            <Select
              value={formData.guardianUserId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, guardianUserId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingGuardians ? "Loading..." : "Select guardian"} />
              </SelectTrigger>
              <SelectContent>
                {guardians.map((guardian) => (
                  <SelectItem key={guardian.id} value={guardian.id}>
                    {guardian.name ?? guardian.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Federation Membership */}
          <div className="space-y-4 pt-2 border-t">
            <div className="space-y-1">
              <h3 className="text-sm font-medium">Federation Membership</h3>
              <p className="text-xs text-muted-foreground">
                Skate Canada / U.S. Figure Skating membership tracking. Required for competition
                eligibility and insurance.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="config-federation-name">Federation</Label>
                <Select
                  value={formData.federationName || FEDERATION_NONE}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      federationName: value === FEDERATION_NONE ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger id="config-federation-name">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FEDERATION_NONE}>None</SelectItem>
                    {FEDERATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-federation-number">Member Number</Label>
                <Input
                  id="config-federation-number"
                  value={formData.federationMemberNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      federationMemberNumber: e.target.value,
                    }))
                  }
                  placeholder="e.g. 12345678"
                  disabled={!formData.federationName}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Membership Expires</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.federationMemberExpiresAt && "text-muted-foreground"
                    )}
                    disabled={!formData.federationName}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.federationMemberExpiresAt
                      ? format(new Date(formData.federationMemberExpiresAt + "T12:00:00Z"), "PPP")
                      : "No expiry set"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={
                      formData.federationMemberExpiresAt
                        ? new Date(formData.federationMemberExpiresAt + "T12:00:00Z")
                        : undefined
                    }
                    onSelect={(date) =>
                      setFormData((prev) => ({
                        ...prev,
                        federationMemberExpiresAt: date ? format(date, "yyyy-MM-dd") : "",
                      }))
                    }
                    captionLayout="dropdown"
                    fromYear={new Date().getFullYear() - 2}
                    toYear={new Date().getFullYear() + 5}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
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
  );
}
