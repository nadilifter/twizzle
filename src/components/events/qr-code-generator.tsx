"use client"

import { QRCodeSVG } from "qrcode.react"

interface QRCodePayload {
  athleteId: string
  eventId?: string
  timestamp: number
}

interface QRCodeGeneratorProps {
  athleteId: string
  eventId?: string
  athleteName?: string
  size?: number
}

export function generateQRPayload(athleteId: string, eventId?: string): string {
  const payload: QRCodePayload = {
    athleteId,
    eventId,
    timestamp: Date.now(),
  }
  return JSON.stringify(payload)
}

export function parseQRPayload(data: string): QRCodePayload | null {
  try {
    const parsed = JSON.parse(data)
    if (parsed.athleteId && typeof parsed.athleteId === "string") {
      return parsed as QRCodePayload
    }
    return null
  } catch {
    return null
  }
}

export function QRCodeGenerator({ 
  athleteId, 
  eventId, 
  athleteName,
  size = 200 
}: QRCodeGeneratorProps) {
  const payload = generateQRPayload(athleteId, eventId)
  
  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-lg">
      <QRCodeSVG
        value={payload}
        size={size}
        level="M"
        includeMargin
        bgColor="#ffffff"
        fgColor="#000000"
      />
      {athleteName && (
        <p className="text-sm font-medium text-center">{athleteName}</p>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Scan this code for quick check-in
      </p>
    </div>
  )
}
