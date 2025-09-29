import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSensorManagement, SensorTransferRequest } from "@/hooks/use-sensor-management"
import { CheckCircle, XCircle, Clock, AlertTriangle, Wifi, Bell } from "lucide-react"
import { toast } from "sonner"

export function SensorTransferNotification() {
  const { transferRequests, respondToTransferRequest } = useSensorManagement()
  const [showNotification, setShowNotification] = useState(false)
  const [currentRequest, setCurrentRequest] = useState<SensorTransferRequest | null>(null)
  const [processedRequests, setProcessedRequests] = useState<Set<string>>(new Set())

  // Check for new transfer requests
  useEffect(() => {
    if (transferRequests && transferRequests.length > 0) {
      // Find the most recent unprocessed request
      const unprocessedRequest = transferRequests.find(
        request => !processedRequests.has(request.id) && !isExpired(request.expires_at)
      )
      
      if (unprocessedRequest) {
        setCurrentRequest(unprocessedRequest)
        setShowNotification(true)
      }
    }
  }, [transferRequests, processedRequests])

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  const handleAccept = async () => {
    if (!currentRequest) return
    
    try {
      await respondToTransferRequest(currentRequest.id, currentRequest.sensor_id, currentRequest.from_user_id, currentRequest.to_user_id, true)
      toast.success("Sensor transfer geaccepteerd!")
      setProcessedRequests(prev => new Set([...prev, currentRequest.id]))
      setShowNotification(false)
      setCurrentRequest(null)
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het accepteren van de transfer")
    }
  }

  const handleReject = async () => {
    if (!currentRequest) return
    
    try {
      await respondToTransferRequest(currentRequest.id, currentRequest.sensor_id, currentRequest.from_user_id, currentRequest.to_user_id, false)
      toast.success("Sensor transfer geweigerd!")
      setProcessedRequests(prev => new Set([...prev, currentRequest.id]))
      setShowNotification(false)
      setCurrentRequest(null)
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het weigeren van de transfer")
    }
  }

  const handleDismiss = () => {
    if (currentRequest) {
      setProcessedRequests(prev => new Set([...prev, currentRequest.id]))
    }
    setShowNotification(false)
    setCurrentRequest(null)
  }

  if (!showNotification || !currentRequest) {
    return null
  }

  return (
    <Dialog open={showNotification} onOpenChange={() => {}} modal>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Sensor Transfer Verzoek
          </DialogTitle>
          <DialogDescription>
            Iemand wil je sensor overnemen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Wifi className="h-4 w-4" />
            <AlertDescription>
              <strong>Sensor:</strong> {currentRequest.sensor_id}
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verzoeker:</span>
              <span className="font-mono">{currentRequest.from_user_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verloopt:</span>
              <span>{new Date(currentRequest.expires_at).toLocaleDateString('nl-NL')}</span>
            </div>
          </div>

          {currentRequest.message && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Bericht:</p>
              <p className="text-sm text-muted-foreground">{currentRequest.message}</p>
            </div>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Belangrijk:</strong> Als je dit accepteert, wordt de sensor overgedragen aan de nieuwe eigenaar. 
              Historische data blijft bij jou, nieuwe data wordt verzameld voor de nieuwe eigenaar.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleReject}
            className="text-red-600 hover:text-red-700"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Weigeren
          </Button>
          <Button
            onClick={handleAccept}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Accepteren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
