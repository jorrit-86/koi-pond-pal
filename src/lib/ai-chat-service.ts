import { supabase } from './supabase'

export interface ChatContext {
  currentPage: string
  waterParameters?: Array<{
    name: string
    value: number
    unit: string
    status: string
  }>
  koiCount?: number
  pondSize?: number
  userExperience?: string
  season?: string
  filterData?: {
    filtration_type?: string
    filter_media?: string[]
    filter_segments?: Array<{
      name: string
      type: string
      media: string[]
      description: string
    }>
    uv_sterilizer?: boolean
    protein_skimmer?: boolean
    waterfall?: boolean
    fountain?: boolean
    aeration_system?: boolean
    heater?: boolean
    chiller?: boolean
    auto_feeder?: boolean
    water_source?: string
    water_changes_manual?: boolean
    plants_present?: boolean
    plant_types?: string[]
  }
}

export interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: ChatContext
}

export class AIChatService {
  // Get user's pond context for personalized responses
  static async getPondContext(userId: string): Promise<ChatContext> {
    try {
      // Get user preferences including filter data
      const { data: preferences, error: preferencesError } = await supabase
        .from('user_preferences')
        .select(`
          experience_level, 
          pond_size_liters,
          filtration_type,
          filter_media,
          filter_segments,
          uv_sterilizer,
          protein_skimmer,
          waterfall,
          fountain,
          aeration_system,
          heater,
          chiller,
          auto_feeder,
          water_source,
          water_changes_manual,
          plants_present,
          plant_types
        `)
        .eq('user_id', userId)
        .maybeSingle()


      // Get latest water parameters
      const { data: parameters } = await supabase
        .from('water_parameters')
        .select('parameter_type, value, unit, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      // Get koi count
      const { count: koiCount } = await supabase
        .from('koi')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      // Determine current season
      const currentMonth = new Date().getMonth()
      const season = currentMonth >= 2 && currentMonth <= 4 ? 'spring' :
                    currentMonth >= 5 && currentMonth <= 7 ? 'summer' :
                    currentMonth >= 8 && currentMonth <= 10 ? 'autumn' : 'winter'

      return {
        currentPage: 'dashboard',
        waterParameters: parameters?.map(p => ({
          name: p.parameter_type,
          value: p.value,
          unit: p.unit || '',
          status: p.status || 'normal'
        })),
        koiCount: koiCount || 0,
        pondSize: preferences?.pond_size_liters || 0,
        userExperience: preferences?.experience_level || 'beginner',
        season,
        filterData: {
          filtration_type: preferences?.filtration_type || 'mechanical_biological',
          filter_media: preferences?.filter_media || [],
          filter_segments: preferences?.filter_segments || [],
          uv_sterilizer: preferences?.uv_sterilizer ?? false,
          protein_skimmer: preferences?.protein_skimmer ?? false,
          waterfall: preferences?.waterfall ?? false,
          fountain: preferences?.fountain ?? false,
          aeration_system: preferences?.aeration_system ?? false,
          heater: preferences?.heater ?? false,
          chiller: preferences?.chiller ?? false,
          auto_feeder: preferences?.auto_feeder ?? false,
          water_source: preferences?.water_source || 'tap_water',
          water_changes_manual: preferences?.water_changes_manual ?? true,
          plants_present: preferences?.plants_present ?? false,
          plant_types: preferences?.plant_types || []
        }
      }
    } catch (error) {
      console.error('Error getting pond context:', error)
      return {
        currentPage: 'dashboard',
        waterParameters: [],
        koiCount: 0,
        pondSize: 0,
        userExperience: 'beginner',
        season: 'spring',
        filterData: {
          filtration_type: 'mechanical_biological',
          filter_media: [],
          filter_segments: [],
          uv_sterilizer: false,
          protein_skimmer: false,
          waterfall: false,
          fountain: false,
          aeration_system: false,
          heater: false,
          chiller: false,
          auto_feeder: false,
          water_source: 'tap_water',
          water_changes_manual: true,
          plants_present: false,
          plant_types: []
        }
      }
    }
  }

  // Generate AI response based on user message and context
  static async generateResponse(
    userMessage: string, 
    context: ChatContext
  ): Promise<string> {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))

    const lowerMessage = userMessage.toLowerCase()
    
    // Pond size/volume questions
    if (lowerMessage.includes('inhoud') || lowerMessage.includes('volume') || lowerMessage.includes('grootte') || lowerMessage.includes('liter') || lowerMessage.includes('vijver grootte')) {
      return this.generatePondSizeResponse(context)
    }

    // Water quality related questions
    if (lowerMessage.includes('water') || lowerMessage.includes('waterkwaliteit') || lowerMessage.includes('ph') || lowerMessage.includes('nitriet') || lowerMessage.includes('nitraat')) {
      return this.generateWaterQualityResponse(context)
    }

    // Koi care questions
    if (lowerMessage.includes('koi') || lowerMessage.includes('vis') || lowerMessage.includes('vissen')) {
      return this.generateKoiCareResponse(context)
    }


    // Filter questions
    if (lowerMessage.includes('filter') || lowerMessage.includes('filtratie') || lowerMessage.includes('biologisch')) {
      return this.generateFilterResponse(context)
    }

    // Temperature questions
    if (lowerMessage.includes('temperatuur') || lowerMessage.includes('warm') || lowerMessage.includes('koud')) {
      return this.generateTemperatureResponse(context)
    }

    // Seasonal questions
    if (lowerMessage.includes('seizoen') || lowerMessage.includes('winter') || lowerMessage.includes('zomer') || lowerMessage.includes('lente') || lowerMessage.includes('herfst')) {
      return this.generateSeasonalResponse(context)
    }

    // Health/disease questions
    if (lowerMessage.includes('ziek') || lowerMessage.includes('gezondheid') || lowerMessage.includes('probleem') || lowerMessage.includes('symptoom')) {
      return this.generateHealthResponse(context)
    }

    // General help
    if (lowerMessage.includes('help') || lowerMessage.includes('hulp') || lowerMessage.includes('wat kan je')) {
      return this.generateHelpResponse(context)
    }

    // System prompt/knowledge questions
    if (lowerMessage.includes('kennis') || lowerMessage.includes('system') || lowerMessage.includes('briefing') || lowerMessage.includes('master')) {
      return this.generateSystemPromptResponse(context)
    }

    // Default response
    return this.generateDefaultResponse(context)
  }

  private static generatePondSizeResponse(context: ChatContext): string {
    const pondSize = context.pondSize || 0
    const koiCount = context.koiCount || 0
    const experience = context.userExperience || 'beginner'
    
    if (pondSize === 0) {
      return `Ik zie dat je nog geen vijvergrootte hebt ingevoerd in je profiel. Om je beter te kunnen helpen, voeg je vijvergegevens toe via de 'Instellingen' pagina.

Voor een gezonde koi-vijver is het belangrijk om te weten:
• Vijverinhoud in liters
• Aantal koi
• Filtercapaciteit
• Diepte van de vijver

Met deze informatie kan ik je veel specifiekere adviezen geven over filtratie en onderhoud!`
    }

    const litersPerKoi = pondSize > 0 ? Math.round(pondSize / koiCount) : 0
    const isOverstocked = litersPerKoi < 50 // Less than 50 liters per koi is overstocked
    const isWellStocked = litersPerKoi >= 100 // More than 100 liters per koi is excellent
    
    let advice = `Je vijver heeft een inhoud van **${pondSize.toLocaleString('nl-NL')} liter** en je hebt **${koiCount} koi**.

**Analyse van je vijver:**
• Je hebt ${litersPerKoi} liter per koi
• ${isWellStocked ? '✅ Uitstekende bezetting' : isOverstocked ? '⚠️ Mogelijk overbezetting' : '✅ Goede bezetting'}

**Aanbevelingen voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**`

    if (pondSize < 1000) {
      advice += `
• Kleine vijver: Extra aandacht voor waterkwaliteit
• Regelmatige waterverversing (10-20% per week)
• Krachtige filtratie essentieel`
    } else if (pondSize < 5000) {
      advice += `
• Medium vijver: Goede balans tussen onderhoud en stabiliteit
• Wekelijkse waterkwaliteit controles
• Seizoensgebonden onderhoud`
    } else {
      advice += `
• Grote vijver: Zeer stabiel ecosysteem
• Maandelijkse controles voldoende
• Minimale waterverversing nodig`
    }

    if (koiCount > 0) {
      advice += `

**Specifiek voor je ${koiCount} koi:**
• Voeding: ${koiCount * 2}-${koiCount * 3} gram per dag in de zomer
• Filter: Minimaal ${Math.ceil(pondSize / 1000)}x vijverinhoud per uur
• Zuurstof: Extra beluchting bij warm weer`
    }

    return advice
  }

  private static generateWaterQualityResponse(context: ChatContext): string {
    const params = context.waterParameters || []
    const pondSize = context.pondSize || 0
    
    if (params.length === 0) {
      return `🔍 **Waterkwaliteit Analyse**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ **Geen Recente Metingen**
Ik zie dat je nog geen waterparameters hebt ingevoerd. Om je beter te kunnen helpen, voeg eerst wat metingen toe via de 'Waterparameters' pagina.

📋 **Ideale Waarden voor Koi**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 **pH**: 7.0-8.5
☠️ **Ammoniak**: 0 mg/l
⚠️ **Nitriet**: <0.1 mg/l  
📈 **Nitraat**: <50 mg/l
🛡️ **KH**: ≥6°dH
💎 **GH**: 6-12 dH
🌡️ **Temperatuur**: 18-24°C
💨 **Zuurstof**: >6 mg/l
🧪 **Fosfaat**: <1.0 mg/l

🧠 **Waterkwaliteit Kennis**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Ammoniak (NH₃/NH₄⁺)**: 0 mg/l - Giftig → direct actie bij detectie
**Nitriet (NO₂⁻)**: <0.1 mg/l - Giftig → filter verbeteren  
**Nitraat (NO₃⁻)**: <50 mg/l - Hoog → algengroei
**Fosfaat (PO₄³⁻)**: <1.0 mg/l - Algenvoeding, indirect schadelijk
**Zuurstof (O₂)**: >6 mg/l - Onder deze waarde: direct actie
**KH**: ≥6°dH - Buffer tegen pH-schommelingen
**Temperatuur**: 18-24°C - Optimale bacteriële activiteit

**Belangrijke relaties:**
• Ammoniak → Nitriet → Nitraat (biologische cyclus)
• Fosfaat voedt algen → water verversen bij hoge waarden
• Zuurstoftekort → stress en sterfte
• KH buffer → pH stabiliteit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 **Wat wil je specifiek weten over waterkwaliteit?**`
    }

    // Analyze each parameter and provide specific advice
    let analysis = `🔍 **Waterkwaliteit Analyse**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 **Je Vijver**: ${pondSize}L
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧪 **Parameter Analyse**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    let hasIssues = false
    let recommendations = []

    params.forEach(param => {
      const { name, value, unit, status } = param
      let statusIcon = '✅'
      let advice = ''

      switch (name.toLowerCase()) {
        case 'ph':
          if (value < 7.0) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te laag! Streefwaarde: 7.0-8.5. Voeg KH+ toe voor pH stabiliteit.'
          } else if (value > 8.5) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te hoog! Streefwaarde: 7.0-8.5. Controleer KH waarde (≥6°dH voor buffer).'
          } else {
            advice = 'Perfecte waarde! Binnen streefwaarde 7.0-8.5.'
          }
          break
        case 'nitriet':
          if (value > 0.1) {
            statusIcon = '🚨'
            hasIssues = true
            advice = 'Gevaarlijk! Streefwaarde: <0.1 mg/l. Acuut giftig voor koi! Direct 50% waterverversing en controleer biologische filter.'
            recommendations.push('Directe waterverversing en filter controle')
          } else if (value > 0) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te hoog! Streefwaarde: <0.1 mg/l. Giftig voor koi, controleer filter.'
            recommendations.push('Filter controle en waterverversing')
          } else {
            advice = 'Uitstekend! Geen nitriet gedetecteerd (streefwaarde: <0.1 mg/l).'
          }
          break
        case 'nitraat':
          if (value > 50) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te hoog! Streefwaarde: <50 mg/l. Stimuleert algen. Verhoog waterverversing of voeg planten toe.'
            recommendations.push('Verhoog waterverversing naar 20% per week')
          } else {
            advice = 'Goede waarde! Binnen streefwaarde <50 mg/l.'
          }
          break
        case 'ammoniak':
          if (value > 0) {
            statusIcon = '🚨'
            hasIssues = true
            advice = 'Gevaarlijk! Streefwaarde: 0 mg/l. Acuut giftig voor koi! Direct 50% waterverversing en controleer biologische filter.'
            recommendations.push('Urgente waterverversing en filter controle')
          } else {
            advice = 'Perfect! Geen ammoniak gedetecteerd (streefwaarde: 0 mg/l).'
          }
          break
        case 'kh':
          if (value < 6) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te laag! Streefwaarde: ≥6°dH. Essentieel voor pH stabiliteit en buffer voor bacteriën. Voeg KH+ toe.'
            recommendations.push('KH+ toevoegen voor buffer capaciteit')
          } else if (value > 12) {
            statusIcon = '⚠️'
            advice = 'Te hoog! Streefwaarde: ≥6°dH. Niet gevaarlijk, maar kan pH te stabiel maken.'
          } else {
            advice = 'Ideale buffer capaciteit! Binnen streefwaarde ≥6°dH.'
          }
          break
        case 'gh':
          if (value < 6) {
            statusIcon = '⚠️'
            advice = 'Te laag! Streefwaarde: 6-12°dH. Voeg GH+ toe voor essentiële mineralen.'
          } else if (value > 12) {
            statusIcon = '⚠️'
            advice = 'Te hoog! Streefwaarde: 6-12°dH. Niet gevaarlijk, maar kan hardheid problemen geven.'
          } else {
            advice = 'Goede mineralen balans! Binnen streefwaarde 6-12°dH.'
          }
          break
        case 'fosfaat':
          if (value > 1) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te hoog! Streefwaarde: <0.5-1 mg/l. Voedt algenexplosie en veroorzaakt indirect stress. Verhoog waterverversing.'
            recommendations.push('Waterverversing verhogen')
          } else if (value > 0.5) {
            statusIcon = '⚠️'
            advice = 'Aan de hoge kant! Streefwaarde: <0.5-1 mg/l. Houd in de gaten voor algen.'
          } else {
            advice = 'Goede waarde! Binnen streefwaarde <0.5-1 mg/l.'
          }
          break
        case 'zuurstof':
          if (value < 6) {
            statusIcon = '🚨'
            hasIssues = true
            advice = 'Te laag! Streefwaarde: >6 mg/l. Tekort veroorzaakt stress en sterfte. Voeg beluchting toe!'
            recommendations.push('Beluchtingssysteem toevoegen')
          } else {
            advice = 'Goede zuurstofwaarde! Binnen streefwaarde >6 mg/l.'
          }
          break
        default:
          advice = status === 'normal' ? 'Normale waarde' : 'Controleer waarde'
      }

      analysis += `${statusIcon} **${name.toUpperCase()}**: ${value} ${unit} - ${advice}\n`
    })

    if (hasIssues) {
      analysis += `

🚨 **Actie Vereist**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      recommendations.forEach(rec => {
        analysis += `\n⚠️ ${rec}`
      })
    } else {
      analysis += `

✅ **Uitstekend! Je waterkwaliteit is goed.**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    }

    if (pondSize > 0) {
      analysis += `

📊 **Specifiek voor je ${pondSize.toLocaleString('nl-NL')} liter vijver**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      if (pondSize < 1000) {
        analysis += `\n🔍 Kleine vijver: Controleer waterkwaliteit 2x per week`
      } else if (pondSize < 5000) {
        analysis += `\n📅 Medium vijver: Wekelijkse controles voldoende`
      } else {
        analysis += `\n📆 Grote vijver: Maandelijkse controles voldoende`
      }
    }

    analysis += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 **Wat wil je specifiek weten over waterkwaliteit?**`

    return analysis
  }

  private static generateKoiCareResponse(context: ChatContext): string {
    const koiCount = context.koiCount || 0
    const pondSize = context.pondSize || 0
    const experience = context.userExperience || 'beginner'
    
    if (koiCount === 0) {
      return `Ik kan je helpen met alle aspecten van koi-verzorging! Van het kiezen van de juiste koi tot dagelijkse verzorging.

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder kan ik je adviseren over:
• Het kiezen van gezonde koi
• Quarantaine procedures
• Dagelijkse observatie
• Groei en ontwikkeling
• Gedrag en interactie

Wat wil je specifiek weten over koi-verzorging?`
    }

    const litersPerKoi = pondSize > 0 ? Math.round(pondSize / koiCount) : 0
    const isOverstocked = litersPerKoi < 50
    const isWellStocked = litersPerKoi >= 100

    let response = `**Je koi overzicht:**
• Aantal koi: **${koiCount}**
${pondSize > 0 ? `• Vijverinhoud: **${pondSize.toLocaleString('nl-NL')} liter**` : ''}
${litersPerKoi > 0 ? `• Liter per koi: **${litersPerKoi} liter**` : ''}

**Bezetting analyse:**
${isWellStocked ? '✅ **Uitstekende bezetting** - Ruim voldoende ruimte per koi' : 
  isOverstocked ? '⚠️ **Mogelijk overbezetting** - Overweeg minder koi of grotere vijver' : 
  '✅ **Goede bezetting** - Voldoende ruimte per koi'}

**Specifieke adviezen voor je ${koiCount} koi:**`

    if (koiCount === 1) {
      response += `
• Solitaire koi: Zorg voor voldoende afleiding en schuilplaatsen
• Extra aandacht voor gedrag en gezondheid
• Overweeg een tweede koi voor gezelschap`
    } else if (koiCount <= 5) {
      response += `
• Kleine groep: Goede sociale interactie
• Houdt rekening met hiërarchie in de groep
• Regelmatige observatie van alle koi`
    } else {
      response += `
• Grote groep: Complexe sociale dynamiek
• Extra aandacht voor waterkwaliteit
• Mogelijk meer agressie - zorg voor voldoende ruimte`
    }

    if (pondSize > 0) {
      response += `

`
    }

    response += `

**Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder:**
• Dagelijkse gezondheidscontrole
• Groei en ontwikkeling monitoren
• Gedrag en interactie observeren
• Probleemherkenning en preventie

Wat wil je specifiek weten over je koi?`

    return response
  }

  private static generateFilterResponse(context: ChatContext): string {
    const pondSize = context.pondSize || 0
    const koiCount = context.koiCount || 0
    const experience = context.userExperience || 'beginner'
    const season = context.season || 'spring'
    const filterData = context.filterData
    
    
    if (!filterData || !filterData.filtration_type) {
      return `🔍 **Filtratie Systeem Analyse**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ **Geen Filtergegevens**
Ik zie dat je nog geen filtergegevens hebt ingevoerd. Om je specifieke feedback te kunnen geven over je filtersysteem, voeg je filtergegevens toe via de 'Instellingen' pagina.

📋 **Voor een complete filteranalyse heb ik nodig:**
• Type filtratie (mechanisch/biologisch/natuurlijk)
• Filter media (sponsen, keramiek, bio-ballen, etc.)
• UV-sterilisator, protein skimmer, etc.
• Water features (waterval, fontein, beluchting)

🧠 **Kennis: Filtratie Principes**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Een goed filtersysteem bestaat uit meerdere complementaire stappen:**
🔧 **Mechanische filtering** - Verwijdert vaste en zwevende deeltjes
🧬 **Biologische filtering** - Breekt giftige stoffen af (ammoniak → nitriet → nitraat)
🧪 **Chemische filtering** - Optioneel, voor tijdelijke correcties
💡 **UV-C en plantenfiltering** - Ondersteunend, geen vervanging van hoofdfilter

**Beluchting is een prestatieversterker van biologische filtering:**
• Zuurstofvoorziening - bacteriën zijn aeroob; meer O₂ = snellere omzetting
• Verbeterde doorstroming - lucht voorkomt dode zones
• Preventie van anaerobe zones - voorkomt H₂S en andere giftige gassen
• Gasuitwisseling - CO₂ eruit, O₂ erin → stabielere pH

Met deze informatie kan ik je concrete feedback geven over je huidige opstelling!`
    }

    // Extract media and equipment from filter segments
    const allMedia: string[] = []
    let hasUVFromSegments = false
    let hasProteinSkimmerFromSegments = false
    
    if (filterData.filter_segments && filterData.filter_segments.length > 0) {
      filterData.filter_segments.forEach(segment => {
        if (segment.media && segment.media.length > 0) {
          allMedia.push(...segment.media)
        }
        if (segment.type === 'uv') {
          hasUVFromSegments = true
        }
        if (segment.type === 'skimmer') {
          hasProteinSkimmerFromSegments = true
        }
      })
    }
    
    // Combine with direct boolean flags
    const hasUV = hasUVFromSegments || filterData.uv_sterilizer
    const hasProteinSkimmer = hasProteinSkimmerFromSegments || filterData.protein_skimmer
    const displayMedia = allMedia.length > 0 ? allMedia.join(', ') : (filterData.filter_media?.length > 0 ? filterData.filter_media.join(', ') : 'Geen media opgegeven')

    let response = `🔍 **Filter Systeem Analyse**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 **Je Huidige Opstelling**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Filtratie Type**: ${this.getFiltrationTypeName(filterData.filtration_type)}
🧽 **Filter Media**: ${displayMedia}
💡 **UV-Sterilisator**: ${hasUV ? '✅ Aanwezig' : '❌ Niet aanwezig'}
🫧 **Protein Skimmer**: ${hasProteinSkimmer ? '✅ Aanwezig' : '❌ Niet aanwezig'}
🌊 **Waterval**: ${filterData.waterfall ? '✅ Aanwezig' : '❌ Niet aanwezig'}
⛲ **Fontein**: ${filterData.fountain ? '✅ Aanwezig' : '❌ Niet aanwezig'}
💨 **Beluchtingssysteem**: ${filterData.aeration_system ? '✅ Aanwezig' : '❌ Niet aanwezig'}`

    if (filterData.filter_segments && filterData.filter_segments.length > 0) {
      response += `

🔗 **Filter Segmenten**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${filterData.filter_segments.map((segment, index) => {
  const typeEmoji = segment.type === 'mechanical' ? '🔧' : 
                   segment.type === 'biological' ? '🧬' : 
                   segment.type === 'chemical' ? '🧪' : 
                   segment.type === 'uv' ? '💡' : 
                   segment.type === 'skimmer' ? '🫧' : '📦'
  return `${typeEmoji} **Segment ${index + 1}** (${segment.type}): ${segment.media?.join(', ') || 'Geen media'}`
}).join('\n')}`
    }

    // Analyze the current setup
    response += `

📊 **Mijn Analyse**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

    // Add detailed filtration knowledge
    response += `

🧠 **Filtratie Kennis**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 **Mechanische Filtering**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verwijdert vaste en zwevende deeltjes (uitwerpselen, bladeren):

**Vortex** - Eenvoudig, goedkoop, maar vangt alleen grof vuil
**Borstels** - Betaalbaar, effectief tegen grove vervuiling, veel onderhoud
**Mattenfilter** - Vangt vuil + wat biofunctie, kan dichtslibben
**Zeefbochtfilter (sieve)** - Compact, weinig onderhoud, dagelijks afspoelen
**Trommelfilter** - Automatisch, zeer efficiënt, duur, afhankelijk van techniek
**Beadfilter** - Compact, combineert mech/bio, kan verstopt raken, backwash nodig

🧬 **Biologische Filtering**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hier vindt omzetting van giftige stoffen plaats (ammoniak → nitriet → nitraat) door bacteriën:

**Japanse matten** - Veel oppervlak, maar onderhoudsgevoelig
**Moving Bed (K1/K3)** - Belucht, zelfreinigend, hoge capaciteit
**Trickle/Shower filter** - Zuurstofrijk, stabiel, zeer effectief
**Beadfilter** - Compact, deels biologisch
**Glasfoam/keramisch** - Poreus, duurzaam, ideaal in trickles of beluchte kamers

🧪 **Chemische Filtering (optioneel)**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Gebruik van absorberende materialen:
• Actief kool, zeoliet, fosfaatbinders
• Effectief bij tijdelijke problemen (verkleuring, ammoniakpieken)
• Niet permanent toepasbaar; materiaal verzadigt en moet vervangen worden

💡 **UV-C en Plantenfiltering**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• UV-C doodt zweefalgen en ziektekiemen, maar vervangt geen filter
• Plantenfilters/moerasfilters nemen nitraat en fosfaat op, maar zijn seizoensgebonden
• Niet geschikt als hoofdfilter voor koi-vijvers

🌬️ **Beluchting en Filterprestatie**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Beluchting is een prestatieversterker van biologische filtering:

**Waarom beluchting essentieel is:**
• Zuurstofvoorziening - bacteriën zijn aeroob; meer O₂ = snellere omzetting
• Verbeterde doorstroming - lucht voorkomt dode zones, benut meer bio-oppervlak
• Preventie van anaerobe zones - voorkomt vorming van H₂S en andere giftige gassen
• Gasuitwisseling - CO₂ eruit, O₂ erin → stabielere pH en minder verzuring

**Invloed per filtertype:**
• Japanse matten: 60% → 80% (minder slib, beter O₂)
• Statisch media: 70% → 90% (sterke winst door beluchting)
• Moving bed: 0-40% → 100% (essentieel voor werking)
• Trickle/Shower: 100% (reeds natuurlijk belucht)
• Beadfilter: 60% → 70% (lichte winst mogelijk)

**Praktische aandachtspunten:**
• Lucht verdelen met fijne luchtstenen of schijven onder het medium
• Matige, constante beluchting voorkomt biofilmverlies
• In winter: beluchting reduceren om warmteverlies te beperken

*"Een biologisch filter zonder beluchting werkt, maar met beluchting leeft het."*`

    // Filtration type analysis
    const filtrationScore = this.analyzeFiltrationType(filterData.filtration_type, pondSize, koiCount)
    const filtrationEmoji = filtrationScore.score >= 8 ? '🌟' : filtrationScore.score >= 6 ? '👍' : '⚠️'
    response += `

${filtrationEmoji} **Filtratie Type**: ${filtrationScore.score}/10
   ${filtrationScore.feedback}`

    // Filter media analysis
    const mediaScore = this.analyzeFilterMedia(allMedia.length > 0 ? allMedia : (filterData.filter_media || []), pondSize, koiCount)
    const mediaEmoji = mediaScore.score >= 8 ? '🌟' : mediaScore.score >= 6 ? '👍' : '⚠️'
    response += `

${mediaEmoji} **Filter Media**: ${mediaScore.score}/10
   ${mediaScore.feedback}`

    // Equipment analysis (use updated UV and protein skimmer detection)
    const updatedFilterData = {
      ...filterData,
      uv_sterilizer: hasUV,
      protein_skimmer: hasProteinSkimmer
    }
    const equipmentScore = this.analyzeEquipment(updatedFilterData, pondSize, koiCount)
    const equipmentEmoji = equipmentScore.score >= 8 ? '🌟' : equipmentScore.score >= 6 ? '👍' : '⚠️'
    response += `

${equipmentEmoji} **Uitrusting**: ${equipmentScore.score}/10
   ${equipmentScore.feedback}`

    // Overall assessment
    const overallScore = Math.round((filtrationScore.score + mediaScore.score + equipmentScore.score) / 3)
    let overallFeedback = ''
    let overallEmoji = ''
    if (overallScore >= 8) {
      overallFeedback = 'Uitstekend filtersysteem! Je hebt een professionele opstelling.'
      overallEmoji = '🏆'
    } else if (overallScore >= 6) {
      overallFeedback = 'Goed filtersysteem met enkele verbeterpunten.'
      overallEmoji = '👍'
    } else if (overallScore >= 4) {
      overallFeedback = 'Basis filtersysteem, maar er zijn belangrijke verbeteringen mogelijk.'
      overallEmoji = '⚠️'
    } else {
      overallFeedback = 'Je filtersysteem heeft significante verbeteringen nodig.'
      overallEmoji = '🚨'
    }

    response += `

${overallEmoji} **Algemene Beoordeling**: ${overallScore}/10
   ${overallFeedback}

💡 **Specifieke Aanbevelingen**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

    // Specific recommendations based on current setup
    const recommendations: string[] = []
    
    if (!hasUV && pondSize > 1000) {
      recommendations.push('💡 Overweeg een UV-sterilisator voor kristalhelder water')
    }

    if (!filterData.aeration_system && koiCount > 3) {
      recommendations.push('💨 Beluchtingssysteem aanbevolen voor optimale zuurstof')
    }

    if (filterData.filtration_type === 'mechanical_only' && koiCount > 0) {
      recommendations.push('🧬 Voeg biologische filtratie toe voor betere waterkwaliteit')
    }

    if (allMedia.length === 0 && (!filterData.filter_media || filterData.filter_media.length === 0)) {
      recommendations.push('🧽 Voeg filter media toe (sponsen, keramiek, bio-ballen)')
    }

    if (pondSize > 0 && koiCount > 0) {
      const litersPerKoi = Math.round(pondSize / koiCount)
      if (litersPerKoi < 100 && !hasProteinSkimmer) {
        recommendations.push('🫧 Protein skimmer aanbevolen voor hoge bezetting')
      }
    }

    if (recommendations.length > 0) {
      response += `\n${recommendations.join('\n')}`
    } else {
      response += `\n🎉 Je filtersysteem is al goed geoptimaliseerd!`
    }

    response += `

🔧 **Onderhoudstips**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ ${this.getMaintenanceAdvice(filterData, season)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 **Wat wil je specifiek weten over je filtersysteem?**`

    return response
  }

  private static getFiltrationTypeName(type: string): string {
    const types: Record<string, string> = {
      'mechanical_biological': 'Mechanisch + Biologisch',
      'mechanical_only': 'Alleen Mechanisch',
      'biological_only': 'Alleen Biologisch',
      'natural': 'Natuurlijk',
      'none': 'Geen filtratie'
    }
    return types[type] || type
  }

  private static analyzeFiltrationType(type: string, pondSize: number, koiCount: number): { score: number, feedback: string } {
    switch (type) {
      case 'mechanical_biological':
        return { 
          score: 9, 
          feedback: 'Uitstekende combinatie! Mechanische filtering verwijdert vuil, biologische filtering breekt afvalstoffen af (ammoniak → nitriet → nitraat). Dit is de gouden standaard voor koi-vijvers.' 
        }
      case 'biological_only':
        return { 
          score: 6, 
          feedback: 'Biologische filtratie is essentieel, maar mechanische voorfiltratie voorkomt dat het biofilter dichtslibt. Overweeg een vortexkamer, borstelfilter of trommelfilter toe te voegen.' 
        }
      case 'mechanical_only':
        return { 
          score: 3, 
          feedback: 'Alleen mechanische filtratie is onvoldoende! Koi produceren ammoniak dat giftig is. Je hebt biologische filtratie nodig (Japanse matten, Moving Bed, of trickle filter) om ammoniak af te breken.' 
        }
      case 'natural':
        return { 
          score: 5, 
          feedback: 'Natuurlijke filtratie kan werken in grote vijvers met weinig koi, maar is minder betrouwbaar. Voor koi is een mechanisch-biologisch systeem aanbevolen.' 
        }
      case 'none':
        return { 
          score: 1, 
          feedback: 'Geen filtratie is levensgevaarlijk voor koi! Ammoniak en nitriet zijn acuut giftig. Installeer direct een filtersysteem.' 
        }
      default:
        return { 
          score: 5, 
          feedback: 'Onbekend type, controleer je instellingen.' 
        }
    }
  }

  private static analyzeFilterMedia(media: string[], pondSize: number, koiCount: number): { score: number, feedback: string } {
    if (media.length === 0) {
      return { 
        score: 3, 
        feedback: 'Geen filter media opgegeven! Voor koi heb je zowel mechanische als biologische media nodig. Overweeg: Japanse matten, Moving Bed (K1), keramiek, of glasfoam.' 
      }
    }

    let score = 5
    let feedback = ''
    let hasMechanical = false
    let hasBiological = false

    // Mechanische filter media
    if (media.some(m => m.toLowerCase().includes('borstelfilter') || m.toLowerCase().includes('brush'))) {
      score += 1
      hasMechanical = true
      feedback += 'Borstelfilter: goedkoop, vangt grove delen, maar veel schoonmaak. '
    }
    if (media.some(m => m.toLowerCase().includes('vortex') || m.toLowerCase().includes('vortexkamer'))) {
      score += 1
      hasMechanical = true
      feedback += 'Vortexkamer: goedkoop en eenvoudig, maar weinig effectief bij fijn vuil. '
    }
    if (media.some(m => m.toLowerCase().includes('trommel') || m.toLowerCase().includes('drum'))) {
      score += 3
      hasMechanical = true
      feedback += 'Trommelfilter: zeer effectief, automatisch, onderhoudsarm! '
    }
    if (media.some(m => m.toLowerCase().includes('zeef') || m.toLowerCase().includes('sieve'))) {
      score += 2
      hasMechanical = true
      feedback += 'Zeefbochtfilter: effectief, weinig onderhoud, handmatig afspoelen. '
    }

    // Biologische filter media
    if (media.some(m => m.toLowerCase().includes('japanse') || m.toLowerCase().includes('matten'))) {
      score += 3
      hasBiological = true
      feedback += 'Japanse matten: veel oppervlak, bewezen techniek, maar arbeidsintensief schoonmaken. '
    }
    if (media.some(m => m.toLowerCase().includes('moving') || m.toLowerCase().includes('k1') || m.toLowerCase().includes('k3'))) {
      score += 3
      hasBiological = true
      feedback += 'Moving Bed (K1/K3): belucht, zelfreinigend, zeer effectief! Vraagt wel luchtpomp. '
    }
    if (media.some(m => m.toLowerCase().includes('glasfoam') || m.toLowerCase().includes('glas'))) {
      score += 2
      hasBiological = true
      feedback += 'Glasfoam: zeer hoog oppervlak, duurzaam, ideaal voor trickle/shower filters. '
    }
    if (media.some(m => m.toLowerCase().includes('keramiek') || m.toLowerCase().includes('ceramic'))) {
      score += 2
      hasBiological = true
      feedback += 'Keramiek: stabiel biologisch medium met goed oppervlak. '
    }
    if (media.some(m => m.toLowerCase().includes('bead') || m.toLowerCase().includes('kralen'))) {
      score += 2
      hasBiological = true
      feedback += 'Beadfilter: combineert mechanisch en biologisch, compact, maar kans op verstopping. '
    }

    // Chemische filter media
    if (media.some(m => m.toLowerCase().includes('actieve') || m.toLowerCase().includes('carbon'))) {
      score += 1
      feedback += 'Actieve kool: goed voor tijdelijke correcties, niet permanent gebruiken. '
    }
    if (media.some(m => m.toLowerCase().includes('zeoliet') || m.toLowerCase().includes('zeolite'))) {
      score += 1
      feedback += 'Zeoliet: kan ammoniak binden, maar vervangt geen biologische filtratie. '
    }

    // Overall assessment
    if (hasMechanical && hasBiological) {
      feedback = 'Uitstekende combinatie van mechanische en biologische media! ' + feedback
    } else if (hasBiological) {
      feedback = 'Goede biologische media, overweeg mechanische voorfiltratie. ' + feedback
    } else if (hasMechanical) {
      feedback = 'Alleen mechanische media is onvoldoende voor koi! Voeg biologische media toe. ' + feedback
    } else {
      feedback = 'Basis filter media. ' + feedback
    }

    return { score: Math.min(score, 10), feedback: feedback.trim() }
  }

  private static analyzeEquipment(filterData: any, pondSize: number, koiCount: number): { score: number, feedback: string } {
    let score = 5
    let feedback = ''

    if (filterData.uv_sterilizer) {
      score += 2
      feedback += 'UV-sterilisator voor helder water. '
    }
    if (filterData.protein_skimmer) {
      score += 1
      feedback += 'Protein skimmer voor organische afval. '
    }
    if (filterData.aeration_system) {
      score += 2
      feedback += 'Beluchtingssysteem voor zuurstof. '
    }
    if (filterData.waterfall || filterData.fountain) {
      score += 1
      feedback += 'Water circulatie via waterval/fontein. '
    }

    if (score >= 8) {
      feedback = 'Uitstekende uitrusting! ' + feedback
    } else if (score >= 6) {
      feedback = 'Goede uitrusting. ' + feedback
    } else {
      feedback = 'Basis uitrusting. ' + feedback
    }

    return { score: Math.min(score, 10), feedback: feedback.trim() }
  }

  private static getMaintenanceAdvice(filterData: any, season: string): string {
    const advice = []
    
    if (filterData.filter_media?.includes('sponges') || filterData.filter_media?.includes('sponsen')) {
      advice.push('Reinig sponsen wekelijks')
    }
    if (filterData.uv_sterilizer) {
      advice.push('Vervang UV-lamp jaarlijks')
    }
    if (filterData.protein_skimmer) {
      advice.push('Leeg skimmer dagelijks')
    }
    if (filterData.aeration_system) {
      advice.push('Controleer beluchting regelmatig')
    }

    if (advice.length === 0) {
      return 'Controleer je filtersysteem regelmatig op verstoppingen en vervuiling.'
    }

    return advice.join(', ')
  }

  private static generateTemperatureResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const pondSize = context.pondSize || 0
    const koiCount = context.koiCount || 0
    const experience = context.userExperience || 'beginner'
    
    let response = `**Temperatuur beheer voor de ${season}:**

**Temperatuur zones:**
• **Onder 10°C**: Koi eten weinig tot niets, minimale activiteit
• **10-15°C**: Lichte activiteit, weinig beweging, voorzichtig opbouwen
• **15-20°C**: Normale activiteit, matige beweging, regelmatig observeren
• **20-25°C**: Optimale temperatuur, actieve koi, maximale groei
• **Boven 25°C**: Extra zuurstof en schaduw nodig, stress gevaar`

    // Seasonal specific advice
    const seasonalTempAdvice = {
      spring: `
**Lente temperatuur management:**
• Temperatuur stijgt langzaam (10-18°C)
• Start met activiteit bij 12°C
• Filter opstarten en bacteriën activeren
• Voorzichtig met plotselinge temperatuurschommelingen`,
      summer: `
**Zomer temperatuur management:**
• Optimale temperatuur (18-25°C)
• Maximale activiteit en groei
• Extra zuurstof bij warm weer
• Schaduw voorzien bij temperaturen boven 25°C`,
      autumn: `
**Herfst temperatuur management:**
• Temperatuur daalt (15-10°C)
• Verminder activiteit bij dalende temperatuur
• Voorbereiden op winter
• Filter beschermen tegen kou`,
      winter: `
**Winter temperatuur management:**
• Lage temperatuur (onder 10°C)
• Minimale activiteit onder 10°C
• Filter beschermen tegen vorst
• Minimale doorstroming, ijsvrij houden`
    }

    response += seasonalTempAdvice[season as keyof typeof seasonalTempAdvice]

    if (pondSize > 0) {
      response += `

**Specifiek voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**
• ${pondSize < 1000 ? 'Kleine vijver: Snellere temperatuurschommelingen, extra aandacht' :
    pondSize < 5000 ? 'Medium vijver: Matige temperatuurschommelingen, normale aandacht' :
    'Grote vijver: Langzame temperatuurschommelingen, zeer stabiel'}`
    }

    if (koiCount > 0) {
      response += `

**Voor je ${koiCount} koi:**
• ${koiCount === 1 ? 'Solitaire koi: Extra aandacht voor gedrag bij temperatuurveranderingen' :
    koiCount <= 5 ? 'Kleine groep: Normale temperatuurgevoeligheid' :
    'Grote groep: Meer warmte productie, extra zuurstof bij warm weer'}`
    }

    response += `

**Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder:**
• ${experience === 'beginner' ? 'Investeer in een goede thermometer' : 'Overweeg geavanceerde temperatuur monitoring'}
• Monitor temperatuur dagelijks
• Pas activiteit aan op temperatuur
• Voorzie schaduw en zuurstof bij warm weer

Wat wil je specifiek weten over temperatuurbeheer?`

    return response
  }

  private static generateSeasonalResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const experience = context.userExperience || 'beginner'
    
    const seasonalTasks = {
      spring: 'Lente: Vijver opstarten, filter controleren, waterkwaliteit testen',
      summer: 'Zomer: Waterkwaliteit monitoren, schaduw voorzien, zuurstof controleren',
      autumn: 'Herfst: Bladeren verwijderen, vijver voorbereiden op winter',
      winter: 'Winter: Ijsvrij houden, filter onderhoud, koi observeren'
    }

    return `In de ${season} zijn er specifieke taken voor je vijver:

${seasonalTasks[season as keyof typeof seasonalTasks]}

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder kan ik je helpen met seizoensgebonden adviezen. Wat wil je specifiek weten over ${season}onderhoud?`
  }

  private static generateHealthResponse(context: ChatContext): string {
    const experience = context.userExperience || 'beginner'
    
    return `Koi-gezondheid is belangrijk! Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder kan ik je helpen met:

• Symptoomherkenning
• Preventieve maatregelen
• Eerste hulp bij problemen
• Wanneer een specialist raadplegen
• Quarantaine procedures

Belangrijke signalen om op te letten:
• Veranderd zwemgedrag
• Verlies van eetlust
• Vreemde plekken of wonden
• Ademhalingsproblemen

Wat specifiek wil je weten over koi-gezondheid?`
  }

  private static generateHelpResponse(context: ChatContext): string {
    const experience = context.userExperience || 'beginner'
    
    return `Ik ben je Koi Sensei AI-assistant! Ik kan je helpen met:

🌊 **Waterkwaliteit**
• Parameter interpretatie
• Probleemoplossing
• Onderhoudstips

🐟 **Koi-verzorging**
• Voeding en gezondheid
• Gedrag en groei
• Probleemherkenning

🔧 **Vijveronderhoud**
• Filterbeheer
• Seizoensadviezen
• Technische vragen

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder geef ik je gepersonaliseerd advies. Stel gerust je vraag!`
  }

  private static generateDefaultResponse(context: ChatContext): string {
    const experience = context.userExperience || 'beginner'
    
    return `Dat is een interessante vraag! Als Koi Sensei kan ik je helpen met:

• Waterkwaliteit en parameters
• Koi-verzorging en gezondheid  
• Vijveronderhoud en filtratie
• Seizoensadviezen
• Probleemoplossing

Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder geef ik je gepersonaliseerd advies. Kun je je vraag wat specifieker stellen? Dan kan ik je het beste advies geven!`
  }

  private static generateSystemPromptResponse(context: ChatContext): string {
    return `🧠 **Koi Sensei - Master Kennis Base**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 **Doel van de AI**
Je bent een deskundige koi-vijverspecialist met uitgebreide kennis van waterkwaliteit en biochemie, filtratietechniek en visgezondheid. Je taak is om koi-houders te voorzien van feitelijk correcte, onderbouwde en praktische adviezen over het beheer van hun vijver, afgestemd op hun filtertype, waterwaarden, temperatuur en bezetting.

🧩 **1. Filtratiesystemen in koi-vijvers**

Een goed filtersysteem bestaat uit meerdere complementaire stappen: mechanisch, biologisch, chemisch, en ondersteunend (UV/planten).

🔹 **Mechanische filtering**
Verwijdert vaste en zwevende deeltjes (uitwerpselen, bladeren).

**Vortex** - Eenvoudig, goedkoop, maar vangt alleen grof vuil
**Borstels** - Betaalbaar, effectief tegen grove vervuiling, veel onderhoud
**Mattenfilter** - Vangt vuil + wat biofunctie, kan dichtslibben
**Zeefbochtfilter (sieve)** - Compact, weinig onderhoud, dagelijks afspoelen
**Trommelfilter** - Automatisch, zeer efficiënt, duur, afhankelijk van techniek
**Beadfilter** - Compact, combineert mech/bio, kan verstopt raken, backwash nodig

🔹 **Biologische filtering**
Hier vindt omzetting van giftige stoffen plaats (ammoniak → nitriet → nitraat) door bacteriën.

**Japanse matten** – veel oppervlak, maar onderhoudsgevoelig
**Moving Bed (K1/K3)** – belucht, zelfreinigend, hoge capaciteit
**Trickle/Shower filter** – zuurstofrijk, stabiel, zeer effectief
**Beadfilter** – compact, deels biologisch
**Glasfoam/keramisch** – poreus, duurzaam, ideaal in trickles of beluchte kamers

🔹 **Chemische filtering (optioneel)**
Gebruik van absorberende materialen: Actief kool, zeoliet, fosfaatbinders. Effectief bij tijdelijke problemen (verkleuring, ammoniakpieken). Niet permanent toepasbaar; materiaal verzadigt en moet vervangen worden.

🔹 **UV-C en plantenfiltering**
UV-C doodt zweefalgen en ziektekiemen, maar vervangt geen filter. Plantenfilters/moerasfilters nemen nitraat en fosfaat op, maar zijn seizoensgebonden en niet geschikt als hoofdfilter.

🌬️ **2. Beluchting en filterprestatie**

Beluchting is een prestatieversterker van biologische filtering.

🔹 **Waarom beluchting essentieel is**
• Zuurstofvoorziening – bacteriën zijn aeroob; meer O₂ = snellere omzetting
• Verbeterde doorstroming – lucht voorkomt dode zones, benut meer bio-oppervlak
• Preventie van anaerobe zones – voorkomt vorming van H₂S en andere giftige gassen
• Gasuitwisseling – CO₂ eruit, O₂ erin → stabielere pH en minder verzuring

🔹 **Invloed per filtertype**
• Japanse matten: 60% → 80% (minder slib, beter O₂)
• Statisch media: 70% → 90% (sterke winst door beluchting)
• Moving bed: 0-40% → 100% (essentieel voor werking)
• Trickle/Shower: 100% (reeds natuurlijk belucht)
• Beadfilter: 60% → 70% (lichte winst mogelijk)

🔹 **Praktische aandachtspunten**
• Lucht verdelen met fijne luchtstenen of schijven onder het medium
• Matige, constante beluchting voorkomt biofilmverlies
• In winter: beluchting reduceren om warmteverlies te beperken

*"Een biologisch filter zonder beluchting werkt, maar met beluchting leeft het."*

💧 **3. Waterparameters en streefwaarden**

| Parameter | Streefwaarde | Betekenis |
|-----------|--------------|-----------|
| Ammoniak (NH₃/NH₄⁺) | 0 mg/l | Giftig → direct actie bij detectie |
| Nitriet (NO₂⁻) | <0.1 mg/l | Giftig → filter verbeteren |
| Nitraat (NO₃⁻) | <50 mg/l | Hoog → algengroei |
| Fosfaat (PO₄³⁻) | <1.0 mg/l | Algenvoeding, indirect schadelijk |
| Zuurstof (O₂) | >6 mg/l | Onder deze waarde: direct actie |
| KH | ≥6°dH | Buffer tegen pH-schommelingen |
| Temperatuur | 18-24°C | Optimale bacteriële activiteit |

🌡️ **4. Temperatuur en koi activiteit**

🔹 **Temperatuur zones**
• <8°C: Koi in winterslaap, minimale activiteit
• 8-12°C: Koi worden wakker, lichte activiteit
• 12-18°C: Normale activiteit, matige beweging
• 18-24°C: Optimale temperatuur, actieve koi
• >24°C: Extra aandacht voor zuurstof, stress gevaar

🔹 **Waterkwaliteit als limiterende factor**
• Elke meetbare hoeveelheid ammoniak of nitriet → direct actie vereist
• Nitraat >50 mg/l of fosfaat >1 mg/l → water verversen
• Zuurstoftekort → extra beluchting

*Temperatuur bepaalt de activiteit van koi en filter bacteriën.*

🧭 **5. AI-gedragsinstructies**

De AI moet:
• Antwoorden geven met technische nauwkeurigheid én praktische toepasbaarheid
• Uitleg structureren in 3-4 logische secties (uitleg, oorzaak, effect, advies)
• Altijd de relatie leggen tussen temperatuur, waterkwaliteit en filtering
• Bij vragen over filterprestaties altijd beluchting meenemen als factor
• Begrippen als "filterscore" kunnen toelichten op basis van bio-oppervlak, doorstroming, zuurstofvoorziening, stabiliteit
• Toon: deskundig, rustig en adviserend
• Stijl: technisch onderbouwd, begrijpelijk voor hobbyisten én professionals

🔑 **6. Kernboodschap**

• Mechanische filtering verwijdert vuil
• Biologische filtering breekt afvalstoffen af
• Beluchting versterkt biologische werking
• Waterkwaliteit bepaalt koi gezondheid
• Fosfaat is een essentiële indicator voor balans in het systeem

*"Een goed koifilter is geen apparaat, maar een ecosysteem. Hoe beter de zuurstof, hoe stabieler het leven erin."*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 **Dit is mijn complete kennis base. Wat wil je specifiek weten?**`
  }

  // Save chat history to database
  static async saveChatMessage(
    userId: string, 
    message: ChatMessage
  ): Promise<void> {
    try {
      await supabase
        .from('ai_chat_history')
        .insert({
          user_id: userId,
          message_type: message.type,
          content: message.content,
          context: message.context,
          created_at: message.timestamp.toISOString()
        })
    } catch (error) {
      console.error('Error saving chat message:', error)
    }
  }

  // Get chat history from database
  static async getChatHistory(userId: string, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return data?.map(msg => ({
        id: msg.id,
        type: msg.message_type,
        content: msg.content,
        timestamp: new Date(msg.created_at),
        context: msg.context
      })).reverse() || []
    } catch (error) {
      console.error('Error getting chat history:', error)
      return []
    }
  }
}
