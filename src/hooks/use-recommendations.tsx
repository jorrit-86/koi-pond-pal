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
  const [aiPreferences, setAiPreferences] = useState<{
    ai_recommendations_enabled: boolean
    ai_risk_assessment_enabled: boolean
    ai_trend_analysis_enabled: boolean
  }>({
    ai_recommendations_enabled: true,
    ai_risk_assessment_enabled: true,
    ai_trend_analysis_enabled: true
  })

  const { user } = useAuth()
  const { i18n } = useTranslation()

  // Helper functions for parameter status and ranges
  const getParameterStatus = (type: string, value: number): 'good' | 'warning' | 'danger' => {
    switch (type) {
      case 'ph':
        if (value < 6.5 || value > 8.5) return 'danger'
        if (value < 6.8 || value > 8.2) return 'warning'
        return 'good'
      case 'temperature':
        if (value < 10 || value > 30) return 'danger'
        if (value < 15 || value > 25) return 'warning'
        return 'good'
      case 'nitrite':
        if (value > 0.3) return 'danger'
        if (value > 0.1) return 'warning'
        return 'good'
      case 'nitrate':
        if (value > 50) return 'danger'
        if (value > 25) return 'warning'
        return 'good'
      case 'phosphate':
        if (value > 1.0) return 'danger'
        if (value > 0.5) return 'warning'
        return 'good'
      case 'kh':
        if (value < 3 || value > 12) return 'danger'
        if (value < 4 || value > 10) return 'warning'
        return 'good'
      case 'gh':
        if (value < 4 || value > 20) return 'danger'
        if (value < 6 || value > 16) return 'warning'
        return 'good'
      default:
        return 'good'
    }
  }

  const getParameterRange = (type: string): string => {
    switch (type) {
      case 'ph': return '6.8-8.2'
      case 'temperature': return '15-25°C'
      case 'nitrite': return '0-0.3mg/l'
      case 'nitrate': return '<25mg/l'
      case 'phosphate': return '<0.5mg/l'
      case 'kh': return '4-10°dH'
      case 'gh': return '6-16°dH'
      default: return 'N/A'
    }
  }

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*, ai_recommendations_enabled, ai_risk_assessment_enabled, ai_trend_analysis_enabled')
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
      
      // Set AI preferences
      setAiPreferences({
        ai_recommendations_enabled: data?.ai_recommendations_enabled ?? true,
        ai_risk_assessment_enabled: data?.ai_risk_assessment_enabled ?? true,
        ai_trend_analysis_enabled: data?.ai_trend_analysis_enabled ?? true
      })
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

      // Get latest water parameters - use the same approach as dashboard
      const { data: waterData, error: waterError } = await supabase
        .from('water_parameters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100) // Get last 100 measurements

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

      // Group by parameter type and get the latest value for each (same as dashboard)
      const latestReadings: Record<string, any> = {}
      waterData.forEach(reading => {
        if (!latestReadings[reading.parameter_type] || 
            new Date(reading.created_at) > new Date(latestReadings[reading.parameter_type].created_at)) {
          latestReadings[reading.parameter_type] = reading
        }
      })

      // Transform to WaterParameter format
      const currentParameters: WaterParameter[] = Object.values(latestReadings).map(param => ({
        name: param.parameter_type,
        value: param.value,
        unit: param.unit || '',
        status: getParameterStatus(param.parameter_type, param.value),
        range: getParameterRange(param.parameter_type)
      }))

      // Generate recommendations using AI engine (only if enabled)
      let analysis = null
      if (aiPreferences.ai_recommendations_enabled || aiPreferences.ai_risk_assessment_enabled || aiPreferences.ai_trend_analysis_enabled) {
        analysis = recommendationEngine.analyzeWaterParameters(currentParameters)
        
        // Only set data for enabled features
        if (aiPreferences.ai_recommendations_enabled) {
          setRecommendations(analysis.recommendations)
        } else {
          setRecommendations([])
        }
        
        if (aiPreferences.ai_risk_assessment_enabled) {
          setRiskAssessment(analysis.riskAssessment)
        } else {
          setRiskAssessment(null)
        }
        
        if (aiPreferences.ai_trend_analysis_enabled) {
          setTrends(analysis.trends)
        } else {
          setTrends([])
        }
      } else {
        // All AI features disabled
        setRecommendations([])
        setRiskAssessment(null)
        setTrends([])
      }

      // Save recommendations to database (only if recommendations are enabled)
      if (aiPreferences.ai_recommendations_enabled && analysis) {
        await saveRecommendationsToDatabase(analysis.recommendations)
      }

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
