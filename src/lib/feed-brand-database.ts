export interface FeedBrand {
  merk: string
  eiwit: number
  vet: number
  rendement: number
  type: string
  description?: string
  ruweCelstof?: number
  ruweAs?: number
  fosfor?: number
  vorm?: string
  bron?: string
}

export const FEED_BRAND_DATABASE: FeedBrand[] = [
  {
    merk: "Saki-Hikari Growth",
    eiwit: 40,
    vet: 6,
    rendement: 1.10,
    type: "High Protein",
    description: "Premium groeivoer met hoog eiwitgehalte"
  },
  {
    merk: "Hikari Staple",
    eiwit: 35,
    vet: 4,
    rendement: 1.05,
    type: "Standard",
    description: "Basisvoer voor dagelijks gebruik"
  },
  {
    merk: "Takazumi Gold Plus",
    eiwit: 38,
    vet: 7,
    rendement: 1.05,
    type: "Premium",
    description: "Premium voer voor kleurversterking"
  },
  {
    merk: "Coppens Basic",
    eiwit: 32,
    vet: 4,
    rendement: 0.85,
    type: "Economy",
    description: "Economisch basisvoer"
  },
  {
    merk: "Tetra Pond Sticks",
    eiwit: 30,
    vet: 3,
    rendement: 0.90,
    type: "Standard",
    description: "Drijvende sticks voor gemakkelijk voeren"
  },
  {
    merk: "JBL Novo Pond",
    eiwit: 33,
    vet: 5,
    rendement: 0.95,
    type: "Standard",
    description: "Gebalanceerd voer voor alle seizoenen"
  },
  {
    merk: "Generiek Voer",
    eiwit: 30,
    vet: 4,
    rendement: 1.00,
    type: "Generic",
    description: "Standaard voer zonder specifiek merk"
  },
  // Hikari voeren
  {
    merk: "Hikari Hi-Growth",
    eiwit: 35,
    vet: 9,
    rendement: 1.15,
    type: "High Protein",
    description: "Hoogwaardig koivoer voor snelle groei",
    ruweCelstof: 2.5,
    ruweAs: 12.5,
    fosfor: 1.2,
    vorm: "Drijvend; 2 kg (verpakking)",
    bron: "Koivoershop.nl"
  },
  {
    merk: "Hikari Staple Large",
    eiwit: 37,
    vet: 5,
    rendement: 1.05,
    type: "Standard",
    description: "Compleet Koi- en Vijvervisvoer voor optimale groei",
    ruweCelstof: 4.2,
    ruweAs: 11.6,
    fosfor: 1.2,
    vorm: "Drijvend; Large",
    bron: "Koivoershop.nl"
  },
  {
    merk: "Hikari Wheat-Germ Medium",
    eiwit: 35,
    vet: 6,
    rendement: 1.00,
    type: "Standard",
    description: "Licht verteerbaar visvoer",
    ruweCelstof: 3.3,
    ruweAs: 10.7,
    fosfor: 0.9,
    vorm: "Drijvend; Medium",
    bron: "Koivoershop.nl"
  },
  {
    merk: "Hikari Gold Medium",
    eiwit: 38,
    vet: 5,
    rendement: 1.10,
    type: "Premium",
    description: "Kleur- en groei verbeterend koivoer",
    ruweCelstof: 4.2,
    ruweAs: 11.6,
    fosfor: 1.2,
    vorm: "Drijvend; Small/Medium/Large",
    bron: "Koivoershop.nl"
  },
  {
    merk: "Hikari Spirulina Mini",
    eiwit: 43,
    vet: 5,
    rendement: 1.20,
    type: "High Protein",
    description: "Hoogwaardig Koi Visvoer voor Kleurversterking",
    ruweCelstof: 4.2,
    ruweAs: 14.3,
    fosfor: 1.2,
    vorm: "Drijvend; Mini",
    bron: "Koivoershop.nl"
  },
  {
    merk: "Hikari Friend Large",
    eiwit: 31,
    vet: 5,
    rendement: 0.95,
    type: "Standard",
    description: "Hoogwaardig Koi Voer voor Gezonde Groei",
    ruweCelstof: 3.3,
    ruweAs: 7.0,
    fosfor: 0.7,
    vorm: "Drijvend; Large",
    bron: "Koivoershop.nl"
  }
]

export function getFeedBrand(merk: string): FeedBrand | null {
  return FEED_BRAND_DATABASE.find(brand => 
    brand.merk.toLowerCase() === merk.toLowerCase()
  ) || null
}

export function getFeedBrandRendement(merk: string): number {
  const brand = getFeedBrand(merk)
  return brand ? brand.rendement : 1.0
}

