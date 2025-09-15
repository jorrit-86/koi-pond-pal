// Sprint 1: Smart Water Analysis - Recommendation Engine
// Client-side AI engine for generating personalized water quality recommendations

export interface WaterParameter {
  name: string
  value: number
  unit: string
  status: "good" | "warning" | "danger"
  range: string
  measured_at?: string
}

export interface UserPreferences {
  pond_size_liters?: number
  koi_count?: number
  experience_level: 'beginner' | 'intermediate' | 'expert'
  maintenance_frequency: 'daily' | 'weekly' | 'bi-weekly' | 'monthly'
  preferred_chemicals?: string[]
  seasonal_awareness: boolean
  auto_recommendations: boolean
}

export interface Recommendation {
  id: string
  type: 'water_change' | 'filter_maintenance' | 'ph_adjustment' | 'temperature_control' | 'chemical_treatment'
  priority: 1 | 2 | 3 | 4 | 5
  title: string
  description: string
  action_required: boolean
  estimated_effort: 'low' | 'medium' | 'high'
  estimated_duration: string
  related_parameters: string[]
  conditions: Record<string, any>
  expires_at?: Date
}

export interface TrendAnalysis {
  parameter: string
  trend: 'increasing' | 'decreasing' | 'stable'
  rate: number // change per day
  confidence: number // 0-1
  prediction: {
    value: number
    timeframe: string
  }
}

export interface RiskAssessment {
  overall_risk: 'low' | 'medium' | 'high' | 'critical'
  risk_score: number // 0-100
  risk_factors: Array<{
    parameter: string
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    description: string
    impact: string
  }>
}

export class RecommendationEngine {
  private userPreferences: UserPreferences
  private historicalData: WaterParameter[] = []

  constructor(userPreferences: UserPreferences) {
    this.userPreferences = userPreferences
  }

  // Main analysis function
  public analyzeWaterParameters(currentParameters: WaterParameter[]): {
    recommendations: Recommendation[]
    riskAssessment: RiskAssessment
    trends: TrendAnalysis[]
  } {
    const riskAssessment = this.calculateRiskScore(currentParameters)
    const trends = this.detectTrends(currentParameters)
    const recommendations = this.generateRecommendations(currentParameters, riskAssessment, trends)

    return {
      recommendations: this.prioritizeRecommendations(recommendations),
      riskAssessment,
      trends
    }
  }

  // Risk assessment calculation
  private calculateRiskScore(parameters: WaterParameter[]): RiskAssessment {
    const riskFactors: RiskAssessment['risk_factors'] = []
    let totalRiskScore = 0
    let factorCount = 0

    parameters.forEach(param => {
      const risk = this.assessParameterRisk(param)
      if (risk.risk_level !== 'low') {
        riskFactors.push(risk)
        totalRiskScore += this.getRiskScoreValue(risk.risk_level)
        factorCount++
      }
    })

    const averageRiskScore = factorCount > 0 ? totalRiskScore / factorCount : 0
    const overallRisk = this.getOverallRiskLevel(averageRiskScore)

    return {
      overall_risk: overallRisk,
      risk_score: Math.round(averageRiskScore),
      risk_factors: riskFactors
    }
  }

  // Assess individual parameter risk
  private assessParameterRisk(param: WaterParameter): RiskAssessment['risk_factors'][0] {
    const riskLevel = param.status === 'danger' ? 'critical' : 
                     param.status === 'warning' ? 'high' : 'low'

    let description = ''
    let impact = ''

    switch (param.name.toLowerCase()) {
      case 'ph':
        if (param.value < 6.5) {
          description = 'pH is too low, causing acidity stress'
          impact = 'Can damage fish gills and reduce oxygen uptake'
        } else if (param.value > 8.5) {
          description = 'pH is too high, causing alkalinity stress'
          impact = 'Can cause ammonia toxicity and stress fish'
        }
        break
      case 'temperature':
        if (param.value < 10) {
          description = 'Water temperature is too cold'
          impact = 'Slows metabolism, reduces immune system function'
        } else if (param.value > 30) {
          description = 'Water temperature is too warm'
          impact = 'Reduces oxygen levels, increases stress'
        }
        break
      case 'nitrite':
        if (param.value > 0.3) {
          description = 'Nitrite levels are elevated'
          impact = 'Blocks oxygen transport in fish blood'
        }
        break
      case 'nitrate':
        if (param.value > 25) {
          description = 'Nitrate levels are high'
          impact = 'Can cause long-term health issues and algae blooms'
        }
        break
      case 'phosphate':
        if (param.value > 0.5) {
          description = 'Phosphate levels are elevated'
          impact = 'Promotes excessive algae growth'
        }
        break
    }

    return {
      parameter: param.name,
      risk_level: riskLevel,
      description,
      impact
    }
  }

  // Trend detection
  private detectTrends(parameters: WaterParameter[]): TrendAnalysis[] {
    // For now, we'll use a simple trend detection
    // In a real implementation, this would analyze historical data
    return parameters.map(param => {
      const trend = this.calculateSimpleTrend(param)
      return {
        parameter: param.name,
        trend: trend.direction,
        rate: trend.rate,
        confidence: trend.confidence,
        prediction: {
          value: param.value + (trend.rate * 7), // 7-day prediction
          timeframe: '7 days'
        }
      }
    })
  }

  // Simple trend calculation (placeholder for more complex analysis)
  private calculateSimpleTrend(param: WaterParameter): {
    direction: 'increasing' | 'decreasing' | 'stable'
    rate: number
    confidence: number
  } {
    // This is a simplified version - in reality, you'd analyze historical data
    const status = param.status
    if (status === 'danger') {
      return { direction: 'increasing', rate: 0.1, confidence: 0.8 }
    } else if (status === 'warning') {
      return { direction: 'increasing', rate: 0.05, confidence: 0.6 }
    } else {
      return { direction: 'stable', rate: 0, confidence: 0.9 }
    }
  }

  // Generate recommendations based on analysis
  private generateRecommendations(
    parameters: WaterParameter[],
    riskAssessment: RiskAssessment,
    trends: TrendAnalysis[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = []

    // Water change recommendation
    if (this.shouldRecommendWaterChange(parameters, riskAssessment)) {
      recommendations.push(this.createWaterChangeRecommendation(parameters))
    }

    // Filter maintenance recommendation
    if (this.shouldRecommendFilterMaintenance(parameters, trends)) {
      recommendations.push(this.createFilterMaintenanceRecommendation())
    }

    // pH adjustment recommendation
    const phParam = parameters.find(p => p.name.toLowerCase().includes('ph'))
    if (phParam && phParam.status !== 'good') {
      recommendations.push(this.createPhAdjustmentRecommendation(phParam))
    }

    // Temperature control recommendation
    const tempParam = parameters.find(p => p.name.toLowerCase().includes('temperature'))
    if (tempParam && tempParam.status !== 'good') {
      recommendations.push(this.createTemperatureControlRecommendation(tempParam))
    }

    // Chemical treatment recommendation
    if (this.shouldRecommendChemicalTreatment(parameters, riskAssessment)) {
      recommendations.push(this.createChemicalTreatmentRecommendation(parameters))
    }

    return recommendations
  }

  // Recommendation generation methods
  private shouldRecommendWaterChange(parameters: WaterParameter[], riskAssessment: RiskAssessment): boolean {
    const criticalParams = parameters.filter(p => p.status === 'danger')
    const warningParams = parameters.filter(p => p.status === 'warning')
    
    return criticalParams.length > 0 || warningParams.length >= 3
  }

  private createWaterChangeRecommendation(parameters: WaterParameter[]): Recommendation {
    const criticalCount = parameters.filter(p => p.status === 'danger').length
    const priority = criticalCount > 0 ? 1 : 2

    return {
      id: `water_change_${Date.now()}`,
      type: 'water_change',
      priority: priority as 1 | 2,
      title: 'Water Change Recommended',
      description: criticalCount > 0 
        ? 'Critical water parameters detected. Immediate water change required to protect fish health.'
        : 'Multiple water parameters are outside ideal ranges. A water change will help restore balance.',
      action_required: true,
      estimated_effort: 'medium',
      estimated_duration: '1-2 hours',
      related_parameters: parameters.filter(p => p.status !== 'good').map(p => p.name.toLowerCase()),
      conditions: {
        critical_parameters: criticalCount,
        warning_parameters: parameters.filter(p => p.status === 'warning').length
      }
    }
  }

  private shouldRecommendFilterMaintenance(parameters: WaterParameter[], trends: TrendAnalysis[]): boolean {
    const nitriteParam = parameters.find(p => p.name.toLowerCase().includes('nitrite'))
    const nitrateParam = parameters.find(p => p.name.toLowerCase().includes('nitrate'))
    
    return (nitriteParam && nitriteParam.status === 'warning') ||
           (nitrateParam && nitrateParam.status === 'warning')
  }

  private createFilterMaintenanceRecommendation(): Recommendation {
    return {
      id: `filter_maintenance_${Date.now()}`,
      type: 'filter_maintenance',
      priority: 3,
      title: 'Filter Maintenance Needed',
      description: 'Nitrogen cycle parameters suggest filter efficiency may be reduced. Clean or replace filter media.',
      action_required: false,
      estimated_effort: 'low',
      estimated_duration: '30 minutes',
      related_parameters: ['nitrite', 'nitrate'],
      conditions: {
        filter_efficiency: 'reduced'
      }
    }
  }

  private createPhAdjustmentRecommendation(phParam: WaterParameter): Recommendation {
    const isLow = phParam.value < 7.0
    const priority = phParam.status === 'danger' ? 1 : 2

    return {
      id: `ph_adjustment_${Date.now()}`,
      type: 'ph_adjustment',
      priority: priority as 1 | 2,
      title: `pH ${isLow ? 'Increase' : 'Decrease'} Required`,
      description: isLow 
        ? 'pH is too low. Add baking soda or crushed coral to raise pH gradually.'
        : 'pH is too high. Add peat moss or driftwood to lower pH naturally.',
      action_required: phParam.status === 'danger',
      estimated_effort: 'low',
      estimated_duration: '15 minutes',
      related_parameters: ['ph'],
      conditions: {
        current_ph: phParam.value,
        target_ph: isLow ? '7.0-7.5' : '7.0-7.5'
      }
    }
  }

  private createTemperatureControlRecommendation(tempParam: WaterParameter): Recommendation {
    const isLow = tempParam.value < 15
    const priority = tempParam.status === 'danger' ? 1 : 3

    return {
      id: `temperature_control_${Date.now()}`,
      type: 'temperature_control',
      priority: priority as 1 | 3,
      title: `Temperature ${isLow ? 'Heating' : 'Cooling'} Needed`,
      description: isLow
        ? 'Water temperature is too cold. Consider using a pond heater or increasing aeration.'
        : 'Water temperature is too warm. Increase shade, aeration, or add cool water.',
      action_required: tempParam.status === 'danger',
      estimated_effort: 'medium',
      estimated_duration: '1 hour',
      related_parameters: ['temperature'],
      conditions: {
        current_temperature: tempParam.value,
        target_temperature: '15-25°C'
      }
    }
  }

  private shouldRecommendChemicalTreatment(parameters: WaterParameter[], riskAssessment: RiskAssessment): boolean {
    return riskAssessment.overall_risk === 'critical' && 
           parameters.some(p => p.status === 'danger')
  }

  private createChemicalTreatmentRecommendation(parameters: WaterParameter[]): Recommendation {
    const criticalParams = parameters.filter(p => p.status === 'danger')
    
    return {
      id: `chemical_treatment_${Date.now()}`,
      type: 'chemical_treatment',
      priority: 1,
      title: 'Emergency Chemical Treatment',
      description: 'Critical water parameters detected. Consider emergency water treatment products to stabilize conditions quickly.',
      action_required: true,
      estimated_effort: 'low',
      estimated_duration: '15 minutes',
      related_parameters: criticalParams.map(p => p.name.toLowerCase()),
      conditions: {
        critical_parameters: criticalParams.length,
        emergency_treatment: true
      }
    }
  }

  // Prioritize recommendations
  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    return recommendations.sort((a, b) => {
      // First by priority (1 = highest)
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }
      // Then by action required
      if (a.action_required !== b.action_required) {
        return a.action_required ? -1 : 1
      }
      return 0
    })
  }

  // Helper methods
  private getRiskScoreValue(riskLevel: string): number {
    switch (riskLevel) {
      case 'critical': return 100
      case 'high': return 75
      case 'medium': return 50
      case 'low': return 25
      default: return 0
    }
  }

  private getOverallRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical'
    if (score >= 50) return 'high'
    if (score >= 25) return 'medium'
    return 'low'
  }

  // Update historical data for trend analysis
  public updateHistoricalData(newData: WaterParameter[]): void {
    this.historicalData = [...this.historicalData, ...newData]
    // Keep only last 30 days of data
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    this.historicalData = this.historicalData.filter(data => {
      if (!data.measured_at) return true
      return new Date(data.measured_at) > thirtyDaysAgo
    })
  }
}
