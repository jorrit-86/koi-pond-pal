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
  ArrowLeft,
  FileText
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import { ReportDialog } from './report-dialog'
import jsPDF from 'jspdf'
// @ts-ignore - jspdf-autotable doesn't have proper TypeScript definitions
import autoTable from 'jspdf-autotable'
import html2canvas from 'html2canvas'

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
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  

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

  // Helper function to convert HSL to RGB for PDF
  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    s /= 100
    l /= 100
    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs((h / 60) % 2 - 1))
    const m = l - c / 2
    let r = 0, g = 0, b = 0

    if (0 <= h && h < 60) {
      r = c; g = x; b = 0
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x
    }
    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)
    return [r, g, b]
  }

  const filteredChartData = selectedParameter === 'all' 
    ? chartData 
    : chartData.map(item => ({
        date: item.date,
        [selectedParameter]: item[selectedParameter] || 0
      }))

  const availableParameters = Array.from(new Set(waterData.map(item => item.parameter_type)))

  const generatePDFReport = async (reportTimeRange: string) => {
    try {
      setGeneratingReport(true)

      // Fetch data for the selected report period
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(reportTimeRange))
      
      const { data: reportData, error } = await supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user?.id)
        .gte('measured_at', daysAgo.toISOString())
        .order('measured_at', { ascending: true })

      if (error) {
        console.error('Error loading report data:', error)
        alert('Er is een fout opgetreden bij het laden van de data.')
        return
      }

      if (!reportData || reportData.length === 0) {
        alert('Geen data beschikbaar voor de geselecteerde periode.')
        setReportDialogOpen(false)
        return
      }

      // Create PDF
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      let yPosition = margin

      // Header - compact
      doc.setFontSize(16)
      doc.setTextColor(37, 99, 235) // Blue color
      doc.text('Waterkwaliteit Rapport', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 6

      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      const periodText = reportTimeRange === '7' ? 'Laatste 7 dagen' :
                        reportTimeRange === '30' ? 'Laatste 30 dagen' :
                        reportTimeRange === '90' ? 'Laatste 90 dagen' : 'Laatste jaar'
      doc.text(periodText, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 4

      const generatedDate = new Date().toLocaleDateString('nl-NL', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      doc.setFontSize(8)
      doc.text(`Gegenereerd: ${generatedDate}`, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 8

      // Summary statistics - compact grid layout
      doc.setFontSize(11)
      doc.setTextColor(0, 0, 0)
      doc.text('Samenvatting', margin, yPosition)
      yPosition += 5

      doc.setFontSize(8)
      const totalMeasurements = reportData.length
      const uniqueParameters = Array.from(new Set(reportData.map(item => item.parameter_type)))
      const measurementsPerDay = (totalMeasurements / parseInt(reportTimeRange)).toFixed(1)
      const firstMeasurement = reportData[0] ? new Date(reportData[0].measured_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }) : 'N/A'
      const lastMeasurement = reportData[reportData.length - 1] ? new Date(reportData[reportData.length - 1].measured_at).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' }) : 'N/A'

      // Two column layout for summary
      const col1X = margin
      const col2X = pageWidth / 2 + 5
      const lineHeight = 4.5

      doc.text(`Totaal: ${totalMeasurements}`, col1X, yPosition)
      doc.text(`Parameters: ${uniqueParameters.length}`, col2X, yPosition)
      yPosition += lineHeight
      doc.text(`Per dag: ${measurementsPerDay}`, col1X, yPosition)
      doc.text(`${firstMeasurement} - ${lastMeasurement}`, col2X, yPosition)
      yPosition += 6

      // Parameter statistics table
      const parameterStats: Record<string, { min: number; max: number; avg: number; count: number }> = {}
      
      reportData.forEach(item => {
        if (!parameterStats[item.parameter_type]) {
          parameterStats[item.parameter_type] = {
            min: item.value,
            max: item.value,
            avg: 0,
            count: 0
          }
        }
        const stats = parameterStats[item.parameter_type]
        stats.min = Math.min(stats.min, item.value)
        stats.max = Math.max(stats.max, item.value)
        stats.avg += item.value
        stats.count += 1
      })

      // Calculate averages
      Object.keys(parameterStats).forEach(param => {
        parameterStats[param].avg = parameterStats[param].avg / parameterStats[param].count
      })

      // Parameter statistics section - compact
      doc.setFontSize(11)
      doc.text('Parameter Statistieken', margin, yPosition)
      yPosition += 5

      // Create table data
      const tableData = Object.entries(parameterStats).map(([param, stats]) => [
        getParameterName(param),
        stats.min.toFixed(1) + getParameterUnit(param),
        stats.max.toFixed(1) + getParameterUnit(param),
        stats.avg.toFixed(1) + getParameterUnit(param),
        stats.count.toString()
      ])

      autoTable(doc, {
        head: [['Parameter', 'Min', 'Max', 'Gem.', 'Aantal']],
        body: tableData,
        startY: yPosition,
        margin: { left: margin, right: margin, top: 0 },
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        tableWidth: 'auto'
      })

      yPosition = (doc as any).lastAutoTable.finalY + 8

      // Chart section - process data for chart
      doc.setFontSize(11)
      doc.text('Waterkwaliteit Trends', margin, yPosition)
      yPosition += 5

      // Process chart data similar to processChartData function
      const chartGroupedData: Record<string, Record<string, number>> = {}
      
      reportData.forEach(item => {
        const date = new Date(item.measured_at).toLocaleDateString('nl-NL', {
          month: 'short',
          day: 'numeric'
        })
        
        if (!chartGroupedData[date]) {
          chartGroupedData[date] = {}
        }
        
        // Take the latest value for each parameter on each date
        if (!chartGroupedData[date][item.parameter_type] || 
            new Date(item.measured_at) > new Date(reportData.find(d => 
              d.parameter_type === item.parameter_type && 
              chartGroupedData[date][item.parameter_type] === d.value
            )?.measured_at || 0)) {
          chartGroupedData[date][item.parameter_type] = item.value
        }
      })

      // Convert to chart format
      const chartDataForPDF = Object.entries(chartGroupedData).map(([date, params]) => ({
        date,
        ...params
      }))

      // Create a temporary container for the chart - smaller for single page
      const chartContainer = document.createElement('div')
      chartContainer.style.position = 'absolute'
      chartContainer.style.left = '-9999px'
      chartContainer.style.top = '0px'
      chartContainer.style.width = '700px'
      chartContainer.style.height = '350px'
      chartContainer.style.backgroundColor = '#ffffff'
      chartContainer.style.padding = '10px'
      chartContainer.style.boxSizing = 'border-box'
      document.body.appendChild(chartContainer)

      // Render chart in the container
      const chartElement = document.createElement('div')
      chartElement.style.width = '100%'
      chartElement.style.height = '100%'
      chartContainer.appendChild(chartElement)

      // Create React element for the chart - compact for single page
      const ChartComponent = (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#ffffff' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartDataForPDF} margin={{ top: 5, right: 5, left: 5, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 8 }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 8 }} />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  `${value} ${getParameterUnit(name)}`, 
                  getParameterName(name)
                ]}
                labelFormatter={(label) => `Datum: ${label}`}
              />
              <Legend 
                wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }}
                iconType="line"
                formatter={(value) => getParameterName(value)}
              />
              {uniqueParameters.map((param, index) => (
                <Line
                  key={param}
                  type="monotone"
                  dataKey={param}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                  name={getParameterName(param)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )

      // Render chart using React
      const ReactDOM = await import('react-dom/client')
      const root = ReactDOM.createRoot(chartElement)
      root.render(ChartComponent)

      // Wait for chart to render (give recharts time to draw)
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Convert chart to image
      const canvas = await html2canvas(chartContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false
      })

      // Calculate image dimensions for PDF - fit remaining space on page
      const maxWidth = pageWidth - (margin * 2)
      const availableHeight = pageHeight - yPosition - 15 // Leave space for footer
      const imgWidth = maxWidth
      const imgHeight = Math.min(availableHeight, (canvas.height / canvas.width) * imgWidth)

      // Add chart image to PDF
      const imgData = canvas.toDataURL('image/png')
      doc.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight)

      // Clean up
      document.body.removeChild(chartContainer)
      root.unmount()

      // Add legend below chart if there's space
      const legendY = yPosition + imgHeight + 5
      if (legendY < pageHeight - 20) {
        doc.setFontSize(7)
        doc.setTextColor(0, 0, 0)
        
        // Calculate legend items per row
        const legendItemWidth = 35
        const itemsPerRow = Math.floor((pageWidth - (margin * 2)) / legendItemWidth)
        let currentX = margin
        let currentY = legendY
        let itemsInRow = 0

        uniqueParameters.forEach((param, index) => {
          if (itemsInRow >= itemsPerRow) {
            currentX = margin
            currentY += 4
            itemsInRow = 0
          }

          // Draw colored line/box for legend
          const color = `hsl(${index * 60}, 70%, 50%)`
          const rgb = hslToRgb(index * 60, 70, 50)
          doc.setDrawColor(rgb[0], rgb[1], rgb[2])
          doc.setFillColor(rgb[0], rgb[1], rgb[2])
          doc.rect(currentX, currentY, 8, 2, 'F')
          
          // Add parameter name
          doc.setTextColor(0, 0, 0)
          doc.text(getParameterName(param), currentX + 10, currentY + 1.5)
          
          currentX += legendItemWidth
          itemsInRow++
        })
      }

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text(
        `Gegenereerd op ${new Date().toLocaleDateString('nl-NL')}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      )

      // Save PDF
      const fileName = `waterkwaliteit-rapport-${periodText.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)

      setReportDialogOpen(false)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Er is een fout opgetreden bij het genereren van het rapport.')
    } finally {
      setGeneratingReport(false)
    }
  }

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")} className="h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Analytics & Trends</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Inzicht in waterkwaliteit trends en voorspellingen
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadWaterData} className="h-8 sm:h-9 text-xs sm:text-sm">
            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Vernieuwen</span>
            <span className="sm:hidden">Refresh</span>
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={() => setReportDialogOpen(true)}
            className="h-8 sm:h-9 text-xs sm:text-sm"
          >
            <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Rapport</span>
            <span className="sm:hidden">Rapport</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <label className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 block">Parameter</label>
              <Select value={selectedParameter} onValueChange={setSelectedParameter}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
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
              <label className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 block">Tijdsperiode</label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
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


      {/* Charts */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Waterkwaliteit Trends
          </CardTitle>
          <CardDescription className="text-sm">
            Historische data en trends over de geselecteerde periode
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {chartData.length > 0 ? (
            <div className="h-64 sm:h-80 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, sm: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 10, sm: 12 }} />
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
            <div className="h-64 sm:h-80 lg:h-96 flex items-center justify-center text-center">
              <div>
                <BarChart3 className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">Geen data beschikbaar</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                  Voeg water parameters toe om trends te zien
                </p>
                <Button onClick={() => onNavigate('parameters')} className="h-8 sm:h-9 text-xs sm:text-sm">
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
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-lg sm:text-xl">Samenvatting Statistieken</CardTitle>
            <CardDescription className="text-sm">
              Overzicht van metingen over de geselecteerde periode
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {waterData.length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Totaal metingen
                </div>
              </div>
              
              <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {availableParameters.length}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Parameters gemeten
                </div>
              </div>
              
              <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {Math.round(waterData.length / parseInt(timeRange) * 10) / 10}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Metingen per dag
                </div>
              </div>
              
              <div className="text-center p-3 sm:p-4 bg-muted rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">
                  {new Date(Math.max(...waterData.map(d => new Date(d.measured_at).getTime()))).toLocaleDateString('nl-NL')}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Laatste meting
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Dialog */}
      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        onGenerateReport={generatePDFReport}
        loading={generatingReport}
      />
    </div>
  )
}
