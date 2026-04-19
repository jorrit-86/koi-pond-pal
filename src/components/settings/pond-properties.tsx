import { useState, useEffect, useCallback, useRef } from 'react'
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
  RefreshCw,
  Plus,
  X,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import './pond-properties.css'

interface FilterSegment {
  id: string
  type: 'mechanical' | 'biological' | 'chemical' | 'uv' | 'skimmer' | 'empty'
  media: string[]
  description: string
  aeration?: boolean // For biological segments, indicates if the media is aerated
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

// Helper function to calculate segment score (normalized to 1-10 scale)
const calculateSegmentScore = (segment: FilterSegment): { score: number; maxScore: number; reasoning: string[] } => {
  const reasoning: string[] = []
  let rawScore = 0
  let maxRawScore = 0

  // Base score for segment type (0-3 points)
  const typeScores: Record<string, number> = {
    'mechanical': 1,
    'biological': 2,
    'chemical': 1.5,
    'uv': 1,
    'skimmer': 1.5,
    'empty': 0
  }

  const typeScore = typeScores[segment.type] || 0
  rawScore += typeScore
  maxRawScore += 3
  reasoning.push(`${segment.type} segment: ${typeScore}/3 punten`)

  // Media scoring (0-4 points)
  if (segment.media.length > 0) {
    const mediaScores: Record<string, number> = {
      // Mechanical media
      'vortex_chamber': 1,
      'brush_filter': 1.2,
      'mat_filter': 1.5,
      'sieve_filter': 2,
      'drum_filter': 2.5,
      'sponges': 0.8,
      'foam': 1,
      // Biological media
      'japanese_mats': 2,
      'moving_bed_k1': 2.5,
      'moving_bed_k3': 2.2,
      'bead_filter': 2,
      'trickle_filter': 2.8,
      'shower_filter': 2.5,
      'glass_foam': 2.8,
      'ceramic_rings': 1.8,
      'bio_balls': 1.5,
      'lava_rock': 1.8,
      'matrix': 2.5,
      'bacteria_house': 2.2,
      // Chemical media
      'activated_carbon': 1,
      'zeolite': 1.5,
      'phosphate_remover': 1.2,
      'ozone': 2
    }

    const mediaScore = segment.media.reduce((total, media) => {
      return total + (mediaScores[media] || 0.5)
    }, 0)
    
    rawScore += Math.min(mediaScore, 4)
    maxRawScore += 4
    reasoning.push(`Media: ${Math.min(mediaScore, 4).toFixed(1)}/4 punten`)

    // Aeration bonus for biological segments (0-1.5 points)
    if (segment.type === 'biological' && segment.aeration) {
      rawScore += 1.5
      maxRawScore += 1.5
      reasoning.push('Beluchting: +1.5 punten')
    }
  }

  // Normalize to 1-10 scale
  // Minimum score is 1 (even empty segments get 1 point)
  // Maximum possible raw score is 8.5, so we scale accordingly
  const normalizedScore = Math.max(1, Math.min(10, (rawScore / maxRawScore) * 9 + 1))
  const maxScore = 10

  return { score: normalizedScore, maxScore, reasoning }
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
        { value: 'japanese_mats', label: 'Japanse Matten', desc: 'Grote synthetische matten met ruwe structuur' },
        { value: 'moving_bed_k1', label: 'Moving Bed (K1)', desc: 'Kunststof dragers in beweging door lucht' },
        { value: 'moving_bed_k3', label: 'Moving Bed (K3)', desc: 'Grote kunststof dragers in beweging' },
        { value: 'bead_filter', label: 'Beadfilter', desc: 'Gesloten drukvat met plastic bolletjes' },
        { value: 'trickle_filter', label: 'Trickle Filter', desc: 'Water druppelt over filtermateriaal' },
        { value: 'shower_filter', label: 'Druppeltoren/Shower', desc: 'Compacte verticale bakken met Bacteria House' },
        { value: 'glass_foam', label: 'Glasfoam', desc: 'Gerecycled glas met extreem hoog bio-oppervlak' },
        { value: 'ceramic_rings', label: 'Keramische Ring', desc: 'Bio ringen voor bacteriën' },
        { value: 'bio_balls', label: 'Bio Ballen', desc: 'Plastic ballen met groot oppervlak' },
        { value: 'lava_rock', label: 'Lava Steen', desc: 'Natuurlijke bio media' },
        { value: 'matrix', label: 'Matrix Media', desc: 'Geavanceerde bio media' },
        { value: 'bacteria_house', label: 'Bacteria House', desc: 'Speciale media voor shower filters' }
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
  const { user, session } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [scrollPosition, setScrollPosition] = useState({ canScrollLeft: false, canScrollRight: false })
  const [isMobile, setIsMobile] = useState(false)
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
      { id: '2', type: 'biological', media: ['moving_bed_k1'], description: 'Moving Bed K1 - biologische filtering' }
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

  // Debounce timer for auto-save
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (user) {
      loadPondProperties()
      loadKoiCounts()
    }
  }, [user])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  // Check scroll position and update arrow visibility
  const checkScrollPosition = (container: HTMLElement) => {
    const canScrollLeft = container.scrollLeft > 0
    const canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth)
    setScrollPosition({ canScrollLeft, canScrollRight })
  }

  // Scroll functions
  const scrollLeft = () => {
    const container = document.querySelector('.filter-segments-container') as HTMLElement
    if (container) {
      if (isMobile) {
        // On mobile, center the previous segment
        const segments = container.querySelectorAll('[data-segment]')
        const currentScrollLeft = container.scrollLeft
        const containerWidth = container.clientWidth
        
        // Find the currently visible segment
        let targetSegment = null
        for (let i = segments.length - 1; i >= 0; i--) {
          const segment = segments[i] as HTMLElement
          const segmentLeft = segment.offsetLeft
          const segmentRight = segmentLeft + segment.offsetWidth
          
          if (segmentLeft <= currentScrollLeft + containerWidth / 2 && segmentRight >= currentScrollLeft + containerWidth / 2) {
            targetSegment = i > 0 ? segments[i - 1] : segments[i]
            break
          }
        }
        
        if (targetSegment) {
          const targetElement = targetSegment as HTMLElement
          const targetLeft = targetElement.offsetLeft
          const targetWidth = targetElement.offsetWidth
          const centerPosition = targetLeft + targetWidth / 2 - containerWidth / 2
          
          container.scrollTo({ left: Math.max(0, centerPosition), behavior: 'smooth' })
        }
      } else {
        // On desktop, use fixed scroll distance
        container.scrollBy({ left: -300, behavior: 'smooth' })
      }
    }
  }

  const scrollRight = () => {
    const container = document.querySelector('.filter-segments-container') as HTMLElement
    if (container) {
      if (isMobile) {
        // On mobile, center the next segment
        const segments = container.querySelectorAll('[data-segment]')
        const currentScrollLeft = container.scrollLeft
        const containerWidth = container.clientWidth
        
        // Find the currently visible segment
        let targetSegment = null
        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i] as HTMLElement
          const segmentLeft = segment.offsetLeft
          const segmentRight = segmentLeft + segment.offsetWidth
          
          if (segmentLeft <= currentScrollLeft + containerWidth / 2 && segmentRight >= currentScrollLeft + containerWidth / 2) {
            targetSegment = i < segments.length - 1 ? segments[i + 1] : segments[i]
            break
          }
        }
        
        if (targetSegment) {
          const targetElement = targetSegment as HTMLElement
          const targetLeft = targetElement.offsetLeft
          const targetWidth = targetElement.offsetWidth
          const centerPosition = targetLeft + targetWidth / 2 - containerWidth / 2
          
          container.scrollTo({ left: Math.max(0, centerPosition), behavior: 'smooth' })
        }
      } else {
        // On desktop, use fixed scroll distance
        container.scrollBy({ left: 300, behavior: 'smooth' })
      }
    }
  }

  // Check scroll position on mount and when segments change
  useEffect(() => {
    const container = document.querySelector('.filter-segments-container') as HTMLElement
    if (container) {
      checkScrollPosition(container)
    }
  }, [pondProperties.filter_segments])

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  const loadPondProperties = async () => {
    if (!user) return

    try {
      setLoading(true)
      console.log('Loading pond properties for user:', user.id)
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let data: any = null
      let error: any = null
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading pond properties using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?user_id=eq.${user.id}&select=*`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (response.ok) {
            const responseData = await response.json()
            // maybeSingle() returns a single object or null, so we need to handle array response
            data = Array.isArray(responseData) ? (responseData.length > 0 ? responseData[0] : null) : responseData
            console.log('Loaded pond properties (direct fetch):', data ? 'found' : 'none')
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - silently ignore
            console.log('Table not accessible (406/404), using defaults')
            data = null
          } else {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
        } catch (fetchError: any) {
          console.error('Error loading pond properties with direct fetch:', fetchError)
          error = fetchError
          // Fall through to try normal Supabase query
        }
      }
      
      // If we don't have data yet, try normal Supabase query
      if (!data && !error) {
        const queryResult = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        
        data = queryResult.data
        error = queryResult.error
      }

      console.log('Database query result:', { data, error })
      console.log('Data type:', typeof data)
      console.log('Data is null?', data === null)
      console.log('Data is undefined?', data === undefined)
      console.log('Data length/keys:', data ? Object.keys(data) : 'no data')

      if (error) {
        console.error('Error loading pond properties:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        toast({
          title: "Fout",
          description: "Kon vijver eigenschappen niet laden: " + error.message,
          variant: "destructive"
        })
        return
      }

      if (data) {
        // Debug: log all loaded data
        console.log('Loaded data from database:', data)
        console.log('pond_size_liters:', data.pond_size_liters, 'type:', typeof data.pond_size_liters)
        console.log('pond_depth_cm:', data.pond_depth_cm, 'type:', typeof data.pond_depth_cm)
        
        // Ensure filter_segments is properly parsed
        let filterSegments = data.filter_segments
        if (typeof filterSegments === 'string') {
          try {
            filterSegments = JSON.parse(filterSegments)
          } catch (e) {
            console.error('Error parsing filter_segments:', e)
            filterSegments = [
              { id: '1', type: 'mechanical', media: ['vortex_chamber'], description: 'Vortexkamer - grove filtering' },
              { id: '2', type: 'biological', media: ['moving_bed_k1'], description: 'Moving Bed K1 - biologische filtering' }
            ]
          }
        }
        
        // Ensure filter_segments is an array
        if (!Array.isArray(filterSegments)) {
          console.warn('filter_segments is not an array, using defaults')
          filterSegments = [
            { id: '1', type: 'mechanical', media: ['vortex_chamber'], description: 'Vortexkamer - grove filtering' },
            { id: '2', type: 'biological', media: ['moving_bed_k1'], description: 'Moving Bed K1 - biologische filtering' }
          ]
        }

        // Convert DECIMAL to number if needed (Supabase returns DECIMAL as string sometimes)
        const pondSizeLiters = data.pond_size_liters != null 
          ? (typeof data.pond_size_liters === 'string' ? parseFloat(data.pond_size_liters) : Number(data.pond_size_liters))
          : null
        const pondDepthCm = data.pond_depth_cm != null
          ? (typeof data.pond_depth_cm === 'string' ? parseFloat(data.pond_depth_cm) : Number(data.pond_depth_cm))
          : null

        const loadedProperties = {
          pond_size_liters: pondSizeLiters,
          pond_depth_cm: pondDepthCm,
          pond_type: data.pond_type || 'outdoor',
          location: data.location || '',
          climate_zone: data.climate_zone || 'temperate',
          maintenance_frequency: data.maintenance_frequency || 'weekly',
          seasonal_awareness: data.seasonal_awareness ?? true,
          auto_recommendations: data.auto_recommendations ?? true,
          // Filtration system
          filtration_type: data.filtration_type || 'mechanical_biological',
          filter_media: data.filter_media || [],
          filter_segments: filterSegments,
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
        }

        console.log('Setting pond properties state:', loadedProperties)
        setPondProperties(loadedProperties)
      } else {
        console.log('No data found in database for user, using defaults')
      }
    } catch (error) {
      console.error('Error in loadPondProperties:', error)
      toast({
        title: "Fout",
        description: "Onverwachte fout bij laden vijver eigenschappen",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadKoiCounts = async () => {
    if (!user) return

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let data: any = null
      let error: any = null

      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/pond_koi_count?user_id=eq.${user.id}&select=*`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (response.ok) {
            const responseData = await response.json()
            data = Array.isArray(responseData) ? (responseData.length > 0 ? responseData[0] : null) : responseData
          } else if (response.status === 406 || response.status === 404) {
            // Table doesn't exist or not accessible - silently ignore
            return
          }
        } catch (fetchError: any) {
          // Silently ignore fetch errors for koi counts
          return
        }
      }

      // If we don't have data yet, try normal Supabase query
      if (!data && !error) {
        const queryResult = await supabase
          .from('pond_koi_count')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        
        data = queryResult.data
        error = queryResult.error
      }

      if (error && error.code !== 'PGRST116') {
        // Silently ignore errors for koi counts (table might not exist or be accessible)
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
      // Silently ignore errors for koi counts
    }
  }

  // Debounced auto-save function for all pond properties
  const debouncedAutoSave = useCallback((properties: Partial<PondProperties>) => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(async () => {
      await autoSavePondProperties(properties)
    }, 1000) // Wait 1 second after last change
  }, [])

  // Debounced auto-save function for filter segments (legacy)
  const debouncedAutoSaveSegments = useCallback((segments: FilterSegment[]) => {
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(async () => {
      await autoSaveFilterSegments(segments)
    }, 1000) // Wait 1 second after last change
  }, [])

  // Auto-save function for all pond properties
  const autoSavePondProperties = async (properties: Partial<PondProperties>) => {
    if (!user) return

    try {
      // Debug: log the properties data before saving
      console.log('Auto-saving pond properties to database:', properties)

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let data: any = null
      let error: any = null

      // Prepare the data to save
      const dataToSave = {
        user_id: user.id,
        ...properties,
        // Set defaults only if they don't exist in the record
        maintenance_frequency: properties.maintenance_frequency || 'weekly',
        seasonal_awareness: properties.seasonal_awareness ?? true,
        auto_recommendations: properties.auto_recommendations ?? true
      }

      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Saving pond properties using direct fetch with access token...')
          
          // First, try to get existing record to determine if we should PATCH or POST
          const checkResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?user_id=eq.${user.id}&select=id`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (checkResponse.ok) {
            const existingData = await checkResponse.json()
            const recordExists = Array.isArray(existingData) && existingData.length > 0

            // Use PATCH for update, POST for insert
            const method = recordExists ? 'PATCH' : 'POST'
            const url = recordExists 
              ? `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?user_id=eq.${user.id}&select=*`
              : `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?select=*`

            const saveResponse = await fetch(url, {
              method,
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(dataToSave)
            })

            if (saveResponse.ok) {
              const responseData = await saveResponse.json()
              data = Array.isArray(responseData) ? (responseData.length > 0 ? responseData[0] : null) : responseData
              console.log('Pond properties saved successfully (direct fetch)')
            } else {
              const errorData = await saveResponse.json().catch(() => ({ message: `HTTP ${saveResponse.status}` }))
              error = { message: errorData.message || `HTTP error! status: ${saveResponse.status}` }
            }
          } else {
            error = { message: `Failed to check existing record: ${checkResponse.status}` }
          }
        } catch (fetchError: any) {
          console.error('Error saving pond properties with direct fetch:', fetchError)
          error = fetchError
          // Fall through to try normal Supabase query
        }
      }

      // If we don't have data yet, try normal Supabase query
      if (!data && !error) {
        const queryResult = await supabase
          .from('user_preferences')
          .upsert(dataToSave, {
            onConflict: 'user_id'
          })
          .select()
        
        data = queryResult.data
        error = queryResult.error
      }

      console.log('Upsert result:', { data, error })

      if (error) {
        console.error('Error auto-saving pond properties:', error)
        toast({
          title: "Fout",
          description: "Kon vijver eigenschappen niet opslaan: " + (error.message || 'Onbekende fout'),
          variant: "destructive"
        })
      } else {
        console.log('Pond properties saved successfully')
      }
    } catch (error) {
      console.error('Error in autoSavePondProperties:', error)
      toast({
        title: "Fout",
        description: "Onverwachte fout bij opslaan vijver eigenschappen",
        variant: "destructive"
      })
    }
  }

  // Auto-save function for filter segments
  const autoSaveFilterSegments = async (segments: FilterSegment[]) => {
    if (!user) return

    try {
      // Debug: log the filter_segments data before saving
      console.log('Auto-saving filter_segments to database:', segments)

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let data: any = null
      let error: any = null

      // Prepare the data to save
      const dataToSave = {
        user_id: user.id,
        filter_segments: segments,
        // Set defaults only if they don't exist in the record
        maintenance_frequency: 'weekly',
        seasonal_awareness: true,
        auto_recommendations: true
      }

      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Saving filter segments using direct fetch with access token...')
          
          // First, try to get existing record to determine if we should PATCH or POST
          const checkResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?user_id=eq.${user.id}&select=id`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )

          if (checkResponse.ok) {
            const existingData = await checkResponse.json()
            const recordExists = Array.isArray(existingData) && existingData.length > 0

            // Use PATCH for update, POST for insert
            const method = recordExists ? 'PATCH' : 'POST'
            const url = recordExists 
              ? `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?user_id=eq.${user.id}&select=*`
              : `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/user_preferences?select=*`

            const saveResponse = await fetch(url, {
              method,
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(dataToSave)
            })

            if (saveResponse.ok) {
              const responseData = await saveResponse.json()
              data = Array.isArray(responseData) ? (responseData.length > 0 ? responseData[0] : null) : responseData
              console.log('Filter segments saved successfully (direct fetch)')
            } else {
              const errorData = await saveResponse.json().catch(() => ({ message: `HTTP ${saveResponse.status}` }))
              error = { message: errorData.message || `HTTP error! status: ${saveResponse.status}` }
            }
          } else {
            error = { message: `Failed to check existing record: ${checkResponse.status}` }
          }
        } catch (fetchError: any) {
          console.error('Error saving filter segments with direct fetch:', fetchError)
          error = fetchError
          // Fall through to try normal Supabase query
        }
      }

      // If we don't have data yet, try normal Supabase query
      if (!data && !error) {
        const queryResult = await supabase
          .from('user_preferences')
          .upsert(dataToSave, {
            onConflict: 'user_id'
          })
          .select()
        
        data = queryResult.data
        error = queryResult.error
      }

      console.log('Upsert result:', { data, error })

      if (error) {
        console.error('Error auto-saving filter segments:', error)
        toast({
          title: "Fout",
          description: "Kon filter segmenten niet opslaan: " + (error.message || 'Onbekende fout'),
          variant: "destructive"
        })
      } else {
        console.log('Filter segments saved successfully')
      }
    } catch (error) {
      console.error('Error in autoSaveFilterSegments:', error)
      toast({
        title: "Fout",
        description: "Onverwachte fout bij opslaan filter segmenten",
        variant: "destructive"
      })
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
                onChange={(e) => {
                  const newValue = e.target.value ? parseInt(e.target.value) : null
                  setPondProperties(prev => ({
                    ...prev,
                    pond_size_liters: newValue
                  }))
                  debouncedAutoSave({ pond_size_liters: newValue })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pond-depth">Vijver Diepte (cm)</Label>
              <Input
                id="pond-depth"
                type="number"
                placeholder="120"
                value={pondProperties.pond_depth_cm || ''}
                onChange={(e) => {
                  const newValue = e.target.value ? parseInt(e.target.value) : null
                  setPondProperties(prev => ({
                    ...prev,
                    pond_depth_cm: newValue
                  }))
                  debouncedAutoSave({ pond_depth_cm: newValue })
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pond-type">Vijver Type</Label>
              <Select 
                value={pondProperties.pond_type} 
                onValueChange={(value) => {
                  setPondProperties(prev => ({ ...prev, pond_type: value }))
                  debouncedAutoSave({ pond_type: value })
                }}
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
                onValueChange={(value) => {
                  setPondProperties(prev => ({ ...prev, climate_zone: value }))
                  debouncedAutoSave({ climate_zone: value })
                }}
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
              onChange={(e) => {
                setPondProperties(prev => ({ ...prev, location: e.target.value }))
                debouncedAutoSave({ location: e.target.value })
              }}
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
              onValueChange={(value) => {
                setPondProperties(prev => ({ ...prev, maintenance_frequency: value }))
                debouncedAutoSave({ maintenance_frequency: value })
              }}
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
                    const newSegments = [...pondProperties.filter_segments, newSegment]
                    setPondProperties(prev => ({
                      ...prev,
                      filter_segments: newSegments
                    }))
                    // Auto-save the changes (immediate for additions)
                    autoSavePondProperties({ filter_segments: newSegments })
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

              {/* Navigation Arrows */}
              {scrollPosition.canScrollLeft && (
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-lg hover:bg-gray-50"
                  onClick={scrollLeft}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}

              {scrollPosition.canScrollRight && (
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10 bg-white shadow-lg hover:bg-gray-50"
                  onClick={scrollRight}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}

              {/* Filter Segments */}
              <div 
                className="flex gap-4 overflow-x-auto pb-4 filter-segments-container"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
                onScroll={(e) => checkScrollPosition(e.currentTarget)}
              >
                {pondProperties.filter_segments.map((segment, index) => (
                  <div key={segment.id} className="flex items-center gap-2" data-segment>
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
                            const newSegments = pondProperties.filter_segments.map(s => 
                              s.id === segment.id ? { ...s, type: value, media: [] } : s
                            )
                            setPondProperties(prev => ({
                              ...prev,
                              filter_segments: newSegments
                            }))
                            // Auto-save the changes (debounced)
                            debouncedAutoSave({ filter_segments: newSegments })
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
                            
                            {/* Selected Media Display */}
                            {segment.media.length > 0 && (
                              <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs font-medium text-green-800">
                                        {getMediaOptions(segment.type).find(m => m.value === segment.media[0])?.label}
                                      </span>
                                      {/* Score Display */}
                                      {(() => {
                                        const segmentScore = calculateSegmentScore(segment)
                                        const percentage = (segmentScore.score / segmentScore.maxScore) * 100
                                        const scoreColor = segmentScore.score >= 8 ? 'text-green-600' : segmentScore.score >= 6 ? 'text-yellow-600' : 'text-red-600'
                                        return (
                                          <div className="flex items-center space-x-1">
                                            <span className={`text-xs font-bold ${scoreColor}`}>
                                              {segmentScore.score.toFixed(1)}/10
                                            </span>
                                            <div className="w-8 h-2 bg-gray-200 rounded-full overflow-hidden">
                                              <div 
                                                className={`h-full ${segmentScore.score >= 8 ? 'bg-green-500' : segmentScore.score >= 6 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                              />
                                            </div>
                                          </div>
                                        )
                                      })()}
                                    </div>
                                    <p className="text-xs text-green-600">
                                      {getMediaOptions(segment.type).find(m => m.value === segment.media[0])?.desc}
                                    </p>
                                    {/* Aeration checkbox for biological segments */}
                                    {segment.type === 'biological' && (
                                      <label className="flex items-center space-x-2 mt-2">
                                        <input
                                          type="checkbox"
                                          checked={segment.aeration || false}
                                          onChange={(e) => {
                                            const newSegments = pondProperties.filter_segments.map(s => 
                                              s.id === segment.id ? { ...s, aeration: e.target.checked } : s
                                            )
                                            setPondProperties(prev => ({
                                              ...prev,
                                              filter_segments: newSegments
                                            }))
                                            // Auto-save the changes
                                            autoSaveFilterSegments(newSegments)
                                          }}
                                          className="rounded text-xs"
                                        />
                                        <span className="text-xs text-green-700 font-medium">
                                          Belucht filter medium
                                        </span>
                                      </label>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const newSegments = pondProperties.filter_segments.map(s => 
                                        s.id === segment.id ? { ...s, media: [], aeration: false } : s
                                      )
                                      setPondProperties(prev => ({
                                        ...prev,
                                        filter_segments: newSegments
                                      }))
                                      // Auto-save the changes
                                      autoSaveFilterSegments(newSegments)
                                    }}
                                    className="h-4 w-4 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Media Selection Options */}
                            {segment.media.length === 0 && (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {getMediaOptions(segment.type).map((media) => (
                                  <label key={media.value} className="flex items-start space-x-2 p-1 rounded hover:bg-gray-50">
                                    <input
                                      type="radio"
                                      name={`media-${segment.id}`}
                                      value={media.value}
                                      onChange={(e) => {
                                        const newSegments = pondProperties.filter_segments.map(s => 
                                          s.id === segment.id ? { ...s, media: [media.value] } : s
                                        )
                                        setPondProperties(prev => ({
                                          ...prev,
                                          filter_segments: newSegments
                                        }))
                                        // Auto-save the changes
                                        autoSaveFilterSegments(newSegments)
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
                            )}
                          </div>
                        )}

                        {/* Description */}
                        <Input
                          placeholder="Beschrijving..."
                          value={segment.description}
                          onChange={(e) => {
                            const newSegments = pondProperties.filter_segments.map(s => 
                              s.id === segment.id ? { ...s, description: e.target.value } : s
                            )
                            setPondProperties(prev => ({
                              ...prev,
                              filter_segments: newSegments
                            }))
                            // Auto-save the changes (debounced)
                            debouncedAutoSave({ filter_segments: newSegments })
                          }}
                          className="h-6 text-xs"
                        />

                        {/* Delete Button */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const newSegments = pondProperties.filter_segments.filter(s => s.id !== segment.id)
                            setPondProperties(prev => ({
                              ...prev,
                              filter_segments: newSegments
                            }))
                            // Auto-save the changes (immediate for deletions)
                            autoSavePondProperties({ filter_segments: newSegments })
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
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, waterfall: e.target.checked }))
                  debouncedAutoSave({ waterfall: e.target.checked })
                }}
                className="rounded"
              />
              <span>Waterval</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.fountain}
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, fountain: e.target.checked }))
                  debouncedAutoSave({ fountain: e.target.checked })
                }}
                className="rounded"
              />
              <span>Fontein</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.aeration_system}
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, aeration_system: e.target.checked }))
                  debouncedAutoSave({ aeration_system: e.target.checked })
                }}
                className="rounded"
              />
              <span>Beluchting Systeem</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.heater}
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, heater: e.target.checked }))
                  debouncedAutoSave({ heater: e.target.checked })
                }}
                className="rounded"
              />
              <span>Verwarming</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.chiller}
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, chiller: e.target.checked }))
                  debouncedAutoSave({ chiller: e.target.checked })
                }}
                className="rounded"
              />
              <span>Koeling</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={pondProperties.auto_feeder}
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, auto_feeder: e.target.checked }))
                  debouncedAutoSave({ auto_feeder: e.target.checked })
                }}
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
              onValueChange={(value) => {
                setPondProperties(prev => ({ ...prev, water_source: value }))
                debouncedAutoSave({ water_source: value })
              }}
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
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, water_changes_manual: e.target.checked }))
                  debouncedAutoSave({ water_changes_manual: e.target.checked })
                }}
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
                onChange={(e) => {
                  setPondProperties(prev => ({ ...prev, plants_present: e.target.checked }))
                  debouncedAutoSave({ plants_present: e.target.checked })
                }}
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

    </div>
  )
}
