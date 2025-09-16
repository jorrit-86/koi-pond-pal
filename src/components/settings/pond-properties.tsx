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
  RefreshCw,
  Plus,
  X,
  ArrowRight
} from 'lucide-react'

interface FilterSegment {
  id: string
  type: 'mechanical' | 'biological' | 'chemical' | 'uv' | 'skimmer' | 'empty'
  media: string[]
  description: string
}

interface PondProperties {
  pond_size_liters: number | null
  pond_depth_cm: number | null
  pond_type: string
  location: string
  climate_zone: string
  maintenance_frequency: string
  seasonal_awareness: boolean
  auto_recommendations: boolean
  // Filtration system
  filtration_type: string
  filter_media: string[]
  filter_segments: FilterSegment[]
  uv_sterilizer: boolean
  protein_skimmer: boolean
  // Water features
  waterfall: boolean
  fountain: boolean
  aeration_system: boolean
  // Equipment
  heater: boolean
  chiller: boolean
  auto_feeder: boolean
  // Water source
  water_source: string
  water_changes_manual: boolean
  // Plant life
  plants_present: boolean
  plant_types: string[]
}

interface KoiCounts {
  total_koi: number
  pond_koi: number
  quarantine_koi: number
  hospital_koi: number
}

// Helper function to get media options based on segment type
const getMediaOptions = (type: string) => {
  switch (type) {
    case 'mechanical':
      return [
        { value: 'vortex_chamber', label: 'Vortexkamer', desc: 'Ronde kamer met langzame watercirculatie' },
        { value: 'brush_filter', label: 'Borstelfilter', desc: 'Kamer met speciale filterborstels' },
        { value: 'mat_filter', label: 'Mattenfilter', desc: 'Japanse matten of filtermatten' },
        { value: 'sieve_filter', label: 'Zeefbochtfilter', desc: 'Roestvrijstalen zeef (200-300 micron)' },
        { value: 'drum_filter', label: 'Trommelfilter', desc: 'Geautomatiseerde roestvrijstalen trommel' },
        { value: 'bead_filter', label: 'Beadfilter', desc: 'Kunststof bolletjes (mechanisch + biologisch)' },
        { value: 'sponges', label: 'Sponzen', desc: 'Traditionele sponzen' },
        { value: 'foam', label: 'Schuim', desc: 'Filter schuim' }
      ]
    case 'biological':
      return [
        { value: 'ceramic_rings', label: 'Keramische Ring', desc: 'Bio ringen voor bacteriën' },
        { value: 'bio_balls', label: 'Bio Ballen', desc: 'Plastic ballen met groot oppervlak' },
        { value: 'lava_rock', label: 'Lava Steen', desc: 'Natuurlijke bio media' },
        { value: 'matrix', label: 'Matrix Media', desc: 'Geavanceerde bio media' },
        { value: 'k1_media', label: 'K1 Media', desc: 'Bewegende bed bio media' },
        { value: 'bio_blocks', label: 'Bio Blokken', desc: 'Grote bio blokken' }
      ]
    case 'chemical':
      return [
        { value: 'activated_carbon', label: 'Actieve Kool', desc: 'Verwijdert chemicaliën en geuren' },
        { value: 'zeolite', label: 'Zeoliet', desc: 'Verwijdert ammoniak' },
        { value: 'phosphate_remover', label: 'Fosfaat Verwijderaar', desc: 'Verwijdert fosfaten' },
        { value: 'ozone', label: 'Ozon', desc: 'Sterke oxidatie en desinfectie' }
      ]
    default:
      return []
  }
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
    auto_recommendations: true,
    // Filtration system
    filtration_type: 'mechanical_biological',
    filter_media: [],
    filter_segments: [
      { id: '1', type: 'mechanical', media: ['vortex_chamber'], description: 'Vortexkamer - grove filtering' },
      { id: '2', type: 'biological', media: ['ceramic_rings'], description: 'Biologische filtering' }
    ],
    uv_sterilizer: false,
    protein_skimmer: false,
    // Water features
    waterfall: false,
    fountain: false,
    aeration_system: false,
    // Equipment
    heater: false,
    chiller: false,
    auto_feeder: false,
    // Water source
    water_source: 'tap_water',
    water_changes_manual: true,
    // Plant life
    plants_present: false,
    plant_types: []
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
          auto_recommendations: data.auto_recommendations ?? true,
          // Filtration system
          filtration_type: data.filtration_type || 'mechanical_biological',
          filter_media: data.filter_media || [],
          filter_segments: data.filter_segments || [
            { id: '1', type: 'mechanical', media: ['vortex_chamber'], description: 'Vortexkamer - grove filtering' },
            { id: '2', type: 'biological', media: ['ceramic_rings'], description: 'Biologische filtering' }
          ],
          uv_sterilizer: data.uv_sterilizer ?? false,
          protein_skimmer: data.protein_skimmer ?? false,
          // Water features
          waterfall: data.waterfall ?? false,
          fountain: data.fountain ?? false,
          aeration_system: data.aeration_system ?? false,
          // Equipment
          heater: data.heater ?? false,
          chiller: data.chiller ?? false,
          auto_feeder: data.auto_feeder ?? false,
          // Water source
          water_source: data.water_source || 'tap_water',
          water_changes_manual: data.water_changes_manual ?? true,
          // Plant life
          plants_present: data.plants_present ?? false,
          plant_types: data.plant_types || []
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
          auto_recommendations: pondProperties.auto_recommendations,
          // Filtration system
          filtration_type: pondProperties.filtration_type,
          filter_media: pondProperties.filter_media,
          filter_segments: pondProperties.filter_segments,
          uv_sterilizer: pondProperties.uv_sterilizer,
          protein_skimmer: pondProperties.protein_skimmer,
          // Water features
          waterfall: pondProperties.waterfall,
          fountain: pondProperties.fountain,
          aeration_system: pondProperties.aeration_system,
          // Equipment
          heater: pondProperties.heater,
          chiller: pondProperties.chiller,
          auto_feeder: pondProperties.auto_feeder,
          // Water source
          water_source: pondProperties.water_source,
          water_changes_manual: pondProperties.water_changes_manual,
          // Plant life
          plants_present: pondProperties.plants_present,
          plant_types: pondProperties.plant_types
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
            // Filtration system
            filtration_type: pondProperties.filtration_type,
            filter_media: pondProperties.filter_media,
            filter_segments: pondProperties.filter_segments,
            uv_sterilizer: pondProperties.uv_sterilizer,
            protein_skimmer: pondProperties.protein_skimmer,
            // Water features
            waterfall: pondProperties.waterfall,
            fountain: pondProperties.fountain,
            aeration_system: pondProperties.aeration_system,
            // Equipment
            heater: pondProperties.heater,
            chiller: pondProperties.chiller,
            auto_feeder: pondProperties.auto_feeder,
            // Water source
            water_source: pondProperties.water_source,
            water_changes_manual: pondProperties.water_changes_manual,
            // Plant life
            plants_present: pondProperties.plants_present,
            plant_types: pondProperties.plant_types,
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

      {/* Visual Filter Builder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Filter Systeem Builder
          </CardTitle>
          <CardDescription>
            Bouw je filter systeem visueel op - water stroomt van links naar rechts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filter Flow Diagram */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Filter Stroom</h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const newSegment: FilterSegment = {
                      id: Date.now().toString(),
                      type: 'empty',
                      media: [],
                      description: 'Nieuw segment'
                    }
                    setPondProperties(prev => ({
                      ...prev,
                      filter_segments: [...prev.filter_segments, newSegment]
                    }))
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Segment Toevoegen
                </Button>
              </div>
            </div>

            {/* Visual Filter Flow */}
            <div className="relative">
              {/* Water Flow Arrow */}
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-blue-200 transform -translate-y-1/2 z-0">
                <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-200 border-t-2 border-b-2 border-t-transparent border-b-transparent"></div>
              </div>

              {/* Filter Segments */}
              <div className="flex gap-4 overflow-x-auto pb-4">
                {pondProperties.filter_segments.map((segment, index) => (
                  <div key={segment.id} className="flex items-center gap-2">
                    {/* Segment */}
                    <div className="relative bg-white border-2 border-gray-300 rounded-lg p-4 min-w-[200px] shadow-sm hover:shadow-md transition-shadow">
                      {/* Segment Type Badge */}
                      <div className={`absolute -top-2 left-2 px-2 py-1 rounded-full text-xs font-medium ${
                        segment.type === 'mechanical' ? 'bg-blue-100 text-blue-800' :
                        segment.type === 'biological' ? 'bg-green-100 text-green-800' :
                        segment.type === 'chemical' ? 'bg-purple-100 text-purple-800' :
                        segment.type === 'uv' ? 'bg-yellow-100 text-yellow-800' :
                        segment.type === 'skimmer' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {segment.type === 'mechanical' ? 'Mechanisch' :
                         segment.type === 'biological' ? 'Biologisch' :
                         segment.type === 'chemical' ? 'Chemisch' :
                         segment.type === 'uv' ? 'UV' :
                         segment.type === 'skimmer' ? 'Skimmer' :
                         'Leeg'}
                      </div>

                      {/* Segment Content */}
                      <div className="space-y-2 mt-2">
                        <Select
                          value={segment.type}
                          onValueChange={(value: any) => {
                            setPondProperties(prev => ({
                              ...prev,
                              filter_segments: prev.filter_segments.map(s => 
                                s.id === segment.id ? { ...s, type: value, media: [] } : s
                              )
                            }))
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mechanical">Mechanisch</SelectItem>
                            <SelectItem value="biological">Biologisch</SelectItem>
                            <SelectItem value="chemical">Chemisch</SelectItem>
                            <SelectItem value="uv">UV Sterilisator</SelectItem>
                            <SelectItem value="skimmer">Proteïne Skimmer</SelectItem>
                            <SelectItem value="empty">Leeg</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Media Selection */}
                        {segment.type !== 'empty' && segment.type !== 'uv' && segment.type !== 'skimmer' && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Filter Media:</Label>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {getMediaOptions(segment.type).map((media) => (
                                <label key={media.value} className="flex items-start space-x-2 p-1 rounded hover:bg-gray-50">
                                  <input
                                    type="checkbox"
                                    checked={segment.media.includes(media.value)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setPondProperties(prev => ({
                                          ...prev,
                                          filter_segments: prev.filter_segments.map(s => 
                                            s.id === segment.id ? { ...s, media: [...s.media, media.value] } : s
                                          )
                                        }))
                                      } else {
                                        setPondProperties(prev => ({
                                          ...prev,
                                          filter_segments: prev.filter_segments.map(s => 
                                            s.id === segment.id ? { ...s, media: s.media.filter(m => m !== media.value) } : s
                                          )
                                        }))
                                      }
                                    }}
                                    className="mt-0.5 rounded text-xs"
                                  />
                                  <div className="flex-1">
                                    <span className="text-xs font-medium">{media.label}</span>
                                    <p className="text-xs text-muted-foreground">{media.desc}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        <Input
                          placeholder="Beschrijving..."
                          value={segment.description}
                          onChange={(e) => {
                            setPondProperties(prev => ({
                              ...prev,
                              filter_segments: prev.filter_segments.map(s => 
                                s.id === segment.id ? { ...s, description: e.target.value } : s
                              )
                            }))
                          }}
                          className="h-6 text-xs"
                        />

                        {/* Delete Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setPondProperties(prev => ({
                              ...prev,
                              filter_segments: prev.filter_segments.filter(s => s.id !== segment.id)
                            }))
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Arrow between segments */}
                    {index < pondProperties.filter_segments.length - 1 && (
                      <div className="flex-shrink-0">
                        <ArrowRight className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-100 rounded"></div>
                <span>Mechanisch</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-100 rounded"></div>
                <span>Biologisch</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-purple-100 rounded"></div>
                <span>Chemisch</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-yellow-100 rounded"></div>
                <span>UV</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-100 rounded"></div>
                <span>Skimmer</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Water Features & Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Water Features & Apparatuur
          </CardTitle>
          <CardDescription>
            Extra apparatuur en water features in je vijver
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.waterfall}
                onChange={(e) => setPondProperties(prev => ({ ...prev, waterfall: e.target.checked }))}
                className="rounded"
              />
              <span>Waterval</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.fountain}
                onChange={(e) => setPondProperties(prev => ({ ...prev, fountain: e.target.checked }))}
                className="rounded"
              />
              <span>Fontein</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.aeration_system}
                onChange={(e) => setPondProperties(prev => ({ ...prev, aeration_system: e.target.checked }))}
                className="rounded"
              />
              <span>Beluchting Systeem</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.heater}
                onChange={(e) => setPondProperties(prev => ({ ...prev, heater: e.target.checked }))}
                className="rounded"
              />
              <span>Verwarming</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.chiller}
                onChange={(e) => setPondProperties(prev => ({ ...prev, chiller: e.target.checked }))}
                className="rounded"
              />
              <span>Koeling</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.auto_feeder}
                onChange={(e) => setPondProperties(prev => ({ ...prev, auto_feeder: e.target.checked }))}
                className="rounded"
              />
              <span>Automatische Voeder</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Water Source & Plant Life */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            Water Bron & Planten
          </CardTitle>
          <CardDescription>
            Informatie over water bron en plantenleven
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="water-source">Water Bron</Label>
            <Select 
              value={pondProperties.water_source} 
              onValueChange={(value) => setPondProperties(prev => ({ ...prev, water_source: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer water bron" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tap_water">Kraanwater</SelectItem>
                <SelectItem value="well_water">Putwater</SelectItem>
                <SelectItem value="rain_water">Regenwater</SelectItem>
                <SelectItem value="ro_water">RO Water</SelectItem>
                <SelectItem value="mixed">Gemengd</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.water_changes_manual}
                onChange={(e) => setPondProperties(prev => ({ ...prev, water_changes_manual: e.target.checked }))}
                className="rounded"
              />
              <span>Handmatige Waterverversing</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.plants_present}
                onChange={(e) => setPondProperties(prev => ({ ...prev, plants_present: e.target.checked }))}
                className="rounded"
              />
              <span>Planten Aanwezig</span>
            </label>
          </div>

          {pondProperties.plants_present && (
            <div className="space-y-2">
              <Label>Plant Types</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {['water_lilies', 'lotus', 'oxygen_plants', 'floating_plants', 'marginal_plants', 'submerged_plants'].map((plant) => (
                  <label key={plant} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={pondProperties.plant_types.includes(plant)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPondProperties(prev => ({
                            ...prev,
                            plant_types: [...prev.plant_types, plant]
                          }))
                        } else {
                          setPondProperties(prev => ({
                            ...prev,
                            plant_types: prev.plant_types.filter(p => p !== plant)
                          }))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {plant === 'water_lilies' ? 'Waterlelies' :
                       plant === 'lotus' ? 'Lotus' :
                       plant === 'oxygen_plants' ? 'Zuurstofplanten' :
                       plant === 'floating_plants' ? 'Drijfplanten' :
                       plant === 'marginal_plants' ? 'Oeverplanten' :
                       plant === 'submerged_plants' ? 'Onderwaterplanten' : plant}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
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
