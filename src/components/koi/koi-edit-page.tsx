import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhotoUpload } from "@/components/ui/photo-upload"
import { ArrowLeft, Image, Save, Pencil, Check, X, Trash2, Plus, Star } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { useToast } from "@/hooks/use-toast"
import { calculateCurrentAge, getAgeDisplayText } from "@/lib/koi-age-utils"
import { KoiLogbook } from "./koi-logbook"

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
  purchase_date?: string
  age_at_purchase?: number
  length_at_purchase?: number
  location?: string
}

interface KoiPhoto {
  id: string
  koi_id: string
  photo_url: string
  is_primary: boolean
  display_order: number
}

interface KoiEditPageProps {
  onNavigate: (tab: string) => void
  koiId: string
  onKoiUpdated?: () => void // Callback voor wanneer koi data wordt bijgewerkt
}

export function KoiEditPage({ onNavigate, koiId, onKoiUpdated }: KoiEditPageProps) {
  const { user } = useAuth()
  const { uploadPhoto, uploading } = usePhotoUpload()
  const { toast } = useToast()
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [koi, setKoi] = useState<Koi | null>(null)
  const [koiPhotos, setKoiPhotos] = useState<KoiPhoto[]>([])
  const [editingField, setEditingField] = useState<string | null>(null)
  const [currentLength, setCurrentLength] = useState<number | null>(null)
  const [tempValue, setTempValue] = useState<string>("")

  useEffect(() => {
    if (user && koiId) {
      loadKoiData()
      loadCurrentLength()
    }
  }, [user, koiId])

  const loadKoiData = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('koi')
        .select('*')
        .eq('id', koiId)
        .eq('user_id', user?.id)
        .single()

      if (error) {
        console.error('Error loading koi data:', error)
        toast({
          title: "Fout",
          description: "Kon koi gegevens niet laden.",
          variant: "destructive",
        })
        onNavigate("koi")
        return
      }

      // Load koi photos
      const { data: photosData, error: photosError } = await supabase
        .from('koi_photos')
        .select('*')
        .eq('koi_id', koiId)
        .order('display_order', { ascending: true })

      if (photosError) {
        console.error('Error loading koi photos:', photosError)
        // Don't fail the entire load if photos fail
      } else {
        setKoiPhotos(photosData || [])
      }

      // Transform database data to match our interface
      const transformedKoi: Koi = {
        id: data.id,
        name: data.name,
        variety: data.species || data.variety || 'Unknown',
        age: data.age_years || 0,
        length: data.size_cm || 0,
        weight: data.weight,
        color: data.color || '',
        healthStatus: 'excellent' as const, // Default for now
        dateAdded: data.purchase_date || data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        notes: data.notes || undefined,
        photo_url: data.photo_url || undefined,
        breeder: data.breeder || undefined,
        dealer: data.dealer || undefined,
        purchase_price: data.purchase_price || undefined,
        purchase_date: data.purchase_date || undefined,
        age_at_purchase: data.age_at_purchase || undefined,
        length_at_purchase: data.length_at_purchase || undefined,
        location: data.location || 'pond'
      }

      setKoi(transformedKoi)
    } catch (error) {
      console.error('Error in loadKoiData:', error)
      toast({
        title: "Fout",
        description: "Kon koi gegevens niet laden.",
        variant: "destructive",
      })
        onNavigate("koi")
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentLength = async () => {
    try {
      // Haal de laatste meting op
      const { data, error } = await supabase
        .from('koi_log_entries')
        .select('length_cm')
        .eq('koi_id', koiId)
        .eq('entry_type', 'measurement')
        .not('length_cm', 'is', null)
        .order('entry_date', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error loading current length:', error)
        return
      }

      if (data?.length_cm) {
        setCurrentLength(data.length_cm)
      }
    } catch (error) {
      console.error('Error in loadCurrentLength:', error)
    }
  }

  const handlePhotoSelected = async (photoUrl: string, photoFile: File) => {
    try {
      const result = await uploadPhoto(photoFile, 'koi-photos')
      if (result && koi) {
        // Add new photo to koi_photos table
        const { data, error } = await supabase
          .from('koi_photos')
          .insert({
            koi_id: koi.id,
            photo_url: result.url,
            is_primary: koiPhotos.length === 0, // First photo is primary
            display_order: koiPhotos.length
          })
          .select()
          .single()

        if (error) {
          console.error('Error saving photo to database:', error)
          toast({
            title: "Fout",
            description: "Foto geüpload maar niet opgeslagen in database.",
            variant: "destructive",
          })
        } else {
          setKoiPhotos(prev => [...prev, data])
          toast({
            title: "Succes",
            description: "Foto toegevoegd aan koi.",
          })
        }
        setShowPhotoUpload(false)
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast({
        title: "Fout",
        description: "Kon foto niet uploaden.",
        variant: "destructive",
      })
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const { error } = await supabase
        .from('koi_photos')
        .delete()
        .eq('id', photoId)

      if (error) {
        console.error('Error deleting photo:', error)
        toast({
          title: "Fout",
          description: "Kon foto niet verwijderen.",
          variant: "destructive",
        })
      } else {
        setKoiPhotos(prev => prev.filter(photo => photo.id !== photoId))
        toast({
          title: "Succes",
          description: "Foto verwijderd.",
        })
      }
    } catch (error) {
      console.error('Error deleting photo:', error)
      toast({
        title: "Fout",
        description: "Kon foto niet verwijderen.",
        variant: "destructive",
      })
    }
  }

  const handleSetPrimaryPhoto = async (photoId: string) => {
    try {
      // First, unset all primary photos
      const { error: unsetError } = await supabase
        .from('koi_photos')
        .update({ is_primary: false })
        .eq('koi_id', koiId)

      if (unsetError) {
        console.error('Error unsetting primary photos:', unsetError)
        toast({
          title: "Fout",
          description: "Kon primaire foto niet bijwerken.",
          variant: "destructive",
        })
        return
      }

      // Then set the selected photo as primary
      const { error: setError } = await supabase
        .from('koi_photos')
        .update({ is_primary: true })
        .eq('id', photoId)

      if (setError) {
        console.error('Error setting primary photo:', setError)
        toast({
          title: "Fout",
          description: "Kon primaire foto niet instellen.",
          variant: "destructive",
        })
      } else {
        // Update local state immediately for better UX
        setKoiPhotos(prev => prev.map(photo => ({
          ...photo,
          is_primary: photo.id === photoId
        })))
        
        toast({
          title: "Primaire foto bijgewerkt",
          description: "De primaire foto is succesvol gewijzigd.",
        })
      }
    } catch (error) {
      console.error('Error setting primary photo:', error)
      toast({
        title: "Fout",
        description: "Kon primaire foto niet instellen.",
        variant: "destructive",
      })
    }
  }

  const startEditing = (field: string, currentValue: any) => {
    setEditingField(field)
    setTempValue(currentValue?.toString() || "")
  }

  const cancelEditing = () => {
    setEditingField(null)
    setTempValue("")
  }

  const saveField = async (field: string) => {
    if (!koi) return

    try {
      const updateData: any = {}
      
      // Convert value based on field type
      if (field === 'age' || field === 'length' || field === 'age_at_purchase' || field === 'length_at_purchase') {
        updateData[field] = parseInt(tempValue) || 0
      } else if (field === 'weight' || field === 'purchase_price') {
        updateData[field] = parseFloat(tempValue) || null
      } else if (field === 'purchase_date') {
        updateData[field] = tempValue || null
      } else {
        updateData[field] = tempValue || null
      }

      const { error } = await supabase
        .from('koi')
        .update(updateData)
        .eq('id', koi.id)

      if (error) {
        console.error('Error updating field:', error)
        toast({
          title: "Fout",
          description: "Kon veld niet bijwerken: " + error.message,
          variant: "destructive",
        })
        return
      }

      // Update local state
      setKoi(prev => prev ? { ...prev, ...updateData } : null)
      setEditingField(null)
      setTempValue("")

      toast({
        title: "Bijgewerkt",
        description: "Veld is succesvol bijgewerkt.",
      })

    } catch (error) {
      console.error('Error in saveField:', error)
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het bijwerken.",
        variant: "destructive",
      })
    }
  }

  const handleUpdateKoi = async () => {
    if (!koi || !koi.name || !koi.variety || !koi.age || !koi.length) {
      toast({
        title: "Ontbrekende informatie",
        description: "Vul alle verplichte velden in.",
        variant: "destructive",
      })
      return
    }

    if (!user) {
      toast({
        title: "Authenticatie vereist",
        description: "Je moet ingelogd zijn om koi te bewerken.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase
        .from('koi')
        .update({
          name: koi.name,
          species: koi.variety,
          age_years: parseInt(koi.age.toString()),
          size_cm: parseInt(koi.length.toString()),
          weight: koi.weight ? parseFloat(koi.weight.toString()) : null,
          color: koi.color,
          notes: koi.notes || null,
          photo_url: koi.photo_url || null,
          breeder: koi.breeder || null,
          dealer: koi.dealer || null,
          purchase_price: koi.purchase_price ? parseFloat(koi.purchase_price.toString()) : null,
          location: koi.location || 'pond'
        })
        .eq('id', koi.id)

      if (error) {
        console.error('Error updating koi:', error)
        toast({
          title: "Opslag fout",
          description: "Fout bij bijwerken koi: " + error.message,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Koi bijgewerkt",
        description: "Je koi is succesvol bijgewerkt.",
      })

      // Navigate back to koi management
      onNavigate("koi")

    } catch (error) {
      console.error('Error in handleUpdateKoi:', error)
      toast({
        title: "Opslag fout",
        description: "Er is een onverwachte fout opgetreden.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Koi gegevens laden...</p>
        </div>
      </div>
    )
  }

  if (!koi) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Koi niet gevonden</h2>
        <p className="text-muted-foreground mb-4">De gevraagde koi kon niet worden gevonden.</p>
        <Button onClick={() => onNavigate("koi")}>
          Terug naar Collectie
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Koi Details</h1>
          <p className="text-muted-foreground">Bekijk en bewerk de details van {koi.name}</p>
        </div>
        <Button variant="outline" onClick={() => onNavigate("koi")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar Collectie
        </Button>
      </div>

      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Section - Koi Photos */}
            <div className="lg:col-span-1 space-y-4">
              {/* Primary Photo */}
              {(koiPhotos.length > 0 || koi.photo_url) && (
                <div className="relative">
                  <div className="w-64 h-96 relative">
                    <img 
                      src={koiPhotos.find(p => p.is_primary)?.photo_url || koiPhotos[0]?.photo_url || koi.photo_url} 
                      alt={`${koi.name} primary photo`}
                      className="w-full h-full object-cover rounded-xl shadow-lg"
                    />
                    {/* Primary Photo Indicator */}
                    <div className="absolute top-2 left-2">
                      <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Primaire foto
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Photos Grid */}
              {koiPhotos.length > 1 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Extra foto's</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {koiPhotos
                      .filter(photo => !photo.is_primary)
                      .slice(0, 4) // Max 4 additional photos
                      .map((photo, index) => (
                        <div key={photo.id} className="relative group">
                          <div className="w-full aspect-[9/16] relative">
                            <img 
                              src={photo.photo_url} 
                              alt={`${koi.name} photo ${index + 2}`}
                              className={`w-full h-full object-cover rounded-lg shadow-sm ${
                                photo.is_primary ? 'ring-2 ring-yellow-500' : ''
                              }`}
                            />
                            {/* Primary indicator for extra photos */}
                            {photo.is_primary && (
                              <div className="absolute top-1 left-1">
                                <div className="bg-yellow-500 text-white text-xs px-1 py-0.5 rounded-full">
                                  <Star className="h-2 w-2 fill-current" />
                                </div>
                              </div>
                            )}
                            {/* Photo actions overlay */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleSetPrimaryPhoto(photo.id)}
                                  className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                                  title="Maak primaire foto"
                                >
                                  <Star className="h-3 w-3 text-yellow-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeletePhoto(photo.id)}
                                  className="h-6 w-6 p-0 bg-red-500/90 hover:bg-red-500"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Add Photo Button */}
              <Button 
                variant="outline" 
                onClick={() => setShowPhotoUpload(true)}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Foto Toevoegen
              </Button>
            </div>

            {/* Right Section - Koi Information */}
            <div className="lg:col-span-2 space-y-6">
              {/* Header */}
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{koi.name}</h2>
                <p className="text-lg text-gray-600">{koi.variety}</p>
              </div>

              {/* Details Grid */}
              <div className="space-y-2">
                {/* Basis Informatie */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-0">Basis Informatie</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                {/* Naam */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Naam</p>
                      {editingField === 'name' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveField('name')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">{koi.name}</p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('name', koi.name)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Variëteit */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Variëteit</p>
                      {editingField === 'variety' ? (
                        <div className="flex items-center gap-2">
                          <Select value={tempValue} onValueChange={setTempValue}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Asagi">Asagi</SelectItem>
                              <SelectItem value="Bekko">Bekko</SelectItem>
                              <SelectItem value="Goshiki">Goshiki</SelectItem>
                              <SelectItem value="Kohaku">Kohaku</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                              <SelectItem value="Sanke">Sanke</SelectItem>
                              <SelectItem value="Showa">Showa</SelectItem>
                              <SelectItem value="Shusui">Shusui</SelectItem>
                              <SelectItem value="Tancho Kohaku">Tancho Kohaku</SelectItem>
                              <SelectItem value="Tancho Showa">Tancho Showa</SelectItem>
                              <SelectItem value="Utsuri">Utsuri</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" onClick={() => saveField('variety')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">{koi.variety}</p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('variety', koi.variety)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Gezondheidsstatus */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Gezondheidsstatus</p>
                      {editingField === 'healthStatus' ? (
                        <div className="flex items-center gap-2">
                          <Select value={tempValue} onValueChange={setTempValue}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="excellent">Uitstekend</SelectItem>
                              <SelectItem value="good">Goed</SelectItem>
                              <SelectItem value="needs-attention">Aandacht Nodig</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" onClick={() => saveField('healthStatus')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-semibold px-3 py-1 rounded-full ${
                            koi.healthStatus === 'excellent' ? 'bg-green-100 text-green-800' :
                            koi.healthStatus === 'good' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {koi.healthStatus === 'excellent' ? 'Uitstekend' : 
                             koi.healthStatus === 'good' ? 'Goed' : 'Aandacht Nodig'}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('healthStatus', koi.healthStatus)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                  </div>
                </div>

                {/* Huidige Metingen */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-0">Huidige Metingen</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

                {/* Huidige Leeftijd (Automatisch berekend) */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Huidige Leeftijd</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-semibold text-gray-900">
                          {koi.purchase_date && koi.age_at_purchase !== undefined 
                            ? getAgeDisplayText(calculateCurrentAge(koi.purchase_date, koi.age_at_purchase))
                            : 'Onbekend'
                          }
                        </p>
                        <span className="text-xs text-gray-500 bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Automatisch
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Huidige Lengte */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Huidige Lengte</p>
                      {editingField === 'length' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveField('length')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">
                            {currentLength || koi.length_at_purchase || koi.length} cm
                          </p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('length', currentLength || koi.length_at_purchase || koi.length)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Locatie */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Locatie</p>
                      {editingField === 'location' ? (
                        <div className="flex items-center gap-2">
                          <Select value={tempValue} onValueChange={setTempValue}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pond">Vijver</SelectItem>
                              <SelectItem value="quarantine">Quarantaine</SelectItem>
                              <SelectItem value="hospital">Ziekenboeg</SelectItem>
                              <SelectItem value="breeding_tank">Kweekbak</SelectItem>
                              <SelectItem value="breeder">Kweker</SelectItem>
                              <SelectItem value="dealer">Dealer</SelectItem>
                              <SelectItem value="other">Anders</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" onClick={() => saveField('location')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">
                            {koi.location === 'pond' ? 'Vijver' :
                             koi.location === 'quarantine' ? 'Quarantaine' :
                             koi.location === 'hospital' ? 'Ziekenboeg' :
                             koi.location === 'breeding_tank' ? 'Kweekbak' :
                             koi.location === 'breeder' ? 'Kweker' :
                             koi.location === 'dealer' ? 'Dealer' :
                             koi.location === 'other' ? 'Anders' : 'Vijver'}
                          </p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('location', koi.location || 'pond')} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                  </div>
                </div>

                {/* Aanschaf Informatie */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-0">Aanschaf Informatie</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

                {/* Datum Aanschaf */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Datum Aanschaf</p>
                      {editingField === 'purchase_date' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveField('purchase_date')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">
                            {koi.purchase_date ? new Date(koi.purchase_date).toLocaleDateString('nl-NL') : 'Onbekend'}
                          </p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('purchase_date', koi.purchase_date)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Leeftijd bij Aanschaf */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Leeftijd bij Aanschaf</p>
                      {editingField === 'age_at_purchase' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveField('age_at_purchase')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">
                            {koi.age_at_purchase ? `${koi.age_at_purchase} jaar` : 'Onbekend'}
                          </p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('age_at_purchase', koi.age_at_purchase)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lengte bij Aanschaf */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Lengte bij Aanschaf</p>
                      {editingField === 'length_at_purchase' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveField('length_at_purchase')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">
                            {koi.length_at_purchase ? `${koi.length_at_purchase} cm` : 'Onbekend'}
                          </p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('length_at_purchase', koi.length_at_purchase)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Aankoopbedrag */}
                {koi.purchase_price && (
                  <div className="bg-gray-50 rounded-lg p-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Aankoopbedrag</p>
                        {editingField === 'purchase_price' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="flex-1"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={() => saveField('purchase_price')} className="h-8 w-8 p-0">
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold text-gray-900">€{koi.purchase_price.toFixed(2)}</p>
                            <Button size="sm" variant="ghost" onClick={() => startEditing('purchase_price', koi.purchase_price)} className="h-8 w-8 p-0">
                              <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                </div>

                {/* Herkomst */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-0">Herkomst</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

                {/* Kweker */}
                <div className="bg-gray-50 rounded-lg p-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">Kweker</p>
                      {editingField === 'breeder' ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={() => saveField('breeder')} className="h-8 w-8 p-0">
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold text-gray-900">{koi.breeder || 'Onbekend'}</p>
                          <Button size="sm" variant="ghost" onClick={() => startEditing('breeder', koi.breeder)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dealer */}
                {koi.dealer && (
                  <div className="bg-gray-50 rounded-lg p-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500 mb-1">Dealer</p>
                        {editingField === 'dealer' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="flex-1"
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={() => saveField('dealer')} className="h-8 w-8 p-0">
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0">
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-lg font-semibold text-gray-900">{koi.dealer}</p>
                            <Button size="sm" variant="ghost" onClick={() => startEditing('dealer', koi.dealer)} className="h-8 w-8 p-0">
                              <Pencil className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center pt-6">
                <Button 
                  onClick={handleUpdateKoi} 
                  disabled={saving || uploading}
                  className="px-6"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Opslaan...' : uploading ? 'Uploaden...' : 'Alle Wijzigingen Opslaan'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Upload Modal */}
      {showPhotoUpload && (
        <PhotoUpload
          onPhotoSelected={handlePhotoSelected}
          onClose={() => setShowPhotoUpload(false)}
          title="Koi Foto Bijwerken"
          description="Selecteer een nieuwe foto van je koi van je apparaat"
        />
      )}

      {/* Koi Logboek */}
      <div className="mt-8 max-w-4xl mx-auto">
        <KoiLogbook 
          koiId={koiId} 
          onMeasurementAdded={() => {
            // Refresh current length when a measurement is added
            loadCurrentLength();
            // Notify parent component that koi data has been updated
            if (onKoiUpdated) {
              onKoiUpdated();
            }
          }}
          onViewAll={() => {
            // Navigate to logbook overview page
            onNavigate('koi-logbook-overview');
          }}
        />
      </div>
    </div>
  )
}
