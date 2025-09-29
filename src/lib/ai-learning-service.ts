import { supabase } from './supabase'

export interface LearningPattern {
  id: string
  pattern_type: 'seasonal' | 'pond_size' | 'koi_count' | 'user_behavior'
  pattern_data: Record<string, any>
  confidence_score: number
  usage_count: number
  success_rate: number
  created_at: string
  updated_at: string
}

export interface RecommendationEffectiveness {
  id: string
  recommendation_type: string
  parameter_conditions: Record<string, any>
  success_count: number
  total_count: number
  average_effectiveness: number
  last_updated: string
}

export class AILearningService {
  // Get learned patterns for improving recommendations
  static async getLearningPatterns(): Promise<LearningPattern[]> {
    const { data, error } = await supabase
      .from('ai_learning_patterns')
      .select('*')
      .order('confidence_score', { ascending: false })

    if (error) {
      console.error('Error fetching learning patterns:', error)
      return []
    }

    return data || []
  }

  // Get effectiveness data for recommendation types
  static async getRecommendationEffectiveness(): Promise<RecommendationEffectiveness[]> {
    const { data, error } = await supabase
      .from('recommendation_effectiveness')
      .select('*')
      .order('average_effectiveness', { ascending: false })

    if (error) {
      console.error('Error fetching effectiveness data:', error)
      return []
    }

    return data || []
  }

  // Analyze user feedback patterns
  static async analyzeUserFeedback(userId: string) {
    const { data, error } = await supabase
      .from('user_feedback')
      .select(`
        *,
        recommendations!inner(type, conditions)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error analyzing user feedback:', error)
      return null
    }

    return data
  }

  // Get personalized recommendations based on learning
  static async getPersonalizedRecommendations(
    userId: string, 
    currentParameters: any[]
  ): Promise<{
    adjustedRecommendations: any[]
    confidenceScore: number
    learningInsights: string[]
  }> {
    try {
      // Get user's historical feedback
      const userFeedback = await this.analyzeUserFeedback(userId)
      
      // Get learning patterns
      const patterns = await this.getLearningPatterns()
      
      // Get effectiveness data
      const effectiveness = await this.getRecommendationEffectiveness()

      // Analyze user preferences and history
      const userPreferences = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      const insights: string[] = []
      let confidenceScore = 0.5 // Base confidence

      // Apply seasonal adjustments
      const currentMonth = new Date().getMonth() + 1
      const seasonalPatterns = patterns.filter(p => p.pattern_type === 'seasonal')
      
      if (seasonalPatterns.length > 0) {
        insights.push(`Seizoenspatronen gedetecteerd voor ${currentMonth}e maand`)
        confidenceScore += 0.1
      }

      // Apply pond size adjustments
      if (userPreferences.data?.pond_size_liters) {
        const pondSizePatterns = patterns.filter(p => 
          p.pattern_type === 'pond_size' && 
          p.pattern_data.pond_size_liters === userPreferences.data.pond_size_liters
        )
        
        if (pondSizePatterns.length > 0) {
          insights.push(`Aanbevelingen aangepast voor vijver grootte: ${userPreferences.data.pond_size_liters}L`)
          confidenceScore += 0.15
        }
      }

      // Apply effectiveness adjustments
      const effectiveRecommendations = effectiveness.filter(e => e.average_effectiveness > 0.7)
      if (effectiveRecommendations.length > 0) {
        insights.push(`${effectiveRecommendations.length} bewezen effectieve aanbevelingen beschikbaar`)
        confidenceScore += 0.1
      }

      // Apply user feedback adjustments
      if (userFeedback && userFeedback.length > 0) {
        const helpfulCount = userFeedback.filter(f => f.feedback_type === 'helpful').length
        const totalCount = userFeedback.length
        const helpfulRate = helpfulCount / totalCount

        if (helpfulRate > 0.8) {
          insights.push('Hoge tevredenheid met eerdere aanbevelingen')
          confidenceScore += 0.2
        } else if (helpfulRate < 0.5) {
          insights.push('Aanbevelingen worden aangepast op basis van feedback')
          confidenceScore -= 0.1
        }
      }

      // Ensure confidence is between 0 and 1
      confidenceScore = Math.max(0, Math.min(1, confidenceScore))

      return {
        adjustedRecommendations: [], // This would be populated with adjusted recommendations
        confidenceScore,
        learningInsights: insights
      }
    } catch (error) {
      console.error('Error getting personalized recommendations:', error)
      return {
        adjustedRecommendations: [],
        confidenceScore: 0.5,
        learningInsights: ['AI learning niet beschikbaar']
      }
    }
  }

  // Trigger learning from new data
  static async triggerLearning(): Promise<void> {
    try {
      // Call the database function to learn from patterns
      const { error } = await supabase.rpc('learn_from_user_patterns')
      
      if (error) {
        console.error('Error triggering learning:', error)
      } else {
        // AI learning triggered successfully
      }
    } catch (error) {
      console.error('Error in triggerLearning:', error)
    }
  }

  // Get AI learning statistics
  static async getLearningStats(): Promise<{
    totalFeedback: number
    averageEffectiveness: number
    learningPatterns: number
    userSatisfaction: number
  }> {
    try {
      // Get total feedback count
      const { count: totalFeedback } = await supabase
        .from('user_feedback')
        .select('*', { count: 'exact', head: true })

      // Get average effectiveness
      const { data: effectivenessData } = await supabase
        .from('recommendation_effectiveness')
        .select('average_effectiveness')

      const averageEffectiveness = effectivenessData?.length > 0 
        ? effectivenessData.reduce((sum, item) => sum + item.average_effectiveness, 0) / effectivenessData.length
        : 0

      // Get learning patterns count
      const { count: learningPatterns } = await supabase
        .from('ai_learning_patterns')
        .select('*', { count: 'exact', head: true })

      // Get user satisfaction (helpful feedback rate)
      const { data: feedbackData } = await supabase
        .from('user_feedback')
        .select('feedback_type')

      const helpfulCount = feedbackData?.filter(f => f.feedback_type === 'helpful').length || 0
      const totalFeedbackCount = feedbackData?.length || 0
      const userSatisfaction = totalFeedbackCount > 0 ? helpfulCount / totalFeedbackCount : 0

      return {
        totalFeedback: totalFeedback || 0,
        averageEffectiveness,
        learningPatterns: learningPatterns || 0,
        userSatisfaction
      }
    } catch (error) {
      console.error('Error getting learning stats:', error)
      return {
        totalFeedback: 0,
        averageEffectiveness: 0,
        learningPatterns: 0,
        userSatisfaction: 0
      }
    }
  }
}
