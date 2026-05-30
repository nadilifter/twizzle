"use client";

import { useState, useEffect, useCallback } from "react";
import { useFeatures } from "@/components/feature-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Archive,
  Megaphone,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";
import { toast } from "sonner";

// Tiptap imports
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetScope: "ALL" | "PROGRAM" | "EVENT" | "GUARDIAN";
  targetProgramId: string | null;
  targetEventId: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  createdAt: string;
  program?: { id: string; name: string } | null;
  event?: { id: string; name: string } | null;
}

const priorityColors = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-secondary text-secondary-foreground",
  HIGH: "bg-orange-500 text-white",
  URGENT: "bg-destructive text-destructive-foreground",
};

const statusColors = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-green-500 text-white",
  ARCHIVED: "bg-gray-500 text-white",
};

export default function AnnouncementsPage() {
  const { isFeatureEnabled } = useFeatures();
  const eventsEnabled = isFeatureEnabled("events");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  // Reference data
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [title, setTitle] = useState("");
  const [targetScope, setTargetScope] = useState<"ALL" | "PROGRAM" | "EVENT" | "GUARDIAN">("ALL");
  const [targetProgramId, setTargetProgramId] = useState("");
  const [targetEventId, setTargetEventId] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write your announcement here...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline",
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[150px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto prose prose-sm max-w-none dark:prose-invert",
      },
    },
  });

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/announcements?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      toast.error("Failed to fetch announcements");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  useEffect(() => {
    fetch("/api/programs")
      .then((r) => r.json())
      .then((data) =>
        setPrograms(
          (data.data || data.programs || []).map((p: any) => ({ id: p.id, name: p.name }))
        )
      )
      .catch((err) => console.error("Failed to load programs:", err));
  }, []);

  useEffect(() => {
    if (!eventsEnabled) return;
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) =>
        setEvents(
          (data.data || data.events || []).map((e: any) => ({ id: e.id, name: e.title || e.name }))
        )
      )
      .catch((err) => console.error("Failed to load events:", err));
  }, [eventsEnabled]);

  const resetForm = () => {
    setTitle("");
    setTargetScope("ALL");
    setTargetProgramId("");
    setTargetEventId("");
    setPriority("NORMAL");
    setStatus("DRAFT");
    editor?.commands.clearContent();
    setEditingAnnouncement(null);
  };

  const handleOpenDialog = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setTitle(announcement.title);
      setTargetScope(announcement.targetScope);
      setTargetProgramId(announcement.targetProgramId || "");
      setTargetEventId(announcement.targetEventId || "");
      setPriority(announcement.priority);
      setStatus(announcement.status);
      editor?.commands.setContent(announcement.content);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title || !editor?.getHTML()) {
      toast.error("Title and content are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title,
        content: editor.getHTML(),
        targetScope,
        targetProgramId:
          targetScope === "PROGRAM" && targetProgramId && targetProgramId !== "all"
            ? targetProgramId
            : null,
        targetEventId: targetScope === "EVENT" && targetEventId ? targetEventId : null,
        priority,
        status,
      };

      const url = editingAnnouncement
        ? `/api/announcements/${editingAnnouncement.id}`
        : "/api/announcements";

      const response = await fetch(url, {
        method: editingAnnouncement ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(
          editingAnnouncement
            ? "Announcement updated successfully"
            : "Announcement created successfully"
        );
        setIsDialogOpen(false);
        resetForm();
        fetchAnnouncements();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save announcement");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    toast("Delete this announcement?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            const response = await fetch(`/api/announcements/${id}`, {
              method: "DELETE",
            });

            if (response.ok) {
              toast.success("Announcement deleted successfully");
              fetchAnnouncements();
            } else {
              throw new Error("Failed to delete announcement");
            }
          } catch (error) {
            toast.error("Failed to delete announcement");
          }
        },
      },
      cancel: { label: "Cancel", onClick: () => {} },
    });
  };

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PUBLISHED" }),
      });

      if (response.ok) {
        toast.success("Announcement published successfully");
        fetchAnnouncements();
      } else {
        throw new Error("Failed to publish announcement");
      }
    } catch (error) {
      toast.error("Failed to publish announcement");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });

      if (response.ok) {
        toast.success("Announcement archived");
        fetchAnnouncements();
      } else {
        throw new Error("Failed to archive announcement");
      }
    } catch (error) {
      toast.error("Failed to archive announcement");
    }
  };

  const scopeLabel = (a: Announcement) => {
    if (a.targetScope === "PROGRAM" && a.program) return a.program.name;
    if (a.targetScope === "EVENT" && a.event) return a.event.name;
    const labels: Record<string, string> = {
      ALL: "All Members",
      GUARDIAN: "Guardians",
      PROGRAM: "All Program Registrants",
      EVENT: "Event",
    };
    return labels[a.targetScope] || a.targetScope;
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <DashboardPageHeader
        variant="small"
        title="Announcements"
        description="Broadcast updates, news, and alerts to your community."
        actions={
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New Announcement
          </Button>
        }
      />
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
            </DialogTitle>
            <DialogDescription>
              {editingAnnouncement
                ? "Update this announcement."
                : "Compose a new announcement to share with your audience."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Important Facility Update"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Audience</Label>
                <Select
                  value={targetScope}
                  onValueChange={(val: any) => {
                    setTargetScope(val);
                    if (val !== "PROGRAM") setTargetProgramId("");
                    if (val !== "EVENT") setTargetEventId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Members</SelectItem>
                    <SelectItem value="GUARDIAN">Guardians</SelectItem>
                    <SelectItem value="PROGRAM">Program</SelectItem>
                    {eventsEnabled && <SelectItem value="EVENT">Event</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Publish Now</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetScope === "PROGRAM" && (
              <div className="grid gap-2">
                <Label>Program</Label>
                <Select value={targetProgramId} onValueChange={setTargetProgramId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All program registrants" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Program Registrants</SelectItem>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {targetProgramId && targetProgramId !== "all"
                    ? "Only members with athletes registered for this program will see this announcement."
                    : "All members with athletes enrolled in any program will see this announcement."}
                </p>
              </div>
            )}

            {targetScope === "EVENT" && eventsEnabled && (
              <div className="grid gap-2">
                <Label>Event</Label>
                <Select value={targetEventId} onValueChange={setTargetEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only members with athletes registered for this event will see this announcement.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Content</Label>
              {editor && (
                <div className="border rounded-md">
                  <div className="flex items-center gap-1 border-b p-2 bg-muted/20">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
                    >
                      <UnderlineIcon className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign("left").run()}
                      className={cn(
                        "h-8 w-8 p-0",
                        editor.isActive({ textAlign: "left" }) && "bg-muted"
                      )}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign("center").run()}
                      className={cn(
                        "h-8 w-8 p-0",
                        editor.isActive({ textAlign: "center" }) && "bg-muted"
                      )}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign("right").run()}
                      className={cn(
                        "h-8 w-8 p-0",
                        editor.isActive({ textAlign: "right" }) && "bg-muted"
                      )}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleOrderedList().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
                    >
                      <ListOrdered className="h-4 w-4" />
                    </Button>
                  </div>
                  <EditorContent editor={editor} className="p-1" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !title}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAnnouncement ? "Update" : "Create"} Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search announcements..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title={
                searchQuery || statusFilter !== "all"
                  ? "No announcements match your filters"
                  : "No announcements yet"
              }
              description={
                !searchQuery && statusFilter === "all"
                  ? "Post announcements to keep parents and coaches informed."
                  : undefined
              }
              action={
                !searchQuery && statusFilter === "all"
                  ? { label: "New announcement", onClick: () => handleOpenDialog() }
                  : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium">{announcement.title}</TableCell>
                    <TableCell className="text-sm">{scopeLabel(announcement)}</TableCell>
                    <TableCell>
                      <Badge className={priorityColors[announcement.priority]}>
                        {announcement.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[announcement.status]}>
                        {announcement.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {announcement.publishedAt
                        ? format(new Date(announcement.publishedAt), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenDialog(announcement)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          {announcement.status === "DRAFT" && (
                            <DropdownMenuItem onClick={() => handlePublish(announcement.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          {announcement.status === "PUBLISHED" && (
                            <DropdownMenuItem onClick={() => handleArchive(announcement.id)}>
                              <Archive className="mr-2 h-4 w-4" />
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(announcement.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
