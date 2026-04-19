import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Fish, Plus, Calendar, Ruler, Heart, BarChart3, ArrowLeft, Calculator, Archive } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { calculateCurrentAge, getAgeDisplayText } from "@/lib/koi-age-utils"
import { GrowthChart } from "./growth-chart"

// Helper function to extract healthStatus from notes
function extractHealthStatusFromNotes(notes: string | null): string | null {
  if (!notes) return null
  const match = notes.match(/\[HealthStatus: ([^\]]+)\]/)
  return match ? match[1] : null
}

interface Koi {
  id: string
  name: string
  variety: string
  age: number
  length: number
  weight?: number
  color: string
  healthStatus: "excellent" | "good" | "needs-attention"
  dateAdded: string
  notes?: string
  photo_url?: string
  breeder?: string
  dealer?: string
  purchase_price?: number
  primary_photo_url?: string
  purchase_date?: string
  age_at_purchase?: number
  length_at_purchase?: number
}

interface KoiManagementProps {
  onNavigate: (tab: string) => void
  onEditKoi: (koiId: string, koiName: string) => void
  refreshTrigger?: number // Trigger om data te refreshen
}

export function KoiManagement({ onNavigate, onEditKoi, refreshTrigger }: KoiManagementProps) {
  const { user, session } = useAuth()
  const [koiList, setKoiList] = useState<Koi[]>([])
  const [loading, setLoading] = useState(true)
  const [showGrowthChart, setShowGrowthChart] = useState(false)
  const [selectedKoiId, setSelectedKoiId] = useState<string | null>(null)
  const [selectedKoiName, setSelectedKoiName] = useState<string>('')


  // Load koi data from database with retry for auth errors
  const loadKoiData = async (retryCount = 0) => {
    if (!user) {
      console.log('No user available, skipping koi data load')
      return
    }
    
    // Check if Supabase has a session
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    // If no Supabase session but we have React session, use direct fetch (don't try to restore session - causes 403 errors)
    const useDirectToken = !currentSession && session?.access_token
    
    if (!currentSession && !useDirectToken) {
      if (retryCount < 3) {
        console.log(`No session available (attempt ${retryCount + 1}/3), waiting...`)
        await new Promise(resolve => setTimeout(resolve, 500))
        return loadKoiData(retryCount + 1)
      } else {
        console.error('No session available after 3 retries, cannot load koi data')
        setKoiList([])
        setLoading(false)
        return
      }
    }
    
    try {
      setLoading(true)
      console.log('Loading koi data for user:', user.id, useDirectToken ? '(using direct fetch)' : '')
      
      // If using direct token, use fetch directly (don't call setSession - it causes 403 errors)
      if (useDirectToken && session?.access_token) {
        // Use fetch directly with the access token
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?user_id=eq.${user.id}&select=*&order=created_at.desc`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            }
          }
        )
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        const error = null
        
        // Process the data as if it came from Supabase query
        if (error) {
          throw error
        }
        
        console.log('Loaded koi data:', data?.length || 0, 'koi found')
        
        if (!data || data.length === 0) {
          console.log('No koi data found, setting empty list')
          setKoiList([])
          setLoading(false)
          return
        }
        
        // Load photos and other data using direct fetch
        const koiIds = data.map((koi: any) => koi.id)
        
        // Load primary photos
        let primaryPhotos = new Map()
        if (koiIds.length > 0) {
          try {
            const photosResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_photos?koi_id=in.(${koiIds.join(',')})&is_primary=eq.true&select=koi_id,photo_url`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )
            if (photosResponse.ok) {
              const photosData = await photosResponse.json()
              photosData?.forEach((photo: any) => {
                primaryPhotos.set(photo.koi_id, photo.photo_url)
              })
            }
          } catch (error) {
            console.log('Error loading photos:', error)
          }
        }
        
        // Load current lengths from logbook entries (latest measurement per koi)
        let currentLengths = new Map()
        if (koiIds.length > 0) {
          try {
            // Fetch all measurements for all koi and filter in JavaScript
            // Use proper PostgREST syntax: in.(id1,id2,id3)
            const koiIdsParam = koiIds.map(id => encodeURIComponent(id)).join(',')
            const lengthResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries?koi_id=in.(${koiIdsParam})&entry_type=eq.measurement&select=koi_id,length_cm,entry_date&order=entry_date.desc`,
              {
                headers: {
                  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json'
                }
              }
            )
            
            if (lengthResponse.ok) {
              const lengthData = await lengthResponse.json()
              const measurements = Array.isArray(lengthData) ? lengthData : [lengthData]
              
              // Create a map of koi_id to current length (latest measurement with non-null length_cm)
              measurements.forEach((entry: any) => {
                // Only keep the latest measurement for each koi that has a length_cm
                if (entry.length_cm != null && !currentLengths.has(entry.koi_id)) {
                  currentLengths.set(entry.koi_id, entry.length_cm)
                }
              })
              
              console.log('Loaded current lengths from logbook (direct fetch):', currentLengths.size, 'koi with measurements')
            }
          } catch (error) {
            console.log('Error loading lengths from logbook:', error)
          }
        }
        
        // Transform data
        const transformedData = data.map((koi: any) => {
          const currentLength = currentLengths.get(koi.id) || koi.length_at_purchase || koi.size_cm || 0
          return {
            id: koi.id,
            name: koi.name || 'Onbekend',
            variety: koi.species || 'Onbekend',
            age: calculateCurrentAge(koi.purchase_date, koi.age_at_purchase),
            length: currentLength,
            color: koi.color || '',
            healthStatus: extractHealthStatusFromNotes(koi.notes) || koi.healthStatus || 'good',
            dateAdded: koi.created_at || new Date().toISOString(),
            notes: koi.notes || '',
            photo_url: koi.photo_url || undefined,
            primary_photo_url: primaryPhotos.get(koi.id) || koi.photo_url || undefined,
            breeder: koi.breeder || undefined,
            dealer: koi.dealer || undefined,
            purchase_price: koi.purchase_price || undefined,
            purchase_date: koi.purchase_date || undefined,
            age_at_purchase: koi.age_at_purchase || undefined,
            length_at_purchase: koi.length_at_purchase || undefined,
            location: koi.location || 'pond'
          }
        })
        
        setKoiList(transformedData)
        setLoading(false)
        return
      }
      
      // Normal Supabase query path (when we have a valid Supabase session)
      const { data, error } = await supabase
        .from('koi')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        // If auth error and we have React session, fall back to direct fetch
        if ((error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('session')) && session?.access_token && retryCount === 0) {
          console.log('Auth error detected, falling back to direct fetch...')
          // Skip to direct fetch path - the useDirectToken check at the top will handle it
          // Just return and let the function retry, which will trigger useDirectToken
          await new Promise(resolve => setTimeout(resolve, 100))
          return loadKoiData(retryCount + 1)
        }
        
        console.error('Error loading koi data:', error)
        setKoiList([])
        setLoading(false)
        return
      }

      console.log('Loaded koi data:', data?.length || 0, 'koi found')

      if (!data || data.length === 0) {
        console.log('No koi data found, setting empty list')
        setKoiList([])
        setLoading(false)
        return
      }

      // Load primary photos for each koi
      const koiIds = data.map((koi: any) => koi.id)
      const { data: photosData } = await supabase
        .from('koi_photos')
        .select('koi_id, photo_url')
        .eq('is_primary', true)
        .in('koi_id', koiIds)

      // Create a map of koi_id to primary photo
      const primaryPhotos = new Map()
      photosData?.forEach((photo: any) => {
        primaryPhotos.set(photo.koi_id, photo.photo_url)
      })

      // Load current lengths from logbook entries (latest measurement per koi)
      let currentLengths = new Map()
      const { data: lengthData } = await supabase
        .from('koi_log_entries')
        .select('koi_id, length_cm, entry_date')
        .eq('entry_type', 'measurement')
        .not('length_cm', 'is', null)
        .in('koi_id', koiIds)
        .order('entry_date', { ascending: false })

      // Create a map of koi_id to current length (latest measurement)
      lengthData?.forEach((entry: any) => {
        // Only keep the latest measurement for each koi
        if (!currentLengths.has(entry.koi_id)) {
          currentLengths.set(entry.koi_id, entry.length_cm)
        }
      })

      // Transform database data to match our interface
      const transformedData: Koi[] = data.map((koi: any) => {
        // Determine current length: latest measurement > length at purchase > original length
        const currentLength = currentLengths.get(koi.id) || koi.length_at_purchase || koi.size_cm || 0
        
        return {
          id: koi.id,
          name: koi.name || koi.species || 'Unknown', // Use species as name if no name provided
          variety: koi.species || 'Unknown',
          age: koi.age_years || 0,
          length: currentLength,
          weight: koi.weight,
          color: koi.color || '',
          dateAdded: koi.purchase_date || koi.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          notes: koi.notes || undefined,
          photo_url: koi.photo_url || undefined,
          primary_photo_url: primaryPhotos.get(koi.id) || koi.photo_url || undefined,
          breeder: koi.breeder || undefined,
          dealer: koi.dealer || undefined,
          purchase_price: koi.purchase_price || undefined,
          purchase_date: koi.purchase_date || undefined,
          age_at_purchase: koi.age_at_purchase || undefined,
          length_at_purchase: koi.length_at_purchase || undefined,
          healthStatus: extractHealthStatusFromNotes(koi.notes) || koi.healthStatus || 'good',
          location: koi.location || 'pond'
        }
      })

      setKoiList(transformedData)
    } catch (error) {
      console.error('Error in loadKoiData:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && session) {
      loadKoiData()
    }
  }, [user, session])

  // React to refresh trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && user && session) {
      loadKoiData()
    }
  }, [refreshTrigger, user, session])

  const handleEditKoi = (koi: Koi) => {
    console.log('handleEditKoi called for koi:', koi.name); // Debug log
    onEditKoi(koi.id, koi.name)
    onNavigate("koi-edit")
  }

  const handleShowGrowthChart = (koiId: string) => {
    console.log('handleShowGrowthChart called with koiId:', koiId); // Debug log
    const koi = koiList.find(k => k.id === koiId)
    const koiName = koi?.name || koi?.species || koi?.variety || 'Onbekend'
    console.log('Selected koi:', koi, 'Name:', koiName); // Debug log
    setSelectedKoiId(koiId)
    setSelectedKoiName(koiName)
    setShowGrowthChart(true)
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case "excellent": return "bg-success text-success-foreground"
      case "good": return "bg-primary text-primary-foreground"
      case "needs-attention": return "bg-warning text-warning-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getHealthLabel = (status: string) => {
    switch (status) {
      case "excellent": return "Uitstekend"
      case "good": return "Goed"
      case "needs-attention": return "Aandacht Nodig"
      default: return "Onbekend"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Je koi collectie laden...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Je moet ingelogd zijn om je koi collectie te bekijken.</p>
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Mijn Koi Collectie</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Beheer informatie over je koi vissen</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => onNavigate("koi-add")} className="h-9 sm:h-10 text-sm">
            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            <span className="hidden sm:inline">Nieuwe Koi Toevoegen</span>
            <span className="sm:hidden">Nieuwe Koi</span>
          </Button>
          <Button variant="outline" onClick={() => onNavigate("koi-archive")} className="h-9 sm:h-10 text-sm">
            <Archive className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            <span className="hidden sm:inline">Archief</span>
            <span className="sm:hidden">Archief</span>
          </Button>
          <Button variant="outline" onClick={() => onNavigate("koi-weight-calculator")} className="h-9 sm:h-10 text-sm">
            <Calculator className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            <span className="hidden sm:inline">Voerstrategie Calculator</span>
            <span className="sm:hidden">Calculator</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-gradient-water">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Totaal aantal koi</p>
                <p className="text-lg sm:text-2xl font-bold">{koiList.length}</p>
              </div>
              <Fish className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water hidden sm:block">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Gemiddelde Leeftijd</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {Math.round(koiList.reduce((acc, koi) => acc + koi.age, 0) / koiList.length * 10) / 10} jaar
                </p>
              </div>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Grootste Koi</p>
                <p className="text-lg sm:text-2xl font-bold">
                  {Math.max(...koiList.map(k => k.length))}cm
                </p>
              </div>
              <Ruler className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Koi Grid */}
      {koiList.length === 0 ? (
        <Card className="bg-gradient-water">
          <CardContent className="p-8 text-center">
            <Fish className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nog geen koi in je collectie</h3>
            <p className="text-muted-foreground mb-4">
              Voeg je eerste koi toe om je collectie te beginnen.
            </p>
            <Button onClick={() => onNavigate("koi-add")} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Eerste Koi Toevoegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {koiList.map((koi) => (
          <Card key={koi.id} className="hover:shadow-water transition-shadow">
            <CardContent className="p-4 sm:p-6">
              <div className="flex gap-3 sm:gap-4">
                {/* Left Section - Text Information */}
                <div className="flex-1 space-y-2 sm:space-y-3">
                  {/* Header */}
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">{koi.name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600">{koi.variety}</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs sm:text-sm gap-2">
                      <span className="text-gray-600">Leeftijd:</span>
                      <span className="text-gray-900">
                        {koi.purchase_date && koi.age_at_purchase !== undefined 
                          ? getAgeDisplayText(calculateCurrentAge(koi.purchase_date, koi.age_at_purchase))
                          : `${koi.age} jaar`
                        }
                      </span>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm gap-2">
                      <span className="text-gray-600">Lengte:</span>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-gray-900">{koi.length} cm</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-5 w-5 sm:h-6 sm:w-6 p-0 hover:bg-gray-100"
                          onClick={() => handleShowGrowthChart(koi.id)}
                        >
                          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs sm:text-sm gap-2">
                      <span className="text-gray-600">Kweker:</span>
                      <span className="text-gray-900 truncate">{koi.breeder || 'Onbekend'}</span>
                    </div>
                    {koi.dealer && (
                      <div className="flex justify-between text-xs sm:text-sm gap-2">
                        <span className="text-gray-600">Dealer:</span>
                        <span className="text-gray-900 truncate">{koi.dealer}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4 sm:pt-8">
                    <Button variant="outline" size="sm" className="flex-1 h-8 sm:h-9 text-xs sm:text-sm" onClick={() => handleEditKoi(koi)}>
                      Details
                    </Button>
                    <Button variant="outline" size="sm" className="px-2 sm:px-3 h-8 sm:h-9">
                      <Heart className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                </div>

                {/* Right Section - Koi Image */}
                {(koi.primary_photo_url || koi.photo_url) && (
                  <div className="w-20 h-32 sm:w-28 sm:h-52 flex-shrink-0 relative">
                    <img 
                      src={koi.primary_photo_url || koi.photo_url} 
                      alt={`${koi.name} photo`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {/* Health Status Badge over de afbeelding */}
                    <div className="absolute top-1 right-1">
                      <Badge className={`${getHealthColor(koi.healthStatus)} text-xs px-1 py-0.5`}>
                        {getHealthLabel(koi.healthStatus)}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {/* Care Tips */}
      <Card className="bg-gradient-water">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-base sm:text-lg">Koi Verzorging Richtlijnen</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Voedingsschema</h4>
              <ul className="space-y-1 text-xs sm:text-sm">
                <li>• Lente/Herfst: 1-2 keer per dag bij watertemperatuur 10-18°C</li>
                <li>• Zomer: 2-3 keer per dag bij watertemperatuur 18-25°C</li>
                <li>• Winter: Stop met voeren wanneer water onder 10°C daalt</li>
                <li>• Voer alleen wat ze binnen 5 minuten kunnen opeten</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Gezondheidsmonitoring</h4>
              <ul className="space-y-1 text-xs sm:text-sm">
                <li>• Let op veranderingen in zwemgedrag</li>
                <li>• Controleer op witte vlekken, rode strepen of vinbeschadiging</li>
                <li>• Monitor eetlust en voedingsrespons</li>
                <li>• Quarantaine nieuwe vissen gedurende 2-4 weken</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Growth Chart Dialog */}
      {selectedKoiId && (
        console.log('Rendering GrowthChart with koiId:', selectedKoiId, 'koiName:', selectedKoiName, 'isOpen:', showGrowthChart) || 
        <GrowthChart
          koiId={selectedKoiId}
          koiName={selectedKoiName}
          isOpen={showGrowthChart}
          onClose={() => {
            setShowGrowthChart(false)
            setSelectedKoiId(null)
            setSelectedKoiName('')
          }}
          onAddMeasurement={() => {
            console.log('onAddMeasurement called from koi-management'); // Debug log
            
            // Close the growth chart first
            setShowGrowthChart(false)
            setSelectedKoiId(null)
            setSelectedKoiName('')
            
            // Use the existing edit function to open koi-edit with the selected koi
            console.log('Using existing edit function to open koi-edit'); // Debug log
            const koi = koiList.find(k => k.id === selectedKoiId);
            if (koi) {
              console.log('Opening koi-edit for koi:', koi.name); // Debug log
              onEditKoi(koi.id, koi.name);
              onNavigate("koi-edit");
            } else {
              console.log('Koi not found, using fallback navigation'); // Debug log
              onNavigate("koi-edit");
            }
          }}
        />
      )}

    </div>
  )
}
