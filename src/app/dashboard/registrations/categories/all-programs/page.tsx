"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { ImageUpload } from "@/components/ui/image-upload";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "sonner";

export default function EditAllProgramsCategoryPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<{ imageUrl: string | null }>("/api/categories/all-programs");
        setImageUrl(data.imageUrl);
      } catch {
        toast.error("Failed to load");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.patch("/api/categories/all-programs", { imageUrl });
      toast.success("All Programs category updated");
      router.push("/dashboard/registrations/categories");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update";
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
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/dashboard/registrations/categories">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <DashboardPageHeader
            title="Edit All Programs"
            description={`Customize the image for the default "All Programs" category on your marketing site.`}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Category Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImageUpload
              label="All Programs Image"
              value={imageUrl}
              onChange={(url) => setImageUrl(url)}
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
