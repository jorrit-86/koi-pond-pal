import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface FilterInfo {
  filtration_type: string
  filter_media: string[]
  uv_sterilizer: boolean
  protein_skimmer: boolean
  waterfall: boolean
  fountain: boolean
  aeration_system: boolean
  pond_size_liters: number | null
}

interface FilterCapacityData {
  capacity: 'weak' | 'medium' | 'strong'
  confidence: number
  reasoning: string[]
  loading: boolean
}

export const useFilterCapacity = () => {
  const { user } = useAuth()
  const [filterInfo, setFilterInfo] = useState<FilterInfo | null>(null)
  const [filterCapacity, setFilterCapacity] = useState<FilterCapacityData>({
    capacity: 'strong',
    confidence: 0,
    reasoning: [],
    loading: true
  })

  // Load filter information from user_preferences
  const loadFilterInfo = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select(`
          filtration_type,
          filter_media,
          filter_segments,
          uv_sterilizer,
          protein_skimmer,
          waterfall,
          fountain,
          aeration_system,
          pond_size_liters
        `)
        .eq('user_id', user.id)
        .single()


      if (error && error.code !== 'PGRST116') {
        console.error('Error loading filter info:', error)
        return
      }

      if (data) {
        // Extract filter media from both sources
        let filterMedia: string[] = data.filter_media || []
        
        // If filter_media is empty but filter_segments exists, extract media from segments
        if (filterMedia.length === 0 && data.filter_segments && Array.isArray(data.filter_segments)) {
          filterMedia = data.filter_segments
            .map((segment: any) => segment.media || [])
            .flat()
            .filter((media: string) => media && media.trim() !== '')
        }
        
        setFilterInfo({
          filtration_type: data.filtration_type || 'mechanical_biological',
          filter_media: filterMedia,
          uv_sterilizer: data.uv_sterilizer || false,
          protein_skimmer: data.protein_skimmer || false,
          waterfall: data.waterfall || false,
          fountain: data.fountain || false,
          aeration_system: data.aeration_system || false,
          pond_size_liters: data.pond_size_liters
        })
      }
    } catch (error) {
      console.error('Error in loadFilterInfo:', error)
    }
  }

  // Determine filter capacity based on available information
  const calculateFilterCapacity = (info: FilterInfo): FilterCapacityData => {
    const reasoning: string[] = []
    let score = 0
    let maxScore = 0

    // Filtration type scoring
    const filtrationScores: Record<string, number> = {
      'mechanical_biological': 3,
      'mechanical_only': 1,
      'biological_only': 2,
      'natural': 0.5,
      'none': 0
    }
    
    const filtrationScore = filtrationScores[info.filtration_type] || 1
    score += filtrationScore
    maxScore += 3
    reasoning.push(`Filtratie type: ${info.filtration_type} (${filtrationScore}/3 punten)`)

    // Filter media scoring
    const mediaScores: Record<string, number> = {
      'sponges': 1,
      'sand': 0.5,
      'foam': 1,
      'ceramic_rings': 2,
      'bio_balls': 2,
      'lava_rock': 1.5,
      'matrix': 2.5,
      'activated_carbon': 1,
      'zeolite': 1.5,
      'phosphate_remover': 1,
      'moving_bed_k1': 2.5,
      'vortex_chamber': 1,
      // Aeration media scoring
      'air_stone': 0.5,
      'air_diffuser': 1,
      'air_curtain': 1.5,
      'air_ring': 1,
      'air_grid': 1.2,
      'air_lift': 1.5,
      'venturi_aerator': 1.8,
      'membrane_diffuser': 2
    }

    const mediaScore = info.filter_media.reduce((total, media) => {
      return total + (mediaScores[media] || 0.5)
    }, 0)
    
    score += Math.min(mediaScore, 4) // Cap at 4 points
    maxScore += 4
    reasoning.push(`Filter media: ${info.filter_media.length} types (${Math.min(mediaScore, 4)}/4 punten)`)

    // Additional equipment scoring
    if (info.uv_sterilizer) {
      score += 1
      reasoning.push('UV sterilizer aanwezig (+1 punt)')
    }
    if (info.protein_skimmer) {
      score += 1.5
      reasoning.push('Protein skimmer aanwezig (+1.5 punten)')
    }
    if (info.aeration_system) {
      score += 1
      reasoning.push('Beluchting systeem aanwezig (+1 punt)')
    }
    if (info.waterfall || info.fountain) {
      score += 0.5
      reasoning.push('Water circulatie aanwezig (+0.5 punten)')
    }

    maxScore += 4 // Additional equipment max score

    // Pond size adjustment (larger ponds need stronger filtration)
    if (info.pond_size_liters) {
      const sizeAdjustment = Math.min(info.pond_size_liters / 10000, 1) // Scale with pond size
      score += sizeAdjustment
      maxScore += 1
      reasoning.push(`Vijver grootte aanpassing: ${info.pond_size_liters}L (+${sizeAdjustment.toFixed(1)} punten)`)
    }

    // Calculate final capacity
    const percentage = (score / maxScore) * 100
    let capacity: 'weak' | 'medium' | 'strong'
    let confidence: number

    if (percentage >= 70) {
      capacity = 'strong'
      confidence = Math.min(percentage / 100, 1)
      reasoning.push(`Sterke filtercapaciteit (${percentage.toFixed(1)}%)`)
    } else if (percentage >= 40) {
      capacity = 'medium'
      confidence = Math.min(percentage / 100, 1)
      reasoning.push(`Gemiddelde filtercapaciteit (${percentage.toFixed(1)}%)`)
    } else {
      capacity = 'weak'
      confidence = Math.min(percentage / 100, 1)
      reasoning.push(`Zwakke filtercapaciteit (${percentage.toFixed(1)}%)`)
    }

    return {
      capacity,
      confidence,
      reasoning,
      loading: false
    }
  }

  useEffect(() => {
    if (user) {
      loadFilterInfo()
    }
  }, [user])

  useEffect(() => {
    if (filterInfo) {
      const capacityData = calculateFilterCapacity(filterInfo)
      setFilterCapacity(capacityData)
    }
  }, [filterInfo])

  return {
    filterInfo,
    filterCapacity,
    loadFilterInfo
  }
}
