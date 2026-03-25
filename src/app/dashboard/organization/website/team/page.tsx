"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  ChevronUp,
  ChevronDown,
  User,
  ArrowLeft,
  Save,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  title: string | null;
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

  const fetchData = useCallback(async () => {
    try {
      const [staffRes, highlightsRes] = await Promise.all([
        fetch("/api/organization/staff"),
        fetch("/api/organization/team-highlights"),
      ]);

      let staffData: StaffMember[] = [];
      if (staffRes.ok) {
        staffData = await staffRes.json();
        setStaff(staffData);
      }

      let existingHighlights: TeamHighlight[] = [];
      if (highlightsRes.ok) {
        const highlightsData: TeamHighlightWithMember[] =
          await highlightsRes.json();
        existingHighlights = highlightsData.map((h) => ({
          memberId: h.memberId,
          displayOrder: h.displayOrder,
          overrideImage: h.overrideImage,
          title: h.title,
          bio: h.bio,
          isVisible: h.isVisible,
        }));
      }

      const existingMemberIds = new Set(
        existingHighlights.map((h) => h.memberId)
      );
      const eligible = staffData.filter(
        (s) => s.status === "ACTIVE" || s.status === "INVITED"
      );
      const newEntries: TeamHighlight[] = eligible
        .filter((s) => !existingMemberIds.has(s.id))
        .map((s, i) => ({
          memberId: s.id,
          displayOrder: existingHighlights.length + i,
          overrideImage: null,
          title: null,
          bio: null,
          isVisible: false,
        }));

      setHighlights([...existingHighlights, ...newEntries]);
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
    const missingTitle = highlights.some(
      (h) => h.isVisible && !h.title?.trim()
    );
    if (missingTitle) {
      toast.error("Every visible team member must have a title before saving.");
      return;
    }

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
    value: string | number | boolean | null
  ) => {
    setHighlights((prev) =>
      prev.map((h) => (h.memberId === memberId ? { ...h, [field]: value } : h))
    );
  };

  const getStaffMember = (memberId: string): StaffMember | undefined => {
    return staff.find((s) => s.id === memberId);
  };

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
              Toggle visibility and customize how each team member appears on
              your public website.
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

      {/* Team Member List */}
      {highlights.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-lg font-medium text-muted-foreground mb-1">
                No team members found
              </p>
              <p className="text-sm text-muted-foreground">
                Add staff members to your organization and they will appear here
                automatically.
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
              <Card
                key={highlight.memberId}
                className={
                  highlight.isVisible ? "" : "opacity-60"
                }
              >
                <CardContent className="pt-6">
                  <div className="flex gap-6">
                    {/* Reorder Controls */}
                    <div className="flex flex-col items-center gap-1 pt-1">
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

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>
                              Title{" "}
                              {highlight.isVisible && (
                                <span className="text-destructive">*</span>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Their role or position shown on the public team
                              page.
                            </p>
                            <Input
                              value={highlight.title || ""}
                              onChange={(e) =>
                                updateHighlight(
                                  highlight.memberId,
                                  "title",
                                  e.target.value || null
                                )
                              }
                              placeholder="e.g. Head Coach, Program Director..."
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
