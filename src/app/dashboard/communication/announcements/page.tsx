"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Search, Calendar as CalendarIcon, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import { AnnouncementsTable, Announcement } from "@/components/announcements-table"
import { format } from "date-fns"

// Tiptap imports
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import { cn } from "@/lib/utils"

const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "Holiday Schedule Changes",
    status: "Published",
    audience: "All Members",
    date: "Dec 10, 2025",
    views: 1250,
  },
  {
    id: "2",
    title: "New Facility Guidelines",
    status: "Published",
    audience: "All Members",
    date: "Dec 05, 2025",
    views: 843,
  },
  {
    id: "3",
    title: "Staff Meeting Reminders",
    status: "Draft",
    audience: "Staff",
    date: "Dec 12, 2025",
    views: 0,
  },
  {
    id: "4",
    title: "Winter Registration Opening Soon",
    status: "Scheduled",
    audience: "Public",
    date: "Jan 01, 2026",
    views: 0,
  },
]

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form State
  const [title, setTitle] = useState("")
  const [audience, setAudience] = useState<"All Members" | "Public" | "Staff">("All Members")
  const [status, setStatus] = useState<"Draft" | "Published" | "Scheduled">("Draft")
  const [date, setDate] = useState<string>(format(new Date(), "MMM dd, yyyy"))

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
        class: "min-h-[150px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto prose prose-sm max-w-none",
      },
    },
  })

  const resetForm = () => {
    setTitle("")
    setAudience("All Members")
    setStatus("Draft")
    setDate(format(new Date(), "MMM dd, yyyy"))
    editor?.commands.clearContent()
  }

  const handleCreate = () => {
    const newAnnouncement: Announcement = {
      id: Math.random().toString(36).substring(7),
      title,
      audience,
      status,
      date,
      views: 0,
    }
    
    setAnnouncements([newAnnouncement, ...announcements])
    setIsDialogOpen(false)
    resetForm()
  }

  const filteredAnnouncements = announcements.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
          <p className="text-muted-foreground">
            Broadcast updates, news, and alerts to your community.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
              <DialogDescription>
                Compose a new announcement to share with your audience.
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
              
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Audience</Label>
                  <Select value={audience} onValueChange={(val: any) => setAudience(val)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Members">All Members</SelectItem>
                      <SelectItem value="Public">Public</SelectItem>
                      <SelectItem value="Staff">Staff</SelectItem>
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
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Published">Publish Now</SelectItem>
                      <SelectItem value="Scheduled">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Content</Label>
                <div className="border rounded-md">
                  <div className="flex items-center gap-1 border-b p-2 bg-muted/20">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
                    >
                      <Bold className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
                    >
                      <Italic className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleUnderline().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
                    >
                      <UnderlineIcon className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign("left").run()}
                      className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "left" }) && "bg-muted")}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign("center").run()}
                      className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "center" }) && "bg-muted")}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().setTextAlign("right").run()}
                      className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "right" }) && "bg-muted")}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editor.chain().focus().toggleBulletList().run()}
                      className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
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
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!title}>Create Announcement</Button>
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
          <AnnouncementsTable 
            data={filteredAnnouncements} 
            onAnnouncementClick={(announcement) => {
              // In a real app, this would open edit mode or details
              console.log("Clicked:", announcement)
            }} 
          />
        </CardContent>
      </Card>
    </div>
  )
}

