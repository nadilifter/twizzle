"use client"

import { useEffect, useState } from "react"
import { WaiverTable } from "./waiver-table"
import { Loader2 } from "lucide-react"
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
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Waivers</h1>
      </div>
      <div className="flex-1 rounded-xl md:min-h-min">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <WaiverTable data={waivers} onDelete={handleDelete} />
        )}
      </div>
    </div>
  )
}
