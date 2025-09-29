import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSensorStatus } from "@/hooks/use-sensor-status"
import { Wifi, WifiOff, RefreshCw, Clock, Activity, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface SensorStatusCardProps {
  sensorId: string
  sensorName?: string
}

export function SensorStatusCard({ sensorId, sensorName }: SensorStatusCardProps) {
  const { getSensorStatus, pingSensor, refresh } = useSensorStatus()
  const [pinging, setPinging] = useState(false)
  
  const status = getSensorStatus(sensorId)

  const handlePing = async () => {
    setPinging(true)
    try {
      const result = await pingSensor(sensorId)
      if (result.success) {
        toast.success("Ping verzonden!")
        refresh()
      } else {
        toast.error(`Ping mislukt: ${result.error}`)
      }
    } catch (error) {
      toast.error("Er is een fout opgetreden bij het pingen")
    } finally {
      setPinging(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-600" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge variant="default" className="bg-green-100 text-green-800">Online</Badge>
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>
      default:
        return <Badge variant="outline">Onbekend</Badge>
    }
  }

  const formatLastSeen = (lastSeen: string | null) => {
    if (!lastSeen) return "Nooit"
    
    const date = new Date(lastSeen)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return "zojuist"
    if (diffInMinutes < 60) return `${diffInMinutes} minuten geleden`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} uur geleden`
    
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} dagen geleden`
  }

  if (!status) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Status onbekend</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status.status)}
            <CardTitle className="text-lg">
              {sensorName || sensorId}
            </CardTitle>
          </div>
          {getStatusBadge(status.status)}
        </div>
        <CardDescription>
          Sensor status en connectiviteit
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">Laatst gezien:</span>
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatLastSeen(status.last_seen)}
            </p>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Response tijd:</span>
            <p className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {status.response_time !== null ? `${status.response_time} min` : "N/A"}
            </p>
          </div>
        </div>

        {status.status === 'offline' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Sensor is offline. Controleer de verbinding en stroomvoorziening.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handlePing}
            disabled={pinging}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${pinging ? 'animate-spin' : ''}`} />
            {pinging ? 'Pingen...' : 'Ping Sensor'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={refresh}
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Vernieuwen
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
