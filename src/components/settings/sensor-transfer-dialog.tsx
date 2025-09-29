import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSensorManagement, SensorTransferRequest } from "@/hooks/use-sensor-management"
import { CheckCircle, XCircle, Clock, AlertTriangle, Wifi } from "lucide-react"
import { toast } from "sonner"

interface SensorTransferDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SensorTransferDialog({ isOpen, onClose }: SensorTransferDialogProps) {
  const { pendingRequests, handleTransferRequest, refreshRequests } = useSensorManagement()
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  const handleAccept = async (request: SensorTransferRequest) => {
    setProcessingRequest(request.id)
    try {
      await handleTransferRequest(request.id, true)
      toast.success("Sensor transfer geaccepteerd!")
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het accepteren van de transfer")
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleReject = async (request: SensorTransferRequest) => {
    setProcessingRequest(request.id)
    try {
      await handleTransferRequest(request.id, false)
      toast.success("Sensor transfer geweigerd!")
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het weigeren van de transfer")
    } finally {
      setProcessingRequest(null)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const requestTime = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - requestTime.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return "zojuist"
    if (diffInMinutes < 60) return `${diffInMinutes} minuten geleden`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} uur geleden`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} dagen geleden`
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  useEffect(() => {
    if (isOpen) {
      refreshRequests()
    }
  }, [isOpen, refreshRequests])

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Sensor Transfer Verzoeken
          </DialogTitle>
          <DialogDescription>
            Beheer verzoeken om sensoren over te nemen van andere gebruikers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Geen openstaande verzoeken</h3>
                  <p className="text-muted-foreground">
                    Er zijn momenteel geen sensor transfer verzoeken die aandacht vereisen.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id} className={`${isExpired(request.expires_at) ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-blue-600">📡</span>
                      Sensor: {request.sensor_id}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={isExpired(request.expires_at) ? "destructive" : "secondary"}>
                        {isExpired(request.expires_at) ? "Verlopen" : "Actief"}
                      </Badge>
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatTimeAgo(request.created_at)}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Verzoek van gebruiker om sensor over te nemen
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-muted-foreground">Verzoeker:</span>
                      <p className="font-mono text-sm">{request.from_user_id}</p>
                    </div>
                    <div>
                      <span className="font-medium text-muted-foreground">Verloopt:</span>
                      <p className="text-sm">{new Date(request.expires_at).toLocaleDateString('nl-NL')}</p>
                    </div>
                  </div>

                  {request.message && (
                    <div>
                      <span className="font-medium text-muted-foreground text-sm">Bericht:</span>
                      <p className="text-sm mt-1 p-2 bg-white rounded border">
                        {request.message}
                      </p>
                    </div>
                  )}

                  {isExpired(request.expires_at) && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Dit verzoek is verlopen. Je kunt het niet meer accepteren.
                      </AlertDescription>
                    </Alert>
                  )}

                  {!isExpired(request.expires_at) && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-sm text-muted-foreground">
                        <p>• Historische data blijft bij de huidige eigenaar</p>
                        <p>• Nieuwe data wordt verzameld voor de nieuwe eigenaar</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request)}
                          disabled={processingRequest === request.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Weigeren
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(request)}
                          disabled={processingRequest === request.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accepteren
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Sluiten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
