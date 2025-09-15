import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { RecommendationEngine, WaterParameter, UserPreferences, Recommendation, RiskAssessment, TrendAnalysis } from '@/lib/recommendation-engine'
import { useTranslation } from 'react-i18next'

interface UseRecommendationsReturn {
  recommendations: Recommendation[]
  riskAssessment: RiskAssessment | null
  trends: TrendAnalysis[]
  loading: boolean
  error: string | null
  refreshRecommendations: () => Promise<void>
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>
  userPreferences: UserPreferences | null
}

export function useRecommendations(): UseRecommendationsReturn {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null)
  const [trends, setTrends] = useState<TrendAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [recommendationEngine, setRecommendationEngine] = useState<RecommendationEngine | null>(null)

  const { user } = useAuth()
  const { i18n } = useTranslation()

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading user preferences:', error)
        return
      }

      const preferences: UserPreferences = data ? {
        pond_size_liters: data.pond_size_liters,
        koi_count: data.koi_count,
        experience_level: data.experience_level || 'beginner',
        maintenance_frequency: data.maintenance_frequency || 'weekly',
        preferred_chemicals: data.preferred_chemicals || [],
        seasonal_awareness: data.seasonal_awareness ?? true,
        auto_recommendations: data.auto_recommendations ?? true
      } : {
        experience_level: 'beginner',
        maintenance_frequency: 'weekly',
        seasonal_awareness: true,
        auto_recommendations: true
      }

      setUserPreferences(preferences)
      setRecommendationEngine(new RecommendationEngine(preferences, i18n.language))
    } catch (error) {
      console.error('Error in loadUserPreferences:', error)
    }
  }, [user])

  // Load water parameters and generate recommendations
  const loadWaterParametersAndGenerateRecommendations = useCallback(async () => {
    if (!user || !recommendationEngine) return

    try {
      setLoading(true)
      setError(null)

      // Get latest water parameters
      const { data: waterData, error: waterError } = await supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(50) // Get last 50 measurements

      if (waterError) {
        console.error('Error loading water parameters:', waterError)
        setError('Kon water parameters niet laden')
        return
      }

      if (!waterData || waterData.length === 0) {
        setRecommendations([])
        setRiskAssessment(null)
        setTrends([])
        return
      }

      // Group parameters by measurement time
      const parameterGroups: Record<string, any[]> = {}
      waterData.forEach(param => {
        const timeKey = param.measured_at?.split('T')[0] || 'unknown'
        if (!parameterGroups[timeKey]) {
          parameterGroups[timeKey] = []
        }
        parameterGroups[timeKey].push(param)
      })

      // Get the most recent complete set of parameters
      const latestMeasurement = Object.keys(parameterGroups)
        .sort()
        .reverse()
        .find(timeKey => parameterGroups[timeKey].length >= 3) // At least 3 parameters

      if (!latestMeasurement) {
        setRecommendations([])
        setRiskAssessment(null)
        setTrends([])
        return
      }

      // Transform to WaterParameter format
      const currentParameters: WaterParameter[] = parameterGroups[latestMeasurement].map(param => ({
        name: param.parameter_type,
        value: param.value,
        unit: param.unit || '',
        status: getParameterStatus(param.parameter_type, param.value),
        range: getParameterRange(param.parameter_type),
        measured_at: param.measured_at
      }))

      // Generate recommendations using AI engine
      const analysis = recommendationEngine.analyzeWaterParameters(currentParameters)
      
      setRecommendations(analysis.recommendations)
      setRiskAssessment(analysis.riskAssessment)
      setTrends(analysis.trends)

      // Save recommendations to database
      await saveRecommendationsToDatabase(analysis.recommendations)

    } catch (error) {
      console.error('Error in loadWaterParametersAndGenerateRecommendations:', error)
      setError('Er is een fout opgetreden bij het genereren van aanbevelingen')
    } finally {
      setLoading(false)
    }
  }, [user, recommendationEngine])

  // Save recommendations to database
  const saveRecommendationsToDatabase = async (newRecommendations: Recommendation[]) => {
    if (!user || newRecommendations.length === 0) return

    try {
      // First, mark existing active recommendations as dismissed
      await supabase
        .from('recommendations')
        .update({ status: 'dismissed' })
        .eq('user_id', user.id)
        .eq('status', 'active')

      // Insert new recommendations
      const recommendationsToInsert = newRecommendations.map(rec => ({
        user_id: user.id,
        type: rec.type,
        priority: rec.priority,
        title: rec.title,
        description: rec.description,
        action_required: rec.action_required,
        estimated_effort: rec.estimated_effort,
        estimated_duration: rec.estimated_duration,
        related_parameters: rec.related_parameters,
        conditions: rec.conditions,
        expires_at: rec.expires_at?.toISOString() || null
      }))

      const { error } = await supabase
        .from('recommendations')
        .insert(recommendationsToInsert)

      if (error) {
        console.error('Error saving recommendations:', error)
      }
    } catch (error) {
      console.error('Error in saveRecommendationsToDatabase:', error)
    }
  }

  // Update user preferences
  const updateUserPreferences = useCallback(async (preferences: Partial<UserPreferences>) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...preferences,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error updating user preferences:', error)
        return
      }

      // Reload preferences and regenerate recommendations
      await loadUserPreferences()
      await loadWaterParametersAndGenerateRecommendations()
    } catch (error) {
      console.error('Error in updateUserPreferences:', error)
    }
  }, [user, loadUserPreferences, loadWaterParametersAndGenerateRecommendations])

  // Refresh recommendations
  const refreshRecommendations = useCallback(async () => {
    await loadWaterParametersAndGenerateRecommendations()
  }, [loadWaterParametersAndGenerateRecommendations])

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadUserPreferences()
  }, [loadUserPreferences])

  useEffect(() => {
    if (recommendationEngine) {
      loadWaterParametersAndGenerateRecommendations()
    }
  }, [recommendationEngine, loadWaterParametersAndGenerateRecommendations])

  return {
    recommendations,
    riskAssessment,
    trends,
    loading,
    error,
    refreshRecommendations,
    updateUserPreferences,
    userPreferences
  }
}

// Helper functions
function getParameterStatus(type: string, value: number): "good" | "warning" | "danger" {
  switch (type) {
    case 'ph':
      if (value >= 6.8 && value <= 8.2) return "good"
      if (value >= 6.5 && value <= 8.5) return "warning"
      return "danger"
    case 'temperature':
      if (value >= 15 && value <= 25) return "good"
      if (value >= 10 && value <= 30) return "warning"
      return "danger"
    case 'kh':
      if (value >= 3 && value <= 8) return "good"
      if (value >= 2 && value <= 10) return "warning"
      return "danger"
    case 'gh':
      if (value >= 4 && value <= 12) return "good"
      if (value >= 3 && value <= 15) return "warning"
      return "danger"
    case 'nitrite':
      if (value <= 0.3) return "good"
      if (value <= 0.5) return "warning"
      return "danger"
    case 'nitrate':
      if (value < 25) return "good"
      if (value < 50) return "warning"
      return "danger"
    case 'phosphate':
      if (value < 0.5) return "good"
      if (value < 1.0) return "warning"
      return "danger"
    default:
      return "warning"
  }
}

function getParameterRange(type: string): string {
  switch (type) {
    case 'ph': return "6.8-8.2"
    case 'temperature': return "15-25°C"
    case 'kh': return "3-8°dH"
    case 'gh': return "4-12°dH"
    case 'nitrite': return "0-0.3mg/l"
    case 'nitrate': return "<25mg/l"
    case 'phosphate': return "<0.5mg/l"
    default: return "Unknown"
  }
}
