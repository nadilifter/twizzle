"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Plus, Search, Loader2, AlertCircle, Pencil, Trash2,
  BookOpen, CalendarDays, Trophy, ImageIcon,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useCategories } from "@/hooks/use-categories"
import { useFeatures } from "@/components/feature-context"
import { toast } from "sonner"

export default function CategoriesPage() {
  const { categories, isLoading, isDeleting, error, fetchCategories, deleteCategory } = useCategories()
  const { isFeatureEnabled } = useFeatures()
  const competitionsEnabled = isFeatureEnabled("competitions")
  const [searchTerm, setSearchTerm] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchCategories({ search: searchTerm })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm, fetchCategories])

  const handleDelete = async (id: string) => {
    const success = await deleteCategory(id)
    if (success) {
      toast.success("Category deleted")
    } else {
      toast.error("Failed to delete category")
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Group your programs, events, and competitions into categories for your marketing site.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/registrations/categories/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search categories..."
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading && categories.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-64 text-destructive">
          <AlertCircle className="mr-2 h-6 w-6" />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="flex flex-col overflow-hidden">
              {category.imageUrl ? (
                <div className="relative aspect-video w-full bg-muted">
                  <Image
                    src={category.imageUrl}
                    alt={category.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-video w-full bg-muted">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="leading-tight">{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 pb-3">
                {category.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {category.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="h-3 w-3" />
                    {category._count.programs} {category._count.programs === 1 ? "Program" : "Programs"}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {category._count.events} {category._count.events === 1 ? "Event" : "Events"}
                  </Badge>
                  {competitionsEnabled && (
                    <Badge variant="secondary" className="gap-1">
                      <Trophy className="h-3 w-3" />
                      {category._count.competitions} {category._count.competitions === 1 ? "Competition" : "Competitions"}
                    </Badge>
                  )}
                </div>
              </CardContent>
              <CardFooter className="border-t pt-3 gap-2">
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={`/dashboard/registrations/categories/${category.id}`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={isDeleting}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete category?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the category &ldquo;{category.name}&rdquo;. Programs, events, and competitions
                        in this category will become uncategorized.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(category.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {searchTerm ? "No categories match your search." : "No categories found. Create one to get started."}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
