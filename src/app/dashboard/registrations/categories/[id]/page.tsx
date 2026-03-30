"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import { useBreadcrumbOverride } from "@/components/breadcrumb-context";
import type { Category } from "@/hooks/use-categories";

export default function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [category, setCategory] = React.useState<Category | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    imageUrl: null as string | null,
  });

  useBreadcrumbOverride(
    category ? `/dashboard/registrations/categories/${category.id}` : undefined,
    category?.name
  );

  React.useEffect(() => {
    async function load() {
      const { id } = await params;
      try {
        const data = await api.get<Category>(`/api/categories/${id}`);
        setCategory(data);
        setFormData({
          name: data.name,
          description: data.description || "",
          imageUrl: data.imageUrl,
        });
      } catch {
        toast.error("Category not found");
        router.push("/dashboard/registrations/categories");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [params, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!category) return;

    setIsSaving(true);
    try {
      await api.patch(`/api/categories/${category.id}`, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        imageUrl: formData.imageUrl,
      });
      toast.success("Category updated");
      router.push("/dashboard/registrations/categories");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update category";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/registrations/categories">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Category</h1>
          <p className="text-muted-foreground">
            Update category details for &ldquo;{category?.name}&rdquo;.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Category Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Recreational Programs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="A short description of what this category includes..."
                rows={3}
              />
            </div>

            <ImageUpload
              label="Category Image"
              value={formData.imageUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, imageUrl: url }))}
              type="category"
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/registrations/categories">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
