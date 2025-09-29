import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PhotoUpload } from "@/components/ui/photo-upload"
import { useState } from "react"
import { Droplets, Save, History, Camera, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { useSensorManagement } from "@/hooks/use-sensor-management"

interface WaterReading {
  ph: string
  kh: string
  gh: string
  nitrite: string
  nitrate: string
  phosphate: string
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
  const { user } = useAuth()
  const { uploadPhoto, uploading } = usePhotoUpload()
  const { sensors } = useSensorManagement()
  const [reading, setReading] = useState<WaterReading>({
    ph: "",
    kh: "",
    gh: "",
    nitrite: "",
    nitrate: "",
    phosphate: "",
    temperature: "",
    notes: "",
    test_strip_photo: "",
    measured_at: new Date().toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:MM
  })
  const [saving, setSaving] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)

  // Check if user has an active temperature sensor
  const hasActiveTemperatureSensor = sensors.some(sensor => sensor.status === 'active')

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
      // Prepare data for database insertion
      const parametersToSave = [
        { type: 'ph', value: parseFloat(reading.ph), unit: '' },
        ...(reading.temperature ? [{ type: 'temperature', value: parseFloat(reading.temperature), unit: '°C' }] : []),
        ...(reading.kh ? [{ type: 'kh', value: parseFloat(reading.kh), unit: '°dH' }] : []),
        ...(reading.gh ? [{ type: 'gh', value: parseFloat(reading.gh), unit: '°dH' }] : []),
        ...(reading.nitrite ? [{ type: 'nitrite', value: parseFloat(reading.nitrite), unit: 'mg/l' }] : []),
        ...(reading.nitrate ? [{ type: 'nitrate', value: parseFloat(reading.nitrate), unit: 'mg/l' }] : []),
        ...(reading.phosphate ? [{ type: 'phosphate', value: parseFloat(reading.phosphate), unit: 'mg/l' }] : []),
      ]

      // Insert each parameter into database
      const insertPromises = parametersToSave.map(param => 
        supabase.from('water_parameters').insert({
          user_id: user.id,
          parameter_type: param.type,
          value: param.value,
          unit: param.unit,
          notes: reading.notes || null,
          test_strip_photo_url: reading.test_strip_photo || null,
          measured_at: reading.measured_at ? new Date(reading.measured_at).toISOString() : new Date().toISOString()
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

      toast({
        title: "Meting opgeslagen",
        description: "Water parameters zijn succesvol geregistreerd.",
      })
      
      // Reset form
      setReading({
        ph: "",
        kh: "",
        gh: "",
        nitrite: "",
        nitrate: "",
        phosphate: "",
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
      label: "KH (Carbonaat Hardheid)",
      placeholder: "4.0",
      unit: "°dH",
      range: "3 - 8 °dH"
    },
    {
      key: "gh" as keyof WaterReading,
      label: "GH (Totale Hardheid)",
      placeholder: "8.0",
      unit: "°dH",
      range: "4 - 12 °dH"
    },
    {
      key: "nitrite" as keyof WaterReading,
      label: "Nitriet",
      placeholder: "0.1",
      unit: "mg/l",
      range: "0 - 0.3 mg/l"
    },
    {
      key: "nitrate" as keyof WaterReading,
      label: "Nitraat",
      placeholder: "15",
      unit: "mg/l",
      range: "< 25 mg/l"
    },
    {
      key: "phosphate" as keyof WaterReading,
      label: "Fosfaat",
      placeholder: "0.3",
      unit: "mg/l",
      range: "< 0.5 mg/l"
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Water Parameters</h1>
            <p className="text-muted-foreground">Registreer de waterkwaliteit van je vijver</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => onNavigate("water-history")}>
          <History className="h-4 w-4 mr-2" />
          Bekijk eerdere metingen
        </Button>
      </div>

      {/* Sensor Information */}
      {hasActiveTemperatureSensor && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📡</span>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium text-blue-900">Temperatuur via Sensor</h3>
                <p className="text-sm text-blue-700">
                  De watertemperatuur wordt automatisch gemeten door je gekoppelde KOIoT sensor. 
                  Je kunt nog steeds handmatig een temperatuur invoeren als referentie.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Nieuwe watermeting
          </CardTitle>
          <CardDescription>
            Voer de huidige metingen van je water testkit in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {parameters.map((param) => (
              <div key={param.key} className="space-y-2">
                <Label htmlFor={param.key} className="text-sm font-medium">
                  {param.label}
                  {param.unit && <span className="text-muted-foreground ml-1">({param.unit})</span>}
                  {(param as any).optional && <span className="text-muted-foreground ml-1">(Optioneel)</span>}
                </Label>
                <Input
                  id={param.key}
                  type="number"
                  step="0.1"
                  placeholder={param.placeholder}
                  value={reading[param.key]}
                  onChange={(e) => handleInputChange(param.key, e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ideale waarde: {param.range}
                </p>
              </div>
            ))}
          </div>

          {/* Date and Time Picker */}
          <div className="space-y-2">
            <Label htmlFor="measured_at" className="text-sm font-medium">
              Datum en tijd van meting
            </Label>
            <div className="flex gap-2">
              <Input
                id="measured_at"
                type="datetime-local"
                value={reading.measured_at}
                onChange={(e) => handleInputChange("measured_at", e.target.value)}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handleInputChange("measured_at", new Date().toISOString().slice(0, 16))}
                className="px-3"
              >
                Nu
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Kies de datum en tijd wanneer de meting is uitgevoerd. Klik op "Nu" voor de huidige tijd.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Teststrip foto (Optioneel)
            </Label>
            <div className="flex gap-2">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setShowPhotoUpload(true)}
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Voeg teststrip foto toe
              </Button>
              {reading.test_strip_photo && (
                <div className="flex-1">
                  <img 
                    src={reading.test_strip_photo} 
                    alt="Teststrip voorbeeld" 
                    className="w-full h-20 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecteer een foto van je water teststrip als referentie
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notities (Optioneel)
            </Label>
            <Textarea
              id="notes"
              placeholder="Eventuele observaties over waterkwaliteit, vijverconditie of koi gedrag..."
              value={reading.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              onClick={handleSave} 
              className="flex-1" 
              disabled={saving || uploading}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Opslaan..." : uploading ? "Uploaden..." : "Meting opslaan"}
            </Button>
            <Button variant="outline" onClick={() => onNavigate("dashboard")}>
              Terug naar Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-gradient-water">
        <CardHeader>
          <CardTitle className="text-lg">Test Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
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