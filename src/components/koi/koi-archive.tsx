import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Eye, Calendar, User } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { calculateCurrentAge, getAgeDisplayText } from "@/lib/koi-age-utils"

interface ArchivedKoi {
  id: string
  name: string
  variety: string
  age: number
  length: number
  color: string
  archive_reason: string
  archive_date: string
  purchase_date?: string
  age_at_purchase?: number
  primary_photo_url?: string
}

interface KoiArchiveProps {
  onNavigate: (tab: string) => void
  onEditKoi: (koiId: string, koiName: string) => void
}

export function KoiArchive({ onNavigate, onEditKoi }: KoiArchiveProps) {
  const { user } = useAuth()
  const [archivedKoi, setArchivedKoi] = useState<ArchivedKoi[]>([])
  const [loading, setLoading] = useState(true)
  const [unarchiving, setUnarchiving] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadArchivedKoi()
    }
  }, [user])

  const loadArchivedKoi = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      // Tijdelijk: toon lege lijst tot database volledig is bijgewerkt
      const { data, error } = await supabase
        .from('koi')
        .select('*')
        .eq('user_id', user.id)
        .eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent ID to get empty result
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading archived koi:', error)
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

      // Transform data
      const transformedKoi: ArchivedKoi[] = data.map((koi: any) => ({
        id: koi.id,
        name: koi.name || koi.species || 'Onbekend',
        variety: koi.species || 'Onbekend',
        age: koi.age_years || 0,
        length: koi.size_cm || 0,
        color: koi.color || '',
        archive_reason: koi.archive_reason || 'overige',
        archive_date: koi.archive_date,
        purchase_date: koi.purchase_date,
        age_at_purchase: koi.age_at_purchase,
        primary_photo_url: primaryPhotos.get(koi.id)
      }))

      setArchivedKoi(transformedKoi)
    } catch (error) {
      console.error('Error loading archived koi:', error)
    } finally {
      setLoading(false)
    }
  }

  const getArchiveReasonLabel = (reason: string) => {
    switch (reason) {
      case 'overleden': return 'Overleden'
      case 'verkocht': return 'Verkocht'
      case 'overige': return 'Overige'
      default: return 'Onbekend'
    }
  }

  const getArchiveReasonColor = (reason: string) => {
    switch (reason) {
      case 'overleden': return 'bg-red-100 text-red-800 border-red-200'
      case 'verkocht': return 'bg-green-100 text-green-800 border-green-200'
      case 'overige': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatArchiveDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleViewKoi = (koi: ArchivedKoi) => {
    onEditKoi(koi.id, koi.name)
    onNavigate("koi-edit")
  }

  const handleUnarchiveKoi = async (koi: ArchivedKoi) => {
    setUnarchiving(koi.id)

    try {
      const { error } = await supabase
        .from('koi')
        .update({
          archived: false,
          archive_reason: null,
          archive_date: null
        })
        .eq('id', koi.id)

      if (error) {
        console.error('Error unarchiving koi:', error)
        return
      }

      // Remove from archived list
      setArchivedKoi(prev => prev.filter(k => k.id !== koi.id))

    } catch (error) {
      console.error('Error in handleUnarchiveKoi:', error)
    } finally {
      setUnarchiving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Archief laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate("koi")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar Koi
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Koi Archief</h1>
          <p className="text-gray-600">Overzicht van gearchiveerde koi</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Totaal gearchiveerd</p>
                <p className="text-2xl font-bold">{archivedKoi.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-red-500"></div>
              <div>
                <p className="text-sm text-gray-600">Overleden</p>
                <p className="text-2xl font-bold">
                  {archivedKoi.filter(k => k.archive_reason === 'overleden').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-green-500"></div>
              <div>
                <p className="text-sm text-gray-600">Verkocht</p>
                <p className="text-2xl font-bold">
                  {archivedKoi.filter(k => k.archive_reason === 'verkocht').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Archived Koi List */}
      {archivedKoi.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <User className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Geen gearchiveerde koi</h3>
            <p className="text-gray-600">Er zijn nog geen koi gearchiveerd.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {archivedKoi.map((koi) => (
            <Card key={koi.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  {/* Photo */}
                  <div className="flex-shrink-0">
                    {koi.primary_photo_url ? (
                      <img
                        src={koi.primary_photo_url}
                        alt={koi.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center">
                        <User className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Koi Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {koi.name}
                      </h3>
                      <Badge 
                        variant="outline" 
                        className={getArchiveReasonColor(koi.archive_reason)}
                      >
                        {getArchiveReasonLabel(koi.archive_reason)}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Variëteit:</span> {koi.variety}
                      </div>
                      <div>
                        <span className="font-medium">Laatste leeftijd:</span> {
                          koi.purchase_date && koi.age_at_purchase !== undefined 
                            ? getAgeDisplayText(calculateCurrentAge(koi.purchase_date, koi.age_at_purchase))
                            : `${koi.age} jaar`
                        }
                      </div>
                      <div>
                        <span className="font-medium">Gearchiveerd op:</span> {formatArchiveDate(koi.archive_date)}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewKoi(koi)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Bekijk
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleUnarchiveKoi(koi)}
                      disabled={unarchiving === koi.id}
                      className="flex items-center gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      {unarchiving === koi.id ? 'Terugzetten...' : 'Naar Collectie'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
