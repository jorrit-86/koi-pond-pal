import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { Droplets, Save, ArrowLeft, Calculator } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface WaterChange {
  liters_added: string
  water_type: string
  reason: string
  notes: string
  changed_at: string
}

interface WaterChangeFormProps {
  onNavigate: (page: string) => void
  onDataSaved?: () => void
}

export function WaterChangeForm({ onNavigate, onDataSaved }: WaterChangeFormProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [waterChange, setWaterChange] = useState<WaterChange>({
    liters_added: "",
    water_type: "",
    reason: "",
    notes: "",
    changed_at: new Date().toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:MM
  })
  const [saving, setSaving] = useState(false)
  const [pondSize, setPondSize] = useState<number | null>(null)
  const [percentage, setPercentage] = useState<number | null>(null)

  useEffect(() => {
    if (user) {
      loadPondSize()
    }
  }, [user])

  useEffect(() => {
    if (waterChange.liters_added && pondSize) {
      const liters = parseFloat(waterChange.liters_added)
      if (!isNaN(liters) && liters > 0) {
        const calculatedPercentage = (liters / pondSize) * 100
        setPercentage(calculatedPercentage)
      } else {
        setPercentage(null)
      }
    } else {
      setPercentage(null)
    }
  }, [waterChange.liters_added, pondSize])

  const loadPondSize = async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('pond_size_liters')
        .eq('user_id', user?.id)
        .single()

      if (error) {
        console.error('Error loading pond size:', error)
        return
      }

      setPondSize(data?.pond_size_liters || null)
    } catch (error) {
      console.error('Error loading pond size:', error)
    }
  }

  const handleInputChange = (field: keyof WaterChange, value: string) => {
    setWaterChange(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Fout",
        description: "Je moet ingelogd zijn om een waterwissel te registreren.",
        variant: "destructive"
      })
      return
    }

    if (!waterChange.liters_added || !waterChange.water_type || !waterChange.reason) {
      toast({
        title: "Incomplete gegevens",
        description: "Vul alle verplichte velden in.",
        variant: "destructive"
      })
      return
    }

    const liters = parseFloat(waterChange.liters_added)
    if (isNaN(liters) || liters <= 0) {
      toast({
        title: "Ongeldige hoeveelheid",
        description: "Voer een geldig aantal liters in.",
        variant: "destructive"
      })
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('water_changes')
        .insert({
          user_id: user.id,
          liters_added: liters,
          water_type: waterChange.water_type,
          reason: waterChange.reason,
          notes: waterChange.notes || null,
          changed_at: waterChange.changed_at
        })

      if (error) {
        throw error
      }

      toast({
        title: "Waterwissel opgeslagen",
        description: `Waterwissel van ${liters} liter succesvol geregistreerd.`,
      })

      // Reset form
      setWaterChange({
        liters_added: "",
        water_type: "",
        reason: "",
        notes: "",
        changed_at: new Date().toISOString().slice(0, 16)
      })

      // Callback to refresh dashboard
      if (onDataSaved) {
        onDataSaved()
      }

    } catch (error) {
      console.error('Error saving water change:', error)
      toast({
        title: "Fout bij opslaan",
        description: "Er is een fout opgetreden bij het opslaan van de waterwissel.",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const waterTypeOptions = [
    { value: 'tap_water', label: 'Kraanwater' },
    { value: 'well_water', label: 'Putwater' },
    { value: 'rain_water', label: 'Regenwater' },
    { value: 'ro_water', label: 'RO water' },
    { value: 'mixed', label: 'Gemengd' }
  ]

  const reasonOptions = [
    { value: 'routine', label: 'Routine onderhoud' },
    { value: 'problem', label: 'Probleem opgelost' },
    { value: 'emergency', label: 'Noodgeval' },
    { value: 'seasonal', label: 'Seizoensgebonden' },
    { value: 'maintenance', label: 'Onderhoud' },
    { value: 'other', label: 'Anders' }
  ]

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
              <Droplets className="h-6 w-6 text-blue-600" />
              <span>Waterwissel Registreren</span>
            </h1>
            <p className="text-muted-foreground">Registreer een waterwissel voor je vijver</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Waterwissel Gegevens</CardTitle>
            <CardDescription>
              Vul de details van de waterwissel in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="liters">Hoeveelheid Water (liters) *</Label>
              <Input
                id="liters"
                type="number"
                placeholder="500"
                value={waterChange.liters_added}
                onChange={(e) => handleInputChange('liters_added', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="water-type">Type Water *</Label>
              <Select value={waterChange.water_type} onValueChange={(value) => handleInputChange('water_type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer watertype" />
                </SelectTrigger>
                <SelectContent>
                  {waterTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reden voor Waterwissel *</Label>
              <Select value={waterChange.reason} onValueChange={(value) => handleInputChange('reason', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer reden" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="changed-at">Datum en Tijd</Label>
              <Input
                id="changed-at"
                type="datetime-local"
                value={waterChange.changed_at}
                onChange={(e) => handleInputChange('changed_at', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notities</Label>
              <Textarea
                id="notes"
                placeholder="Optionele notities over de waterwissel..."
                value={waterChange.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              onClick={handleSave} 
              disabled={saving || !waterChange.liters_added || !waterChange.water_type || !waterChange.reason}
              className="w-full"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Opslaan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Waterwissel Opslaan
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Calculation Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calculator className="h-5 w-5 text-green-600" />
              <span>Berekening</span>
            </CardTitle>
            <CardDescription>
              Overzicht van de waterwissel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pondSize ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Vijverinhoud</div>
                  <div className="text-lg font-semibold">{pondSize.toLocaleString('nl-NL')} liter</div>
                </div>

                {waterChange.liters_added && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm text-gray-600">Toegevoegd</div>
                    <div className="text-lg font-semibold">{parseFloat(waterChange.liters_added).toLocaleString('nl-NL')} liter</div>
                  </div>
                )}

                {percentage !== null && (
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="text-sm text-gray-600">Percentage</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {percentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">
                      van de totale vijverinhoud
                    </div>
                  </div>
                )}

                {waterChange.water_type && (
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm text-gray-600">Watertype</div>
                    <div className="text-lg font-semibold">
                      {waterTypeOptions.find(opt => opt.value === waterChange.water_type)?.label}
                    </div>
                  </div>
                )}

                {waterChange.reason && (
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="text-sm text-gray-600">Reden</div>
                    <div className="text-lg font-semibold">
                      {reasonOptions.find(opt => opt.value === waterChange.reason)?.label}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="text-yellow-800">
                  <strong>Let op:</strong> Je hebt nog geen vijverinhoud ingesteld. 
                  Ga naar Instellingen → Vijver Eigenschappen om je vijverinhoud in te stellen.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
