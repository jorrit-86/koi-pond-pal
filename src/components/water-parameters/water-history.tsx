import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Lightbox } from '@/components/ui/lightbox'
import { ArrowLeft, Calendar, Droplets, Thermometer, TestTube, Image as ImageIcon, Filter, ChevronDown, ChevronRight, Paperclip, Edit, Save, X, Waves, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

interface WaterParameter {
  id: string
  parameter_type: string
  value: number
  unit: string
  notes: string | null
  test_strip_photo_url: string | null
  measured_at: string
}

interface WaterChange {
  id: string
  liters_added: number
  water_type: string
  reason: string
  notes: string | null
  changed_at: string
}

interface GroupedMeasurement {
  timestamp: string
  date: string
  time: string
  measurements: WaterParameter[]
  waterChanges: WaterChange[]
  hasPhoto: boolean
  isExpanded: boolean
  attachments: string[] // Array of photo URLs
}

interface WaterHistoryProps {
  onNavigate: (tab: string) => void
}

export function WaterHistory({ onNavigate }: WaterHistoryProps) {
  const [measurements, setMeasurements] = useState<GroupedMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all') // 'all', 'with-photos', 'recent', 'water-changes'
  const [sortOrder, setSortOrder] = useState<string>('newest') // 'newest', 'oldest'
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxTitle, setLightboxTitle] = useState('')
  const [editingMeasurement, setEditingMeasurement] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')
  const [editDateTime, setEditDateTime] = useState<string>('')
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [editGroupDateTime, setEditGroupDateTime] = useState<string>('')
  const { user, session } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchMeasurements()
    }
  }, [user, filter, sortOrder])

  const fetchMeasurements = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      let waterParameters: WaterParameter[] = []
      let waterChanges: WaterChange[] = []

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // Try direct fetch first if we have session token
      if (session?.access_token) {
        try {
          console.log('Loading water parameters using direct fetch with access token...')
          
          // Fetch water parameters using direct fetch
          const waterParamsResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?user_id=eq.${user.id}&select=*&order=measured_at.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (waterParamsResponse.ok) {
            waterParameters = await waterParamsResponse.json()
            console.log('Water parameters loaded via direct fetch:', waterParameters?.length || 0, 'records')
          } else {
            console.warn(`Direct fetch for water parameters returned ${waterParamsResponse.status}`)
          }

          // Fetch water changes using direct fetch
          const waterChangesResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_changes?user_id=eq.${user.id}&select=*&order=changed_at.desc`,
            {
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              }
            }
          )
          
          if (waterChangesResponse.ok) {
            waterChanges = await waterChangesResponse.json()
            console.log('Water changes loaded via direct fetch:', waterChanges?.length || 0, 'records')
          } else {
            console.warn(`Direct fetch for water changes returned ${waterChangesResponse.status}`)
          }
        } catch (error) {
          console.warn('Direct fetch failed, trying Supabase client:', error)
        }
      }

      // If direct fetch didn't work or returned no data, try Supabase client
      if (waterParameters.length === 0) {
        const { data, error: waterError } = await supabase
          .from('water_parameters')
          .select('*')
          .eq('user_id', user.id)
          .order('measured_at', { ascending: false })

        if (waterError) {
          console.error('Error fetching water parameters:', waterError)
          toast({
            title: "Fout",
            description: "Kon water parameters niet laden.",
            variant: "destructive",
          })
          return
        }

        waterParameters = data || []
        console.log('Water parameters loaded via Supabase client:', waterParameters.length, 'records')
      }

      if (waterChanges.length === 0) {
        const { data, error: waterChangesError } = await supabase
          .from('water_changes')
          .select('*')
          .eq('user_id', user.id)
          .order('changed_at', { ascending: false })

        if (waterChangesError) {
          console.error('Error fetching water changes:', waterChangesError)
          toast({
            title: "Fout",
            description: "Kon waterwissels niet laden.",
            variant: "destructive",
          })
          return
        }

        waterChanges = data || []
        console.log('Water changes loaded via Supabase client:', waterChanges.length, 'records')
      }

      // If filtering for water changes only, only show water changes
      if (filter === 'water-changes') {
        const grouped = groupWaterChangesByTimestamp(waterChanges || [])
        setMeasurements(grouped)
        return
      }

      // Group measurements by timestamp
      const grouped = groupMeasurementsByTimestamp(waterParameters || [], waterChanges || [])
      setMeasurements(grouped)
    } catch (error) {
      console.error('Error fetching measurements:', error)
      toast({
        title: "Fout",
        description: "Kon meetgeschiedenis niet laden.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const groupMeasurementsByTimestamp = (waterParameters: WaterParameter[], waterChanges: WaterChange[] = []): GroupedMeasurement[] => {
    const grouped: { [key: string]: { measurements: WaterParameter[], waterChanges: WaterChange[] } } = {}
    
    // Group water parameters
    waterParameters.forEach(measurement => {
      const timestamp = new Date(measurement.measured_at)
      const roundedTimestamp = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                       timestamp.getHours(), timestamp.getMinutes(), 0, 0)
      const timestampKey = roundedTimestamp.toISOString()
      
      if (!grouped[timestampKey]) {
        grouped[timestampKey] = { measurements: [], waterChanges: [] }
      }
      grouped[timestampKey].measurements.push(measurement)
    })

    // Group water changes
    waterChanges.forEach(waterChange => {
      const timestamp = new Date(waterChange.changed_at)
      const roundedTimestamp = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                       timestamp.getHours(), timestamp.getMinutes(), 0, 0)
      const timestampKey = roundedTimestamp.toISOString()
      
      if (!grouped[timestampKey]) {
        grouped[timestampKey] = { measurements: [], waterChanges: [] }
      }
      grouped[timestampKey].waterChanges.push(waterChange)
    })

    return Object.entries(grouped)
      .map(([timestamp, data]) => {
        const date = new Date(timestamp)
        // Collect all unique photo URLs from this measurement group
        const attachments = data.measurements
          .map(m => m.test_strip_photo_url)
          .filter((url): url is string => url !== null && url !== undefined)
        
        return {
          timestamp,
          date: date.toLocaleDateString('nl-NL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: date.toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          measurements: data.measurements.sort((a, b) => a.parameter_type.localeCompare(b.parameter_type)),
          waterChanges: data.waterChanges,
          hasPhoto: attachments.length > 0,
          isExpanded: false,
          attachments
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime()
        const dateB = new Date(b.timestamp).getTime()
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
      })
  }

  const groupWaterChangesByTimestamp = (waterChanges: WaterChange[]): GroupedMeasurement[] => {
    const grouped: { [key: string]: WaterChange[] } = {}
    
    waterChanges.forEach(waterChange => {
      const timestamp = new Date(waterChange.changed_at)
      const roundedTimestamp = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                       timestamp.getHours(), timestamp.getMinutes(), 0, 0)
      const timestampKey = roundedTimestamp.toISOString()
      
      if (!grouped[timestampKey]) {
        grouped[timestampKey] = []
      }
      grouped[timestampKey].push(waterChange)
    })

    return Object.entries(grouped)
      .map(([timestamp, changes]) => {
        const date = new Date(timestamp)
        
        return {
          timestamp,
          date: date.toLocaleDateString('nl-NL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          time: date.toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          measurements: [],
          waterChanges: changes,
          hasPhoto: false,
          isExpanded: false,
          attachments: []
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime()
        const dateB = new Date(b.timestamp).getTime()
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
      })
  }

  const getParameterIcon = (type: string) => {
    switch (type) {
      case 'temperature': return <Thermometer className="h-4 w-4" />
      case 'ph': return <Droplets className="h-4 w-4" />
      default: return <TestTube className="h-4 w-4" />
    }
  }

  const getParameterName = (type: string) => {
    switch (type) {
      case 'temperature': return 'Water Temperatuur'
      case 'ph': return 'pH Waarde'
      case 'kh': return 'KH (Carbonaat Hardheid)'
      case 'gh': return 'GH (Totale Hardheid)'
      case 'nitrite': return 'Nitriet'
      case 'nitrate': return 'Nitraat'
      case 'phosphate': return 'Fosfaat'
      default: return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  const getParameterStatus = (type: string, value: number): 'good' | 'warning' | 'danger' => {
    switch (type) {
      case 'ph':
        if (value >= 6.8 && value <= 8.2) return 'good'
        if (value >= 6.5 && value <= 8.5) return 'warning'
        return 'danger'
      case 'temperature':
        if (value >= 15 && value <= 25) return 'good'
        if (value >= 10 && value <= 30) return 'warning'
        return 'danger'
      case 'nitrite':
        if (value <= 0.3) return 'good'
        if (value <= 0.5) return 'warning'
        return 'danger'
      case 'nitrate':
        if (value < 25) return 'good'
        if (value < 50) return 'warning'
        return 'danger'
      case 'phosphate':
        if (value < 1.0) return 'good'
        if (value < 2.0) return 'warning'
        return 'danger'
      case 'kh':
        if (value >= 3 && value <= 8) return 'good'
        if (value >= 2 && value <= 10) return 'warning'
        return 'danger'
      case 'gh':
        if (value >= 4 && value <= 12) return 'good'
        if (value >= 3 && value <= 15) return 'warning'
        return 'danger'
      default:
        return 'good'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('nl-NL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const toggleExpanded = (timestamp: string) => {
    setMeasurements(prev => prev.map(group => 
      group.timestamp === timestamp 
        ? { ...group, isExpanded: !group.isExpanded }
        : group
    ))
  }

  const openLightbox = (images: string[], startIndex: number, title: string) => {
    setLightboxImages(images)
    setLightboxIndex(startIndex)
    setLightboxTitle(title)
    setLightboxOpen(true)
  }

  const startEditing = (measurement: WaterParameter) => {
    setEditingMeasurement(measurement.id)
    setEditValue(measurement.value.toString())
    setEditNotes(measurement.notes || '')
    // Convert measured_at to datetime-local format
    // datetime-local expects local time, so we need to convert from UTC to local
    const date = new Date(measurement.measured_at)
    // Get local date/time components
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`
    console.log('Setting edit date/time:', dateTimeString, 'from:', measurement.measured_at, 'UTC date:', date.toISOString())
    setEditDateTime(dateTimeString)
  }

  const cancelEditing = () => {
    setEditingMeasurement(null)
    setEditValue('')
    setEditNotes('')
    setEditDateTime('')
  }

  const startEditingGroup = (group: GroupedMeasurement) => {
    setEditingGroup(group.timestamp)
    // Convert the first measurement's timestamp to datetime-local format
    const firstMeasurement = group.measurements[0]
    if (firstMeasurement) {
      const date = new Date(firstMeasurement.measured_at)
      // Get local date/time components
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`
      setEditGroupDateTime(dateTimeString)
    }
  }

  const cancelEditingGroup = () => {
    setEditingGroup(null)
    setEditGroupDateTime('')
  }

  const saveGroupEdit = async (groupTimestamp: string) => {
    if (!user) return

    try {
      // Convert datetime-local (local time) to UTC ISO string
      const localDate = new Date(editGroupDateTime)
      // Check if the date is valid
      if (isNaN(localDate.getTime())) {
        toast({
          title: "Ongeldige datum/tijd",
          description: "De ingevoerde datum/tijd is ongeldig.",
          variant: "destructive",
        })
        return
      }
      const newDateTime = localDate.toISOString()
      console.log('Saving group edit with date/time:', newDateTime, 'from input (local):', editGroupDateTime, 'local date object:', localDate.toString())
      
      // Update all measurements in this group
      const group = measurements.find(m => m.timestamp === groupTimestamp)
      if (!group) return

      // Check if Supabase has a session
      const { data: { session: currentSession } = {} } = await supabase.auth.getSession()
      
      let allUpdatesSuccessful = true
      const errors: any[] = []

      // Try direct fetch first if we have session token
      if (session?.access_token) {
        try {
          console.log('Updating group measurements using direct fetch with access token...')
          
          // Update each measurement using direct fetch
          const updatePromises = group.measurements.map(async (measurement) => {
            try {
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?id=eq.${measurement.id}`,
                {
                  method: 'PATCH',
                  headers: {
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                  },
                  body: JSON.stringify({ measured_at: newDateTime })
                }
              )
              
              if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`HTTP ${response.status}: ${errorText}`)
              }
              
              return { success: true }
            } catch (error) {
              console.warn(`Direct fetch failed for measurement ${measurement.id}, trying Supabase client:`, error)
              // Fall back to Supabase client for this measurement
              const { error: supabaseError } = await supabase
                .from('water_parameters')
                .update({ measured_at: newDateTime })
                .eq('id', measurement.id)
              
              if (supabaseError) {
                errors.push(supabaseError)
                return { success: false, error: supabaseError }
              }
              
              return { success: true }
            }
          })

          const results = await Promise.all(updatePromises)
          allUpdatesSuccessful = results.every(r => r.success)
          
          if (!allUpdatesSuccessful) {
            console.error('Some updates failed:', results.filter(r => !r.success))
          }
        } catch (error) {
          console.warn('Direct fetch failed for group, trying Supabase client:', error)
          allUpdatesSuccessful = false
        }
      }

      // If direct fetch didn't work or wasn't available, use Supabase client
      if (!allUpdatesSuccessful || !session?.access_token) {
        const updatePromises = group.measurements.map(measurement => 
          supabase
            .from('water_parameters')
            .update({ measured_at: newDateTime })
            .eq('id', measurement.id)
        )

        const results = await Promise.all(updatePromises)
        
        // Check for errors
        const hasErrors = results.some(result => result.error)
        if (hasErrors) {
          console.error('Error updating group measurements:', results)
          toast({
            title: "Bijwerken mislukt",
            description: "Kon groep metingen niet bijwerken.",
            variant: "destructive",
          })
          return
        }
      }

      // Update local state - refresh the data
      await fetchMeasurements()

      toast({
        title: "Groep bijgewerkt",
        description: "Alle metingen in deze groep zijn bijgewerkt.",
      })

      cancelEditingGroup()
    } catch (error) {
      console.error('Error saving group edit:', error)
      toast({
        title: "Bijwerken mislukt",
        description: "Er is een onverwachte fout opgetreden.",
        variant: "destructive",
      })
    }
  }

  const saveEdit = async (measurementId: string) => {
    if (!user) return

    try {
      // Convert datetime-local (local time) to UTC ISO string
      // datetime-local gives us local time, so we need to create a Date object
      // that represents that local time, then convert to UTC
      const localDate = new Date(editDateTime)
      // Check if the date is valid
      if (isNaN(localDate.getTime())) {
        toast({
          title: "Ongeldige datum/tijd",
          description: "De ingevoerde datum/tijd is ongeldig.",
          variant: "destructive",
        })
        return
      }
      const newDateTime = localDate.toISOString()
      console.log('Saving edit with date/time:', newDateTime, 'from input (local):', editDateTime, 'local date object:', localDate.toString())
      
      const updateData = {
        value: parseFloat(editValue),
        notes: editNotes || null,
        measured_at: newDateTime
      }

      // Check if Supabase has a session
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      let updateSuccess = false
      
      // Try direct fetch first if we have session token
      if (session?.access_token) {
        try {
          console.log('Updating measurement using direct fetch with access token...')
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'}/rest/v1/water_parameters?id=eq.${measurementId}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4',
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify(updateData)
            }
          )
          
          if (response.ok) {
            const data = await response.json()
            console.log('Measurement updated via direct fetch:', data)
            updateSuccess = true
          } else {
            const errorText = await response.text()
            console.warn(`Direct fetch returned ${response.status}:`, errorText)
          }
        } catch (error) {
          console.warn('Direct fetch failed, trying Supabase client:', error)
        }
      }

      // If direct fetch didn't work, try Supabase client
      if (!updateSuccess) {
        const { error } = await supabase
          .from('water_parameters')
          .update(updateData)
          .eq('id', measurementId)

        if (error) {
          console.error('Error updating measurement:', error)
          toast({
            title: "Bijwerken mislukt",
            description: "Kon meting niet bijwerken.",
            variant: "destructive",
          })
          return
        }
        updateSuccess = true
      }

      if (updateSuccess) {
        // Refresh data from server to ensure consistency
        await fetchMeasurements()

        toast({
          title: "Meting bijgewerkt",
          description: "De meting is succesvol bijgewerkt.",
        })

        cancelEditing()
      }
    } catch (error) {
      console.error('Error saving edit:', error)
      toast({
        title: "Bijwerken mislukt",
        description: "Er is een onverwachte fout opgetreden.",
        variant: "destructive",
      })
    }
  }

  const deleteMeasurement = async (measurementId: string) => {
    if (!user) return

    try {
      // Find the measurement to get photo URL for cleanup
      const measurement = measurements
        .flatMap(group => group.measurements)
        .find(m => m.id === measurementId)
      
      if (!measurement) return

      // Delete photo from storage if it exists
      if (measurement.test_strip_photo_url) {
        const { error: storageError } = await supabase.storage
          .from('photos')
          .remove([`${user.id}/water-tests/${measurement.test_strip_photo_url.split('/').pop()}`])

        if (storageError) {
          console.error('Error deleting photo from storage:', storageError)
          // Continue with database deletion even if storage deletion fails
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('water_parameters')
        .delete()
        .eq('id', measurementId)

      if (dbError) {
        console.error('Error deleting measurement:', dbError)
        toast({
          title: "Verwijderen mislukt",
          description: "Kon meting niet verwijderen uit database.",
          variant: "destructive",
        })
        return
      }

      // Update local state
      setMeasurements(prev => prev.map(group => {
        const updatedMeasurements = group.measurements.filter(m => m.id !== measurementId)
        
        // If no measurements left in this group, remove the entire group
        if (updatedMeasurements.length === 0 && group.waterChanges.length === 0) {
          return null
        }
        
        // Update attachments if this measurement had a photo
        const updatedAttachments = group.attachments.filter(url => url !== measurement.test_strip_photo_url)
        
        return {
          ...group,
          measurements: updatedMeasurements,
          attachments: updatedAttachments,
          hasPhoto: updatedAttachments.length > 0
        }
      }).filter(Boolean))

      toast({
        title: "Meting verwijderd",
        description: "De meting is succesvol verwijderd.",
      })

    } catch (error) {
      console.error('Error deleting measurement:', error)
      toast({
        title: "Verwijderen mislukt",
        description: "Er is een onverwachte fout opgetreden bij het verwijderen van de meting.",
        variant: "destructive",
      })
    }
  }

  const deleteWaterChange = async (waterChangeId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('water_changes')
        .delete()
        .eq('id', waterChangeId)

      if (error) {
        console.error('Error deleting water change:', error)
        toast({
          title: "Verwijderen mislukt",
          description: "Kon waterwissel niet verwijderen uit database.",
          variant: "destructive",
        })
        return
      }

      // Update local state
      setMeasurements(prev => prev.map(group => {
        const updatedWaterChanges = group.waterChanges.filter(wc => wc.id !== waterChangeId)
        
        // If no water changes left in this group and no measurements, remove the entire group
        if (updatedWaterChanges.length === 0 && group.measurements.length === 0) {
          return null
        }
        
        return {
          ...group,
          waterChanges: updatedWaterChanges
        }
      }).filter(Boolean))

      toast({
        title: "Waterwissel verwijderd",
        description: "De waterwissel is succesvol verwijderd.",
      })

    } catch (error) {
      console.error('Error deleting water change:', error)
      toast({
        title: "Verwijderen mislukt",
        description: "Er is een onverwachte fout opgetreden bij het verwijderen van de waterwissel.",
        variant: "destructive",
      })
    }
  }

  const deleteGroup = async (timestamp: string) => {
    if (!user) return

    try {
      const group = measurements.find(m => m.timestamp === timestamp)
      if (!group) return

      // Delete all measurements in this group
      if (group.measurements.length > 0) {
        const measurementIds = group.measurements.map(m => m.id)
        
        // Delete photos from storage
        const photoUrls = group.measurements
          .map(m => m.test_strip_photo_url)
          .filter((url): url is string => url !== null && url !== undefined)
        
        if (photoUrls.length > 0) {
          const photoPaths = photoUrls.map(url => `${user.id}/water-tests/${url.split('/').pop()}`)
          const { error: storageError } = await supabase.storage
            .from('photos')
            .remove(photoPaths)

          if (storageError) {
            console.error('Error deleting photos from storage:', storageError)
            // Continue with database deletion even if storage deletion fails
          }
        }

        // Delete measurements from database
        const { error: measurementsError } = await supabase
          .from('water_parameters')
          .delete()
          .in('id', measurementIds)

        if (measurementsError) {
          console.error('Error deleting measurements:', measurementsError)
          toast({
            title: "Verwijderen mislukt",
            description: "Kon metingen niet verwijderen uit database.",
            variant: "destructive",
          })
          return
        }
      }

      // Delete all water changes in this group
      if (group.waterChanges.length > 0) {
        const waterChangeIds = group.waterChanges.map(wc => wc.id)
        
        const { error: waterChangesError } = await supabase
          .from('water_changes')
          .delete()
          .in('id', waterChangeIds)

        if (waterChangesError) {
          console.error('Error deleting water changes:', waterChangesError)
          toast({
            title: "Verwijderen mislukt",
            description: "Kon waterwissels niet verwijderen uit database.",
            variant: "destructive",
          })
          return
        }
      }

      // Update local state - remove the entire group
      setMeasurements(prev => prev.filter(group => group.timestamp !== timestamp))

      toast({
        title: "Groep verwijderd",
        description: "Alle metingen en waterwissels in deze groep zijn verwijderd.",
      })

    } catch (error) {
      console.error('Error deleting group:', error)
      toast({
        title: "Verwijderen mislukt",
        description: "Er is een onverwachte fout opgetreden bij het verwijderen van de groep.",
        variant: "destructive",
      })
    }
  }

  const deleteAttachment = async (timestamp: string, imageIndex: number) => {
    if (!user) return

    try {
      const group = measurements.find(m => m.timestamp === timestamp)
      if (!group || !group.attachments[imageIndex]) return

      const imageUrl = group.attachments[imageIndex]
      
      // Find the measurement that has this photo URL
      const measurementWithPhoto = group.measurements.find(m => m.test_strip_photo_url === imageUrl)
      if (!measurementWithPhoto) return

      // Delete from Supabase storage
      const { error: storageError } = await supabase.storage
        .from('photos')
        .remove([`${user.id}/water-tests/${imageUrl.split('/').pop()}`])

      if (storageError) {
        console.error('Error deleting from storage:', storageError)
        toast({
          title: "Verwijderen mislukt",
          description: "Kon foto niet verwijderen uit opslag.",
          variant: "destructive",
        })
        return
      }

      // Update database - remove photo URL from measurement
      const { error: dbError } = await supabase
        .from('water_parameters')
        .update({ test_strip_photo_url: null })
        .eq('id', measurementWithPhoto.id)

      if (dbError) {
        console.error('Error updating database:', dbError)
        toast({
          title: "Verwijderen mislukt",
          description: "Kon foto niet verwijderen uit meting.",
          variant: "destructive",
        })
        return
      }

      // Update local state
      setMeasurements(prev => prev.map(group => {
        if (group.timestamp === timestamp) {
          const updatedAttachments = group.attachments.filter((_, index) => index !== imageIndex)
          const updatedMeasurements = group.measurements.map(m => 
            m.id === measurementWithPhoto.id 
              ? { ...m, test_strip_photo_url: null }
              : m
          )
          
          return {
            ...group,
            attachments: updatedAttachments,
            measurements: updatedMeasurements,
            hasPhoto: updatedAttachments.length > 0
          }
        }
        return group
      }))

      // Close lightbox if it's open and this was the last image
      if (lightboxOpen && lightboxImages.length === 1) {
        setLightboxOpen(false)
      } else if (lightboxOpen) {
        // Update lightbox images
        const updatedLightboxImages = lightboxImages.filter((_, index) => index !== imageIndex)
        setLightboxImages(updatedLightboxImages)
        
        // Adjust index if needed
        if (lightboxIndex >= updatedLightboxImages.length) {
          setLightboxIndex(updatedLightboxImages.length - 1)
        }
      }

      toast({
        title: "Foto verwijderd",
        description: "Foto is verwijderd uit de meting.",
      })

    } catch (error) {
      console.error('Error deleting attachment:', error)
      toast({
        title: "Verwijderen mislukt",
        description: "Er is een onverwachte fout opgetreden bij het verwijderen van de foto.",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Water Parameters Geschiedenis</h1>
            <p className="text-muted-foreground">Bekijk al je waterkwaliteit metingen</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Meetgeschiedenis laden...</p>
          </div>
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Water Parameters Geschiedenis</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Bekijk al je waterkwaliteit metingen</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              >
                Alle Metingen
              </Button>
              <Button
                variant={filter === 'water-changes' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('water-changes')}
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              >
                <Waves className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Waterwissels
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={sortOrder === 'newest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortOrder('newest')}
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              >
                Nieuwste Eerst
              </Button>
              <Button
                variant={sortOrder === 'oldest' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSortOrder('oldest')}
                className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
              >
                Oudste Eerst
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Measurements */}
      {measurements.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 sm:py-12">
            <Droplets className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">Geen Metingen Gevonden</h3>
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              {filter === 'all' 
                ? "Je hebt nog geen water parameters geregistreerd."
                : "Geen waterwissels gevonden."
              }
            </p>
            <Button onClick={() => onNavigate(filter === 'water-changes' ? "water-change" : "water-parameters")} className="h-9 sm:h-10 text-sm">
              {filter === 'water-changes' ? "Eerste Waterwissel Registreren" : "Eerste Meting Registreren"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {measurements.map((group) => (
            <Collapsible key={group.timestamp} open={group.isExpanded} onOpenChange={() => toggleExpanded(group.timestamp)}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-3 sm:p-4 lg:p-6 group">
                    <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {group.isExpanded ? (
                          <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 mt-1 sm:mt-0" />
                        ) : (
                          <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0 mt-1 sm:mt-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          {editingGroup === group.timestamp ? (
                            <div className="space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="datetime-local"
                                  value={editGroupDateTime}
                                  onChange={(e) => setEditGroupDateTime(e.target.value)}
                                  className="flex-1 px-2 py-1 text-xs sm:text-sm border rounded h-8 sm:h-9"
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditGroupDateTime(new Date().toISOString().slice(0, 16))}
                                  className="px-2 text-xs h-8 sm:h-9"
                                >
                                  Nu
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => saveGroupEdit(group.timestamp)}
                                  className="text-xs h-8 sm:h-9"
                                >
                                  <Save className="h-3 w-3 mr-1" />
                                  Opslaan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditingGroup}
                                  className="text-xs h-8 sm:h-9"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Annuleren
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <CardTitle className="flex items-center gap-2 text-sm sm:text-base lg:text-lg">
                                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                                <span className="truncate">{group.date}</span>
                                <span className="text-muted-foreground text-xs sm:text-sm">• {group.time}</span>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingGroup(group)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-5 w-5 sm:h-6 sm:w-6"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm('Weet je zeker dat je deze hele groep metingen en waterwissels wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.')) {
                                        deleteGroup(group.timestamp)
                                      }
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-5 w-5 sm:h-6 sm:w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardTitle>
                              <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1 text-xs sm:text-sm">
                                <span className="flex items-center gap-1">
                                  <TestTube className="h-3 w-3" />
                                  {group.measurements.length} parameter{group.measurements.length !== 1 ? 's' : ''}
                                </span>
                                {group.waterChanges.length > 0 && (
                                  <span className="flex items-center gap-1 text-blue-600">
                                    <Waves className="h-3 w-3" />
                                    {group.waterChanges.length} waterwissel{group.waterChanges.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {group.hasPhoto && (
                                  <span className="flex items-center gap-1">
                                    <ImageIcon className="h-3 w-3" />
                                    Foto's
                                  </span>
                                )}
                              </CardDescription>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                        {group.hasPhoto && (
                          <Badge variant="secondary" className="flex items-center gap-1 text-xs h-6">
                            <ImageIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">Foto</span>
                            <span className="sm:hidden">📷</span>
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs h-6 hidden sm:flex">
                          {group.measurements.length} meting{group.measurements.length !== 1 ? 'en' : ''}
                          {group.waterChanges.length > 0 && (
                            <span className="ml-1 text-blue-600">
                              + {group.waterChanges.length} waterwissel{group.waterChanges.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0 p-3 sm:p-6">
                    <div className="space-y-3 sm:space-y-4">
                      {/* Parameters Section */}
                      <div className="space-y-2 sm:space-y-3">
                        {group.measurements.map((measurement) => (
                          <div key={measurement.id} className="group flex items-start sm:items-center justify-between p-2 sm:p-3 lg:p-4 bg-muted/30 rounded-lg border gap-2 sm:gap-3 hover:bg-muted/50 transition-colors">
                            <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
                              <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                                {getParameterIcon(measurement.parameter_type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-xs sm:text-sm lg:text-base">
                                  {getParameterName(measurement.parameter_type)}
                                </div>
                                {editingMeasurement === measurement.id ? (
                                  <div className="space-y-2 mt-2">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <input
                                        type="number"
                                        step="0.1"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="flex-1 px-2 py-1 text-xs sm:text-sm border rounded h-8 sm:h-9"
                                        placeholder="Waarde"
                                        inputMode="decimal"
                                        pattern="[0-9]*[.,]?[0-9]*"
                                      />
                                      <span className="text-xs sm:text-sm text-muted-foreground self-center">
                                        {measurement.unit}
                                      </span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                      <input
                                        type="datetime-local"
                                        value={editDateTime}
                                        onChange={(e) => setEditDateTime(e.target.value)}
                                        className="flex-1 px-2 py-1 text-xs border rounded h-8 sm:h-9"
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditDateTime(new Date().toISOString().slice(0, 16))}
                                        className="px-2 text-xs h-8 sm:h-9"
                                      >
                                        Nu
                                      </Button>
                                    </div>
                                    <textarea
                                      value={editNotes}
                                      onChange={(e) => setEditNotes(e.target.value)}
                                      className="w-full px-2 py-1 text-xs border rounded"
                                      placeholder="Notities (optioneel)"
                                      rows={2}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    {measurement.notes && (
                                      <div className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                                        {measurement.notes}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-right flex-shrink-0 flex items-center gap-1 sm:gap-2">
                              {editingMeasurement === measurement.id ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => saveEdit(measurement.id)}
                                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEditing}
                                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <div className="font-semibold text-sm sm:text-base lg:text-lg">
                                      {measurement.value} {measurement.unit}
                                    </div>
                                    {(() => {
                                      const status = getParameterStatus(measurement.parameter_type, measurement.value)
                                      return (
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                          status === 'good' ? 'bg-green-500' : 
                                          status === 'warning' ? 'bg-yellow-500' : 
                                          'bg-red-500'
                                        }`} title={
                                          status === 'good' ? 'Binnen normale waarden' : 
                                          status === 'warning' ? 'Waarschuwing: buiten ideale range' : 
                                          'Kritiek: buiten veilige waarden'
                                        } />
                                      )
                                    })()}
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEditing(measurement)}
                                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (confirm('Weet je zeker dat je deze meting wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.')) {
                                          deleteMeasurement(measurement.id)
                                        }
                                      }}
                                      className="h-7 w-7 sm:h-8 sm:w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Water Changes Section */}
                      {group.waterChanges.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Waves className="h-4 w-4 text-blue-600" />
                            <h4 className="font-medium text-sm text-blue-600">Waterwissels</h4>
                            <span className="text-xs text-muted-foreground">
                              ({group.waterChanges.length} waterwissel{group.waterChanges.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                          {group.waterChanges.map((waterChange) => (
                            <div key={waterChange.id} className="group p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  <div className="flex-shrink-0 mt-0.5">
                                    <Waves className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm sm:text-base text-blue-900">
                                      {waterChange.liters_added.toLocaleString('nl-NL')}L toegevoegd
                                    </div>
                                    <div className="flex items-center gap-4 mt-1 text-xs text-blue-700">
                                      <span>
                                        {waterChange.water_type === 'tap_water' ? 'Kraanwater' :
                                         waterChange.water_type === 'well_water' ? 'Putwater' :
                                         waterChange.water_type === 'rain_water' ? 'Regenwater' :
                                         waterChange.water_type === 'ro_water' ? 'RO water' :
                                         waterChange.water_type === 'mixed' ? 'Gemengd' : waterChange.water_type}
                                      </span>
                                      <span>•</span>
                                      <span>
                                        {waterChange.reason === 'routine' ? 'Routine onderhoud' :
                                         waterChange.reason === 'problem' ? 'Probleem opgelost' :
                                         waterChange.reason === 'emergency' ? 'Noodgeval' :
                                         waterChange.reason === 'seasonal' ? 'Seizoensgebonden' :
                                         waterChange.reason === 'maintenance' ? 'Onderhoud' :
                                         waterChange.reason === 'other' ? 'Anders' : waterChange.reason}
                                      </span>
                                    </div>
                                    {waterChange.notes && (
                                      <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-100 rounded">
                                        {waterChange.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm('Weet je zeker dat je deze waterwissel wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.')) {
                                      deleteWaterChange(waterChange.id)
                                    }
                                  }}
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Attachments Section */}
                      {group.attachments.length > 0 && (
                        <div className="border-t pt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium text-sm text-muted-foreground">Bijlagen</h4>
                            <span className="text-xs text-muted-foreground">
                              ({group.attachments.length} foto{group.attachments.length !== 1 ? "'s" : ""})
                            </span>
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
                            {group.attachments.map((photoUrl, index) => (
                              <div 
                                key={index} 
                                className="relative group cursor-pointer"
                                onClick={() => openLightbox(
                                  group.attachments, 
                                  index, 
                                  `${group.date} - ${group.time}`
                                )}
                              >
                                <div className="aspect-square rounded-lg overflow-hidden bg-muted border group-hover:border-primary/50 transition-colors duration-200">
                                  <img
                                    src={photoUrl}
                                    alt={`Teststrip foto ${index + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                </div>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-lg flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <ImageIcon className="h-4 w-4 sm:h-6 sm:w-6 text-white drop-shadow-lg" />
                                  </div>
                                </div>
                                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                  <div className="w-4 h-4 sm:w-6 sm:h-6 bg-black/50 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-medium">
                                      {index + 1}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onDelete={(index) => {
          // Find the timestamp of the current lightbox images
          const group = measurements.find(m => 
            m.attachments.some((url, i) => 
              lightboxImages[index] === url && i === index
            )
          )
          if (group) {
            deleteAttachment(group.timestamp, index)
          }
        }}
        title={lightboxTitle}
      />
    </div>
  )
}
