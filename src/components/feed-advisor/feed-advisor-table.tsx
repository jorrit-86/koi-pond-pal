import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Fish, AlertCircle } from 'lucide-react'
import { KoiFish } from '@/hooks/use-feed-logic'

interface FeedAdvisorTableProps {
  koiList: KoiFish[]
  calculations?: any[]
  totalFeed: number
  noFeeding?: boolean
  noFeedingMessage?: string
  baseBiomass?: number
}

export function FeedAdvisorTable({ koiList, calculations, totalFeed, noFeeding, noFeedingMessage, baseBiomass }: FeedAdvisorTableProps) {
  
  // Calculate individual weights and daily feeds
  const koiData = koiList.map(koi => {
    // Weight = 0.014 × L³ (in grams)
    const weight = 0.014 * Math.pow(koi.length, 3)
    
    // Calculate daily feed proportionally based on weight
    const totalWeight = koiList.reduce((sum, k) => sum + (0.014 * Math.pow(k.length, 3)), 0)
    const dailyFeed = totalWeight > 0 ? (weight / totalWeight) * totalFeed : 0
    
    return {
      ...koi,
      weight: Math.round(weight),
      dailyFeed: Math.round(dailyFeed * 100) / 100
    }
  })

  // Calculate totals
  const totalWeight = koiData.reduce((sum, koi) => sum + koi.weight, 0)
  const totalDailyFeed = koiData.reduce((sum, koi) => sum + koi.dailyFeed, 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fish className="h-5 w-5" />
              Mijn Koi Collectie
            </CardTitle>
            <CardDescription>
              Koi gegevens uit je collectie voor voeradvies berekening
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {koiList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Fish className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Er zijn nog geen koi in je collectie</p>
            <p className="text-sm">Voeg ze toe via de pagina 'Mijn Koi Collectie' om een voeradvies te ontvangen</p>
          </div>
        ) : (
          <>
            {/* No feeding warning */}
            {noFeeding && noFeedingMessage && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Geen voeren vandaag</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {noFeedingMessage}
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Lengte (cm)</TableHead>
                    <TableHead>Leeftijd (jaar)</TableHead>
                    <TableHead>Gewicht (g)</TableHead>
                    <TableHead>Dagvoer (g)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {koiData.map((koi, index) => (
                    <TableRow key={koi.id} className={noFeeding ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{koi.name}</div>
                          {koi.variety && (
                            <Badge variant="secondary" className="text-xs">
                              {koi.variety}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{koi.length}</span>
                          <span className="text-sm text-muted-foreground">cm</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{koi.age}</span>
                          <span className="text-sm text-muted-foreground">jr</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{koi.weight}</span>
                          <span className="text-sm text-muted-foreground">g</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${noFeeding ? 'text-muted-foreground' : 'text-primary'}`}>
                            {noFeeding ? '0.0' : koi.dailyFeed.toFixed(1)}
                          </span>
                          <span className="text-sm text-muted-foreground">g</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals row */}
                  <TableRow className="border-t-2 font-semibold bg-muted/50">
                    <TableCell>
                      <span className="font-bold">Totaal</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">-</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">{totalWeight}</span>
                        <span className="text-sm text-muted-foreground">g</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${noFeeding ? 'text-muted-foreground' : 'text-primary'}`}>
                          {noFeeding ? '0.0' : totalDailyFeed.toFixed(1)}
                        </span>
                        <span className="text-sm text-muted-foreground">g</span>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
