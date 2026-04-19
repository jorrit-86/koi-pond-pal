/**
 * Seasonal Logic Service
 * Implements seasonal behavior and temperature-dependent logic for koi pond management
 * Based on natural koi behavior and bacterial activity patterns
 */

export interface SeasonalConditions {
  temperature: number
  month: number
  dayOfYear: number
  location?: string
}

export interface SeasonalAdvice {
  season: Season
  phase: SeasonalPhase
  feedingAdvice: FeedingAdvice
  filterAdvice: FilterAdvice
  waterAdvice: WaterAdvice
  recommendations: string[]
  educationalExplanation: string
}

export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

export type SeasonalPhase = 
  | 'deep_winter'      // <5°C
  | 'winter'          // 5-8°C
  | 'early_spring'    // 8-12°C
  | 'spring'          // 12-18°C
  | 'early_summer'    // 18-22°C
  | 'summer'          // 22-28°C
  | 'late_summer'     // 28-25°C
  | 'autumn'          // 18-12°C
  | 'late_autumn'     // 12-8°C

export interface FeedingAdvice {
  shouldFeed: boolean
  frequency: number // times per day
  amount: 'none' | 'minimal' | 'reduced' | 'normal' | 'increased'
  feedType: 'none' | 'wheat_germ' | 'light' | 'normal' | 'high_protein'
  weeklyIncrease: number // grams per week
  explanation: string
}

export interface FilterAdvice {
  activity: 'inactive' | 'building' | 'active' | 'optimal'
  maintenance: 'minimal' | 'normal' | 'increased'
  aeration: 'reduced' | 'normal' | 'increased'
  explanation: string
}

export interface WaterAdvice {
  changes: 'minimal' | 'normal' | 'increased'
  testing: 'weekly' | 'bi_weekly' | 'daily'
  parameters: string[]
  explanation: string
}

export class SeasonalLogicService {
  // Temperature thresholds for seasonal phases
  private static readonly TEMP_THRESHOLDS = {
    DEEP_WINTER: 5,
    WINTER: 8,
    EARLY_SPRING: 12,
    SPRING: 18,
    EARLY_SUMMER: 22,
    SUMMER: 28,
    LATE_SUMMER: 25,
    AUTUMN: 12,
    LATE_AUTUMN: 8
  }

  /**
   * Get comprehensive seasonal advice
   */
  static getSeasonalAdvice(conditions: SeasonalConditions): SeasonalAdvice {
    const season = this.determineSeason(conditions.month, conditions.temperature)
    const phase = this.determinePhase(conditions.temperature)
    
    const feedingAdvice = this.getFeedingAdvice(phase, conditions.temperature)
    const filterAdvice = this.getFilterAdvice(phase, conditions.temperature)
    const waterAdvice = this.getWaterAdvice(phase, conditions.temperature)
    
    const recommendations = this.generateRecommendations(phase, conditions.temperature)
    const educationalExplanation = this.getEducationalExplanation(phase, season)
    
    return {
      season,
      phase,
      feedingAdvice,
      filterAdvice,
      waterAdvice,
      recommendations,
      educationalExplanation
    }
  }

  /**
   * Determine season based on month and temperature
   */
  private static determineSeason(month: number, temperature: number): Season {
    // Override with temperature if extreme
    if (temperature < 8) return 'winter'
    if (temperature > 25) return 'summer'
    
    // Normal seasonal determination
    if (month >= 12 || month <= 2) return 'winter'
    if (month >= 3 && month <= 5) return 'spring'
    if (month >= 6 && month <= 8) return 'summer'
    return 'autumn'
  }

  /**
   * Determine seasonal phase based on temperature
   */
  private static determinePhase(temperature: number): SeasonalPhase {
    if (temperature < this.TEMP_THRESHOLDS.DEEP_WINTER) return 'deep_winter'
    if (temperature < this.TEMP_THRESHOLDS.WINTER) return 'winter'
    if (temperature < this.TEMP_THRESHOLDS.EARLY_SPRING) return 'early_spring'
    if (temperature < this.TEMP_THRESHOLDS.SPRING) return 'spring'
    if (temperature < this.TEMP_THRESHOLDS.EARLY_SUMMER) return 'early_summer'
    if (temperature < this.TEMP_THRESHOLDS.SUMMER) return 'summer'
    if (temperature < this.TEMP_THRESHOLDS.LATE_SUMMER) return 'late_summer'
    if (temperature < this.TEMP_THRESHOLDS.AUTUMN) return 'autumn'
    return 'late_autumn'
  }

  /**
   * Get feeding advice based on seasonal phase
   */
  private static getFeedingAdvice(phase: SeasonalPhase, temperature: number): FeedingAdvice {
    switch (phase) {
      case 'deep_winter':
        return {
          shouldFeed: false,
          frequency: 0,
          amount: 'none',
          feedType: 'none',
          weeklyIncrease: 0,
          explanation: 'Temperatuur <5°C - koi in winterslaap, niet voeren'
        }
      
      case 'winter':
        return {
          shouldFeed: false,
          frequency: 0,
          amount: 'none',
          feedType: 'none',
          weeklyIncrease: 0,
          explanation: 'Temperatuur 5-8°C - bacteriën inactief, niet voeren'
        }
      
      case 'early_spring':
        return {
          shouldFeed: true,
          frequency: 1,
          amount: 'minimal',
          feedType: 'wheat_germ',
          weeklyIncrease: 25,
          explanation: 'Voorjaar opbouw - langzaam beginnen met licht verteerbaar voer'
        }
      
      case 'spring':
        return {
          shouldFeed: true,
          frequency: 2,
          amount: 'reduced',
          feedType: 'light',
          weeklyIncrease: 50,
          explanation: 'Lente - filter wordt actief, voorzichtig opbouwen'
        }
      
      case 'early_summer':
        return {
          shouldFeed: true,
          frequency: 3,
          amount: 'normal',
          feedType: 'normal',
          weeklyIncrease: 0,
          explanation: 'Vroege zomer - normale voeding mogelijk'
        }
      
      case 'summer':
        return {
          shouldFeed: true,
          frequency: 6,
          amount: 'increased',
          feedType: 'high_protein',
          weeklyIncrease: 0,
          explanation: 'Zomer - maximale voeding mogelijk, verdeel over meerdere porties'
        }
      
      case 'late_summer':
        return {
          shouldFeed: true,
          frequency: 4,
          amount: 'normal',
          feedType: 'normal',
          weeklyIncrease: 0,
          explanation: 'Late zomer - normale voeding, voorbereiden op herfst'
        }
      
      case 'autumn':
        return {
          shouldFeed: true,
          frequency: 2,
          amount: 'reduced',
          feedType: 'light',
          weeklyIncrease: -25,
          explanation: 'Herfst - afbouwen, licht verteerbaar voer'
        }
      
      case 'late_autumn':
        return {
          shouldFeed: true,
          frequency: 1,
          amount: 'minimal',
          feedType: 'wheat_germ',
          weeklyIncrease: -50,
          explanation: 'Late herfst - minimaal voeren, voorbereiden op winter'
        }
    }
  }

  /**
   * Get filter advice based on seasonal phase
   */
  private static getFilterAdvice(phase: SeasonalPhase, temperature: number): FilterAdvice {
    switch (phase) {
      case 'deep_winter':
      case 'winter':
        return {
          activity: 'inactive',
          maintenance: 'minimal',
          aeration: 'reduced',
          explanation: 'Filter inactief - alleen circulatie, minimaal onderhoud'
        }
      
      case 'early_spring':
        return {
          activity: 'building',
          maintenance: 'normal',
          aeration: 'normal',
          explanation: 'Filter opbouwen - bacteriën worden wakker, normaal onderhoud'
        }
      
      case 'spring':
        return {
          activity: 'active',
          maintenance: 'normal',
          aeration: 'normal',
          explanation: 'Filter actief - normale werking, regelmatig onderhoud'
        }
      
      case 'early_summer':
      case 'summer':
        return {
          activity: 'optimal',
          maintenance: 'increased',
          aeration: 'increased',
          explanation: 'Filter optimaal - maximale capaciteit, extra onderhoud nodig'
        }
      
      case 'late_summer':
        return {
          activity: 'optimal',
          maintenance: 'normal',
          aeration: 'normal',
          explanation: 'Filter nog optimaal - normale werking'
        }
      
      case 'autumn':
        return {
          activity: 'active',
          maintenance: 'normal',
          aeration: 'normal',
          explanation: 'Filter actief - normale werking, voorbereiden op winter'
        }
      
      case 'late_autumn':
        return {
          activity: 'building',
          maintenance: 'minimal',
          aeration: 'reduced',
          explanation: 'Filter afbouwen - bacteriën worden minder actief'
        }
    }
  }

  /**
   * Get water advice based on seasonal phase
   */
  private static getWaterAdvice(phase: SeasonalPhase, temperature: number): WaterAdvice {
    switch (phase) {
      case 'deep_winter':
      case 'winter':
        return {
          changes: 'minimal',
          testing: 'weekly',
          parameters: ['temperatuur', 'zuurstof'],
          explanation: 'Winter - minimaal waterverversing, wekelijks testen'
        }
      
      case 'early_spring':
        return {
          changes: 'normal',
          testing: 'bi_weekly',
          parameters: ['temperatuur', 'ammoniak', 'nitriet', 'pH'],
          explanation: 'Voorjaar - normale waterverversing, tweewekelijks testen'
        }
      
      case 'spring':
        return {
          changes: 'normal',
          testing: 'bi_weekly',
          parameters: ['temperatuur', 'ammoniak', 'nitriet', 'nitraat', 'pH', 'KH'],
          explanation: 'Lente - normale waterverversing, alle parameters controleren'
        }
      
      case 'early_summer':
      case 'summer':
        return {
          changes: 'increased',
          testing: 'daily',
          parameters: ['temperatuur', 'ammoniak', 'nitriet', 'nitraat', 'pH', 'KH', 'zuurstof'],
          explanation: 'Zomer - extra waterverversing, dagelijks testen van alle parameters'
        }
      
      case 'late_summer':
        return {
          changes: 'normal',
          testing: 'bi_weekly',
          parameters: ['temperatuur', 'ammoniak', 'nitriet', 'nitraat', 'pH'],
          explanation: 'Late zomer - normale waterverversing, regelmatig testen'
        }
      
      case 'autumn':
        return {
          changes: 'normal',
          testing: 'bi_weekly',
          parameters: ['temperatuur', 'ammoniak', 'nitriet', 'pH'],
          explanation: 'Herfst - normale waterverversing, basis parameters controleren'
        }
      
      case 'late_autumn':
        return {
          changes: 'minimal',
          testing: 'weekly',
          parameters: ['temperatuur', 'pH'],
          explanation: 'Late herfst - minimaal waterverversing, wekelijks testen'
        }
    }
  }

  /**
   * Generate seasonal recommendations
   */
  private static generateRecommendations(phase: SeasonalPhase, temperature: number): string[] {
    const recommendations: string[] = []
    
    switch (phase) {
      case 'deep_winter':
      case 'winter':
        recommendations.push('❄️ Winter - koi in winterslaap, niet voeren')
        recommendations.push('🔧 Filter laten draaien voor circulatie')
        recommendations.push('🧊 Bescherm tegen vorst')
        break
      
      case 'early_spring':
        recommendations.push('🌱 Voorjaar - langzaam opbouwen')
        recommendations.push('🍞 Begin met tarwekiem voer')
        recommendations.push('📈 Verhoog voer wekelijks met 25g')
        break
      
      case 'spring':
        recommendations.push('🌸 Lente - filter wordt actief')
        recommendations.push('📈 Verhoog voer wekelijks met 50g')
        recommendations.push('🧪 Controleer waterkwaliteit regelmatig')
        break
      
      case 'early_summer':
      case 'summer':
        recommendations.push('☀️ Zomer - maximale activiteit')
        recommendations.push('🍽️ Verdeel voer over meerdere porties')
        recommendations.push('💧 Extra waterverversing')
        recommendations.push('🌡️ Dagelijks temperatuur controleren')
        break
      
      case 'late_summer':
        recommendations.push('🌅 Late zomer - voorbereiden op herfst')
        recommendations.push('📉 Begin met afbouwen voer')
        break
      
      case 'autumn':
        recommendations.push('🍂 Herfst - afbouwen')
        recommendations.push('🍞 Gebruik licht verteerbaar voer')
        recommendations.push('📉 Verlaag voer wekelijks met 25g')
        break
      
      case 'late_autumn':
        recommendations.push('🍁 Late herfst - voorbereiden op winter')
        recommendations.push('📉 Verlaag voer wekelijks met 50g')
        recommendations.push('🧹 Ruim bladeren op')
        break
    }
    
    return recommendations
  }

  /**
   * Get educational explanation for seasonal behavior
   */
  private static getEducationalExplanation(phase: SeasonalPhase, season: Season): string {
    const explanations: Record<SeasonalPhase, string> = {
      'deep_winter': '❄️ Diepe winter: Koi zijn in winterslaap, metabolisme op minimum. Filter bacteriën zijn inactief.',
      'winter': '❄️ Winter: Koi zijn traag, filter werkt minimaal. Alleen circulatie nodig.',
      'early_spring': '🌱 Vroeg voorjaar: Koi worden wakker, filter bacteriën worden actief. Voorzichtig opbouwen.',
      'spring': '🌸 Lente: Koi zijn actief, filter wordt sterker. Groei periode begint.',
      'early_summer': '☀️ Vroege zomer: Koi zijn zeer actief, filter werkt optimaal. Maximale groei mogelijk.',
      'summer': '☀️ Zomer: Piek activiteit, filter op maximum. Verdeel voer over meerdere porties.',
      'late_summer': '🌅 Late zomer: Koi bereiden zich voor op herfst, filter nog optimaal.',
      'autumn': '🍂 Herfst: Koi bouwen af, filter wordt minder actief. Voorbereiden op winter.',
      'late_autumn': '🍁 Late herfst: Koi worden traag, filter afbouwen. Minimale activiteit.'
    }
    
    return explanations[phase] || 'Seizoensgedrag wordt bepaald door temperatuur en natuurlijke cycli.'
  }

  /**
   * Get seasonal feeding schedule
   */
  static getSeasonalFeedingSchedule(): Record<SeasonalPhase, {
    frequency: number
    amount: string
    feedType: string
    explanation: string
  }> {
    return {
      'deep_winter': { frequency: 0, amount: '0g', feedType: 'Geen', explanation: 'Winterslaap' },
      'winter': { frequency: 0, amount: '0g', feedType: 'Geen', explanation: 'Bacteriën inactief' },
      'early_spring': { frequency: 1, amount: 'Minimaal', feedType: 'Tarwekiem', explanation: 'Opbouw fase' },
      'spring': { frequency: 2, amount: 'Verminderd', feedType: 'Licht', explanation: 'Filter wordt actief' },
      'early_summer': { frequency: 3, amount: 'Normaal', feedType: 'Normaal', explanation: 'Normale voeding' },
      'summer': { frequency: 6, amount: 'Verhoogd', feedType: 'Hoog eiwit', explanation: 'Maximale groei' },
      'late_summer': { frequency: 4, amount: 'Normaal', feedType: 'Normaal', explanation: 'Voorbereiden herfst' },
      'autumn': { frequency: 2, amount: 'Verminderd', feedType: 'Licht', explanation: 'Afbouwen' },
      'late_autumn': { frequency: 1, amount: 'Minimaal', feedType: 'Tarwekiem', explanation: 'Voorbereiden winter' }
    }
  }
}
