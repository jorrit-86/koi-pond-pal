/**
 * Water Safety Service
 * Implements comprehensive water quality safety criteria and automatic actions
 * Based on koi health requirements and RAS principles
 */

export interface WaterParameter {
  name: string
  value: number
  unit: string
  status: 'safe' | 'warning' | 'danger'
  range: {
    safe: { min: number; max: number }
    warning: { min: number; max: number }
    danger: { min: number; max: number }
  }
}

export interface SafetyAssessment {
  overallStatus: 'safe' | 'warning' | 'danger'
  criticalIssues: string[]
  warnings: string[]
  recommendations: string[]
  immediateActions: string[]
  educationalExplanation: string
}

export interface ParameterCriteria {
  safe: { min: number; max: number }
  warning: { min: number; max: number }
  danger: { min: number; max: number }
  unit: string
  description: string
  impact: string
}

export class WaterSafetyService {
  // Comprehensive safety criteria from the briefing
  private static readonly SAFETY_CRITERIA: Record<string, ParameterCriteria> = {
    ammonia: {
      safe: { min: 0, max: 0.2 },
      warning: { min: 0.2, max: 0.5 },
      danger: { min: 0.5, max: 10 },
      unit: 'mg/L',
      description: 'Ammoniak (NH₃/NH₄)',
      impact: 'Acuut giftig voor koi - blokkeert zuurstoftransport'
    },
    nitrite: {
      safe: { min: 0, max: 0.1 },
      warning: { min: 0.1, max: 0.3 },
      danger: { min: 0.3, max: 10 },
      unit: 'mg/L',
      description: 'Nitriet (NO₂)',
      impact: 'Giftig voor koi - veroorzaakt stress en ziekte'
    },
    nitrate: {
      safe: { min: 0, max: 50 },
      warning: { min: 50, max: 100 },
      danger: { min: 100, max: 1000 },
      unit: 'mg/L',
      description: 'Nitraat (NO₃)',
      impact: 'Langdurige gezondheidsproblemen en algengroei'
    },
    ph: {
      safe: { min: 7.0, max: 8.5 },
      warning: { min: 6.5, max: 9.0 },
      danger: { min: 0, max: 14 },
      unit: '',
      description: 'pH waarde',
      impact: 'pH instabiliteit veroorzaakt stress'
    },
    oxygen: {
      safe: { min: 6, max: 20 },
      warning: { min: 4, max: 6 },
      danger: { min: 0, max: 4 },
      unit: 'mg/L',
      description: 'Zuurstof (O₂)',
      impact: 'Zuurstoftekort veroorzaakt stress en ziekte'
    },
    temperature: {
      safe: { min: 8, max: 28 },
      warning: { min: 5, max: 30 },
      danger: { min: 0, max: 50 },
      unit: '°C',
      description: 'Watertemperatuur',
      impact: 'Extreme temperaturen veroorzaken stress'
    },
    kh: {
      safe: { min: 6, max: 12 },
      warning: { min: 4, max: 15 },
      danger: { min: 0, max: 20 },
      unit: '°dH',
      description: 'KH (Carbonaathardheid)',
      impact: 'KH stabiliseert pH - te laag veroorzaakt pH crashes'
    },
    gh: {
      safe: { min: 6, max: 12 },
      warning: { min: 4, max: 15 },
      danger: { min: 0, max: 20 },
      unit: '°dH',
      description: 'GH (Algemene hardheid)',
      impact: 'Te laag veroorzaakt stress en groeiproblemen'
    },
    phosphate: {
      safe: { min: 0, max: 1.0 },
      warning: { min: 1.0, max: 2.0 },
      danger: { min: 2.0, max: 10 },
      unit: 'mg/L',
      description: 'Fosfaat (PO₄)',
      impact: 'Bevordert overmatige algengroei'
    }
  }

  /**
   * Assess water safety comprehensively
   */
  static assessWaterSafety(parameters: WaterParameter[]): SafetyAssessment {
    const criticalIssues: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []
    const immediateActions: string[] = []

    let overallStatus: 'safe' | 'warning' | 'danger' = 'safe'

    // Analyze each parameter
    for (const param of parameters) {
      const criteria = this.SAFETY_CRITERIA[param.name.toLowerCase()]
      if (!criteria) continue

      const status = this.assessParameterStatus(param.value, criteria)
      
      if (status === 'danger') {
        overallStatus = 'danger'
        criticalIssues.push(this.getCriticalIssueMessage(param, criteria))
        immediateActions.push(this.getImmediateAction(param.name))
      } else if (status === 'warning') {
        if (overallStatus === 'safe') overallStatus = 'warning'
        warnings.push(this.getWarningMessage(param, criteria))
      }

      recommendations.push(this.getParameterRecommendation(param, criteria, status))
    }

    // Generate educational explanation
    const educationalExplanation = this.getEducationalExplanation(overallStatus, criticalIssues, warnings)

    return {
      overallStatus,
      criticalIssues,
      warnings,
      recommendations,
      immediateActions,
      educationalExplanation
    }
  }

  /**
   * Assess individual parameter status
   */
  private static assessParameterStatus(value: number, criteria: ParameterCriteria): 'safe' | 'warning' | 'danger' {
    if (value >= criteria.danger.min && value <= criteria.danger.max) return 'danger'
    if (value >= criteria.warning.min && value <= criteria.warning.max) return 'warning'
    return 'safe'
  }

  /**
   * Get critical issue message
   */
  private static getCriticalIssueMessage(param: WaterParameter, criteria: ParameterCriteria): string {
    const icon = this.getParameterIcon(param.name)
    return `${icon} **${criteria.description}**: ${param.value}${criteria.unit} - ${criteria.impact}`
  }

  /**
   * Get warning message
   */
  private static getWarningMessage(param: WaterParameter, criteria: ParameterCriteria): string {
    const icon = this.getParameterIcon(param.name)
    return `${icon} **${criteria.description}**: ${param.value}${criteria.unit} - Let op: ${criteria.impact}`
  }

  /**
   * Get immediate action for critical parameters
   */
  private static getImmediateAction(parameterName: string): string {
    const actions: Record<string, string> = {
      ammonia: '🚨 Stop met voeren - direct 20-30% waterverversing',
      nitrite: '🚨 Extra beluchting - controleer biologische filter',
      nitrate: '💧 Verhoog waterverversing naar 20% per week',
      ph: '🧪 Controleer KH waarde - voeg buffer toe indien nodig',
      oxygen: '💨 Extra beluchting - controleer beluchtingssysteem',
      temperature: '🌡️ Controleer verwarming/koeling systeem',
      kh: '🧪 Voeg KH+ toe voor pH stabiliteit',
      gh: '🧪 Voeg GH+ toe voor waterhardheid',
      phosphate: '🌿 Voeg planten toe of gebruik fosfaatverwijderaar'
    }
    
    return actions[parameterName.toLowerCase()] || 'Controleer parameter waarde'
  }

  /**
   * Get parameter recommendation
   */
  private static getParameterRecommendation(
    param: WaterParameter, 
    criteria: ParameterCriteria, 
    status: 'safe' | 'warning' | 'danger'
  ): string {
    const icon = this.getParameterIcon(param.name)
    
    if (status === 'safe') {
      return `${icon} ${criteria.description}: Veilig (${param.value}${criteria.unit})`
    } else if (status === 'warning') {
      return `${icon} ${criteria.description}: Let op (${param.value}${criteria.unit}) - ${this.getWarningAdvice(param.name)}`
    } else {
      return `${icon} ${criteria.description}: Gevaarlijk (${param.value}${criteria.unit}) - ${this.getDangerAdvice(param.name)}`
    }
  }

  /**
   * Get warning advice
   */
  private static getWarningAdvice(parameterName: string): string {
    const advice: Record<string, string> = {
      ammonia: 'Controleer filter en overweeg waterverversing',
      nitrite: 'Controleer biologische filter werking',
      nitrate: 'Overweeg meer waterverversing of planten',
      ph: 'Controleer KH waarde voor stabiliteit',
      oxygen: 'Controleer beluchtingssysteem',
      temperature: 'Controleer verwarming/koeling',
      kh: 'Overweeg KH+ toevoeging',
      gh: 'Overweeg GH+ toevoeging',
      phosphate: 'Controleer voer en overweeg planten'
    }
    
    return advice[parameterName.toLowerCase()] || 'Controleer parameter'
  }

  /**
   * Get danger advice
   */
  private static getDangerAdvice(parameterName: string): string {
    const advice: Record<string, string> = {
      ammonia: 'Direct waterverversing en filter controle',
      nitrite: 'Direct extra beluchting en filter controle',
      nitrate: 'Direct waterverversing en planten toevoegen',
      ph: 'Direct KH controle en buffer toevoegen',
      oxygen: 'Direct extra beluchting',
      temperature: 'Direct temperatuur aanpassing',
      kh: 'Direct KH+ toevoegen',
      gh: 'Direct GH+ toevoegen',
      phosphate: 'Direct fosfaatverwijderaar gebruiken'
    }
    
    return advice[parameterName.toLowerCase()] || 'Direct actie vereist'
  }

  /**
   * Get parameter icon
   */
  private static getParameterIcon(parameterName: string): string {
    const icons: Record<string, string> = {
      ammonia: '🧪',
      nitrite: '🧪',
      nitrate: '🧪',
      ph: '⚗️',
      oxygen: '💨',
      temperature: '🌡️',
      kh: '🧪',
      gh: '🧪',
      phosphate: '🧪'
    }
    
    return icons[parameterName.toLowerCase()] || '📊'
  }

  /**
   * Get educational explanation
   */
  private static getEducationalExplanation(
    overallStatus: 'safe' | 'warning' | 'danger',
    criticalIssues: string[],
    warnings: string[]
  ): string {
    let explanation = `\n🧬 **Waterkwaliteit Uitleg**\n\n`
    
    if (overallStatus === 'safe') {
      explanation += `✅ **Alle parameters veilig**\n`
      explanation += `Je vijver heeft uitstekende waterkwaliteit. Alle parameters zijn binnen veilige grenzen.\n\n`
    } else if (overallStatus === 'warning') {
      explanation += `⚠️ **Enkele parameters vragen aandacht**\n`
      explanation += `De meeste parameters zijn goed, maar enkele waarden zijn aan de hoge kant.\n\n`
    } else {
      explanation += `🚨 **Kritieke waterkwaliteit problemen**\n`
      explanation += `Er zijn gevaarlijke waarden gemeten die directe actie vereisen.\n\n`
    }
    
    explanation += `**Waarom deze parameters belangrijk zijn:**\n`
    explanation += `• **Ammoniak**: Direct giftig, veroorzaakt stress en ziekte\n`
    explanation += `• **Nitriet**: Blokkeert zuurstoftransport in visbloed\n`
    explanation += `• **Nitraat**: Langdurige gezondheidsproblemen\n`
    explanation += `• **pH**: Instabiliteit veroorzaakt stress\n`
    explanation += `• **Zuurstof**: Essentieel voor vissen en filter bacteriën\n`
    explanation += `• **KH**: Stabiliseert pH, voorkomt crashes\n\n`
    
    explanation += `**Systeemdenken:**\n`
    explanation += `Alles in de vijver is verbonden. Een probleem met één parameter kan andere problemen veroorzaken. Filterveiligheid gaat altijd voor visgroei.\n`
    
    return explanation
  }

  /**
   * Get parameter status with detailed information
   */
  static getParameterStatus(parameterName: string, value: number): {
    status: 'safe' | 'warning' | 'danger'
    message: string
    recommendation: string
    icon: string
  } {
    const criteria = this.SAFETY_CRITERIA[parameterName.toLowerCase()]
    if (!criteria) {
      return {
        status: 'warning',
        message: 'Onbekende parameter',
        recommendation: 'Controleer parameter naam',
        icon: '❓'
      }
    }

    const status = this.assessParameterStatus(value, criteria)
    const icon = this.getParameterIcon(parameterName)
    
    let message = ''
    let recommendation = ''
    
    if (status === 'safe') {
      message = `Veilig: ${value}${criteria.unit}`
      recommendation = 'Parameter is binnen veilige grenzen'
    } else if (status === 'warning') {
      message = `Let op: ${value}${criteria.unit}`
      recommendation = this.getWarningAdvice(parameterName)
    } else {
      message = `Gevaarlijk: ${value}${criteria.unit}`
      recommendation = this.getDangerAdvice(parameterName)
    }
    
    return {
      status,
      message,
      recommendation,
      icon
    }
  }

  /**
   * Get comprehensive safety criteria
   */
  static getSafetyCriteria(): Record<string, ParameterCriteria> {
    return this.SAFETY_CRITERIA
  }

  /**
   * Check if feeding should be stopped based on water quality
   */
  static shouldStopFeeding(parameters: WaterParameter[]): {
    shouldStop: boolean
    reason: string
    immediateAction: string
  } {
    for (const param of parameters) {
      const criteria = this.SAFETY_CRITERIA[param.name.toLowerCase()]
      if (!criteria) continue
      
      const status = this.assessParameterStatus(param.value, criteria)
      
      if (status === 'danger') {
        if (param.name.toLowerCase() === 'ammonia' || param.name.toLowerCase() === 'nitrite') {
          return {
            shouldStop: true,
            reason: `${param.name} niveau gevaarlijk hoog`,
            immediateAction: 'Stop met voeren en voer direct waterverversing uit'
          }
        }
      }
    }
    
    return {
      shouldStop: false,
      reason: 'Waterkwaliteit veilig voor voeren',
      immediateAction: 'Normaal voeren mogelijk'
    }
  }
}
