import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'
import { 
  Droplets, 
  Fish, 
  Thermometer, 
  Calendar,
  MapPin,
  Save,
  RefreshCw
} from 'lucide-react'

interface PondProperties {
  pond_size_liters: number | null
  pond_depth_cm: number | null
  pond_type: string
  location: string
  climate_zone: string
  maintenance_frequency: string
  seasonal_awareness: boolean
  auto_recommendations: boolean
}

interface KoiCounts {
  total_koi: number
  pond_koi: number
  quarantine_koi: number
  hospital_koi: number
}

export function PondProperties() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pondProperties, setPondProperties] = useState<PondProperties>({
    pond_size_liters: null,
    pond_depth_cm: null,
    pond_type: 'outdoor',
    location: '',
    climate_zone: 'temperate',
    maintenance_frequency: 'weekly',
    seasonal_awareness: true,
    auto_recommendations: true
  })
  const [koiCounts, setKoiCounts] = useState<KoiCounts>({
    total_koi: 0,
    pond_koi: 0,
    quarantine_koi: 0,
    hospital_koi: 0
  })

  useEffect(() => {
    if (user) {
      loadPondProperties()
      loadKoiCounts()
    }
  }, [user])

  const loadPondProperties = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading pond properties:', error)
        return
      }

      if (data) {
        setPondProperties({
          pond_size_liters: data.pond_size_liters,
          pond_depth_cm: data.pond_depth_cm,
          pond_type: data.pond_type || 'outdoor',
          location: data.location || '',
          climate_zone: data.climate_zone || 'temperate',
          maintenance_frequency: data.maintenance_frequency || 'weekly',
          seasonal_awareness: data.seasonal_awareness ?? true,
          auto_recommendations: data.auto_recommendations ?? true
        })
      }
    } catch (error) {
      console.error('Error in loadPondProperties:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadKoiCounts = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('pond_koi_count')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading koi counts:', error)
        return
      }

      if (data) {
        setKoiCounts({
          total_koi: data.koi_count || 0,
          pond_koi: data.pond_koi_count || 0,
          quarantine_koi: data.quarantine_koi_count || 0,
          hospital_koi: data.hospital_koi_count || 0
        })
      }
    } catch (error) {
      console.error('Error in loadKoiCounts:', error)
    }
  }

  const savePondProperties = async () => {
    if (!user) return

    try {
      setSaving(true)

      // First try to update existing record
      const { error: updateError } = await supabase
        .from('user_preferences')
        .update({
          pond_size_liters: pondProperties.pond_size_liters,
          pond_depth_cm: pondProperties.pond_depth_cm,
          pond_type: pondProperties.pond_type,
          location: pondProperties.location,
          climate_zone: pondProperties.climate_zone,
          maintenance_frequency: pondProperties.maintenance_frequency,
          seasonal_awareness: pondProperties.seasonal_awareness,
          auto_recommendations: pondProperties.auto_recommendations
        })
        .eq('user_id', user.id)

      // If update fails (no existing record), insert new record
      let error = updateError
      if (updateError && updateError.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('user_preferences')
          .insert({
            user_id: user.id,
            pond_size_liters: pondProperties.pond_size_liters,
            pond_depth_cm: pondProperties.pond_depth_cm,
            pond_type: pondProperties.pond_type,
            location: pondProperties.location,
            climate_zone: pondProperties.climate_zone,
            maintenance_frequency: pondProperties.maintenance_frequency,
            seasonal_awareness: pondProperties.seasonal_awareness,
            auto_recommendations: pondProperties.auto_recommendations,
            experience_level: 'beginner',
            koi_count: 0,
            preferred_chemicals: []
          })
        error = insertError
      }

      if (error) {
        console.error('Error saving pond properties:', error)
        toast({
          title: t('common.error'),
          description: 'Kon vijver eigenschappen niet opslaan',
          variant: 'destructive'
        })
        return
      }

      toast({
        title: t('common.success'),
        description: 'Vijver eigenschappen opgeslagen!'
      })
    } catch (error) {
      console.error('Error in savePondProperties:', error)
      toast({
        title: t('common.error'),
        description: 'Er is een fout opgetreden',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Vijver eigenschappen laden...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Vijver Eigenschappen</h2>
        <p className="text-muted-foreground">
          Configureer je vijver om gepersonaliseerde AI aanbevelingen te ontvangen
        </p>
      </div>

      {/* Koi Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fish className="h-5 w-5 text-primary" />
            Koi Overzicht
          </CardTitle>
          <CardDescription>
            Automatisch bijgehouden op basis van je koi database
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{koiCounts.total_koi}</div>
              <div className="text-sm text-muted-foreground">Totaal Koi</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">{koiCounts.pond_koi}</div>
              <div className="text-sm text-muted-foreground">In Vijver</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600">{koiCounts.quarantine_koi}</div>
              <div className="text-sm text-muted-foreground">Quarantaine</div>
            </div>
            <div className="text-center p-4 border rounded-lg bg-red-50">
              <div className="text-2xl font-bold text-red-600">{koiCounts.hospital_koi}</div>
              <div className="text-sm text-muted-foreground">Ziekenboeg</div>
            </div>
          </div>
          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadKoiCounts}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Vernieuwen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pond Specifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Vijver Specificaties
          </CardTitle>
          <CardDescription>
            Basis informatie over je vijver voor accurate aanbevelingen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pond-size">Vijver Grootte (Liters)</Label>
              <Input
                id="pond-size"
                type="number"
                placeholder="5000"
                value={pondProperties.pond_size_liters || ''}
                onChange={(e) => setPondProperties(prev => ({
                  ...prev,
                  pond_size_liters: e.target.value ? parseInt(e.target.value) : null
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pond-depth">Vijver Diepte (cm)</Label>
              <Input
                id="pond-depth"
                type="number"
                placeholder="120"
                value={pondProperties.pond_depth_cm || ''}
                onChange={(e) => setPondProperties(prev => ({
                  ...prev,
                  pond_depth_cm: e.target.value ? parseInt(e.target.value) : null
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pond-type">Vijver Type</Label>
              <Select 
                value={pondProperties.pond_type} 
                onValueChange={(value) => setPondProperties(prev => ({ ...prev, pond_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer vijver type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outdoor">Buiten Vijver</SelectItem>
                  <SelectItem value="indoor">Binnen Vijver</SelectItem>
                  <SelectItem value="greenhouse">Kas Vijver</SelectItem>
                  <SelectItem value="pondless">Waterval/Zuiveringssysteem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="climate-zone">Klimaat Zone</Label>
              <Select 
                value={pondProperties.climate_zone} 
                onValueChange={(value) => setPondProperties(prev => ({ ...prev, climate_zone: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer klimaat zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temperate">Gematigd (Nederland)</SelectItem>
                  <SelectItem value="continental">Continentaal</SelectItem>
                  <SelectItem value="mediterranean">Mediterraan</SelectItem>
                  <SelectItem value="tropical">Tropisch</SelectItem>
                  <SelectItem value="arctic">Koud</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Locatie (Stad/Regio)</Label>
            <Input
              id="location"
              placeholder="Amsterdam, Nederland"
              value={pondProperties.location}
              onChange={(e) => setPondProperties(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Onderhoud Instellingen
          </CardTitle>
          <CardDescription>
            Configureer hoe vaak je onderhoud uitvoert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maintenance-frequency">Onderhoud Frequentie</Label>
            <Select 
              value={pondProperties.maintenance_frequency} 
              onValueChange={(value) => setPondProperties(prev => ({ ...prev, maintenance_frequency: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer frequentie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Dagelijks</SelectItem>
                <SelectItem value="weekly">Wekelijks</SelectItem>
                <SelectItem value="biweekly">Tweewekelijks</SelectItem>
                <SelectItem value="monthly">Maandelijks</SelectItem>
                <SelectItem value="seasonal">Seizoensgebonden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={savePondProperties} 
          disabled={saving}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Opslaan...' : 'Vijver Eigenschappen Opslaan'}
        </Button>
      </div>
    </div>
  )
}
