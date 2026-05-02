"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const RichTextEditor = dynamic(() => import("@/components/ui/rich-text-editor"), {
  ssr: false,
  loading: () => <Skeleton className="h-40 w-full" />,
});
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import type { Waiver } from "@/types/waivers";

interface PageData {
  id?: string;
  pageNumber: number;
  title: string;
  content: string;
}

interface WaiverBuilderProps {
  waiver?: Waiver | null;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function WaiverBuilder({ waiver, onSaved, onCancel }: WaiverBuilderProps) {
  const isEditing = !!waiver;

  const [title, setTitle] = React.useState(waiver?.title || "");
  const [status, setStatus] = React.useState(waiver?.status || "DRAFT");
  const [pages, setPages] = React.useState<PageData[]>(() => {
    if (waiver?.pages?.length) {
      return waiver.pages.map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        title: p.title || "",
        content: p.content,
      }));
    }
    return [{ pageNumber: 1, title: "", content: "" }];
  });
  const [activePage, setActivePage] = React.useState("page-1");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (waiver) {
      setTitle(waiver.title || "");
      setStatus(waiver.status || "DRAFT");
      setPages(
        waiver.pages?.length
          ? waiver.pages.map((p) => ({
              id: p.id,
              pageNumber: p.pageNumber,
              title: p.title || "",
              content: p.content,
            }))
          : [{ pageNumber: 1, title: "", content: "" }]
      );
      setActivePage("page-1");
    } else {
      setTitle("");
      setStatus("DRAFT");
      setPages([{ pageNumber: 1, title: "", content: "" }]);
      setActivePage("page-1");
    }
  }, [waiver]);

  const handleAddPage = () => {
    const newPageNumber = pages.length + 1;
    setPages((prev) => [...prev, { pageNumber: newPageNumber, title: "", content: "" }]);
    setActivePage(`page-${newPageNumber}`);
  };

  const handleRemovePage = (index: number) => {
    if (pages.length <= 1) {
      toast.error("A waiver must have at least one page");
      return;
    }
    setPages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Renumber pages
      return updated.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    });
    setActivePage(`page-1`);
  };

  const handleMovePage = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pages.length) return;

    setPages((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      // Renumber pages
      return updated.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    });
    setActivePage(`page-${newIndex + 1}`);
  };

  const updatePage = (index: number, field: keyof PageData, value: string) => {
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Waiver title is required");
      return;
    }

    const emptyPages = pages.filter((p) => !p.content.trim() || p.content === "<p></p>");
    if (emptyPages.length > 0) {
      toast.error(`Page ${emptyPages[0].pageNumber} has no content`);
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        title,
        status,
        pages: pages.map((p) => ({
          ...(p.id && { id: p.id }),
          pageNumber: p.pageNumber,
          title: p.title || undefined,
          content: p.content,
        })),
      };

      const url = isEditing ? `/api/waivers/${waiver!.id}` : "/api/waivers";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save waiver");
      }

      toast.success(isEditing ? "Waiver updated successfully" : "Waiver created successfully");
      onSaved?.();
    } catch (error: any) {
      console.error("Failed to save waiver:", error);
      toast.error(error.message || "Failed to save waiver");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title and Status */}
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-2">
          <Label htmlFor="waiver-title" className="text-lg font-semibold">
            Waiver Title
          </Label>
          <Input
            id="waiver-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., General Liability Waiver"
            className="text-lg"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-lg font-semibold">Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as "ACTIVE" | "ARCHIVED" | "DRAFT")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pages */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Waiver Pages</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddPage}>
              <Plus className="mr-2 h-4 w-4" />
              Add Page
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Each page will be presented to the signer one at a time. They can sign pages
            individually or all at once.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activePage} onValueChange={setActivePage}>
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
              {pages.map((page, index) => (
                <TabsTrigger
                  key={`page-${page.pageNumber}`}
                  value={`page-${page.pageNumber}`}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Page {page.pageNumber}
                  {page.title ? `: ${page.title}` : ""}
                </TabsTrigger>
              ))}
            </TabsList>

            {pages.map((page, index) => (
              <TabsContent
                key={`page-${page.pageNumber}`}
                value={`page-${page.pageNumber}`}
                className="mt-4 space-y-4"
              >
                {/* Page controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMovePage(index, "up")}
                      disabled={index === 0}
                      title="Move page up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMovePage(index, "down")}
                      disabled={index === pages.length - 1}
                      title="Move page down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePage(index)}
                    disabled={pages.length <= 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove Page
                  </Button>
                </div>

                {/* Page Title (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor={`page-title-${index}`}>
                    Page Title <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={`page-title-${index}`}
                    value={page.title}
                    onChange={(e) => updatePage(index, "title", e.target.value)}
                    placeholder="e.g., Section A: Assumption of Risk"
                  />
                </div>

                {/* Page Content - WYSIWYG */}
                <div className="space-y-2">
                  <Label>Page Content</Label>
                  <p className="text-sm text-muted-foreground">
                    Enter the legal text for this page of the waiver.
                  </p>
                  <div className="min-h-[400px]">
                    <RichTextEditor
                      value={page.content}
                      onChange={(value) => updatePage(index, "content", value)}
                      placeholder="I, the undersigned, hereby acknowledge and agree that..."
                    />
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Update Waiver" : "Create Waiver"}
        </Button>
      </div>
    </div>
  );
}
