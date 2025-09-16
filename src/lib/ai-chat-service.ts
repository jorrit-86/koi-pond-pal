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
      const { data: preferences } = await supabase
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
        .single()

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
          filtration_type: preferences?.filtration_type,
          filter_media: preferences?.filter_media || [],
          filter_segments: preferences?.filter_segments || [],
          uv_sterilizer: preferences?.uv_sterilizer || false,
          protein_skimmer: preferences?.protein_skimmer || false,
          waterfall: preferences?.waterfall || false,
          fountain: preferences?.fountain || false,
          aeration_system: preferences?.aeration_system || false,
          heater: preferences?.heater || false,
          chiller: preferences?.chiller || false,
          auto_feeder: preferences?.auto_feeder || false,
          water_source: preferences?.water_source,
          water_changes_manual: preferences?.water_changes_manual || true,
          plants_present: preferences?.plants_present || false,
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

    // Feeding questions
    if (lowerMessage.includes('voeding') || lowerMessage.includes('eten') || lowerMessage.includes('voer')) {
      return this.generateFeedingResponse(context)
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

Met deze informatie kan ik je veel specifiekere adviezen geven over voeding, filtratie en onderhoud!`
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
      return `Ik zie dat je nog geen waterparameters hebt ingevoerd. Om je beter te kunnen helpen, voeg eerst wat metingen toe via de 'Waterparameters' pagina. 

Ideale waarden voor koi:
• pH: 7.0-8.5
• Ammoniak: 0 mg/l
• Nitriet: 0 mg/l  
• Nitraat: <50 mg/l
• KH: 4-8 dH
• GH: 6-12 dH

Wat wil je specifiek weten over waterkwaliteit?`
    }

    // Analyze each parameter and provide specific advice
    let analysis = `**Analyse van je waterkwaliteit:**\n\n`
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
            advice = 'Te laag! Voeg KH+ toe of gebruik pH+ product.'
          } else if (value > 8.5) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te hoog! Controleer KH waarde en overweeg pH- product.'
          } else {
            advice = 'Perfecte waarde!'
          }
          break
        case 'nitriet':
          if (value > 0) {
            statusIcon = '🚨'
            hasIssues = true
            advice = 'Gevaarlijk! Voer 50% waterverversing uit en controleer filter.'
            recommendations.push('Directe waterverversing nodig')
          } else {
            advice = 'Uitstekend! Geen nitriet gedetecteerd.'
          }
          break
        case 'nitraat':
          if (value > 50) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te hoog! Meer waterverversing of planten toevoegen.'
            recommendations.push('Verhoog waterverversing naar 20% per week')
          } else {
            advice = 'Goede waarde!'
          }
          break
        case 'ammoniak':
          if (value > 0) {
            statusIcon = '🚨'
            hasIssues = true
            advice = 'Gevaarlijk! Directe waterverversing en filter controle.'
            recommendations.push('Urgente waterverversing')
          } else {
            advice = 'Perfect! Geen ammoniak.'
          }
          break
        case 'kh':
          if (value < 4) {
            statusIcon = '⚠️'
            hasIssues = true
            advice = 'Te laag! Voeg KH+ toe voor pH stabiliteit.'
            recommendations.push('KH+ toevoegen voor buffer capaciteit')
          } else if (value > 8) {
            statusIcon = '⚠️'
            advice = 'Te hoog, maar niet gevaarlijk.'
          } else {
            advice = 'Ideale buffer capaciteit!'
          }
          break
        case 'gh':
          if (value < 6) {
            statusIcon = '⚠️'
            advice = 'Te laag! Voeg GH+ toe voor mineralen.'
          } else if (value > 12) {
            statusIcon = '⚠️'
            advice = 'Te hoog, maar acceptabel.'
          } else {
            advice = 'Goede mineralen balans!'
          }
          break
        default:
          advice = status === 'normal' ? 'Normale waarde' : 'Controleer waarde'
      }

      analysis += `${statusIcon} **${name.toUpperCase()}**: ${value} ${unit} - ${advice}\n`
    })

    if (hasIssues) {
      analysis += `\n**🚨 Actie vereist:**\n`
      recommendations.forEach(rec => {
        analysis += `• ${rec}\n`
      })
    } else {
      analysis += `\n**✅ Uitstekend! Je waterkwaliteit is goed.**`
    }

    if (pondSize > 0) {
      analysis += `\n\n**Specifiek voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**`
      if (pondSize < 1000) {
        analysis += `\n• Kleine vijver: Controleer waterkwaliteit 2x per week`
      } else if (pondSize < 5000) {
        analysis += `\n• Medium vijver: Wekelijkse controles voldoende`
      } else {
        analysis += `\n• Grote vijver: Maandelijkse controles voldoende`
      }
    }

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

**Voeding voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**
• Zomer: ${koiCount * 2}-${koiCount * 3} gram per dag
• Lente/herfst: ${koiCount * 1}-${koiCount * 2} gram per dag
• Winter: Geen voeding onder 10°C`
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

  private static generateFeedingResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const koiCount = context.koiCount || 0
    const pondSize = context.pondSize || 0
    const experience = context.userExperience || 'beginner'
    
    const seasonalAdvice = {
      spring: 'In de lente beginnen koi weer actief te worden. Start met lichte voeding en bouw langzaam op.',
      summer: 'In de zomer zijn koi het meest actief. Voer 2-3x per dag met hoogwaardig voer.',
      autumn: 'In de herfst bereid je koi voor op de winter. Verminder voeding en gebruik wintervoer.',
      winter: 'In de winter eten koi weinig tot niets. Voer alleen bij temperaturen boven 10°C.'
    }

    let response = `**Voeding advies voor de ${season}:**\n${seasonalAdvice[season as keyof typeof seasonalAdvice]}`

    if (koiCount > 0) {
      const dailyAmount = season === 'summer' ? koiCount * 3 : 
                         season === 'spring' || season === 'autumn' ? koiCount * 2 : 0
      
      response += `\n\n**Specifiek voor je ${koiCount} koi:**
• ${season === 'winter' ? 'Geen voeding onder 10°C' : `Dagelijkse hoeveelheid: ${dailyAmount} gram`}
• Voer ${season === 'summer' ? '2-3x per dag' : season === 'winter' ? 'niet' : '1-2x per dag'}
• Voer alleen wat ze in 5 minuten opeten`
    }

    if (pondSize > 0) {
      response += `\n\n**Voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**
• ${pondSize < 1000 ? 'Kleine vijver: Extra aandacht voor waterkwaliteit na voeding' :
    pondSize < 5000 ? 'Medium vijver: Normale voeding routine' :
    'Grote vijver: Zeer stabiel, minder risico op problemen'}`
    }

    response += `\n\n**Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} koi-houder:**
• Gebruik seizoensgebonden voer
• Varieer met verschillende soorten voer
• Observeer eetgedrag dagelijks
• Pas voeding aan op basis van activiteit

Wat wil je specifiek weten over voeding?`

    return response
  }

  private static generateFilterResponse(context: ChatContext): string {
    const pondSize = context.pondSize || 0
    const koiCount = context.koiCount || 0
    const experience = context.userExperience || 'beginner'
    const season = context.season || 'spring'
    
    if (pondSize === 0) {
      return `Ik zie dat je nog geen vijvergrootte hebt ingevoerd. Om je specifieke filteradviezen te kunnen geven, voeg je vijvergegevens toe via de 'Instellingen' pagina.

Voor goede filtratie is het belangrijk om te weten:
• Vijverinhoud in liters
• Aantal koi
• Huidige filtercapaciteit
• Doorstroming per uur

Met deze informatie kan ik je veel specifiekere filteradviezen geven!`
    }

    // Calculate recommended filter capacity
    const recommendedFlow = Math.ceil(pondSize / 1000) // 1x pond volume per hour minimum
    const optimalFlow = Math.ceil(pondSize / 500) // 2x pond volume per hour optimal
    const filterSize = pondSize < 1000 ? 'klein' : pondSize < 5000 ? 'medium' : 'groot'

    let response = `**Filter analyse voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**

**Aanbevolen filtercapaciteit:**
• Minimale doorstroming: **${recommendedFlow} liter per uur** (1x vijverinhoud)
• Optimale doorstroming: **${optimalFlow} liter per uur** (2x vijverinhoud)
• Filtergrootte: **${filterSize}** filtersysteem

**Specifieke aanbevelingen voor je ${pondSize.toLocaleString('nl-NL')} liter vijver:**`

    if (pondSize < 1000) {
      response += `
• **Kleine vijver**: Extra aandacht voor filtratie
• Gebruik compacte, efficiënte filters
• Overweeg skimmer + biologische filter
• Regelmatig onderhoud (1x per week)`
    } else if (pondSize < 5000) {
      response += `
• **Medium vijver**: Goede balans tussen capaciteit en onderhoud
• Combinatie van mechanische en biologische filtratie
• UV-filter aanbevolen voor helder water
• Onderhoud 1x per 2 weken`
    } else {
      response += `
• **Grote vijver**: Zeer stabiel, minder kritiek
• Grote biologische filter met veel oppervlakte
• Meerdere filterkamers voor optimale werking
• Onderhoud 1x per maand voldoende`
    }

    if (koiCount > 0) {
      const bioload = koiCount > 5 ? 'hoog' : koiCount > 2 ? 'medium' : 'laag'
      response += `

**Biologische belasting (${koiCount} koi):**
• Belasting: **${bioload}**
• ${bioload === 'hoog' ? 'Extra biologische filtratie nodig' : 
    bioload === 'medium' ? 'Normale biologische filtratie voldoende' : 
    'Minimale biologische filtratie nodig'}`
    }

    // Seasonal filter advice
    const seasonalAdvice = {
      spring: 'Lente: Filter opstarten, bacteriën activeren, eerste reiniging',
      summer: 'Zomer: Maximale filtercapaciteit, regelmatig controleren, UV-filter actief',
      autumn: 'Herfst: Bladeren verwijderen, filter beschermen, voorbereiden op winter',
      winter: 'Winter: Filter beschermen tegen vorst, minimale doorstroming, bacteriën inactief'
    }

    response += `

**Seizoensadvies (${season}):**
${seasonalAdvice[season as keyof typeof seasonalAdvice]}

**Als ${experience === 'beginner' ? 'beginner' : 'ervaren'} vijverhouder:**
• ${experience === 'beginner' ? 'Start met eenvoudig filtersysteem' : 'Overweeg geavanceerde filteropstelling'}
• Regelmatige controle van doorstroming
• Onderhoudsschema aanpassen aan seizoen
• Probleemherkenning en oplossing

Wat wil je specifiek weten over je filtersysteem?`

    return response
  }

  private static generateTemperatureResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const pondSize = context.pondSize || 0
    const koiCount = context.koiCount || 0
    const experience = context.userExperience || 'beginner'
    
    let response = `**Temperatuur beheer voor de ${season}:**

**Temperatuur zones:**
• **Onder 10°C**: Koi eten weinig tot niets, minimale activiteit
• **10-15°C**: Lichte voeding, weinig activiteit, voorzichtig voeren
• **15-20°C**: Normale voeding, matige activiteit, regelmatig voeren
• **20-25°C**: Optimale temperatuur, actieve koi, maximale groei
• **Boven 25°C**: Extra zuurstof en schaduw nodig, stress gevaar`

    // Seasonal specific advice
    const seasonalTempAdvice = {
      spring: `
**Lente temperatuur management:**
• Temperatuur stijgt langzaam (10-18°C)
• Start met voeding bij 12°C
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
• Verminder voeding bij dalende temperatuur
• Voorbereiden op winter
• Filter beschermen tegen kou`,
      winter: `
**Winter temperatuur management:**
• Lage temperatuur (onder 10°C)
• Geen voeding onder 10°C
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
• Pas voeding aan op temperatuur
• Voorzie schaduw en zuurstof bij warm weer

Wat wil je specifiek weten over temperatuurbeheer?`

    return response
  }

  private static generateSeasonalResponse(context: ChatContext): string {
    const season = context.season || 'spring'
    const experience = context.userExperience || 'beginner'
    
    const seasonalTasks = {
      spring: 'Lente: Vijver opstarten, filter controleren, eerste voeding, waterkwaliteit testen',
      summer: 'Zomer: Regelmatig voeren, waterkwaliteit monitoren, schaduw voorzien, zuurstof controleren',
      autumn: 'Herfst: Bladeren verwijderen, wintervoer, vijver voorbereiden op winter',
      winter: 'Winter: Minimale voeding, ijsvrij houden, filter onderhoud, koi observeren'
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
