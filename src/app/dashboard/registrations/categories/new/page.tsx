"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/ui/image-upload"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useCategories } from "@/hooks/use-categories"
import { toast } from "sonner"

export default function NewCategoryPage() {
  const router = useRouter()
  const { createCategory, isCreating } = useCategories({ autoFetch: false })
  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    imageUrl: null as string | null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Name is required")
      return
    }

    const result = await createCategory({
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      imageUrl: formData.imageUrl,
    })

    if (result) {
      toast.success("Category created")
      router.push("/dashboard/registrations/categories")
    } else {
      toast.error("Failed to create category")
    }
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
          <h1 className="text-3xl font-bold tracking-tight">New Category</h1>
          <p className="text-muted-foreground">
            Create a new category to group programs, events, and competitions.
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
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Recreational Programs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="A short description of what this category includes..."
                rows={3}
              />
            </div>

            <ImageUpload
              label="Category Image"
              value={formData.imageUrl}
              onChange={(url) => setFormData(prev => ({ ...prev, imageUrl: url }))}
              type="category"
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/dashboard/registrations/categories">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Category
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
