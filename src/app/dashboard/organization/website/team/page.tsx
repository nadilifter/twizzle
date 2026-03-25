"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  User,
  ArrowLeft,
  GripVertical,
  Save,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface StaffMember {
  id: string;
  title: string | null;
  role: string;
  status: string;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    email: string;
  };
}

interface TeamHighlight {
  memberId: string;
  displayOrder: number;
  overrideImage: string | null;
  bio: string | null;
  isVisible: boolean;
}

interface TeamHighlightWithMember extends TeamHighlight {
  id: string;
  member: {
    id: string;
    title: string | null;
    role: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
      email: string;
    };
  };
}

export default function TeamHighlightsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [highlights, setHighlights] = useState<TeamHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [staffRes, highlightsRes] = await Promise.all([
        fetch("/api/organization/staff"),
        fetch("/api/organization/team-highlights"),
      ]);

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData);
      }

      if (highlightsRes.ok) {
        const highlightsData: TeamHighlightWithMember[] =
          await highlightsRes.json();
        setHighlights(
          highlightsData.map((h) => ({
            memberId: h.memberId,
            displayOrder: h.displayOrder,
            overrideImage: h.overrideImage,
            bio: h.bio,
            isVisible: h.isVisible,
          }))
        );
      }
    } catch {
      toast.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization/team-highlights", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ highlights }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Team highlights saved");
    } catch {
      toast.error("Failed to save team highlights");
    } finally {
      setSaving(false);
    }
  };

  const addMember = () => {
    if (!selectedMemberId) return;
    if (highlights.some((h) => h.memberId === selectedMemberId)) {
      toast.error("This member is already on the team page");
      return;
    }
    setHighlights((prev) => [
      ...prev,
      {
        memberId: selectedMemberId,
        displayOrder: prev.length,
        overrideImage: null,
        bio: null,
        isVisible: true,
      },
    ]);
    setSelectedMemberId("");
  };

  const removeMember = (memberId: string) => {
    setHighlights((prev) =>
      prev
        .filter((h) => h.memberId !== memberId)
        .map((h, i) => ({ ...h, displayOrder: i }))
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setHighlights((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((h, i) => ({ ...h, displayOrder: i }));
    });
  };

  const moveDown = (index: number) => {
    if (index >= highlights.length - 1) return;
    setHighlights((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((h, i) => ({ ...h, displayOrder: i }));
    });
  };

  const updateHighlight = (
    memberId: string,
    field: keyof TeamHighlight,
    value: any
  ) => {
    setHighlights((prev) =>
      prev.map((h) => (h.memberId === memberId ? { ...h, [field]: value } : h))
    );
  };

  const getStaffMember = (memberId: string): StaffMember | undefined => {
    return staff.find((s) => s.id === memberId);
  };

  const availableStaff = staff.filter(
    (s) =>
      s.status === "ACTIVE" &&
      !highlights.some((h) => h.memberId === s.id)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/organization/website">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Team Highlights
            </h1>
            <p className="text-muted-foreground">
              Choose which team members appear on your public website.
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Add Member */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <CardTitle>Add Team Member</CardTitle>
          </div>
          <CardDescription>
            Select a staff member to feature on your public team page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Select
              value={selectedMemberId}
              onValueChange={setSelectedMemberId}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a staff member..." />
              </SelectTrigger>
              <SelectContent>
                {availableStaff.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No available staff members
                  </SelectItem>
                ) : (
                  availableStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <span className="flex items-center gap-2">
                        {member.user.name}
                        {member.title && (
                          <span className="text-muted-foreground">
                            — {member.title}
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={addMember}
              disabled={!selectedMemberId}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Member List */}
      {highlights.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-1">
                No team members added yet
              </p>
              <p className="text-sm text-muted-foreground">
                Use the selector above to add staff members to your public team
                page.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {highlights.map((highlight, index) => {
            const member = getStaffMember(highlight.memberId);
            if (!member) return null;

            return (
              <Card key={highlight.memberId}>
                <CardContent className="pt-6">
                  <div className="flex gap-6">
                    {/* Reorder Controls */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40 mb-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveDown(index)}
                        disabled={index >= highlights.length - 1}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Member Info + Settings */}
                    <div className="flex-1 space-y-4">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage
                              src={
                                highlight.overrideImage ||
                                member.user.avatar ||
                                undefined
                              }
                            />
                            <AvatarFallback>
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {member.title || member.role} &middot;{" "}
                              {member.user.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`visible-${highlight.memberId}`}
                              className="text-sm text-muted-foreground"
                            >
                              Visible
                            </Label>
                            <Switch
                              id={`visible-${highlight.memberId}`}
                              checked={highlight.isVisible}
                              onCheckedChange={(c) =>
                                updateHighlight(
                                  highlight.memberId,
                                  "isVisible",
                                  c
                                )
                              }
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeMember(highlight.memberId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Separator />

                      {/* Settings */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Override Image</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Replaces the member&apos;s profile photo on the team
                            page.
                          </p>
                          <ImageUpload
                            label="Team Photo"
                            type="team"
                            value={highlight.overrideImage}
                            onChange={(url) =>
                              updateHighlight(
                                highlight.memberId,
                                "overrideImage",
                                url
                              )
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Bio</Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            A short description shown on the public team page.
                          </p>
                          <Textarea
                            value={highlight.bio || ""}
                            onChange={(e) =>
                              updateHighlight(
                                highlight.memberId,
                                "bio",
                                e.target.value || null
                              )
                            }
                            placeholder="Tell visitors about this team member..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
