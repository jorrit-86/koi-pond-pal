import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { ArrowLeft, Waves, TrendingUp, Calendar, Droplets, BarChart3, PieChart } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"

interface WaterChange {
  id: string
  liters_added: number
  water_type: string
  reason: string
  notes?: string
  changed_at: string
  created_at: string
}

interface WaterChangeStats {
  totalChanges: number
  totalLiters: number
  averageLiters: number
  lastChange: string
  changesThisMonth: number
  changesThisWeek: number
  mostCommonReason: string
  mostCommonWaterType: string
}

interface WaterChangeHistoryProps {
  onNavigate: (page: string) => void
}

export function WaterChangeHistory({ onNavigate }: WaterChangeHistoryProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [waterChanges, setWaterChanges] = useState<WaterChange[]>([])
  const [stats, setStats] = useState<WaterChangeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pondSize, setPondSize] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      loadWaterChanges()
      loadPondSize()
    }
  }, [user])

  const loadWaterChanges = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('water_changes')
        .select('*')
        .eq('user_id', user?.id)
        .order('changed_at', { ascending: false })

      if (error) {
        throw error
      }

      setWaterChanges(data || [])
      calculateStats(data || [])
    } catch (error) {
      console.error('Error loading water changes:', error)
      toast({
        title: "Fout bij laden",
        description: "Er is een fout opgetreden bij het laden van de waterwissels.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPondSize = async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('pond_size_liters')
        .eq('user_id', user?.id)
        .single()

      if (!error && data) {
        setPondSize(data.pond_size_liters)
      } else {
        setPondSize(1000) // Default 1000 liters
      }
    } catch (error) {
      console.error('Error loading pond size:', error)
    }
  }

  const calculateStats = (changes: WaterChange[]) => {
    if (changes.length === 0) {
      setStats({
        totalChanges: 0,
        totalLiters: 0,
        averageLiters: 0,
        lastChange: 'Geen',
        changesThisMonth: 0,
        changesThisWeek: 0,
        mostCommonReason: 'Geen',
        mostCommonWaterType: 'Geen'
      })
      return
    }

    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const changesThisMonth = changes.filter(c => new Date(c.changed_at) >= thisMonth).length
    const changesThisWeek = changes.filter(c => new Date(c.changed_at) >= thisWeek).length

    const totalLiters = changes.reduce((sum, change) => sum + change.liters_added, 0)
    const averageLiters = totalLiters / changes.length

    // Most common reason
    const reasonCounts = changes.reduce((acc, change) => {
      acc[change.reason] = (acc[change.reason] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const mostCommonReason = Object.entries(reasonCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]

    // Most common water type
    const waterTypeCounts = changes.reduce((acc, change) => {
      acc[change.water_type] = (acc[change.water_type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    const mostCommonWaterType = Object.entries(waterTypeCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0]

    setStats({
      totalChanges: changes.length,
      totalLiters,
      averageLiters,
      lastChange: changes[0]?.changed_at || 'Geen',
      changesThisMonth,
      changesThisWeek,
      mostCommonReason,
      mostCommonWaterType
    })
  }

  const formatTimeDifference = (timestamp: string) => {
    const updateTime = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - updateTime.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) return "Zojuist"
    if (diffMinutes < 60) return `${diffMinutes} min geleden`
    if (diffHours < 24) return `${diffHours} uur geleden`
    return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`
  }

  const getWaterTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'tap_water': 'Kraanwater',
      'well_water': 'Putwater',
      'rain_water': 'Regenwater',
      'ro_water': 'RO water',
      'mixed': 'Gemengd'
    }
    return labels[type] || type
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      'routine': 'Routine onderhoud',
      'problem': 'Probleem opgelost',
      'emergency': 'Noodgeval',
      'seasonal': 'Seizoensgebonden',
      'maintenance': 'Onderhoud',
      'other': 'Anders'
    }
    return labels[reason] || reason
  }

  const getPercentage = (liters: number) => {
    if (!pondSize || pondSize === 0) return null
    return ((liters / pondSize) * 100).toFixed(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate('dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-2">
              <Waves className="h-6 w-6 text-blue-600" />
              <span>Waterwissel Historie</span>
            </h1>
            <p className="text-muted-foreground">Overzicht van alle waterwissels</p>
          </div>
        </div>
        <Button onClick={() => onNavigate('water-change')}>
          <Waves className="h-4 w-4 mr-2" />
          Nieuwe Waterwissel
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Totaal Waterwissels</p>
                  <p className="text-2xl font-bold">{stats.totalChanges}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Droplets className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Totaal Liters</p>
                  <p className="text-2xl font-bold">{stats.totalLiters.toLocaleString('nl-NL')}L</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Gemiddeld per Wissel</p>
                  <p className="text-2xl font-bold">{stats.averageLiters.toFixed(0)}L</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm text-gray-600">Deze Maand</p>
                  <p className="text-2xl font-bold">{stats.changesThisMonth}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional Stats */}
      {stats && stats.totalChanges > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meest Gebruikte Watertype</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-blue-600">
                  {getWaterTypeLabel(stats.mostCommonWaterType)}
                </Badge>
                <span className="text-sm text-gray-600">
                  Meest gebruikt in {stats.totalChanges} waterwissels
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meest Voorkomende Reden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-green-600">
                  {getReasonLabel(stats.mostCommonReason)}
                </Badge>
                <span className="text-sm text-gray-600">
                  Meest voorkomende reden
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Water Changes List */}
      <Card>
        <CardHeader>
          <CardTitle>Alle Waterwissels</CardTitle>
          <CardDescription>
            Chronologische lijst van alle waterwissels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waterChanges.length === 0 ? (
            <div className="text-center py-8">
              <Waves className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">Geen waterwissels</h3>
              <p className="text-gray-500 mb-4">Je hebt nog geen waterwissels geregistreerd.</p>
              <Button onClick={() => onNavigate('water-change')}>
                <Waves className="h-4 w-4 mr-2" />
                Eerste Waterwissel Registreren
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {waterChanges.map((change) => (
                <div key={change.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-lg">{change.liters_added}L</h3>
                      {pondSize && (
                        <Badge variant="secondary" className="text-blue-600">
                          {getPercentage(change.liters_added)}% van vijver
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTimeDifference(change.changed_at)}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <div className="flex items-center space-x-1">
                      <Droplets className="h-4 w-4 text-blue-600" />
                      <span>{getWaterTypeLabel(change.water_type)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4 text-green-600" />
                      <span>{getReasonLabel(change.reason)}</span>
                    </div>
                  </div>
                  
                  {change.notes && (
                    <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                      {change.notes}
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-400">
                    {new Date(change.changed_at).toLocaleString('nl-NL')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
