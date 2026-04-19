/**
 * Conservative Safety Service
 * Implements conservative approach and enhanced error handling
 * Prioritizes safety over growth, with clear warnings and fallbacks
 */

export interface SafetyCheck {
  parameter: string
  value: number
  safeRange: { min: number; max: number }
  status: 'safe' | 'warning' | 'danger'
  recommendation: string
  immediateAction?: string
}

export interface ConservativeAdvice {
  canFeed: boolean
  maxSafeFeed: number
  safetyStatus: 'safe' | 'warning' | 'danger'
  warnings: string[]
  recommendations: string[]
  fallbackAdvice: string
  educationalExplanation: string
}

export interface MissingParameter {
  parameter: string
  required: boolean
  impact: string
  fallbackValue?: number
  fallbackExplanation: string
}

export class ConservativeSafetyService {
  // Conservative safety thresholds (more strict than normal)
  private static readonly CONSERVATIVE_THRESHOLDS = {
    ammonia: { safe: 0.1, warning: 0.2, danger: 0.3 },
    nitrite: { safe: 0.05, warning: 0.1, danger: 0.2 },
    nitrate: { safe: 25, warning: 50, danger: 75 },
    pH: { safe: { min: 7.2, max: 8.2 }, warning: { min: 6.8, max: 8.5 }, danger: { min: 6.5, max: 9.0 } },
    oxygen: { safe: 7, warning: 5, danger: 3 },
    temperature: { safe: { min: 10, max: 26 }, warning: { min: 8, max: 28 }, danger: { min: 5, max: 30 } },
    kh: { safe: 6, warning: 4, danger: 2 }
  }

  /**
   * Perform comprehensive safety check
   */
  static performSafetyCheck(parameters: Record<string, number>): SafetyCheck[] {
    const checks: SafetyCheck[] = []
    
    // Check each parameter
    for (const [param, value] of Object.entries(parameters)) {
      const check = this.checkParameter(param, value)
      if (check) checks.push(check)
    }
    
    return checks
  }

  /**
   * Check individual parameter
   */
  private static checkParameter(parameter: string, value: number): SafetyCheck | null {
    const thresholds = this.CONSERVATIVE_THRESHOLDS[parameter as keyof typeof this.CONSERVATIVE_THRESHOLDS]
    if (!thresholds) return null
    
    let status: 'safe' | 'warning' | 'danger' = 'safe'
    let recommendation = ''
    let immediateAction = ''
    
    if (parameter === 'ammonia') {
      if (value <= thresholds.safe) {
        status = 'safe'
        recommendation = 'Ammoniak niveau veilig'
      } else if (value <= thresholds.warning) {
        status = 'warning'
        recommendation = 'Ammoniak stijgt - controleer filter'
      } else {
        status = 'danger'
        recommendation = 'Ammoniak gevaarlijk hoog - stop met voeren'
        immediateAction = 'Direct 20-30% waterverversing'
      }
    } else if (parameter === 'nitrite') {
      if (value <= thresholds.safe) {
        status = 'safe'
        recommendation = 'Nitriet niveau veilig'
      } else if (value <= thresholds.warning) {
        status = 'warning'
        recommendation = 'Nitriet stijgt - controleer biologische filter'
      } else {
        status = 'danger'
        recommendation = 'Nitriet gevaarlijk hoog - extra beluchting'
        immediateAction = 'Direct extra beluchting en filter controle'
      }
    } else if (parameter === 'nitrate') {
      if (value <= thresholds.safe) {
        status = 'safe'
        recommendation = 'Nitraat niveau veilig'
      } else if (value <= thresholds.warning) {
        status = 'warning'
        recommendation = 'Nitraat stijgt - overweeg waterverversing'
      } else {
        status = 'danger'
        recommendation = 'Nitraat gevaarlijk hoog - direct waterverversing'
        immediateAction = 'Direct 20-30% waterverversing'
      }
    } else if (parameter === 'ph') {
      if (value >= thresholds.safe.min && value <= thresholds.safe.max) {
        status = 'safe'
        recommendation = 'pH niveau veilig'
      } else if (value >= thresholds.warning.min && value <= thresholds.warning.max) {
        status = 'warning'
        recommendation = 'pH buiten optimale range - controleer KH'
      } else {
        status = 'danger'
        recommendation = 'pH gevaarlijk - direct buffer toevoegen'
        immediateAction = 'Direct KH+ toevoegen'
      }
    } else if (parameter === 'oxygen') {
      if (value >= thresholds.safe) {
        status = 'safe'
        recommendation = 'Zuurstof niveau veilig'
      } else if (value >= thresholds.warning) {
        status = 'warning'
        recommendation = 'Zuurstof te laag - controleer beluchting'
      } else {
        status = 'danger'
        recommendation = 'Zuurstof gevaarlijk laag - direct extra beluchting'
        immediateAction = 'Direct extra beluchting'
      }
    } else if (parameter === 'temperature') {
      if (value >= thresholds.safe.min && value <= thresholds.safe.max) {
        status = 'safe'
        recommendation = 'Temperatuur veilig'
      } else if (value >= thresholds.warning.min && value <= thresholds.warning.max) {
        status = 'warning'
        recommendation = 'Temperatuur buiten optimale range'
      } else {
        status = 'danger'
        recommendation = 'Temperatuur gevaarlijk - direct aanpassen'
        immediateAction = 'Direct temperatuur aanpassen'
      }
    } else if (parameter === 'kh') {
      if (value >= thresholds.safe) {
        status = 'safe'
        recommendation = 'KH niveau veilig'
      } else if (value >= thresholds.warning) {
        status = 'warning'
        recommendation = 'KH te laag - pH instabiliteit risico'
      } else {
        status = 'danger'
        recommendation = 'KH gevaarlijk laag - direct buffer toevoegen'
        immediateAction = 'Direct KH+ toevoegen'
      }
    }
    
    return {
      parameter,
      value,
      safeRange: this.getSafeRange(parameter),
      status,
      recommendation,
      immediateAction: immediateAction || undefined
    }
  }

  /**
   * Get safe range for parameter
   */
  private static getSafeRange(parameter: string): { min: number; max: number } {
    const ranges: Record<string, { min: number; max: number }> = {
      ammonia: { min: 0, max: 0.1 },
      nitrite: { min: 0, max: 0.05 },
      nitrate: { min: 0, max: 25 },
      ph: { min: 7.2, max: 8.2 },
      oxygen: { min: 7, max: 20 },
      temperature: { min: 10, max: 26 },
      kh: { min: 6, max: 12 }
    }
    
    return ranges[parameter] || { min: 0, max: 100 }
  }

  /**
   * Generate conservative feeding advice
   */
  static generateConservativeAdvice(
    parameters: Record<string, number>,
    calculatedFeed: number,
    temperature: number
  ): ConservativeAdvice {
    const safetyChecks = this.performSafetyCheck(parameters)
    
    // Determine if feeding is safe
    const canFeed = this.canFeedSafely(safetyChecks, temperature)
    
    // Calculate maximum safe feed amount
    const maxSafeFeed = this.calculateMaxSafeFeed(safetyChecks, calculatedFeed)
    
    // Determine overall safety status
    const safetyStatus = this.determineOverallSafety(safetyChecks)
    
    // Generate warnings
    const warnings = this.generateWarnings(safetyChecks, temperature)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(safetyChecks, temperature)
    
    // Generate fallback advice
    const fallbackAdvice = this.generateFallbackAdvice(safetyChecks, temperature)
    
    // Generate educational explanation
    const educationalExplanation = this.generateEducationalExplanation(safetyChecks, temperature)
    
    return {
      canFeed,
      maxSafeFeed,
      safetyStatus,
      warnings,
      recommendations,
      fallbackAdvice,
      educationalExplanation
    }
  }

  /**
   * Check if feeding is safe
   */
  private static canFeedSafely(safetyChecks: SafetyCheck[], temperature: number): boolean {
    // No feeding below 8°C
    if (temperature < 8) return false
    
    // No feeding if any critical parameters are in danger
    const criticalParams = ['ammonia', 'nitrite', 'oxygen']
    for (const check of safetyChecks) {
      if (criticalParams.includes(check.parameter) && check.status === 'danger') {
        return false
      }
    }
    
    return true
  }

  /**
   * Calculate maximum safe feed amount
   */
  private static calculateMaxSafeFeed(safetyChecks: SafetyCheck[], calculatedFeed: number): number {
    let safetyFactor = 1.0
    
    // Reduce feed based on safety checks
    for (const check of safetyChecks) {
      if (check.status === 'danger') {
        safetyFactor *= 0.2 // 20% of calculated amount
      } else if (check.status === 'warning') {
        safetyFactor *= 0.7 // 70% of calculated amount
      }
    }
    
    return Math.max(0, calculatedFeed * safetyFactor)
  }

  /**
   * Determine overall safety status
   */
  private static determineOverallSafety(safetyChecks: SafetyCheck[]): 'safe' | 'warning' | 'danger' {
    const dangerCount = safetyChecks.filter(check => check.status === 'danger').length
    const warningCount = safetyChecks.filter(check => check.status === 'warning').length
    
    if (dangerCount > 0) return 'danger'
    if (warningCount > 0) return 'warning'
    return 'safe'
  }

  /**
   * Generate warnings
   */
  private static generateWarnings(safetyChecks: SafetyCheck[], temperature: number): string[] {
    const warnings: string[] = []
    
    // Temperature warnings
    if (temperature < 8) {
      warnings.push('❄️ Temperatuur <8°C - niet voeren')
    } else if (temperature < 12) {
      warnings.push('🌱 Temperatuur 8-12°C - voorzichtig voeren')
    } else if (temperature > 28) {
      warnings.push('☀️ Temperatuur >28°C - extra beluchting nodig')
    }
    
    // Parameter warnings
    for (const check of safetyChecks) {
      if (check.status === 'danger') {
        warnings.push(`🚨 ${check.parameter}: ${check.recommendation}`)
      } else if (check.status === 'warning') {
        warnings.push(`⚠️ ${check.parameter}: ${check.recommendation}`)
      }
    }
    
    return warnings
  }

  /**
   * Generate recommendations
   */
  private static generateRecommendations(safetyChecks: SafetyCheck[], temperature: number): string[] {
    const recommendations: string[] = []
    
    // Conservative feeding recommendations
    if (temperature < 8) {
      recommendations.push('❄️ Winter - niet voeren, filter laten circuleren')
    } else if (temperature < 12) {
      recommendations.push('🌱 Voorjaar - minimaal voeren, langzaam opbouwen')
    } else if (temperature < 20) {
      recommendations.push('🌿 Lente - voorzichtig voeren, controleer waterkwaliteit')
    } else {
      recommendations.push('☀️ Zomer - normaal voeren mogelijk')
    }
    
    // Parameter-specific recommendations
    for (const check of safetyChecks) {
      if (check.immediateAction) {
        recommendations.push(`🔧 ${check.immediateAction}`)
      }
    }
    
    // General safety recommendations
    recommendations.push('🧪 Test waterkwaliteit regelmatig')
    recommendations.push('🔧 Onderhoud filter volgens schema')
    recommendations.push('💧 Voer regelmatig waterverversing uit')
    
    return recommendations
  }

  /**
   * Generate fallback advice
   */
  private static generateFallbackAdvice(safetyChecks: SafetyCheck[], temperature: number): string {
    if (temperature < 8) {
      return 'Winter: Niet voeren, filter laten draaien voor circulatie, bescherm tegen vorst'
    }
    
    const dangerCount = safetyChecks.filter(check => check.status === 'danger').length
    if (dangerCount > 0) {
      return 'Gevaarlijke waterwaarden: Stop met voeren, voer direct waterverversing uit, controleer filter'
    }
    
    const warningCount = safetyChecks.filter(check => check.status === 'warning').length
    if (warningCount > 0) {
      return 'Waterwaarden stijgen: Verminder voer, controleer filter, overweeg waterverversing'
    }
    
    return 'Waterkwaliteit veilig: Normaal voeren mogelijk, blijf parameters controleren'
  }

  /**
   * Generate educational explanation
   */
  private static generateEducationalExplanation(safetyChecks: SafetyCheck[], temperature: number): string {
    let explanation = `\n🧬 **Conservatieve Veiligheidsbenadering**\n\n`
    
    explanation += `**Waarom conservatief?**\n`
    explanation += `• Koi zijn gevoelig voor waterkwaliteit veranderingen\n`
    explanation += `• Filter heeft tijd nodig om te reageren\n`
    explanation += `• Beter te weinig voeren dan te veel\n`
    explanation += `• Veiligheid gaat altijd voor groei\n\n`
    
    explanation += `**Temperatuur impact:**\n`
    if (temperature < 8) {
      explanation += `• ${temperature}°C: Bacteriën inactief - filter werkt niet\n`
      explanation += `• Geen voeren - voorkom ammoniak ophoping\n`
    } else if (temperature < 12) {
      explanation += `• ${temperature}°C: Bacteriën worden wakker - voorzichtig opbouwen\n`
      explanation += `• Minimaal voeren - langzaam verhogen\n`
    } else if (temperature < 20) {
      explanation += `• ${temperature}°C: Bacteriën actief - normale werking\n`
      explanation += `• Voorzichtig voeren - controleer waterkwaliteit\n`
    } else {
      explanation += `• ${temperature}°C: Bacteriën optimaal - normaal voeren\n`
      explanation += `• Maximaal voeren mogelijk\n`
    }
    
    explanation += `\n**Huidige veiligheidsstatus:**\n`
    const dangerCount = safetyChecks.filter(check => check.status === 'danger').length
    const warningCount = safetyChecks.filter(check => check.status === 'warning').length
    
    if (dangerCount > 0) {
      explanation += `• ${dangerCount} kritieke parameters - directe actie vereist\n`
    }
    if (warningCount > 0) {
      explanation += `• ${warningCount} parameters vragen aandacht\n`
    }
    if (dangerCount === 0 && warningCount === 0) {
      explanation += `• Alle parameters veilig - normaal voeren mogelijk\n`
    }
    
    explanation += `\n**Conservatieve principes:**\n`
    explanation += `• Bij twijfel: niet voeren\n`
    explanation += `• Filterveiligheid gaat voor visgroei\n`
    explanation += `• Temperatuur bepaalt wat mogelijk is\n`
    explanation += `• Regelmatig testen en monitoren\n`
    
    return explanation
  }

  /**
   * Check for missing parameters
   */
  static checkMissingParameters(parameters: Record<string, number>): MissingParameter[] {
    const requiredParams = ['temperature', 'ammonia', 'nitrite', 'nitrate', 'ph', 'oxygen']
    const missing: MissingParameter[] = []
    
    for (const param of requiredParams) {
      if (parameters[param] === undefined || parameters[param] === null) {
        missing.push({
          parameter: param,
          required: true,
          impact: this.getParameterImpact(param),
          fallbackValue: this.getFallbackValue(param),
          fallbackExplanation: this.getFallbackExplanation(param)
        })
      }
    }
    
    return missing
  }

  /**
   * Get parameter impact
   */
  private static getParameterImpact(parameter: string): string {
    const impacts: Record<string, string> = {
      temperature: 'Kan geen veilig voeradvies geven - temperatuur bepaalt bacteriën activiteit',
      ammonia: 'Kan geen veilig voeradvies geven - ammoniak is direct giftig',
      nitrite: 'Kan geen veilig voeradvies geven - nitriet is giftig',
      nitrate: 'Kan geen volledig advies geven - nitraat beïnvloedt langetermijn gezondheid',
      ph: 'Kan geen volledig advies geven - pH beïnvloedt filter efficiëntie',
      oxygen: 'Kan geen volledig advies geven - zuurstof is essentieel voor filter'
    }
    
    return impacts[parameter] || 'Parameter ontbreekt'
  }

  /**
   * Get fallback value
   */
  private static getFallbackValue(parameter: string): number | undefined {
    const fallbacks: Record<string, number> = {
      temperature: 20, // Assume room temperature
      ammonia: 0, // Assume safe
      nitrite: 0, // Assume safe
      nitrate: 10, // Assume low
      ph: 7.5, // Assume neutral
      oxygen: 7 // Assume adequate
    }
    
    return fallbacks[parameter]
  }

  /**
   * Get fallback explanation
   */
  private static getFallbackExplanation(parameter: string): string {
    const explanations: Record<string, string> = {
      temperature: 'Gebruikt 20°C als standaard - controleer werkelijke temperatuur',
      ammonia: 'Gebruikt 0mg/L als standaard - controleer werkelijke waarde',
      nitrite: 'Gebruikt 0mg/L als standaard - controleer werkelijke waarde',
      nitrate: 'Gebruikt 10mg/L als standaard - controleer werkelijke waarde',
      ph: 'Gebruikt 7.5 als standaard - controleer werkelijke waarde',
      oxygen: 'Gebruikt 7mg/L als standaard - controleer werkelijke waarde'
    }
    
    return explanations[parameter] || 'Gebruikt standaard waarde'
  }
}
