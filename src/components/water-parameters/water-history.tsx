import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Lightbox } from '@/components/ui/lightbox'
import { ArrowLeft, Calendar, Droplets, Thermometer, TestTube, Image as ImageIcon, Filter, ChevronDown, ChevronRight, Paperclip } from 'lucide-react'
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

interface GroupedMeasurement {
  timestamp: string
  date: string
  time: string
  measurements: WaterParameter[]
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
  const [filter, setFilter] = useState<string>('all') // 'all', 'with-photos', 'recent'
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxTitle, setLightboxTitle] = useState('')
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchMeasurements()
    }
  }, [user, filter])

  const fetchMeasurements = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })

      // Apply filters
      if (filter === 'with-photos') {
        query = query.not('test_strip_photo_url', 'is', null)
      } else if (filter === 'recent') {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        query = query.gte('measured_at', thirtyDaysAgo.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching measurements:', error)
        toast({
          title: "Fout",
          description: "Kon meetgeschiedenis niet laden.",
          variant: "destructive",
        })
        return
      }

      // Group measurements by timestamp
      const grouped = groupMeasurementsByTimestamp(data || [])
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

  const groupMeasurementsByTimestamp = (data: WaterParameter[]): GroupedMeasurement[] => {
    const grouped: { [key: string]: WaterParameter[] } = {}
    
    data.forEach(measurement => {
      // Group by exact timestamp (rounded to nearest minute to account for slight variations)
      const timestamp = new Date(measurement.measured_at)
      const roundedTimestamp = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), 
                                       timestamp.getHours(), timestamp.getMinutes(), 0, 0)
      const timestampKey = roundedTimestamp.toISOString()
      
      if (!grouped[timestampKey]) {
        grouped[timestampKey] = []
      }
      grouped[timestampKey].push(measurement)
    })

    return Object.entries(grouped)
      .map(([timestamp, measurements]) => {
        const date = new Date(timestamp)
        // Collect all unique photo URLs from this measurement group
        const attachments = measurements
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
          measurements: measurements.sort((a, b) => a.parameter_type.localeCompare(b.parameter_type)),
          hasPhoto: attachments.length > 0,
          isExpanded: false,
          attachments
        }
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Water Parameters Geschiedenis</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Bekijk al je waterkwaliteit metingen</p>
        </div>
        <Button variant="outline" onClick={() => onNavigate("water-parameters")} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar Parameters
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="w-full sm:w-auto"
            >
              Alle Metingen
            </Button>
            <Button
              variant={filter === 'with-photos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('with-photos')}
              className="w-full sm:w-auto"
            >
              Met Foto's
            </Button>
            <Button
              variant={filter === 'recent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('recent')}
              className="w-full sm:w-auto"
            >
              Laatste 30 Dagen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Measurements */}
      {measurements.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Droplets className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Geen Metingen Gevonden</h3>
            <p className="text-muted-foreground mb-4">
              {filter === 'all' 
                ? "Je hebt nog geen water parameters geregistreerd."
                : filter === 'with-photos'
                ? "Geen metingen met foto's gevonden."
                : "Geen metingen in de laatste 30 dagen."
              }
            </p>
            <Button onClick={() => onNavigate("water-parameters")}>
              Eerste Meting Registreren
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {measurements.map((group) => (
            <Collapsible key={group.timestamp} open={group.isExpanded} onOpenChange={() => toggleExpanded(group.timestamp)}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors p-4 sm:p-6">
                    <div className="flex items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                        {group.isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 sm:mt-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1 sm:mt-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Calendar className="h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{group.date}</span>
                          </CardTitle>
                          <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-1">
                            <span className="flex items-center gap-1 text-xs sm:text-sm">
                              <TestTube className="h-3 w-3" />
                              {group.time}
                            </span>
                            <span className="text-xs sm:text-sm">
                              {group.measurements.length} parameter{group.measurements.length !== 1 ? 's' : ''}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                        {group.hasPhoto && (
                          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                            <ImageIcon className="h-3 w-3" />
                            Foto
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {group.measurements.length} meting{group.measurements.length !== 1 ? 'en' : ''}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Parameters Section */}
                      <div className="space-y-3">
                        {group.measurements.map((measurement) => (
                          <div key={measurement.id} className="flex items-start sm:items-center justify-between p-3 sm:p-4 bg-muted/30 rounded-lg border gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="flex-shrink-0 mt-0.5 sm:mt-0">
                                {getParameterIcon(measurement.parameter_type)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm sm:text-base">
                                  {getParameterName(measurement.parameter_type)}
                                </div>
                                {measurement.notes && (
                                  <div className="text-xs sm:text-sm text-muted-foreground mt-1 break-words">
                                    {measurement.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-right flex-shrink-0">
                              <div className="font-semibold text-base sm:text-lg">
                                {measurement.value} {measurement.unit}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

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
