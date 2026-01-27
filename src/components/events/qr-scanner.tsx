"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Camera, CameraOff, RefreshCw } from "lucide-react"

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  width?: number
  height?: number
}

export function QRScanner({ onScan, onError, width = 300, height = 300 }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastScanRef = useRef<string>("")
  const lastScanTimeRef = useRef<number>(0)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop()
        }
      } catch (e) {
        // Ignore stop errors
        console.log("Scanner stop error:", e)
      }
    }
    setIsScanning(false)
  }, [])

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return
    
    setError(null)
    
    try {
      // Initialize scanner if not already done
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader")
      }

      // Check if already scanning
      const state = scannerRef.current.getState()
      if (state === Html5QrcodeScannerState.SCANNING) {
        return
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Debounce: prevent rapid duplicate scans
          const now = Date.now()
          if (decodedText === lastScanRef.current && now - lastScanTimeRef.current < 3000) {
            return
          }
          lastScanRef.current = decodedText
          lastScanTimeRef.current = now
          
          // Play success sound/vibration if available
          if (navigator.vibrate) {
            navigator.vibrate(200)
          }
          
          onScan(decodedText)
        },
        () => {
          // QR code scanning in progress (not found yet)
        }
      )
      
      setIsScanning(true)
      setHasPermission(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to start camera"
      setError(errorMessage)
      setHasPermission(false)
      onError?.(errorMessage)
    }
  }, [onScan, onError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [stopScanner])

  // Auto-start scanner
  useEffect(() => {
    const timer = setTimeout(() => {
      startScanner()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [startScanner])

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden"
        style={{ width, height }}
      >
        <div id="qr-reader" className="w-full h-full" />
        
        {!isScanning && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center text-white">
              <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Starting camera...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90">
            <div className="text-center text-white p-4">
              <CameraOff className="h-12 w-12 mx-auto mb-2 text-red-400" />
              <p className="text-sm mb-4">{error}</p>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={startScanner}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {isScanning && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Scanning for QR codes...
        </div>
      )}
      
      <div className="flex gap-2">
        {isScanning ? (
          <Button variant="outline" onClick={stopScanner} className="gap-2">
            <CameraOff className="h-4 w-4" />
            Stop Camera
          </Button>
        ) : (
          <Button onClick={startScanner} className="gap-2">
            <Camera className="h-4 w-4" />
            Start Camera
          </Button>
        )}
      </div>
    </div>
  )
}
