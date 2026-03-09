"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { DataTable } from "@/components/data-table/data-table"
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header"
import {
  Image,
  Video,
  Music,
  FileText,
  File,
  Trash2,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

export interface StorageFile {
  id: string
  name: string
  fileSize: number
  type: "media" | "registration"
  category: "image" | "video" | "audio" | "document" | "other"
  source: string
  uploadedBy: string
  createdAt: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const categoryIcons: Record<string, typeof File> = {
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  other: File,
}

const categoryColors: Record<string, string> = {
  image: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  video: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  audio: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  document: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
}

function DeleteButton({ file, onDeleted }: { file: StorageFile; onDeleted: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const endpoint = file.type === "media"
        ? `/api/media/${file.id}`
        : `/api/registration-files/${file.id}`
      const res = await fetch(endpoint, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete file")
      }
      toast.success(`Deleted ${file.name}`)
      onDeleted()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete file")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete file</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{file.name}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function StorageFilesTable({ files }: { files: StorageFile[] }) {
  const router = useRouter()

  function handleDeleted() {
    router.refresh()
  }

  const columns: ColumnDef<StorageFile>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="File Name" />,
      cell: ({ row }) => {
        const Icon = categoryIcons[row.original.category] || File
        return (
          <div className="flex items-center gap-2 max-w-[240px]">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{row.original.name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "category",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => (
        <Badge variant="secondary" className={categoryColors[row.original.category]}>
          {row.original.category}
        </Badge>
      ),
    },
    {
      accessorKey: "fileSize",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Size" />,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{formatBytes(row.original.fileSize)}</span>
      ),
    },
    {
      accessorKey: "source",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
          {row.original.source}
        </span>
      ),
    },
    {
      accessorKey: "uploadedBy",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Uploaded By" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.uploadedBy}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => <DeleteButton file={row.original} onDeleted={handleDeleted} />,
    },
  ]

  return <DataTable columns={columns} data={files} pageSize={15} />
}
