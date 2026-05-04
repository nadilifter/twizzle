"use client";

import { useState } from "react";
import { Loader2, User, Calendar, AlertCircle, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { athleteDisplayName } from "@/lib/athlete-name";

interface AddAthleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAthleteCreated: () => void;
  hasSelfAthlete: boolean;
}

export function AddAthleteDialog({
  open,
  onOpenChange,
  onAthleteCreated,
  hasSelfAthlete,
}: AddAthleteDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [newAthlete, setNewAthlete] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    gender: "",
    isSelf: false,
    allowGuardianClaims: false,
  });

  const handleCreateAthlete = async () => {
    if (!newAthlete.firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!newAthlete.lastName.trim()) {
      toast.error("Last name is required");
      return;
    }
    if (!newAthlete.birthDate) {
      toast.error("Date of birth is required");
      return;
    }
    if (!newAthlete.gender) {
      toast.error("Gender declaration is required");
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/athletes/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAthlete),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setErrorMessage(data.error);
          return;
        }
        throw new Error(data.error || "Failed to create athlete");
      }

      const created = data.athlete;
      const displayName = athleteDisplayName(created);
      toast.success(`${displayName} added successfully`);
      onAthleteCreated();
      handleClose();
    } catch (error: any) {
      console.error("Error creating athlete:", error);
      toast.error(error.message || "Failed to create athlete");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setErrorMessage(null);
    setNewAthlete({
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "",
      isSelf: false,
      allowGuardianClaims: false,
    });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) handleClose();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Athlete</DialogTitle>
          <DialogDescription>
            Enter the details of the athlete you&apos;d like to add to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 rounded-lg">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!hasSelfAthlete && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="is-self" className="text-sm font-medium cursor-pointer">
                    This athlete is me
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    I am adding myself, not a dependent
                  </p>
                </div>
              </div>
              <Switch
                id="is-self"
                checked={newAthlete.isSelf}
                onCheckedChange={(checked) =>
                  setNewAthlete((prev) => ({ ...prev, isSelf: checked }))
                }
                disabled={isCreating}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="athlete-first-name">First Name</Label>
              <Input
                id="athlete-first-name"
                value={newAthlete.firstName}
                onChange={(e) => setNewAthlete((prev) => ({ ...prev, firstName: e.target.value }))}
                placeholder="First name"
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="athlete-last-name">Last Name</Label>
              <Input
                id="athlete-last-name"
                value={newAthlete.lastName}
                onChange={(e) => setNewAthlete((prev) => ({ ...prev, lastName: e.target.value }))}
                placeholder="Last name"
                disabled={isCreating}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isCreating}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !newAthlete.birthDate && "text-muted-foreground"
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {newAthlete.birthDate
                    ? format(new Date(newAthlete.birthDate + "T12:00:00Z"), "PPP")
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarPicker
                  mode="single"
                  selected={
                    newAthlete.birthDate ? new Date(newAthlete.birthDate + "T12:00:00Z") : undefined
                  }
                  onSelect={(date) =>
                    setNewAthlete((prev) => ({
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
            <Label htmlFor="athlete-gender">Gender Declaration</Label>
            <Select
              value={newAthlete.gender}
              onValueChange={(value) => setNewAthlete((prev) => ({ ...prev, gender: value }))}
              disabled={isCreating}
            >
              <SelectTrigger id="athlete-gender">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
                <SelectItem value="PREFER_NOT_TO_SAY">Prefer Not to Say</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!newAthlete.isSelf && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label
                    htmlFor="allow-guardian-claims"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Allow other guardians
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Let other guardians find and claim this athlete
                  </p>
                </div>
              </div>
              <Switch
                id="allow-guardian-claims"
                checked={newAthlete.allowGuardianClaims}
                onCheckedChange={(checked) =>
                  setNewAthlete((prev) => ({ ...prev, allowGuardianClaims: checked }))
                }
                disabled={isCreating}
              />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateAthlete} disabled={isCreating} className="flex-1">
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {newAthlete.isSelf ? "Add Myself" : "Add Athlete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
