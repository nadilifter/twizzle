"use client";

import { useState, useRef } from "react";
import { useMedia, uploadAndCreateMedia } from "@/hooks/use-media";
import { useCoachEvents } from "@/hooks/use-coach-events";
import { useCoachAthletes } from "@/hooks/use-coach-athletes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Upload, 
  Image as ImageIcon, 
  Video, 
  X, 
  Search,
  Calendar,
  User,
  Filter,
  Trash2,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Image from "next/image";

export default function CoachMediaPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAthleteId, setEditAthleteId] = useState<string>("");
  const [editEventId, setEditEventId] = useState<string>("");

  const { media, isLoading, deleteMedia, updateMedia, createMedia, refresh } = useMedia();
  const { events } = useCoachEvents({ autoFetch: true });
  const { athletes } = useCoachAthletes({ autoFetch: true });

  // Filter media
  const filteredMedia = media.filter((item) => {
    const matchesSearch = (item.title?.toLowerCase() || "").includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of Array.from(files)) {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        
        if (!isImage && !isVideo) {
          toast.error(`${file.name} is not a supported file type`);
          continue;
        }

        const result = await uploadAndCreateMedia(file, {
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        });

        if (result) {
          toast.success(`${file.name} uploaded successfully`);
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      
      refresh();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload files");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this media?")) return;
    
    const success = await deleteMedia(id);
    if (success) {
      toast.success("Media deleted successfully");
    } else {
      toast.error("Failed to delete media");
    }
  };

  // Open edit dialog
  const openEditDialog = (item: any) => {
    setSelectedMedia(item);
    setEditTitle(item.title || "");
    setEditDescription(item.description || "");
    setEditAthleteId(item.athleteId || "");
    setEditEventId(item.eventId || "");
    setIsEditDialogOpen(true);
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!selectedMedia) return;
    
    const result = await updateMedia(selectedMedia.id, {
      title: editTitle || undefined,
      description: editDescription || undefined,
      athleteId: editAthleteId || null,
      eventId: editEventId || null,
    });

    if (result) {
      toast.success("Media updated successfully");
      setIsEditDialogOpen(false);
      setSelectedMedia(null);
    } else {
      toast.error("Failed to update media");
    }
  };

  // Get media type icon
  const getMediaIcon = (type: string) => {
    return type === "VIDEO" ? (
      <Video className="h-4 w-4" />
    ) : (
      <ImageIcon className="h-4 w-4" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Media</h1>
          <p className="text-muted-foreground">Upload and manage training photos and videos</p>
        </div>
        
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Uploading..." : "Upload Media"}
          </Button>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <Card 
        className="border-2 border-dashed hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Drop files here or click to upload</h3>
            <p className="text-sm text-muted-foreground">
              Support for images and videos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="IMAGE">Images</SelectItem>
                <SelectItem value="VIDEO">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{media.length}</p>
            <p className="text-xs text-muted-foreground">Total Files</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">
              {media.filter(m => m.type === "IMAGE").length}
            </p>
            <p className="text-xs text-muted-foreground">Images</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">
              {media.filter(m => m.type === "VIDEO").length}
            </p>
            <p className="text-xs text-muted-foreground">Videos</p>
          </CardContent>
        </Card>
      </div>

      {/* Media Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gallery ({filteredMedia.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Media Found</h3>
              <p className="text-muted-foreground mb-4">
                {search || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first photo or video to get started"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredMedia.map((item) => (
                <div 
                  key={item.id} 
                  className="group relative aspect-square rounded-lg overflow-hidden bg-muted border"
                >
                  {item.type === "VIDEO" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <Video className="h-12 w-12 text-white/80" />
                    </div>
                  ) : (
                    <Image
                      src={item.url}
                      alt={item.title || "Media"}
                      fill
                      className="object-cover"
                    />
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-white text-sm font-medium truncate">
                        {item.title || "Untitled"}
                      </p>
                      <div className="flex items-center gap-2 text-white/70 text-xs">
                        {getMediaIcon(item.type)}
                        <span>{format(new Date(item.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      {item.athlete && (
                        <div className="flex items-center gap-1 text-white/70 text-xs">
                          <User className="h-3 w-3" />
                          <span>{item.athlete.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Type Badge */}
                  <Badge 
                    className="absolute top-2 left-2 text-xs"
                    variant={item.type === "VIDEO" ? "default" : "secondary"}
                  >
                    {item.type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
            <DialogDescription>
              Update media details and tags
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter a title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add a description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="athlete">Tag Athlete</Label>
              <Select value={editAthleteId} onValueChange={setEditAthleteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an athlete (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {athletes.map((athlete) => (
                    <SelectItem key={athlete.id} value={athlete.id}>
                      {athlete.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event">Tag Event</Label>
              <Select value={editEventId} onValueChange={setEditEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an event (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} - {format(new Date(event.date), "MMM d")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
