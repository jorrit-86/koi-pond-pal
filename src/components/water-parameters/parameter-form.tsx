import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhotoUpload } from "@/components/ui/photo-upload"
import { useState } from "react"
import { Droplets, Save, History, Camera, ArrowLeft, Timer, Play, Pause, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { useSensorManagement } from "@/hooks/use-sensor-management"
import { usePendingWaterParametersTask } from "@/hooks/use-pending-water-parameters-task"
import { useParameterTimers } from "@/hooks/use-parameter-timers"

interface WaterReading {
  ph: string
  kh: string
  gh: string
  nitrite: string
  nitrate: string
  phosphate: string
  ammonia: string
  temperature: string
  notes: string
  test_strip_photo?: string
  measured_at?: string
}

interface ParameterFormProps {
  onNavigate: (tab: string) => void
  onDataSaved?: () => void // Callback to refresh dashboard
}

export function ParameterForm({ onNavigate, onDataSaved }: ParameterFormProps) {
  const { toast } = useToast()
  const { user, session } = useAuth()
  const { uploadPhoto, uploading } = usePhotoUpload()
  const { sensors } = useSensorManagement()
  const { completePendingTask } = usePendingWaterParametersTask()
  const { timerConfigs, timerStates, startTimer, stopTimer, resetTimer } = useParameterTimers()
  const [reading, setReading] = useState<WaterReading>({
    ph: "",
    kh: "",
    gh: "",
    nitrite: "",
    nitrate: "",
    phosphate: "",
    ammonia: "",
    temperature: "",
    notes: "",
    test_strip_photo: "",
    measured_at: (() => {
      // Use local time instead of UTC for initial value
      const now = new Date()
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      return localDateTime.toISOString().slice(0, 16)
    })() // Format: YYYY-MM-DDTHH:MM
  })
  const [saving, setSaving] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)

  // Check if user has an active temperature sensor
  const hasActiveTemperatureSensor = sensors.some(sensor => sensor.status === 'active')

  // Helper function to format time
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleInputChange = (field: keyof WaterReading, value: string) => {
    setReading(prev => ({ ...prev, [field]: value }))
  }

  const handleTestStripPhoto = async (photoUrl: string, photoFile: File) => {
    try {
      const result = await uploadPhoto(photoFile, 'water-tests')
      if (result) {
        setReading(prev => ({ ...prev, test_strip_photo: result.url }))
      }
    } catch (error) {
      console.error('Error uploading test strip photo:', error)
    }
  }

  const handleSave = async () => {
    // Validate required fields - only require temperature if no active sensor
    const requiredFields = ['ph']
    if (!hasActiveTemperatureSensor) {
      requiredFields.push('temperature')
    }
    
    const missingFields = requiredFields.filter(field => !reading[field as keyof WaterReading])
    
    if (missingFields.length > 0) {
      const fieldNames = missingFields.map(field => 
        field === 'ph' ? 'pH' : 
        field === 'temperature' ? 'temperatuur' : 
        field
      ).join(' en ')
      
      toast({
        title: "Ontbrekende informatie",
        description: `Vul ten minste ${fieldNames} waarden in.`,
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Authenticatie vereist",
        description: "Je moet ingelogd zijn om water parameters op te slaan.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      // Check if Supabase has a session (needed for both sensor fetch and parameter save)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // Fetch latest sensor temperature if active sensor is available
      let sensorTemperature: number | null = null
      if (hasActiveTemperatureSensor) {
        try {
          if (currentSession) {
            // Use Supabase query
            const { data: sensorData, error: sensorError } = await supabase
              .from('sensor_data')
              .select('temperature, sensor_id, created_at')
              .eq('user_id', user.id)
              .eq('sensor_type', 'temperatuurmeter')
              .order('created_at', { ascending: false })
              .limit(50)

            if (!sensorError && sensorData && sensorData.length > 0) {
              // Find vijver water sensor (ends with -01)
              const vijverSensor = sensorData.find((item: any) => item.sensor_id?.endsWith('-01'))
              if (vijverSensor && vijverSensor.temperature != null) {
                sensorTemperature = parseFloat(vijverSensor.temperature)
                console.log('Latest sensor temperature found:', sensorTemperature)
              } else {
                // Fallback: use the most recent sensor reading if no -01 sensor found
                const latestSensor = sensorData[0]
                if (latestSensor && latestSensor.temperature != null) {
                  sensorTemperature = parseFloat(latestSensor.temperature)
                  console.log('Using latest sensor temperature (fallback):', sensorTemperature)
                }
              }
            }
          } else if (session?.access_token) {
            // Use direct fetch if no Supabase session
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4'
            
            const response = await fetch(
              `${supabaseUrl}/rest/v1/sensor_data?user_id=eq.${user.id}&sensor_type=eq.temperatuurmeter&select=temperature,sensor_id,created_at&order=created_at.desc&limit=50`,
              {
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )
            
            if (response.ok) {
              const sensorData = await response.json()
              if (sensorData && sensorData.length > 0) {
                // Find vijver water sensor (ends with -01)
                const vijverSensor = sensorData.find((item: any) => item.sensor_id?.endsWith('-01'))
                if (vijverSensor && vijverSensor.temperature != null) {
                  sensorTemperature = parseFloat(vijverSensor.temperature)
                  console.log('Latest sensor temperature found (direct fetch):', sensorTemperature)
                } else {
                  // Fallback: use the most recent sensor reading if no -01 sensor found
                  const latestSensor = sensorData[0]
                  if (latestSensor && latestSensor.temperature != null) {
                    sensorTemperature = parseFloat(latestSensor.temperature)
                    console.log('Using latest sensor temperature (fallback, direct fetch):', sensorTemperature)
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Error fetching sensor temperature:', error)
          // Continue without sensor temperature if fetch fails
        }
      }

      // Prepare data for database insertion
      const parametersToSave = [
        { type: 'ph', value: parseFloat(reading.ph), unit: '' },
        // Add sensor temperature if available (always add when sensor is active)
        ...(hasActiveTemperatureSensor && sensorTemperature != null ? [{ type: 'temperature', value: sensorTemperature, unit: '°C' }] : []),
        // Add manual temperature only if no active sensor
        ...(reading.temperature && !hasActiveTemperatureSensor ? [{ type: 'temperature', value: parseFloat(reading.temperature), unit: '°C' }] : []),
        ...(reading.kh ? [{ type: 'kh', value: parseFloat(reading.kh), unit: '°dH' }] : []),
        ...(reading.gh ? [{ type: 'gh', value: parseFloat(reading.gh), unit: '°dH' }] : []),
        ...(reading.nitrite ? [{ type: 'nitrite', value: parseFloat(reading.nitrite), unit: 'mg/l' }] : []),
        ...(reading.nitrate ? [{ type: 'nitrate', value: parseFloat(reading.nitrate), unit: 'mg/l' }] : []),
        ...(reading.phosphate ? [{ type: 'phosphate', value: parseFloat(reading.phosphate), unit: 'mg/l' }] : []),
        ...(reading.ammonia ? [{ type: 'ammonia', value: parseFloat(reading.ammonia), unit: 'mg/l' }] : []),
      ]
      
      const measuredAt = reading.measured_at ? new Date(reading.measured_at).toISOString() : new Date().toISOString()
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Saving water parameters using direct fetch with access token...')
          
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4'
          
          // Insert each parameter one by one via direct fetch
          const insertPromises = parametersToSave.map(async (param) => {
            const insertData = {
              user_id: user.id,
              parameter_type: param.type,
              value: param.value,
              unit: param.unit,
              notes: reading.notes || null,
              test_strip_photo_url: reading.test_strip_photo || null,
              measured_at: measuredAt
            }
            
            const response = await fetch(
              `${supabaseUrl}/rest/v1/water_parameters`,
              {
                method: 'POST',
                headers: {
                  'apikey': supabaseAnonKey,
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=representation'
                },
                body: JSON.stringify(insertData)
              }
            )
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              return { error: { message: `HTTP ${response.status}`, details: errorData } }
            }
            
            return { error: null }
          })
          
          const results = await Promise.all(insertPromises)
          
          // Check for errors
          const hasErrors = results.some(result => result.error)
          if (hasErrors) {
            console.error('Error saving water parameters with direct fetch:', results)
            
            // Log detailed error information
            results.forEach((result, index) => {
              if (result.error) {
                console.error(`Parameter ${index} error:`, result.error)
              }
            })
            
            toast({
              title: "Opslag fout",
              description: "Sommige parameters konden niet worden opgeslagen. Probeer opnieuw.",
              variant: "destructive",
            })
            return
          }
          
          // Success - continue with task completion and form reset
        } catch (error: any) {
          console.error('Error saving water parameters with direct fetch:', error)
          toast({
            title: "Opslag fout",
            description: "Er is een onverwachte fout opgetreden. Probeer opnieuw.",
            variant: "destructive",
          })
          return
        }
      } else {
        // Normal Supabase query
        // Insert each parameter into database
        const insertPromises = parametersToSave.map(param => 
          supabase.from('water_parameters').insert({
            user_id: user.id,
            parameter_type: param.type,
            value: param.value,
            unit: param.unit,
            notes: reading.notes || null,
            test_strip_photo_url: reading.test_strip_photo || null,
            measured_at: measuredAt
          })
        )

        const results = await Promise.all(insertPromises)
        
        // Check for errors
        const hasErrors = results.some(result => result.error)
        if (hasErrors) {
          console.error('Error saving water parameters:', results)
          
          // Log detailed error information
          results.forEach((result, index) => {
            if (result.error) {
              console.error(`Parameter ${index} error:`, result.error)
            }
          })
          
          toast({
            title: "Opslag fout",
            description: "Sommige parameters konden niet worden opgeslagen. Probeer opnieuw.",
            variant: "destructive",
          })
          return
        }
      }

      // Complete pending water parameters task if exists
      const taskCompleted = await completePendingTask()
      
      // Build success message
      let description = "Water parameters zijn succesvol geregistreerd."
      if (hasActiveTemperatureSensor && sensorTemperature != null) {
        description += ` Sensortemperatuur (${sensorTemperature.toFixed(1)}°C) is automatisch toegevoegd.`
      }
      if (taskCompleted) {
        description += " Onderhoudstaak voltooid."
      }
      
      toast({
        title: "Meting opgeslagen",
        description: description,
      })
      
      // Reset form
      setReading({
        ph: "",
        kh: "",
        gh: "",
        nitrite: "",
        nitrate: "",
        phosphate: "",
        ammonia: "",
        temperature: "",
        notes: "",
        test_strip_photo: "",
        measured_at: new Date().toISOString().slice(0, 16)
      })

      // Trigger dashboard refresh
      if (onDataSaved) {
        onDataSaved()
      }

      // Navigate back to dashboard after successful save
      onNavigate("dashboard")

    } catch (error) {
      console.error('Error saving water parameters:', error)
      toast({
        title: "Opslag fout",
        description: "Er is een onverwachte fout opgetreden. Probeer opnieuw.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const allParameters = [
    {
      key: "ph" as keyof WaterReading,
      label: "pH Waarde",
      placeholder: "7.0",
      unit: "",
      range: "6.8 - 8.2"
    },
    {
      key: "kh" as keyof WaterReading,
      label: "kH (Carbonaathardheid)",
      placeholder: "4.0",
      unit: "°dH",
      range: "3 - 8 °dH"
    },
    {
      key: "gh" as keyof WaterReading,
      label: "gH (Totale Hardheid)",
      placeholder: "8.0",
      unit: "°dH",
      range: "4 - 12 °dH"
    },
    {
      key: "nitrite" as keyof WaterReading,
      label: "Nitriet (NO₂)",
      placeholder: "0.1",
      unit: "mg/l",
      range: "0 - 0.3 mg/l"
    },
    {
      key: "nitrate" as keyof WaterReading,
      label: "Nitraat (NO₃)",
      placeholder: "15",
      unit: "mg/l",
      range: "< 25 mg/l"
    },
    {
      key: "phosphate" as keyof WaterReading,
      label: "Fosfaat (PO₄)",
      placeholder: "0.3",
      unit: "mg/l",
      range: "< 1.0 mg/l"
    },
    {
      key: "ammonia" as keyof WaterReading,
      label: "NH₃/NH₄ (Ammonia)",
      placeholder: "0.02",
      unit: "mg/l",
      range: "0 - 0.05 mg/l"
    },
    {
      key: "temperature" as keyof WaterReading,
      label: "Water Temperatuur",
      placeholder: "18.5",
      unit: "°C",
      range: "15 - 25 °C",
      optional: hasActiveTemperatureSensor
    }
  ]

  // Show all parameters, but temperature is optional when sensor is active
  const parameters = allParameters

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")} className="h-8 w-8 sm:h-10 sm:w-10">
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Water Parameters</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Registreer de waterkwaliteit van je vijver</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => onNavigate("water-history")} className="w-full sm:w-auto h-9 sm:h-10 text-sm">
          <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Bekijk eerdere metingen</span>
          <span className="sm:hidden">Geschiedenis</span>
        </Button>
      </div>

      {/* Sensor Information */}
      {hasActiveTemperatureSensor && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 sm:pt-6">
            <div className="flex items-start space-x-2 sm:space-x-3">
              <div className="flex-shrink-0">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-xs sm:text-sm">📡</span>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900">Temperatuur via Sensor</h3>
                <p className="text-xs sm:text-sm text-blue-700 mt-1">
                  De watertemperatuur wordt automatisch gemeten door je gekoppelde KOIoT sensor. 
                  Je kunt nog steeds handmatig een temperatuur invoeren als referentie.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Droplets className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Nieuwe watermeting
          </CardTitle>
          <CardDescription className="text-sm">
            Voer de huidige metingen van je water testkit in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {parameters.map((param) => {
              const timerConfig = timerConfigs[param.key]
              const timerState = timerStates[param.key]
              const isRunning = timerState?.isRunning || false
              const timeLeft = timerState?.timeLeft || timerConfig?.duration * 60
              const hasTimer = timerConfig?.enabled
              
              return (
                <div key={param.key} className="space-y-1 sm:space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={param.key} className="text-xs sm:text-sm font-medium">
                      {param.label}
                      {param.unit && <span className="text-muted-foreground ml-1">({param.unit})</span>}
                      {(param as any).optional && <span className="text-muted-foreground ml-1">(Optioneel)</span>}
                    </Label>
                    {hasTimer && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => isRunning ? stopTimer(param.key) : startTimer(param.key)}
                          className="h-6 w-6 p-0"
                        >
                          {isRunning ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resetTimer(param.key)}
                          className="h-6 w-6 p-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      id={param.key}
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      pattern="[0-9]*[.,]?[0-9]*"
                      placeholder={param.placeholder}
                      value={reading[param.key]}
                      onChange={(e) => handleInputChange(param.key, e.target.value)}
                      className={`h-8 sm:h-9 ${hasTimer ? 'flex-1' : 'w-full'}`}
                    />
                    {hasTimer && (
                      <div className="flex flex-col items-center justify-center min-w-[80px] px-2 py-1 bg-muted/50 rounded border">
                        <div className="text-xs font-mono font-bold text-primary">
                          {formatTime(timeLeft)}
                        </div>
                        {isRunning && (
                          <div className="text-xs text-green-600">
                            Actief
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Ideale waarde: {param.range}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Timer Tip */}
          {Object.values(timerConfigs).some(config => config.enabled) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-700">
                💡 <strong>Tip:</strong> Start een timer wanneer je begint met een druppeltest. 
                Je krijgt een herinnering wanneer de testtijd voorbij is.
              </p>
            </div>
          )}

          {/* Date and Time Picker */}
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="measured_at" className="text-xs sm:text-sm font-medium">
              Datum en tijd van meting
            </Label>
            <div className="flex gap-2">
              <Input
                id="measured_at"
                type="datetime-local"
                value={reading.measured_at}
                onChange={(e) => handleInputChange("measured_at", e.target.value)}
                className="flex-1 h-8 sm:h-9"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  // Use local time instead of UTC
                  const now = new Date()
                  const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                  handleInputChange("measured_at", localDateTime.toISOString().slice(0, 16))
                }}
                className="px-3 h-8 sm:h-9 text-xs sm:text-sm"
              >
                Nu
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Kies de datum en tijd wanneer de meting is uitgevoerd. Klik op "Nu" voor de huidige tijd.
            </p>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label className="text-xs sm:text-sm font-medium">
              Teststrip foto (Optioneel)
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowPhotoUpload(true)}
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              >
                <Camera className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Voeg teststrip foto toe</span>
                <span className="sm:hidden">Foto toevoegen</span>
              </Button>
              {reading.test_strip_photo && (
                <div className="flex-1">
                  <img 
                    src={reading.test_strip_photo} 
                    alt="Teststrip voorbeeld" 
                    className="w-full h-16 sm:h-20 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecteer een foto van je water teststrip als referentie
            </p>
          </div>

          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="notes" className="text-xs sm:text-sm font-medium">
              Notities (Optioneel)
            </Label>
            <Textarea
              id="notes"
              placeholder="Eventuele observaties over waterkwaliteit, vijverconditie of koi gedrag..."
              value={reading.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
            <Button 
              onClick={handleSave} 
              className="flex-1 h-9 sm:h-10 text-sm" 
              disabled={saving || uploading}
            >
              <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              {saving ? "Opslaan..." : uploading ? "Uploaden..." : "Meting opslaan"}
            </Button>
            <Button variant="outline" onClick={() => onNavigate("dashboard")} className="h-9 sm:h-10 text-sm">
              Terug naar Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-gradient-water">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Test Tips</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-1 sm:space-y-2 text-xs sm:text-sm">
            <li>• Test water parameters wekelijks, of vaker als er problemen zijn</li>
            <li>• Test altijd op hetzelfde tijdstip voor consistentie</li>
            <li>• Reinig test apparatuur tussen gebruik om besmetting te voorkomen</li>
            <li>• Bewaar testkits weg van direct zonlicht en extreme temperaturen</li>
            <li>• Vervang testkits jaarlijks of wanneer reagentia verlopen</li>
          </ul>
        </CardContent>
      </Card>

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <PhotoUpload
          onPhotoSelected={handleTestStripPhoto}
          onClose={() => setShowPhotoUpload(false)}
          title="Voeg teststrip foto toe"
          description="Selecteer een foto van je water teststrip van je apparaat"
        />
      )}
    </div>
  )
}