"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Trash2, Clock, Users, Calendar, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { QueueConfig } from "@/hooks/use-queue-config";

interface QueueConfigurationProps {
  config: QueueConfig;
  onClose: () => void;
  onUpdate: (config: QueueConfig) => void;
  onDelete: () => void;
}

export function QueueConfiguration({
  config,
  onClose,
  onUpdate,
  onDelete,
}: QueueConfigurationProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    isEnabled: config.isEnabled,
    reservationMinutes: config.reservationMinutes,
    maxConcurrent: config.maxConcurrent,
    activationType: config.activationType,
    activationThreshold: config.activationThreshold ?? 100,
    scheduledStart: config.scheduledStart
      ? new Date(config.scheduledStart).toISOString().slice(0, 16)
      : "",
    scheduledEnd: config.scheduledEnd
      ? new Date(config.scheduledEnd).toISOString().slice(0, 16)
      : "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        isEnabled: formData.isEnabled,
        reservationMinutes: formData.reservationMinutes,
        maxConcurrent: formData.maxConcurrent,
        activationType: formData.activationType,
      };

      if (formData.activationType === "THRESHOLD") {
        payload.activationThreshold = formData.activationThreshold;
      } else if (formData.activationType === "SCHEDULED") {
        payload.scheduledStart = formData.scheduledStart
          ? new Date(formData.scheduledStart).toISOString()
          : null;
        payload.scheduledEnd = formData.scheduledEnd
          ? new Date(formData.scheduledEnd).toISOString()
          : null;
      }

      const response = await fetch(`/api/registrations/queues/${config.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update");
      }

      const updated = await response.json();
      onUpdate(updated);
      toast.success("Queue configuration saved");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="pb-4 border-b">
        <h2 className="text-xl font-semibold">
          {config.program ? config.program.name : "Global Queue"} Configuration
        </h2>
        <p className="text-sm text-muted-foreground">
          {config.program
            ? `Configure queue settings for ${config.program.name}`
            : "Configure organization-wide queue settings"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-6 space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Queue Status</Label>
            <p className="text-sm text-muted-foreground">
              {formData.isEnabled
                ? "Queue is active and will meter registration access"
                : "Queue is disabled, users can access registration directly"}
            </p>
          </div>
          <Switch
            checked={formData.isEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, isEnabled: checked })}
          />
        </div>

        <Separator />

        {/* Reservation Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <h3 className="font-medium text-foreground">Reservation Settings</h3>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="reservationMinutes">Reservation Time (minutes)</Label>
              <Input
                id="reservationMinutes"
                type="number"
                min={1}
                max={60}
                value={formData.reservationMinutes}
                onChange={(e) =>
                  setFormData({ ...formData, reservationMinutes: parseInt(e.target.value) || 10 })
                }
              />
              <p className="text-xs text-muted-foreground">
                How long a user has to complete their registration after being admitted from the
                queue.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Concurrency Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <h3 className="font-medium text-foreground">Concurrency Settings</h3>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="maxConcurrent">Maximum Concurrent Users</Label>
              <Input
                id="maxConcurrent"
                type="number"
                min={1}
                max={1000}
                value={formData.maxConcurrent}
                onChange={(e) =>
                  setFormData({ ...formData, maxConcurrent: parseInt(e.target.value) || 50 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of users that can be in the registration flow at the same time.
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Activation Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <h3 className="font-medium text-foreground">Activation Mode</h3>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="activationType">When should the queue activate?</Label>
              <Select
                value={formData.activationType}
                onValueChange={(value) =>
                  setFormData({ ...formData, activationType: value as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALWAYS">Always Active</SelectItem>
                  <SelectItem value="THRESHOLD">When Threshold Exceeded</SelectItem>
                  <SelectItem value="SCHEDULED">During Scheduled Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.activationType === "THRESHOLD" && (
              <div className="grid gap-2">
                <Label htmlFor="activationThreshold">Activation Threshold</Label>
                <Input
                  id="activationThreshold"
                  type="number"
                  min={1}
                  value={formData.activationThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      activationThreshold: parseInt(e.target.value) || 100,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Queue activates when this many users are trying to register simultaneously.
                </p>
              </div>
            )}

            {formData.activationType === "SCHEDULED" && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="scheduledStart">Start Time</Label>
                  <Input
                    id="scheduledStart"
                    type="datetime-local"
                    value={formData.scheduledStart}
                    onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scheduledEnd">End Time</Label>
                  <Input
                    id="scheduledEnd"
                    type="datetime-local"
                    value={formData.scheduledEnd}
                    onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Queue will only be active during this time window.
                </p>
              </div>
            )}
          </div>
        </div>

        {formData.isEnabled && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <CardTitle className="text-base text-amber-800 dark:text-amber-200">
                  Queue Active
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                When enabled, users will be placed in a virtual waiting room before accessing
                registration. They will see their position in line and estimated wait time.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="pt-4 border-t flex justify-between">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
