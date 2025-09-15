import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Fish, Plus, Calendar, Ruler, Heart } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { calculateCurrentAge, getAgeDisplayText } from "@/lib/koi-age-utils"

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
  const { user } = useAuth()
  const [koiList, setKoiList] = useState<Koi[]>([])
  const [loading, setLoading] = useState(true)


  // Load koi data from database
  useEffect(() => {
    const loadKoiData = async () => {
      if (!user) return
      
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('koi')
        .select('*')
          .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading koi data:', error)
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
        const { data: lengthData } = await supabase
          .from('koi_log_entries')
          .select('koi_id, length_cm, entry_date')
          .eq('entry_type', 'measurement')
          .not('length_cm', 'is', null)
          .in('koi_id', koiIds)
          .order('entry_date', { ascending: false })

        // Create a map of koi_id to current length (latest measurement)
        const currentLengths = new Map()
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
        name: koi.name,
        variety: koi.species || koi.variety || 'Unknown',
        age: koi.age_years || 0,
            length: currentLength,
        weight: koi.weight,
        color: koi.color || '',
        healthStatus: 'excellent' as const, // Default for now
        dateAdded: koi.purchase_date || koi.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            notes: koi.notes || undefined,
            photo_url: koi.photo_url || undefined,
            primary_photo_url: primaryPhotos.get(koi.id) || koi.photo_url || undefined,
            breeder: koi.breeder || undefined,
            dealer: koi.dealer || undefined,
            purchase_price: koi.purchase_price || undefined,
            purchase_date: koi.purchase_date || undefined,
            age_at_purchase: koi.age_at_purchase || undefined,
            length_at_purchase: koi.length_at_purchase || undefined
          }
        })

      setKoiList(transformedData)
    } catch (error) {
      console.error('Error in loadKoiData:', error)
    } finally {
      setLoading(false)
    }
  }

    loadKoiData()
  }, [user])

  // React to refresh trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      loadKoiData()
    }
  }, [refreshTrigger, user])

  const handleEditKoi = (koi: Koi) => {
    onEditKoi(koi.id, koi.name)
    onNavigate("koi-edit")
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Mijn Koi Collectie</h1>
          <p className="text-muted-foreground">Beheer informatie over je koi vissen</p>
        </div>
        <Button onClick={() => onNavigate("koi-add")}>
              <Plus className="h-4 w-4 mr-2" />
          Nieuwe Koi Toevoegen
            </Button>

      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Totaal aantal koi</p>
                <p className="text-2xl font-bold">{koiList.length}</p>
              </div>
              <Fish className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gemiddelde Leeftijd</p>
                <p className="text-2xl font-bold">
                  {Math.round(koiList.reduce((acc, koi) => acc + koi.age, 0) / koiList.length * 10) / 10} jaar
                </p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Grootste Koi</p>
                <p className="text-2xl font-bold">
                  {Math.max(...koiList.map(k => k.length))}cm
                </p>
              </div>
              <Ruler className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Koi Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {koiList.map((koi) => (
          <Card key={koi.id} className="hover:shadow-water transition-shadow">
            <CardContent className="p-6">
              <div className="flex gap-4">
                {/* Left Section - Text Information */}
                <div className="flex-1 space-y-3">
                  {/* Header */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{koi.name}</h3>
                    <p className="text-sm text-gray-600">{koi.variety}</p>
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm gap-2">
                      <span className="text-gray-600">Leeftijd:</span>
                      <span className="text-gray-900">
                        {koi.purchase_date && koi.age_at_purchase !== undefined 
                          ? getAgeDisplayText(calculateCurrentAge(koi.purchase_date, koi.age_at_purchase))
                          : `${koi.age} jaar`
                        }
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-2">
                      <span className="text-gray-600">Lengte:</span>
                      <span className="text-gray-900">{koi.length} cm</span>
                    </div>
                    <div className="flex justify-between text-sm gap-2">
                      <span className="text-gray-600">Kweker:</span>
                      <span className="text-gray-900">{koi.breeder || 'Onbekend'}</span>
                    </div>
                    {koi.dealer && (
                      <div className="flex justify-between text-sm gap-2">
                        <span className="text-gray-600">Dealer:</span>
                        <span className="text-gray-900">{koi.dealer}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-8">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditKoi(koi)}>
                      Details
                    </Button>
                    <Button variant="outline" size="sm" className="px-3">
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Right Section - Koi Image */}
                {(koi.primary_photo_url || koi.photo_url) && (
                  <div className="w-28 h-52 flex-shrink-0 self-start relative" style={{ marginTop: '1.5rem' }}>
                    <img 
                      src={koi.primary_photo_url || koi.photo_url} 
                      alt={`${koi.name} photo`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    {/* Health Status Badge over de afbeelding */}
                    <div className="absolute top-1 right-1">
                <Badge className={getHealthColor(koi.healthStatus)}>
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

      {/* Care Tips */}
      <Card className="bg-gradient-water">
        <CardHeader>
          <CardTitle className="text-lg">Koi Verzorging Richtlijnen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Voedingsschema</h4>
              <ul className="space-y-1 text-sm">
                <li>• Lente/Herfst: 1-2 keer per dag bij watertemperatuur 10-18°C</li>
                <li>• Zomer: 2-3 keer per dag bij watertemperatuur 18-25°C</li>
                <li>• Winter: Stop met voeren wanneer water onder 10°C daalt</li>
                <li>• Voer alleen wat ze binnen 5 minuten kunnen opeten</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Gezondheidsmonitoring</h4>
              <ul className="space-y-1 text-sm">
                <li>• Let op veranderingen in zwemgedrag</li>
                <li>• Controleer op witte vlekken, rode strepen of vinbeschadiging</li>
                <li>• Monitor eetlust en voedingsrespons</li>
                <li>• Quarantaine nieuwe vissen gedurende 2-4 weken</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
