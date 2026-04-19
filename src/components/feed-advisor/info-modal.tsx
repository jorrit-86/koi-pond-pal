import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Info, CheckCircle } from 'lucide-react'

interface InfoModalProps {
  children?: React.ReactNode
}

export function InfoModal({ children }: InfoModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Info className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Hoe werkt dit advies?
          </DialogTitle>
          <DialogDescription>
            Uitleg van de voeradvies berekening
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cohort-gewogen Berekening</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Deze berekening gebruikt een <strong>cohort-gewogen vijvergemíddelde</strong> per lengte-band, 
                zodat het advies realistischer is voor gemengde populaties en sprongen worden voorkomen.
              </p>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-lg">Waarom wij geen vaste 0,5%-regel gebruiken</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                De bekende "0,5%-regel" (waarbij je dagelijks 0,5% van het totale visgewicht voert) is eenvoudig, maar ook erg algemeen.
                In de praktijk houdt die vuistregel geen rekening met de verschillen tussen jonge en oudere koi, noch met temperatuur, filterwerking of seizoen.
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Onze berekening doet dat wél.</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                We gebruiken een cohort-gewogen model dat rekening houdt met:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>📏 <strong>Lengte en leeftijd van de vissen</strong> – jonge koi groeien sneller en verbranden meer energie.</li>
                <li>🌡️ <strong>Watertemperatuur</strong> – de verbranding en spijsvertering vertragen bij kouder water.</li>
                <li>🧫 <strong>Filterstatus en seizoen</strong> – in het voorjaar draait het filter nog niet op volle kracht, in het najaar juist wel.</li>
                <li>💧 <strong>Waterkwaliteit</strong> – verhoogde ammoniak- of nitrietwaarden verminderen de aanbevolen voergift.</li>
                <li>🍽️ <strong>Voerkwaliteit</strong> – een hoogwaardig voer levert meer voedingswaarde per gram.</li>
              </ul>
              <p className="text-sm text-muted-foreground">
                Door deze factoren te combineren, berekent het model een persoonlijk vijvergemíddelde in plaats van één vast percentage.
                Zo wordt het advies specifieker en beter afgestemd op de werkelijke behoefte van jouw vissen.
              </p>
              <p className="text-sm text-muted-foreground">
                💡 <strong>In de praktijk betekent dat vaak een iets hogere waarde dan de standaard 0,5%,</strong>
                vooral als je meerdere jonge of actieve koi hebt.
                Het resultaat: stabielere groei, gezondere vissen en een beter functionerend filter.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lengte-banden & BW%</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">Lengte-banden (warm-water referentie)</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• ≤ 30 cm: 3.5% BW (tosai)</li>
                  <li>• 31-55 cm: 1.5% BW (nisai)</li>
                  <li>• 56-70 cm: 1.0% BW (sansai)</li>
                  <li>• ≥ 71 cm: 0.3% BW (ouder/groot)</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium text-sm">Temperatuurschaal</h4>
                <p className="text-sm text-muted-foreground">
                  &lt; 6°C: 0.0 (niet voeren)<br/>
                  6-10°C: 0.30<br/>
                  10-15°C: 0.50<br/>
                  15-20°C: 0.75<br/>
                  20-26°C: 1.00<br/>
                  &gt; 26°C: 0.75
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm">Filter & Seizoen</h4>
                <p className="text-sm text-muted-foreground">
                  Opstartend (voorjaar): × 0.6<br/>
                  Actief (zomer/najaar): × 1.0<br/>
                  Rust (winter): × 0.8
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Waterkwaliteit & Voermerk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium text-sm">Waterkwaliteit correcties</h4>
                <p className="text-sm text-muted-foreground">
                  NH3 &gt; 0.10 mg/L: × 0.75 (–25%)<br/>
                  NO2 &gt; 0.50 mg/L: × 0.85 (–15%)
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm">Voermerk rendement</h4>
                <p className="text-sm text-muted-foreground">
                  Premium/High-protein: × 1.10<br/>
                  Standard/All-season: × 1.00<br/>
                  Economy: × 0.85<br/>
                  Onbekend: × 1.00
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Voerbeurten</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                De totale hoeveelheid wordt verdeeld over meerdere kleine voerbeurten om afvalpieken te voorkomen:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Onder 15°C: 2 voerbeurten per dag</li>
                <li>• 15-20°C: 3 voerbeurten per dag</li>
                <li>• Boven 20°C: 4 voerbeurten per dag</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">🔹 Wanneer voeren?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                In koudere seizoenen (voorjaar en najaar) is het water pas laat op de dag warm genoeg.
                Daarom worden de eerste voerbeurten automatisch pas later ingepland.
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Onder 15°C: Voer pas vanaf 11:00 uur</li>
                <li>• 15-20°C: Voer vanaf 10:00 uur</li>
                <li>• Boven 20°C: Voer vanaf 08:00 uur</li>
                <li>• In de zomer (boven 20°C) wordt er verspreid over de hele dag gevoerd</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-2">
                Onder 15°C voeren we pas vanaf ongeveer 11:00 uur, zodat de vissen het voer goed kunnen verteren en het filter actief is.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• In het voorjaar rustig opbouwen — in het najaar geleidelijk afbouwen</li>
                <li>• Je kunt handmatig invoeren of sensoren gebruiken</li>
                <li>• Houd rekening met de filterconditie bij het voeren</li>
                <li>• Bij twijfel, voer liever iets minder dan te veel</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="text-2xl">❄️</span>
                Let op: Koud water
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Onder de 6 °C eten koi niet meer actief en vertraagt hun spijsvertering sterk.
                Voer dan helemaal niet; het filter blijft wél draaien om afvalresten af te breken.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsOpen(false)} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Begrepen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
