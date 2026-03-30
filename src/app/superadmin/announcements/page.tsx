"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "lucide-react";
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

interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  readCount: number;
  createdBy: {
    name: string;
    email: string;
  };
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

export default function SuperadminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">("DRAFT");
  const [expiresAt, setExpiresAt] = useState("");

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

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/superadmin/announcements");
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
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const resetForm = () => {
    setTitle("");
    setPriority("NORMAL");
    setStatus("DRAFT");
    setExpiresAt("");
    editor?.commands.clearContent();
    setEditingAnnouncement(null);
  };

  const handleOpenDialog = (announcement?: SystemAnnouncement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setTitle(announcement.title);
      setPriority(announcement.priority);
      setStatus(announcement.status);
      setExpiresAt(announcement.expiresAt ? announcement.expiresAt.slice(0, 16) : "");
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
        priority,
        status,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      };

      const url = editingAnnouncement
        ? `/api/superadmin/announcements/${editingAnnouncement.id}`
        : "/api/superadmin/announcements";

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
      const response = await fetch(`/api/superadmin/announcements/${id}`, {
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
  };

  const handlePublish = async (id: string) => {
    try {
      const response = await fetch(`/api/superadmin/announcements/${id}`, {
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

  const filteredAnnouncements = announcements.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Announcements</h1>
          <p className="text-muted-foreground">
            Manage platform-wide announcements visible to all organizations.
          </p>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? "Edit Announcement" : "Create Announcement"}
              </DialogTitle>
              <DialogDescription>
                {editingAnnouncement
                  ? "Update this system-wide announcement."
                  : "Create a new announcement visible to all organizations."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Platform Maintenance Notice"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Expires At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

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
      </div>

      <div className="flex items-center gap-2">
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
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No announcements match your search" : "No announcements yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAnnouncements.map((announcement) => (
                  <TableRow key={announcement.id}>
                    <TableCell className="font-medium">{announcement.title}</TableCell>
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
                    <TableCell>{announcement.readCount}</TableCell>
                    <TableCell>{announcement.createdBy.name}</TableCell>
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
