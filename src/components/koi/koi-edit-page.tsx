import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PhotoUpload } from "@/components/ui/photo-upload"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ArrowLeft, Image, Save, Pencil, Check, X, Trash2, Plus, Star, BarChart3, Archive, Printer } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { usePhotoUpload } from "@/hooks/use-photo-upload"
import { useToast } from "@/hooks/use-toast"
import { calculateCurrentAge, getAgeDisplayText } from "@/lib/koi-age-utils"
import { KoiLogbook } from "./koi-logbook"
import { GrowthChart } from "./growth-chart"

// Helper function to extract healthStatus from notes
function extractHealthStatusFromNotes(notes: string | null): "excellent" | "good" | "needs-attention" | null {
  if (!notes) return null
  const match = notes.match(/\[HealthStatus: ([^\]]+)\]/)
  if (!match) return null
  const status = match[1]
  if (status === 'excellent' || status === 'good' || status === 'needs-attention') {
    return status
  }
  return null
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
  purchase_date?: string
  age_at_purchase?: number
  length_at_purchase?: number
  location?: string
  archived?: boolean
  archive_reason?: string
  archive_date?: string
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
  const { user, session } = useAuth()
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
  const [showGrowthChart, setShowGrowthChart] = useState(false)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [archiveReason, setArchiveReason] = useState<string>("")
  const [isArchiving, setIsArchiving] = useState(false)

  useEffect(() => {
    if (user && koiId) {
      loadKoiData()
      loadCurrentLength()
    }
  }, [user, koiId])

  const loadKoiData = async () => {
    try {
      setLoading(true)
      
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading koi data using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi?id=eq.${koiId}&user_id=eq.${user?.id}&select=*`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const dataArray = await response.json()
          const data = dataArray && dataArray.length > 0 ? dataArray[0] : null
          
          if (!data) {
            throw new Error('No koi data found')
          }
          
          // Continue with photo loading and transformation...
          // Load koi photos using direct fetch
          const photosResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_photos?koi_id=eq.${koiId}&select=*&order=display_order.asc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          let photosData = []
          if (photosResponse.ok) {
            photosData = await photosResponse.json()
          }
          
          setKoiPhotos(photosData || [])
          
          // Transform database data (same as normal path below)
          // ... transformation code will be added below
          const transformedKoi = {
            id: data.id,
            name: data.name || data.species || 'Unknown',
            variety: data.species || 'Unknown',
            age: data.age_years || 0,
            length: data.size_cm || 0,
            weight: data.weight,
            color: data.color || '',
            healthStatus: extractHealthStatusFromNotes(data.notes) || data.healthStatus || 'good',
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
          setLoading(false)
          return
        } catch (error) {
          console.error('Error loading koi data with direct fetch:', error)
          toast({
            title: "Fout",
            description: "Kon koi gegevens niet laden.",
            variant: "destructive",
          })
          onNavigate("koi")
          return
        }
      }
      
      // Normal Supabase query path
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
        name: data.name || data.species || 'Unknown', // Use species as name if no name provided
        variety: data.species || 'Unknown',
        age: data.age_years || 0,
        length: data.size_cm || 0,
        weight: data.weight,
        color: data.color || '',
        healthStatus: extractHealthStatusFromNotes(data.notes) ?? 'good',
        dateAdded: data.purchase_date || data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        notes: data.notes || undefined,
        photo_url: data.photo_url || undefined,
        breeder: data.breeder || undefined,
        dealer: data.dealer || undefined,
        purchase_price: data.purchase_price || undefined,
        purchase_date: data.purchase_date || undefined,
        age_at_purchase: data.age_at_purchase || undefined,
        length_at_purchase: data.length_at_purchase || undefined,
        location: data.location || 'pond',
        archived: data.archived || false,
        archive_reason: data.archive_reason || undefined,
        archive_date: data.archive_date || undefined
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
    if (!user || !koiId) {
      return
    }

    try {
      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // If no Supabase session but we have React session, use direct fetch
      if (!currentSession && session?.access_token) {
        try {
          console.log('Loading current length using direct fetch with access token...')
          // Fetch all measurements and filter in JavaScript to avoid REST API syntax issues
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/koi_log_entries?koi_id=eq.${koiId}&entry_type=eq.measurement&select=length_cm,entry_date&order=entry_date.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (!response.ok) {
            // If 404 or no data, that's okay - just means no measurements yet
            if (response.status === 404 || response.status === 406) {
              console.log('No measurements found for current length')
              return
            }
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const data = await response.json()
          const measurements = Array.isArray(data) ? data : [data]
          
          // Find the first measurement with a non-null length_cm
          const measurement = measurements.find((m: any) => m.length_cm != null)
          
          if (measurement?.length_cm) {
            console.log('Loaded current length (direct fetch):', measurement.length_cm, 'cm')
            setCurrentLength(measurement.length_cm)
          } else {
            console.log('No measurements with length found for current length')
          }
          return
        } catch (error: any) {
          console.error('Error loading current length with direct fetch:', error)
          // Don't throw - just return, we'll fall back to length_at_purchase
          return
        }
      }

      // Normal Supabase query
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
        console.log('Loaded current length (normal query):', data.length_cm, 'cm')
        setCurrentLength(data.length_cm)
      } else {
        // Reset to null if no measurement found, so it falls back to length_at_purchase
        setCurrentLength(null)
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
      
      // Save healthStatus to notes field in database
      if (field === 'healthStatus') {
        console.log(`Updating healthStatus to: ${tempValue}`)
        // Update notes field with healthStatus
        const currentNotes = koi.notes || ''
        const healthStatusNote = `[HealthStatus: ${tempValue}]`
        let newNotes = currentNotes
        
        if (currentNotes.includes('[HealthStatus:')) {
          // Replace existing healthStatus
          newNotes = currentNotes.replace(/\[HealthStatus:[^\]]+\]/, healthStatusNote)
        } else {
          // Add new healthStatus
          newNotes = currentNotes + (currentNotes ? ' ' : '') + healthStatusNote
        }
        
        updateData['notes'] = newNotes
        // Also update local state
        setKoi(prev => prev ? { 
          ...prev, 
          healthStatus: (tempValue === 'excellent' || tempValue === 'good' || tempValue === 'needs-attention') 
            ? tempValue as "excellent" | "good" | "needs-attention"
            : prev.healthStatus
        } : null)
        
        // Skip the rest of the function to avoid healthStatus column error
        const { data, error } = await supabase
          .from('koi')
          .update(updateData)
          .eq('id', koi.id)
        
        if (error) {
          console.error('Error updating field:', error)
          toast({
            title: "Fout",
            description: `Kon veld niet bijwerken: ${error.message}`,
            variant: "destructive",
          })
          return
        }
        
        setEditingField(null)
        setTempValue("")
        toast({
          title: "Bijgewerkt",
          description: "Gezondheidsstatus is bijgewerkt.",
        })
        return
      } else if (field === 'location') {
        console.log(`Updating location to: ${tempValue}`)
        updateData['location'] = tempValue || null
      }
      
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
    if (!koi || !koi.variety || !koi.age || !koi.length) {
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
          name: koi.name || koi.variety, // Use variety as name if no name provided
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

  const handleArchiveKoi = async () => {
    toast({
      title: "Archief functionaliteit",
      description: "Archief functionaliteit is tijdelijk uitgeschakeld. Controleer of de database update is uitgevoerd.",
      variant: "destructive",
    })
    setShowArchiveDialog(false)
  }

  const handleUnarchiveKoi = async () => {
    toast({
      title: "Archief functionaliteit",
      description: "Archief functionaliteit is tijdelijk uitgeschakeld. Controleer of de database update is uitgevoerd.",
      variant: "destructive",
    })
  }

  const handlePrint = async () => {
    if (!koi) return

    try {
      // Haal recente logboek entries op voor print
      const { data: logEntries = [] } = await supabase
        .from('koi_log_entries')
        .select('*')
        .eq('koi_id', koiId)
        .order('entry_date', { ascending: false })
        .limit(10)

      // Maak een nieuw venster voor print
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast({
          title: "Print fout",
          description: "Kon print venster niet openen. Controleer pop-up blocker.",
          variant: "destructive",
        })
        return
      }

      // Haal primaire foto op
      const primaryPhoto = koiPhotos.find(p => p.is_primary)?.photo_url || koiPhotos[0]?.photo_url || koi.photo_url
      
      // Format datum helper
      const formatDate = (date: string | undefined) => {
        if (!date) return 'Onbekend'
        return new Date(date).toLocaleDateString('nl-NL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }

      // Format gezondheidsstatus
      const healthStatusText = {
        'excellent': 'Uitstekend',
        'good': 'Goed',
        'needs-attention': 'Aandacht Nodig'
      }[koi.healthStatus] || koi.healthStatus

      // Format locatie
      const locationText = {
        'pond': 'Vijver',
        'quarantine': 'Quarantaine',
        'hospital': 'Ziekenboeg',
        'breeding_tank': 'Kweekbak',
        'breeder': 'Kweker',
        'dealer': 'Dealer',
        'other': 'Anders'
      }[koi.location || 'pond'] || 'Vijver'

      // Format entry type
      const entryTypeLabels: { [key: string]: string } = {
        'measurement': 'Meting',
        'medication': 'Medicijngebruik',
        'note': 'Opmerking',
        'behavior': 'Gedrag',
        'treatment': 'Ziekte/Behandeling'
      }

      // Bereken huidige leeftijd
      const currentAge = koi.purchase_date && koi.age_at_purchase !== undefined 
        ? getAgeDisplayText(calculateCurrentAge(koi.purchase_date, koi.age_at_purchase))
        : 'Onbekend'

      // Schrijf print HTML
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Koi Details - ${koi.name}</title>
            <meta charset="utf-8">
            <style>
              @page {
                margin: 1.5cm;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                color: #333;
                line-height: 1.6;
                max-width: 800px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                border-bottom: 3px solid #2563eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .header h1 {
                color: #2563eb;
                margin: 0;
                font-size: 32px;
              }
              .header .subtitle {
                color: #666;
                margin-top: 5px;
                font-size: 14px;
              }
              .content {
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 30px;
                margin-bottom: 30px;
              }
              .photo-section {
                text-align: center;
              }
              .photo-section img {
                max-width: 100%;
                height: auto;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                margin-bottom: 10px;
              }
              .photo-section .photo-label {
                font-size: 12px;
                color: #666;
              }
              .info-section {
                display: flex;
                flex-direction: column;
                gap: 20px;
              }
              .section {
                margin-bottom: 25px;
              }
              .section-title {
                font-size: 18px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 15px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 5px;
              }
              .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
              }
              .info-item {
                margin-bottom: 12px;
              }
              .info-label {
                font-size: 12px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 3px;
              }
              .info-value {
                font-size: 16px;
                font-weight: 600;
                color: #111;
              }
              .full-width {
                grid-column: 1 / -1;
              }
              .badge {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 500;
              }
              .badge-excellent {
                background-color: #dcfce7;
                color: #166534;
              }
              .badge-good {
                background-color: #dbeafe;
                color: #1e40af;
              }
              .badge-attention {
                background-color: #fef3c7;
                color: #92400e;
              }
              .logbook-section {
                margin-top: 30px;
                page-break-inside: avoid;
              }
              .logbook-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
              }
              .logbook-table th {
                background-color: #f3f4f6;
                padding: 10px;
                text-align: left;
                font-size: 12px;
                text-transform: uppercase;
                color: #666;
                border-bottom: 2px solid #e5e7eb;
              }
              .logbook-table td {
                padding: 10px;
                border-bottom: 1px solid #e5e7eb;
                font-size: 14px;
              }
              .logbook-table tr:last-child td {
                border-bottom: none;
              }
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                font-size: 12px;
                color: #666;
              }
              @media print {
                .no-print {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Koi Details Overzicht</h1>
              <div class="subtitle">Gegenereerd op ${new Date().toLocaleDateString('nl-NL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
            </div>

            <div class="content">
              ${primaryPhoto ? `
                <div class="photo-section">
                  <img src="${primaryPhoto}" alt="${koi.name}" />
                  <div class="photo-label">${koi.name}</div>
                </div>
              ` : ''}

              <div class="info-section">
                <div class="section">
                  <div class="section-title">Basis Informatie</div>
                  <div class="info-grid">
                    <div class="info-item">
                      <div class="info-label">Naam</div>
                      <div class="info-value">${koi.name}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Variëteit</div>
                      <div class="info-value">${koi.variety}</div>
                    </div>
                    <div class="info-item full-width">
                      <div class="info-label">Gezondheidsstatus</div>
                      <div class="info-value">
                        <span class="badge badge-${koi.healthStatus === 'excellent' ? 'excellent' : koi.healthStatus === 'good' ? 'good' : 'attention'}">
                          ${healthStatusText}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Huidige Metingen</div>
                  <div class="info-grid">
                    <div class="info-item">
                      <div class="info-label">Huidige Leeftijd</div>
                      <div class="info-value">${currentAge}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Huidige Lengte</div>
                      <div class="info-value">${currentLength || koi.length_at_purchase || koi.length} cm</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Locatie</div>
                      <div class="info-value">${locationText}</div>
                    </div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-title">Aanschaf Informatie</div>
                  <div class="info-grid">
                    <div class="info-item">
                      <div class="info-label">Datum Aanschaf</div>
                      <div class="info-value">${formatDate(koi.purchase_date)}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Leeftijd bij Aanschaf</div>
                      <div class="info-value">${koi.age_at_purchase ? `${koi.age_at_purchase} jaar` : 'Onbekend'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Lengte bij Aanschaf</div>
                      <div class="info-value">${koi.length_at_purchase ? `${koi.length_at_purchase} cm` : 'Onbekend'}</div>
                    </div>
                    ${koi.purchase_price ? `
                      <div class="info-item">
                        <div class="info-label">Aankoopbedrag</div>
                        <div class="info-value">€${koi.purchase_price.toFixed(2)}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>

                ${(koi.breeder || koi.dealer) ? `
                  <div class="section">
                    <div class="section-title">Herkomst</div>
                    <div class="info-grid">
                      ${koi.breeder ? `
                        <div class="info-item">
                          <div class="info-label">Kweker</div>
                          <div class="info-value">${koi.breeder}</div>
                        </div>
                      ` : ''}
                      ${koi.dealer ? `
                        <div class="info-item">
                          <div class="info-label">Dealer</div>
                          <div class="info-value">${koi.dealer}</div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                ` : ''}

                ${koi.notes ? `
                  <div class="section">
                    <div class="section-title">Notities</div>
                    <div class="info-value" style="font-weight: normal; font-size: 14px; white-space: pre-wrap;">${koi.notes.replace(/\[HealthStatus:[^\]]+\]/g, '').trim() || 'Geen notities'}</div>
                  </div>
                ` : ''}
              </div>
            </div>

            ${logEntries && logEntries.length > 0 ? `
              <div class="logbook-section">
                <div class="section-title">Recent Logboek Overzicht</div>
                <table class="logbook-table">
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Type</th>
                      <th>Beschrijving</th>
                      ${logEntries.some(e => e.length_cm) ? '<th>Lengte</th>' : ''}
                    </tr>
                  </thead>
                  <tbody>
                    ${logEntries.map(entry => `
                      <tr>
                        <td>${formatDate(entry.entry_date)}</td>
                        <td>${entryTypeLabels[entry.entry_type] || entry.entry_type}</td>
                        <td>${entry.description}</td>
                        ${entry.length_cm ? `<td>${entry.length_cm} cm</td>` : ''}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <div class="footer">
              <p>Dit document is gegenereerd vanuit Koi Pond Pal</p>
            </div>

            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `)

      printWindow.document.close()
      
      toast({
        title: "Print voorbereiden",
        description: "Print dialoog wordt geopend...",
      })
    } catch (error) {
      console.error('Error printing:', error)
      toast({
        title: "Print fout",
        description: "Er is een fout opgetreden bij het voorbereiden van de print.",
        variant: "destructive",
      })
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
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={() => onNavigate("koi")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Koi Details</h1>
            <p className="text-muted-foreground">Bekijk en bewerk de details van {koi.name}</p>
          </div>
        </div>
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

              {/* Print Button */}
              <Button 
                variant="outline" 
                onClick={handlePrint}
                className="w-full"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Details
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
                              <SelectItem value="Benigoi">Benigoi</SelectItem>
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
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setShowGrowthChart(true)} 
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                            title="Bekijk groeiontwikkeling"
                          >
                            <BarChart3 className="h-4 w-4 text-gray-500" />
                          </Button>
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
              <div className="flex justify-center gap-4 pt-6">
                <Button 
                  onClick={handleUpdateKoi} 
                  disabled={saving || uploading}
                  className="px-6"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Opslaan...' : uploading ? 'Uploaden...' : 'Alle Wijzigingen Opslaan'}
                </Button>
                
                {koi?.archived ? (
                  <Button 
                    variant="default" 
                    className="px-6"
                    onClick={handleUnarchiveKoi}
                    disabled={isArchiving}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {isArchiving ? 'Terugzetten...' : 'Naar Collectie'}
                  </Button>
                ) : (
                  <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="px-6">
                        <Archive className="h-4 w-4 mr-2" />
                        Naar Archief
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Koi Archiveren</DialogTitle>
                        <DialogDescription>
                          Selecteer de reden waarom {koi?.name} naar het archief wordt verplaatst.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="archive-reason">Reden voor archivering</Label>
                          <Select value={archiveReason} onValueChange={setArchiveReason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecteer een reden" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="overleden">Overleden</SelectItem>
                              <SelectItem value="verkocht">Verkocht</SelectItem>
                              <SelectItem value="overige">Overige reden</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
                          Annuleren
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleArchiveKoi}
                          disabled={isArchiving || !archiveReason}
                        >
                          {isArchiving ? 'Archiveren...' : 'Archiveren'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
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

      {/* Growth Chart Dialog */}
      {koi && (
        <GrowthChart
          koiId={koiId}
          koiName={koi.name}
          isOpen={showGrowthChart}
          onClose={() => setShowGrowthChart(false)}
          onAddMeasurement={() => {
            console.log('onAddMeasurement called from koi-edit'); // Debug log
            setShowGrowthChart(false)
            console.log('User is already on edit page, can add measurements directly'); // Debug log
            // The user is already on the edit page, so they can add measurements directly
          }}
        />
      )}
    </div>
  )
}
