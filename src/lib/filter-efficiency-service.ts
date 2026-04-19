/**
 * Filter Efficiency Service
 * Implements advanced filter efficiency calculations with temperature-dependent bacterial activity
 * Based on RAS principles and koi pond management best practices
 */

export interface FilterConditions {
  temperature: number
  oxygenLevel: number
  maintenanceLevel: number // 0-1, where 1 is perfect maintenance
  filterAge: number // months
}

export interface FilterSpecs {
  type: FilterType
  media: FilterMedia[]
  aeration: boolean
  size: number // liters
  flowRate: number // liters per hour
}

export type FilterType = 
  | 'mattenbak' 
  | 'trickle' 
  | 'moving_bed' 
  | 'bead_filter' 
  | 'biological_only' 
  | 'mechanical_only' 
  | 'natural'

export type FilterMedia = 
  | 'japanese_mats'
  | 'moving_bed_k1'
  | 'moving_bed_k3'
  | 'trickle_media'
  | 'ceramic_rings'
  | 'bio_balls'
  | 'lava_rock'
  | 'matrix'
  | 'bacteria_house'
  | 'glass_foam'
  | 'sponges'
  | 'foam'

export interface FilterEfficiencyResult {
  baseEfficiency: number
  temperatureFactor: number
  oxygenFactor: number
  maintenanceFactor: number
  ageFactor: number
  totalEfficiency: number
  bacterialActivity: BacterialActivity
  recommendations: string[]
  maxAmmoniaLoad: number
}

export interface BacterialActivity {
  level: 'inactive' | 'slow' | 'active' | 'optimal'
  description: string
  feedingAdvice: string
}

export class FilterEfficiencyService {
  // Temperature thresholds for bacterial activity
  private static readonly TEMP_THRESHOLDS = {
    INACTIVE: 8,
    SLOW: 13,
    ACTIVE: 20,
    OPTIMAL: 25
  }

  // Base efficiency by filter type
  private static readonly BASE_EFFICIENCIES: Record<FilterType, number> = {
    'mattenbak': 0.85,
    'trickle': 0.95,
    'moving_bed': 0.90,
    'bead_filter': 0.70,
    'biological_only': 0.60,
    'mechanical_only': 0.30,
    'natural': 0.20
  }

  // Media efficiency multipliers
  private static readonly MEDIA_EFFICIENCIES: Record<FilterMedia, number> = {
    'japanese_mats': 1.0,
    'moving_bed_k1': 1.2,
    'moving_bed_k3': 1.1,
    'trickle_media': 1.3,
    'ceramic_rings': 0.8,
    'bio_balls': 0.7,
    'lava_rock': 0.9,
    'matrix': 1.1,
    'bacteria_house': 1.0,
    'glass_foam': 1.2,
    'sponges': 0.6,
    'foam': 0.7
  }

  /**
   * Calculate comprehensive filter efficiency
   */
  static calculateFilterEfficiency(
    specs: FilterSpecs,
    conditions: FilterConditions
  ): FilterEfficiencyResult {
    // Base efficiency from filter type
    const baseEfficiency = this.BASE_EFFICIENCIES[specs.type]
    
    // Temperature factor
    const temperatureFactor = this.getTemperatureFactor(conditions.temperature)
    
    // Oxygen factor
    const oxygenFactor = this.getOxygenFactor(conditions.oxygenLevel)
    
    // Maintenance factor
    const maintenanceFactor = conditions.maintenanceLevel
    
    // Age factor (filters lose efficiency over time)
    const ageFactor = this.getAgeFactor(conditions.filterAge)
    
    // Media efficiency bonus
    const mediaBonus = this.calculateMediaBonus(specs.media)
    
    // Aeration bonus
    const aerationBonus = specs.aeration ? 1.1 : 1.0
    
    // Calculate total efficiency
    const totalEfficiency = Math.min(1.0, 
      baseEfficiency * 
      temperatureFactor * 
      oxygenFactor * 
      maintenanceFactor * 
      ageFactor * 
      mediaBonus * 
      aerationBonus
    )
    
    // Determine bacterial activity
    const bacterialActivity = this.determineBacterialActivity(conditions.temperature)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(
      totalEfficiency,
      conditions,
      specs,
      bacterialActivity
    )
    
    // Calculate maximum ammonia load
    const maxAmmoniaLoad = this.calculateMaxAmmoniaLoad(totalEfficiency, specs.size)
    
    return {
      baseEfficiency,
      temperatureFactor,
      oxygenFactor,
      maintenanceFactor,
      ageFactor,
      totalEfficiency,
      bacterialActivity,
      recommendations,
      maxAmmoniaLoad
    }
  }

  /**
   * Get temperature factor for bacterial activity
   */
  private static getTemperatureFactor(temperature: number): number {
    if (temperature < this.TEMP_THRESHOLDS.INACTIVE) {
      return 0.1 // Bacteria nearly inactive
    } else if (temperature < this.TEMP_THRESHOLDS.SLOW) {
      return 0.3 // Slow activity
    } else if (temperature < this.TEMP_THRESHOLDS.ACTIVE) {
      return 0.7 // Active
    } else if (temperature < this.TEMP_THRESHOLDS.OPTIMAL) {
      return 1.0 // Optimal
    } else {
      return 0.8 // Slightly reduced at very high temps
    }
  }

  /**
   * Get oxygen factor
   */
  private static getOxygenFactor(oxygenLevel: number): number {
    if (oxygenLevel >= 7) return 1.0
    if (oxygenLevel >= 5) return 0.8
    if (oxygenLevel >= 3) return 0.5
    return 0.2
  }

  /**
   * Get age factor for filter efficiency
   */
  private static getAgeFactor(ageInMonths: number): number {
    if (ageInMonths < 6) return 1.0
    if (ageInMonths < 12) return 0.95
    if (ageInMonths < 24) return 0.9
    if (ageInMonths < 36) return 0.8
    return 0.7
  }

  /**
   * Calculate media bonus
   */
  private static calculateMediaBonus(media: FilterMedia[]): number {
    if (media.length === 0) return 1.0
    
    const totalEfficiency = media.reduce((sum, medium) => {
      return sum + (this.MEDIA_EFFICIENCIES[medium] || 0.5)
    }, 0)
    
    const averageEfficiency = totalEfficiency / media.length
    return Math.min(1.2, averageEfficiency) // Cap at 20% bonus
  }

  /**
   * Determine bacterial activity level
   */
  private static determineBacterialActivity(temperature: number): BacterialActivity {
    if (temperature < this.TEMP_THRESHOLDS.INACTIVE) {
      return {
        level: 'inactive',
        description: 'Bacteriën zijn inactief - filter werkt niet',
        feedingAdvice: 'Niet voeren - filter kan ammoniak niet afbreken'
      }
    } else if (temperature < this.TEMP_THRESHOLDS.SLOW) {
      return {
        level: 'slow',
        description: 'Bacteriën worden wakker - filter opbouwen',
        feedingAdvice: 'Voorzichtig voeren - langzaam opbouwen'
      }
    } else if (temperature < this.TEMP_THRESHOLDS.ACTIVE) {
      return {
        level: 'active',
        description: 'Bacteriën zijn actief - normale filterwerking',
        feedingAdvice: 'Normaal voeren mogelijk'
      }
    } else {
      return {
        level: 'optimal',
        description: 'Bacteriën werken optimaal - maximale capaciteit',
        feedingAdvice: 'Maximaal voeren mogelijk'
      }
    }
  }

  /**
   * Generate recommendations based on efficiency
   */
  private static generateRecommendations(
    efficiency: number,
    conditions: FilterConditions,
    specs: FilterSpecs,
    bacterialActivity: BacterialActivity
  ): string[] {
    const recommendations: string[] = []
    
    // Efficiency-based recommendations
    if (efficiency < 0.3) {
      recommendations.push('🚨 Filter ernstig onderbelast - dringend onderhoud nodig')
    } else if (efficiency < 0.5) {
      recommendations.push('⚠️ Filter onderbelast - controleer en onderhoud')
    } else if (efficiency > 0.9) {
      recommendations.push('✅ Filter werkt uitstekend')
    }
    
    // Temperature-based recommendations
    if (conditions.temperature < 8) {
      recommendations.push('❄️ Temperatuur <8°C - filter inactief, niet voeren')
    } else if (conditions.temperature < 13) {
      recommendations.push('🌱 Voorjaar - filter opbouwen, langzaam verhogen voer')
    } else if (conditions.temperature > 25) {
      recommendations.push('☀️ Hoge temperatuur - extra beluchting aanbevolen')
    }
    
    // Oxygen recommendations
    if (conditions.oxygenLevel < 5) {
      recommendations.push('🫁 Zuurstof te laag - extra beluchting nodig')
    }
    
    // Maintenance recommendations
    if (conditions.maintenanceLevel < 0.7) {
      recommendations.push('🧽 Filter onderhoud nodig - reinig en controleer')
    }
    
    // Age recommendations
    if (conditions.filterAge > 24) {
      recommendations.push('🔄 Filter ouder dan 2 jaar - overweeg media vervanging')
    }
    
    return recommendations
  }

  /**
   * Calculate maximum ammonia load the filter can handle
   */
  private static calculateMaxAmmoniaLoad(efficiency: number, filterSize: number): number {
    // Base capacity: 1g ammonia per 100L filter per day at 100% efficiency
    const baseCapacity = (filterSize / 100) * 1.0
    return baseCapacity * efficiency
  }

  /**
   * Get filter maintenance schedule
   */
  static getMaintenanceSchedule(filterType: FilterType): {
    frequency: string
    tasks: string[]
    seasonal: string[]
  } {
    const schedules: Record<FilterType, any> = {
      'mattenbak': {
        frequency: 'Wekelijks',
        tasks: ['Voorfilter reinigen', 'Matten spoelen', 'Pomp controleren'],
        seasonal: ['Voorjaar: volledige reiniging', 'Zomer: extra controle', 'Winter: minimaal onderhoud']
      },
      'trickle': {
        frequency: 'Maandelijks',
        tasks: ['Media spoelen', 'Verstoppingen controleren', 'Beluchting controleren'],
        seasonal: ['Voorjaar: media vervangen', 'Zomer: extra beluchting', 'Winter: bescherming tegen vorst']
      },
      'moving_bed': {
        frequency: 'Maandelijks',
        tasks: ['Media controleren', 'Beweging controleren', 'Beluchting optimaliseren'],
        seasonal: ['Voorjaar: media aanvullen', 'Zomer: extra beluchting', 'Winter: bescherming']
      },
      'bead_filter': {
        frequency: 'Wekelijks',
        tasks: ['Backwash uitvoeren', 'Media controleren', 'Druk controleren'],
        seasonal: ['Voorjaar: volledige reiniging', 'Zomer: frequentere backwash', 'Winter: bescherming']
      },
      'biological_only': {
        frequency: 'Maandelijks',
        tasks: ['Media controleren', 'Beluchting controleren', 'Verstoppingen controleren'],
        seasonal: ['Voorjaar: media vervangen', 'Zomer: extra beluchting', 'Winter: bescherming']
      },
      'mechanical_only': {
        frequency: 'Wekelijks',
        tasks: ['Filters reinigen', 'Verstoppingen controleren', 'Pomp controleren'],
        seasonal: ['Voorjaar: volledige reiniging', 'Zomer: extra controle', 'Winter: bescherming']
      },
      'natural': {
        frequency: 'Seizoensgebonden',
        tasks: ['Planten snoeien', 'Slib verwijderen', 'Waterkwaliteit controleren'],
        seasonal: ['Voorjaar: planten opruimen', 'Zomer: algen controleren', 'Herfst: bladeren verwijderen', 'Winter: bescherming']
      }
    }
    
    return schedules[filterType] || schedules['biological_only']
  }

  /**
   * Get educational explanation about filter efficiency
   */
  static getEducationalExplanation(): string {
    return `
🔧 **Filter Efficiëntie Begrijpen**

**Temperatuur is cruciaal:**
• <8°C: Bacteriën slapen - filter werkt niet
• 8-13°C: Bacteriën worden wakker - voorzichtig opbouwen
• 13-20°C: Bacteriën actief - normale werking
• >20°C: Bacteriën optimaal - maximale capaciteit

**Filter types hebben verschillende efficiëntie:**
• Trickle filters: 95% (beste beluchting)
• Mattenbak: 85% (goede oppervlakte)
• Moving bed: 90% (actieve beweging)
• Bead filters: 70% (beperkte beluchting)

**Waarom beluchting belangrijk is:**
Bacteriën hebben zuurstof nodig om ammoniak af te breken.
Meer zuurstof = betere filterwerking = meer voer mogelijk.
    `.trim()
  }
}
