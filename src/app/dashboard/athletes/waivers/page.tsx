"use client"

import { useEffect, useState } from "react"
import { WaiverTable } from "./waiver-table"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Waiver } from "@/types/waivers"

export default function WaiversPage() {
  const [waivers, setWaivers] = useState<Waiver[]>([])
  const [loading, setLoading] = useState(true)

  const fetchWaivers = async () => {
    try {
      const response = await fetch("/api/waivers")
      if (response.ok) {
        const data = await response.json()
        setWaivers(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch waivers:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWaivers()
  }, [])

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/waivers/${id}`, { method: "DELETE" })
      if (response.ok) {
        setWaivers((prev) => prev.filter((w) => w.id !== id))
      }
    } catch (error) {
      console.error("Failed to delete waiver:", error)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Waivers</h1>
          <p className="text-muted-foreground">
            Create and manage waivers for athletes and families.
          </p>
        </div>
        <Button asChild>
          <a href="/dashboard/athletes/waivers/new">
            <Plus className="mr-2 h-4 w-4" /> Create Waiver
          </a>
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <WaiverTable data={waivers} onDelete={handleDelete} />
      )}
    </div>
  )
}
