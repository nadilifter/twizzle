"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { toast } from "sonner";
import {
  Loader2,
  Users,
  User,
  ArrowLeft,
  Save,
  Camera,
  X,
  Upload,
  Award,
  Crop,
  GripVertical,
  ArrowUpDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

function SortableTeamItem({
  highlight,
  member,
}: {
  highlight: TeamHighlight;
  member: StaffMember;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: highlight.memberId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <Avatar className="h-8 w-8">
        <AvatarImage src={highlight.overrideImage || member.user.avatar || undefined} />
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{member.user.name}</span>
          {!highlight.isVisible && (
            <Badge variant="outline" className="text-xs">
              Hidden
            </Badge>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {highlight.title || member.title || member.role}
        </span>
      </div>
    </div>
  );
}

export default function TeamHighlightsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [highlights, setHighlights] = useState<TeamHighlight[]>([]);
  const [showTeamCertifications, setShowTeamCertifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isReorderDialogOpen, setIsReorderDialogOpen] = useState(false);
  const [reorderHighlights, setReorderHighlights] = useState<TeamHighlight[]>([]);
  const [cropState, setCropState] = useState<{
    memberId: string;
    imageSrc: string;
  } | null>(null);
  const [uploadingMemberId, setUploadingMemberId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  );

  const fetchData = useCallback(async () => {
    try {
      const [staffRes, highlightsRes, configRes] = await Promise.all([
        fetch("/api/organization/staff"),
        fetch("/api/organization/team-highlights"),
        fetch("/api/organization/website"),
      ]);

      let staffData: StaffMember[] = [];
      if (staffRes.ok) {
        staffData = await staffRes.json();
        setStaff(staffData);
      }

      if (configRes.ok) {
        const configData = await configRes.json();
        setShowTeamCertifications(configData.showTeamCertifications ?? false);
      }

      let existingHighlights: TeamHighlight[] = [];
      if (highlightsRes.ok) {
        const highlightsData: TeamHighlightWithMember[] = await highlightsRes.json();
        existingHighlights = highlightsData.map((h) => ({
          memberId: h.memberId,
          displayOrder: h.displayOrder,
          overrideImage: h.overrideImage,
          title: h.title,
          bio: h.bio,
          isVisible: h.isVisible,
        }));
      }

      const existingMemberIds = new Set(existingHighlights.map((h) => h.memberId));
      const eligible = staffData.filter((s) => s.status === "ACTIVE" || s.status === "INVITED");
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
    const missingTitle = highlights.some((h) => h.isVisible && !h.title?.trim());
    if (missingTitle) {
      toast.error("Every visible team member must have a title before saving.");
      return;
    }

    setSaving(true);
    try {
      const [highlightsRes, configRes] = await Promise.all([
        fetch("/api/organization/team-highlights", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ highlights }),
        }),
        fetch("/api/organization/website", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ showTeamCertifications }),
        }),
      ]);
      if (!highlightsRes.ok || !configRes.ok) throw new Error("Failed to save");
      toast.success("Team highlights saved");
    } catch {
      toast.error("Failed to save team highlights");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReorder = () => {
    setReorderHighlights([...highlights]);
    setIsReorderDialogOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setReorderHighlights((items) => {
        const oldIndex = items.findIndex((item) => item.memberId === active.id);
        const newIndex = items.findIndex((item) => item.memberId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSaveOrder = () => {
    setHighlights(reorderHighlights.map((h, i) => ({ ...h, displayOrder: i })));
    setIsReorderDialogOpen(false);
    toast.success("Order updated — click Save Changes to persist");
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

  const handlePhotoSelect = useCallback(
    (memberId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be smaller than 10MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCropState({ memberId, imageSrc: reader.result as string });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const handleRecrop = useCallback(async (memberId: string, imageUrl: string) => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setCropState({ memberId, imageSrc: reader.result as string });
      };
      reader.readAsDataURL(blob);
    } catch {
      toast.error("Failed to load image for re-cropping");
    }
  }, []);

  const handleCropComplete = async (blob: Blob) => {
    if (!cropState) return;
    const { memberId } = cropState;
    setCropState(null);
    setUploadingMemberId(memberId);
    try {
      const formData = new FormData();
      formData.append("file", blob, "team-photo.jpg");
      formData.append("type", "team");
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateHighlight(memberId, "overrideImage", data.url);
      toast.success("Photo updated");
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploadingMemberId(null);
    }
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
          <Link href="/dashboard/website">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Team Highlights</h1>
            <p className="text-muted-foreground">
              Toggle visibility and customize how each team member appears on your public website.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {highlights.length > 1 && (
            <Button variant="outline" onClick={handleOpenReorder}>
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Set Order
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Display Settings */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg p-2 bg-muted">
                <Award className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Show Certifications</p>
                <p className="text-sm text-muted-foreground">
                  Display earned certifications as badges beneath each team member&apos;s name on
                  the public team page.
                </p>
              </div>
            </div>
            <Switch
              id="show-team-certifications"
              checked={showTeamCertifications}
              onCheckedChange={setShowTeamCertifications}
            />
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
                No team members found
              </p>
              <p className="text-sm text-muted-foreground">
                Add staff members to your organization and they will appear here automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {highlights.map((highlight) => {
            const member = getStaffMember(highlight.memberId);
            if (!member) return null;

            return (
              <Card key={highlight.memberId} className={highlight.isVisible ? "" : "opacity-60"}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage
                            src={highlight.overrideImage || member.user.avatar || undefined}
                          />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.user.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.title || member.role} &middot; {member.user.email}
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
                            updateHighlight(highlight.memberId, "isVisible", c)
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Settings */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>
                          Team Photo{" "}
                          <span className="text-muted-foreground text-xs font-normal">
                            (Optional)
                          </span>
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Replaces the member&apos;s profile photo on the team page. Image will be
                          cropped to portrait.
                        </p>
                        <div
                          className="relative group w-[150px] aspect-[3/4] rounded-lg overflow-hidden bg-muted border-2 border-dashed cursor-pointer transition-colors hover:border-primary/50"
                          onClick={() =>
                            !uploadingMemberId && fileInputRefs.current[highlight.memberId]?.click()
                          }
                        >
                          {highlight.overrideImage ? (
                            <>
                              <img
                                src={highlight.overrideImage}
                                alt="Team photo"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                {uploadingMemberId === highlight.memberId ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Camera className="h-5 w-5" />
                                )}
                              </div>
                              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  className="p-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                                  title="Re-crop"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (highlight.overrideImage) {
                                      handleRecrop(highlight.memberId, highlight.overrideImage);
                                    }
                                  }}
                                >
                                  <Crop className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded-full bg-destructive text-white hover:bg-destructive/90"
                                  title="Remove photo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateHighlight(highlight.memberId, "overrideImage", null);
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                              {uploadingMemberId === highlight.memberId ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="h-6 w-6" />
                                  <span className="text-xs">Upload Photo</span>
                                </>
                              )}
                            </div>
                          )}
                          <input
                            ref={(el) => {
                              fileInputRefs.current[highlight.memberId] = el;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handlePhotoSelect(highlight.memberId, e)}
                            disabled={uploadingMemberId !== null}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>
                            Title{" "}
                            {highlight.isVisible && <span className="text-destructive">*</span>}
                          </Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Their role or position shown on the public team page.
                          </p>
                          <Input
                            value={highlight.title || ""}
                            onChange={(e) =>
                              updateHighlight(highlight.memberId, "title", e.target.value || null)
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
                              updateHighlight(highlight.memberId, "bio", e.target.value || null)
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

      {cropState && (
        <ImageCropDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) setCropState(null);
          }}
          imageSrc={cropState.imageSrc}
          onCropComplete={handleCropComplete}
          aspect={3 / 4}
          cropShape="rect"
          title="Crop Team Photo"
          maxOutputWidth={1200}
          maxOutputHeight={1600}
        />
      )}

      <Dialog open={isReorderDialogOpen} onOpenChange={setIsReorderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Team Order</DialogTitle>
            <DialogDescription>
              Drag and drop to reorder how team members appear on your public website
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={reorderHighlights.map((h) => h.memberId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {reorderHighlights.map((highlight) => {
                    const member = getStaffMember(highlight.memberId);
                    if (!member) return null;
                    return (
                      <SortableTeamItem
                        key={highlight.memberId}
                        highlight={highlight}
                        member={member}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReorderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveOrder}>Save Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
