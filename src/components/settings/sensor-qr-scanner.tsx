import { useEffect, useId, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, Loader2 } from "lucide-react"
import { parseSensorIdFromQr } from "@/lib/parse-sensor-qr"

interface SensorQrScannerProps {
  onScan: (sensorIdSuffix: string) => void
  active: boolean
  onActiveChange: (active: boolean) => void
}

export function SensorQrScanner({ onScan, active, onActiveChange }: SensorQrScannerProps) {
  const reactId = useId()
  const scannerRegionId = `sensor-qr-reader-${reactId.replace(/:/g, "")}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onScanRef = useRef(onScan)
  const onActiveChangeRef = useRef(onActiveChange)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  onScanRef.current = onScan
  onActiveChangeRef.current = onActiveChange

  useEffect(() => {
    if (!active) return

    let cancelled = false
    const scanner = new Html5Qrcode(scannerRegionId)
    scannerRef.current = scanner
    setStarting(true)
    setError(null)

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            const parsed = parseSensorIdFromQr(decodedText)
            if (!parsed.ok) {
              setError(parsed.error)
              return
            }
            onScanRef.current(parsed.id)
            onActiveChangeRef.current(false)
          },
          () => {
            // Ignore per-frame "not found" noise
          }
        )
        if (!cancelled) setStarting(false)
      } catch (err) {
        console.error("QR scanner start failed:", err)
        if (!cancelled) {
          setStarting(false)
          setError(
            "Camera kon niet worden gestart. Controleer toestemming of voer het ID handmatig in."
          )
          onActiveChangeRef.current(false)
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      const running = scannerRef.current
      scannerRef.current = null
      if (running?.isScanning) {
        void running.stop().then(() => running.clear()).catch(() => undefined)
      } else {
        try {
          running?.clear()
        } catch {
          // Element may already be gone
        }
      }
    }
  }, [active, scannerRegionId])

  if (!active) {
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => onActiveChange(true)}
      >
        <Camera className="h-4 w-4 mr-2" />
        QR-code scannen
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Richt de camera op de QR-code op de sensor</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onActiveChange(false)}
        >
          <CameraOff className="h-4 w-4 mr-1" />
          Stop
        </Button>
      </div>

      {starting && (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Camera starten…
        </div>
      )}

      <div
        id={scannerRegionId}
        className="overflow-hidden rounded-md border bg-black/5 [&_video]:max-h-64 [&_video]:w-full [&_video]:object-cover"
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
