"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { WaiverBuilder } from "../waiver-builder"
import { Loader2 } from "lucide-react"
import type { Waiver } from "@/types/waivers"

export default function EditWaiverPage() {
  const params = useParams()
  const [waiver, setWaiver] = useState<Waiver | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWaiver = async () => {
      try {
        const response = await fetch(`/api/waivers/${params.id}`)
        if (response.ok) {
          const data = await response.json()
          setWaiver(data)
        }
      } catch (error) {
        console.error("Failed to fetch waiver:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchWaiver()
  }, [params.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!waiver) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground">Waiver not found.</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Edit Waiver</h1>
      </div>
      <WaiverBuilder waiver={waiver} />
    </div>
  )
}
