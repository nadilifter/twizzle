"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface ProgramConfigurationProps {
  programId: string;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}

interface ProgramSettingsForm {
  name: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  capacity: number | null;
  registrationOpen: boolean;
  waitlistEnabled: boolean;
  waitlistAutoPromote: boolean;
  waitlistCapacity: number | null;
}

export function ProgramConfiguration({ programId, onClose, onUpdated }: ProgramConfigurationProps) {
  const [form, setForm] = React.useState<ProgramSettingsForm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/programs/${programId}`);
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setForm({
          name: data.name ?? "",
          status: data.status ?? "ACTIVE",
          capacity: data.capacity ?? null,
          registrationOpen: !!data.registrationOpen,
          waitlistEnabled: !!data.waitlistEnabled,
          waitlistAutoPromote: !!data.waitlistAutoPromote,
          waitlistCapacity: data.waitlistCapacity ?? null,
        });
      } catch {
        toast.error("Failed to load program settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [programId]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          status: form.status,
          capacity: form.capacity,
          registrationOpen: form.registrationOpen,
          waitlistEnabled: form.waitlistEnabled,
          waitlistAutoPromote: form.waitlistAutoPromote,
          waitlistCapacity: form.waitlistCapacity,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Failed to save");
      }
      toast.success("Program settings saved");
      await onUpdated();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="p-6 border-b">
        <SheetTitle>Program Settings</SheetTitle>
        <SheetDescription>
          Quick-edit the most common program settings. For the full editor, open the advanced page.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading || !form ? (
          <div className="space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="program-name">Name</Label>
              <Input
                id="program-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v: "ACTIVE" | "INACTIVE" | "ARCHIVED") =>
                  setForm({ ...form, status: v })
                }
              >
                <SelectTrigger id="program-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-capacity">Capacity</Label>
              <Input
                id="program-capacity"
                type="number"
                min={1}
                placeholder="Unlimited"
                value={form.capacity ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    capacity: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">Leave empty for unlimited capacity.</p>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="registration-open" className="text-sm font-medium">
                  Registration Open
                </Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, athletes can register for this program.
                </p>
              </div>
              <Switch
                id="registration-open"
                checked={form.registrationOpen}
                onCheckedChange={(v) => setForm({ ...form, registrationOpen: v })}
              />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="waitlist-enabled" className="text-sm font-medium">
                    Waitlist
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Accept athletes into a waitlist when the program is full.
                  </p>
                </div>
                <Switch
                  id="waitlist-enabled"
                  checked={form.waitlistEnabled}
                  onCheckedChange={(v) => setForm({ ...form, waitlistEnabled: v })}
                />
              </div>

              {form.waitlistEnabled && (
                <>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="waitlist-auto" className="text-sm">
                      Auto-promote from waitlist
                    </Label>
                    <Switch
                      id="waitlist-auto"
                      checked={form.waitlistAutoPromote}
                      onCheckedChange={(v) => setForm({ ...form, waitlistAutoPromote: v })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waitlist-cap">Waitlist capacity</Label>
                    <Input
                      id="waitlist-cap"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={form.waitlistCapacity ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          waitlistCapacity: e.target.value ? parseInt(e.target.value, 10) : null,
                        })
                      }
                    />
                  </div>
                </>
              )}
            </div>

            <Button variant="outline" className="w-full" asChild>
              <Link href={`/dashboard/registrations/programs/${programId}/edit`}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open full editor
              </Link>
            </Button>
          </>
        )}
      </div>

      <SheetFooter className="p-6 border-t">
        <div className="flex gap-2 w-full justify-end">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </SheetFooter>
    </div>
  );
}
