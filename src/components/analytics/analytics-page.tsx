import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Calendar,
  RefreshCw,
  Download,
  Filter,
  ArrowLeft
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useRecommendations } from '@/hooks/use-recommendations'
import { TrendAnalysis } from '@/lib/recommendation-engine'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface AnalyticsPageProps {
  onNavigate: (tab: string) => void
}

interface WaterParameterData {
  parameter_type: string
  value: number
  measured_at: string
  unit: string
}

interface ChartData {
  date: string
  [key: string]: string | number
}

export function AnalyticsPage({ onNavigate }: AnalyticsPageProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [selectedParameter, setSelectedParameter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('30')
  const [waterData, setWaterData] = useState<WaterParameterData[]>([])
  
  // Get trends from recommendations hook
  const { trends, refreshRecommendations } = useRecommendations()

  useEffect(() => {
    if (user) {
      loadWaterData()
    }
  }, [user, timeRange])

  const loadWaterData = async () => {
    try {
      setLoading(true)
      
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(timeRange))
      
      const { data, error } = await supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user?.id)
        .gte('measured_at', daysAgo.toISOString())
        .order('measured_at', { ascending: true })

      if (error) {
        console.error('Error loading water data:', error)
        return
      }

      setWaterData(data || [])
      processChartData(data || [])
    } catch (error) {
      console.error('Error in loadWaterData:', error)
    } finally {
      setLoading(false)
    }
  }

  const processChartData = (data: WaterParameterData[]) => {
    // Group data by date
    const groupedData: Record<string, Record<string, number>> = {}
    
    data.forEach(item => {
      const date = new Date(item.measured_at).toLocaleDateString('nl-NL', {
        month: 'short',
        day: 'numeric'
      })
      
      if (!groupedData[date]) {
        groupedData[date] = {}
      }
      
      // Take the latest value for each parameter on each date
      if (!groupedData[date][item.parameter_type] || 
          new Date(item.measured_at) > new Date(data.find(d => 
            d.parameter_type === item.parameter_type && 
            groupedData[date][item.parameter_type] === d.value
          )?.measured_at || 0)) {
        groupedData[date][item.parameter_type] = item.value
      }
    })

    // Convert to chart format
    const chartDataArray = Object.entries(groupedData).map(([date, params]) => ({
      date,
      ...params
    }))

    setChartData(chartDataArray)
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-500" />
      case 'stable': return <Minus className="h-4 w-4 text-gray-500" />
      default: return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return 'text-red-600'
      case 'decreasing': return 'text-green-600'
      case 'stable': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getParameterName = (param: string) => {
    const names: Record<string, string> = {
      ph: 'pH',
      temperature: 'Temperatuur',
      kh: 'KH',
      gh: 'GH',
      nitrite: 'Nitriet',
      nitrate: 'Nitraat',
      phosphate: 'Fosfaat'
    }
    return names[param] || param
  }

  const getParameterUnit = (param: string) => {
    const units: Record<string, string> = {
      ph: '',
      temperature: '°C',
      kh: '°dH',
      gh: '°dH',
      nitrite: 'mg/l',
      nitrate: 'mg/l',
      phosphate: 'mg/l'
    }
    return units[param] || ''
  }

  const filteredChartData = selectedParameter === 'all' 
    ? chartData 
    : chartData.map(item => ({
        date: item.date,
        [selectedParameter]: item[selectedParameter] || 0
      }))

  const availableParameters = Array.from(new Set(waterData.map(item => item.parameter_type)))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Analytics laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Analytics & Trends</h1>
            <p className="text-muted-foreground">
              Inzicht in waterkwaliteit trends en voorspellingen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadWaterData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Vernieuwen
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Parameter</label>
              <Select value={selectedParameter} onValueChange={setSelectedParameter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer parameter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle parameters</SelectItem>
                  {availableParameters.map(param => (
                    <SelectItem key={param} value={param}>
                      {getParameterName(param)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Tijdsperiode</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Laatste 7 dagen</SelectItem>
                  <SelectItem value="30">Laatste 30 dagen</SelectItem>
                  <SelectItem value="90">Laatste 90 dagen</SelectItem>
                  <SelectItem value="365">Laatste jaar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend Analysis */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Trend Analyse
            </CardTitle>
            <CardDescription>
              AI-gedreven trend detectie en voorspellingen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.map((trend, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{getParameterName(trend.parameter)}</h4>
                    <div className="flex items-center gap-2">
                      {getTrendIcon(trend.trend)}
                      <Badge variant="outline" className={getTrendColor(trend.trend)}>
                        {trend.trend === 'increasing' ? 'Stijgend' : 
                         trend.trend === 'decreasing' ? 'Dalend' : 'Stabiel'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verandering per dag:</span>
                      <span className="font-medium">
                        {trend.rate > 0 ? '+' : ''}{trend.rate.toFixed(2)} {getParameterUnit(trend.parameter)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Voorspelling ({trend.prediction.timeframe}):</span>
                      <span className="font-medium">
                        {trend.prediction.value.toFixed(1)} {getParameterUnit(trend.parameter)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vertrouwen:</span>
                      <span className="font-medium">
                        {Math.round(trend.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Waterkwaliteit Trends
          </CardTitle>
          <CardDescription>
            Historische data en trends over de geselecteerde periode
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      `${value} ${getParameterUnit(name)}`, 
                      getParameterName(name)
                    ]}
                    labelFormatter={(label) => `Datum: ${label}`}
                  />
                  
                  {selectedParameter === 'all' ? (
                    availableParameters.map((param, index) => (
                      <Line
                        key={param}
                        type="monotone"
                        dataKey={param}
                        stroke={`hsl(${index * 60}, 70%, 50%)`}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name={getParameterName(param)}
                      />
                    ))
                  ) : (
                    <Line
                      type="monotone"
                      dataKey={selectedParameter}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name={getParameterName(selectedParameter)}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center text-center">
              <div>
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Geen data beschikbaar</h3>
                <p className="text-muted-foreground mb-4">
                  Voeg water parameters toe om trends te zien
                </p>
                <Button onClick={() => onNavigate('parameters')}>
                  Voeg metingen toe
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      {waterData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Samenvatting Statistieken</CardTitle>
            <CardDescription>
              Overzicht van metingen over de geselecteerde periode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {waterData.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Totaal metingen
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {availableParameters.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Parameters gemeten
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {Math.round(waterData.length / parseInt(timeRange) * 10) / 10}
                </div>
                <div className="text-sm text-muted-foreground">
                  Metingen per dag
                </div>
              </div>
              
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {new Date(Math.max(...waterData.map(d => new Date(d.measured_at).getTime()))).toLocaleDateString('nl-NL')}
                </div>
                <div className="text-sm text-muted-foreground">
                  Laatste meting
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
