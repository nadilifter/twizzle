"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  PlayCircle,
  Video,
  Loader2,
  Pencil,
  Trash2,
  Users,
  LayoutGrid,
  List,
} from "lucide-react";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ResponsiveTabsList } from "@/components/ui/responsive-tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { Skill, Level } from "@/types/evaluations";

interface OrgSport {
  id: string;
  name: string;
  slug: string;
}

const DEFAULT_CATEGORIES = ["Floor", "Bars", "Beam", "Vault", "Trampoline", "General"];

interface SkillFormData {
  name: string;
  category: string;
  description: string;
  levelId: string;
  minAge: string;
  maxAge: string;
  videoUrl: string;
  imageUrl: string;
}

const initialFormData: SkillFormData = {
  name: "",
  category: "",
  description: "",
  levelId: "",
  minAge: "",
  maxAge: "",
  videoUrl: "",
  imageUrl: "",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [levelFilter, setLevelFilter] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Form state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [formData, setFormData] = useState<SkillFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch skills
  const fetchSkills = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory !== "All") params.category = selectedCategory;
      if (levelFilter) params.levelId = levelFilter;

      const response = await api.get<{
        data: Skill[];
        categories: string[];
        total: number;
      }>("/api/skills", params);

      setSkills(response.data);
      if (response.categories?.length > 0) {
        setCategories(["All", ...response.categories]);
      }
    } catch (error) {
      console.error("Error fetching skills:", error);
      toast.error("Failed to load skills");
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory, levelFilter]);

  // Organization sports context
  const [orgSports, setOrgSports] = useState<OrgSport[]>([]);

  // Fetch levels and org sports
  useEffect(() => {
    async function loadLevels() {
      try {
        const response = await api.get<Level[]>("/api/levels");
        setLevels(response);
      } catch (error) {
        console.error("Error fetching levels:", error);
      }
    }
    async function loadOrgSports() {
      try {
        const response = await fetch("/api/organization/sports");
        if (response.ok) {
          setOrgSports(await response.json());
        }
      } catch (error) {
        console.error("Error fetching org sports:", error);
      }
    }
    loadLevels();
    loadOrgSports();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchSkills();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchSkills]);

  // Handle create skill
  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.category) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);
    try {
      await api.post("/api/skills", {
        name: formData.name,
        category: formData.category,
        description: formData.description || undefined,
        levelId: formData.levelId || undefined,
        minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : undefined,
        videoUrl: formData.videoUrl || undefined,
        imageUrl: formData.imageUrl || undefined,
      });

      toast.success("Skill created successfully");
      setIsCreateOpen(false);
      setFormData(initialFormData);
      fetchSkills();
    } catch (error) {
      console.error("Error creating skill:", error);
      toast.error("Failed to create skill");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle update skill
  const handleUpdate = async () => {
    if (!selectedSkill || !formData.name.trim() || !formData.category) {
      toast.error("Please fill in required fields");
      return;
    }

    setIsSaving(true);
    try {
      await api.put(`/api/skills/${selectedSkill.id}`, {
        name: formData.name,
        category: formData.category,
        description: formData.description || null,
        levelId: formData.levelId || null,
        minAge: formData.minAge ? parseInt(formData.minAge) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : null,
        videoUrl: formData.videoUrl || null,
        imageUrl: formData.imageUrl || null,
      });

      toast.success("Skill updated successfully");
      setIsEditOpen(false);
      setSelectedSkill(null);
      setFormData(initialFormData);
      fetchSkills();
    } catch (error) {
      console.error("Error updating skill:", error);
      toast.error("Failed to update skill");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete skill
  const handleDelete = async () => {
    if (!selectedSkill) return;

    setIsDeleting(true);
    try {
      await api.delete(`/api/skills/${selectedSkill.id}`);

      toast.success("Skill deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedSkill(null);
      fetchSkills();
    } catch (error: unknown) {
      console.error("Error deleting skill:", error);
      const errorMessage =
        error instanceof Error && "message" in error ? error.message : "Failed to delete skill";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open edit sheet
  const openEdit = (skill: Skill) => {
    setSelectedSkill(skill);
    setFormData({
      name: skill.name,
      category: skill.category,
      description: skill.description || "",
      levelId: skill.levelId || "",
      minAge: skill.minAge?.toString() || "",
      maxAge: skill.maxAge?.toString() || "",
      videoUrl: skill.videoUrl || "",
      imageUrl: skill.imageUrl || "",
    });
    setIsEditOpen(true);
  };

  // Open view sheet
  const openView = (skill: Skill) => {
    setSelectedSkill(skill);
    setIsViewOpen(true);
  };

  // Filtered skills
  const filteredSkills = skills.filter((skill) => {
    if (selectedCategory !== "All" && skill.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  // Get age range display
  const getAgeRange = (skill: Skill) => {
    if (skill.minAge && skill.maxAge) {
      return `Ages ${skill.minAge}-${skill.maxAge}`;
    } else if (skill.minAge) {
      return `Ages ${skill.minAge}+`;
    } else if (skill.maxAge) {
      return `Ages up to ${skill.maxAge}`;
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <DashboardPageHeader
        title="Skills Database"
        description={
          <>
            Library of skills, drills, and progressions.
            {orgSports.length > 0 && (
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Sports:</span>
                {orgSports.map((sport) => (
                  <Badge key={sport.id} variant="secondary" className="text-xs">
                    {sport.name}
                  </Badge>
                ))}
              </span>
            )}
          </>
        }
        actions={
          <Button
            onClick={() => {
              setFormData(initialFormData);
              setIsCreateOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add New Skill
          </Button>
        }
      />
      <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add New Skill</SheetTitle>
            <SheetDescription>Add a new skill to the training database.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Skill Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Forward Roll"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="difficulty">Level</Label>
              <Select
                value={formData.levelId || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, levelId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No level</SelectItem>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minAge">Min Age</Label>
                <Input
                  id="minAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 4"
                  value={formData.minAge}
                  onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxAge">Max Age</Label>
                <Input
                  id="maxAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 18"
                  value={formData.maxAge}
                  onChange={(e) => setFormData({ ...formData, maxAge: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the skill and key technique points..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="videoUrl">Video URL</Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://..."
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Skill
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="relative w-full md:max-w-sm md:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search skills..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={levelFilter || "all"}
            onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="All Levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {levels.map((level) => (
                <SelectItem key={level.id} value={level.id}>
                  {level.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as "grid" | "table")}
            className="shrink-0 rounded-md border"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" className="px-3">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view" className="px-3">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="space-y-4">
        <ResponsiveTabsList value={selectedCategory} onValueChange={setSelectedCategory}>
          {categories.map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </ResponsiveTabsList>

        {categories.map((tabCategory) => (
          <TabsContent key={tabCategory} value={tabCategory} className="space-y-4">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-video w-full rounded-t-lg" />
                    <CardHeader className="pb-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredSkills.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No Skills Found</h3>
                <p className="text-muted-foreground mb-4">
                  {search || levelFilter
                    ? "Try adjusting your filters"
                    : "Get started by creating your first skill"}
                </p>
                {!search && !levelFilter && (
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Skill
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSkills.map((skill) => (
                  <Card
                    key={skill.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => openView(skill)}
                  >
                    <div className="aspect-video bg-muted relative flex items-center justify-center rounded-t-lg group">
                      {skill.imageUrl ? (
                        <img
                          src={skill.imageUrl}
                          alt={skill.name}
                          className="w-full h-full object-cover rounded-t-lg"
                        />
                      ) : (
                        <PlayCircle className="h-12 w-12 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                      )}
                      {skill.skillLevel && (
                        <Badge
                          className="absolute top-2 right-2"
                          style={
                            skill.skillLevel.color
                              ? {
                                  backgroundColor: `${skill.skillLevel.color}20`,
                                  color: skill.skillLevel.color,
                                }
                              : undefined
                          }
                          variant={skill.skillLevel.color ? "outline" : "secondary"}
                        >
                          {skill.skillLevel.name}
                        </Badge>
                      )}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{skill.name}</CardTitle>
                          <CardDescription>{skill.category}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getAgeRange(skill) && <span>{getAgeRange(skill)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Age Range</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSkills.map((skill) => (
                      <TableRow
                        key={skill.id}
                        className="cursor-pointer"
                        onClick={() => openView(skill)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {skill.imageUrl ? (
                                <img
                                  src={skill.imageUrl}
                                  alt={skill.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <PlayCircle className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <span>{skill.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{skill.category}</TableCell>
                        <TableCell>
                          {skill.skillLevel ? (
                            <Badge
                              style={
                                skill.skillLevel.color
                                  ? {
                                      backgroundColor: `${skill.skillLevel.color}20`,
                                      color: skill.skillLevel.color,
                                    }
                                  : undefined
                              }
                              variant={skill.skillLevel.color ? "outline" : "secondary"}
                            >
                              {skill.skillLevel.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {getAgeRange(skill) || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(skill);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSkill(skill);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* View Skill Sheet */}
      <Sheet open={isViewOpen} onOpenChange={setIsViewOpen}>
        <SheetContent className="sm:max-w-xl">
          {selectedSkill && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedSkill.name}</SheetTitle>
                <SheetDescription>
                  {selectedSkill.category}
                  {selectedSkill.skillLevel ? ` • ${selectedSkill.skillLevel.name}` : ""}
                  {getAgeRange(selectedSkill) && ` • ${getAgeRange(selectedSkill)}`}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="aspect-video bg-black rounded-lg flex items-center justify-center overflow-hidden">
                  {selectedSkill.imageUrl ? (
                    <img
                      src={selectedSkill.imageUrl}
                      alt={selectedSkill.name}
                      className="w-full h-full object-contain"
                    />
                  ) : selectedSkill.videoUrl ? (
                    <video src={selectedSkill.videoUrl} controls className="w-full h-full" />
                  ) : (
                    <Video className="h-16 w-16 text-muted" />
                  )}
                </div>
                {selectedSkill.description && (
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedSkill.description}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsViewOpen(false);
                      openEdit(selectedSkill);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      setIsViewOpen(false);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Edit Skill Sheet */}
      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Skill</SheetTitle>
            <SheetDescription>Update skill details.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Skill Name *</Label>
              <Input
                id="edit-name"
                placeholder="e.g. Forward Roll"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-difficulty">Level</Label>
              <Select
                value={formData.levelId || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, levelId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="edit-difficulty">
                  <SelectValue placeholder="Select a level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No level</SelectItem>
                  {levels.map((level) => (
                    <SelectItem key={level.id} value={level.id}>
                      {level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-minAge">Min Age</Label>
                <Input
                  id="edit-minAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 4"
                  value={formData.minAge}
                  onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-maxAge">Max Age</Label>
                <Input
                  id="edit-maxAge"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="e.g. 18"
                  value={formData.maxAge}
                  onChange={(e) => setFormData({ ...formData, maxAge: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Describe the skill and key technique points..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-videoUrl">Video URL</Label>
              <Input
                id="edit-videoUrl"
                type="url"
                placeholder="https://..."
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-imageUrl">Image URL</Label>
              <Input
                id="edit-imageUrl"
                type="url"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
              />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedSkill?.name}&quot;? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
