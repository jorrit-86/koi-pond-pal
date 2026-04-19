import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Droplets } from 'lucide-react'
import { FeedSchedule } from '@/hooks/use-feed-logic'

interface FeedPlannerProps {
  feedSchedule: FeedSchedule[]
  totalFeed: number
  temperature: number
  seasonInfo: {
    season: string
    label: string
    emoji: string
  }
  noFeeding?: boolean
  noFeedingMessage?: string
}

export function FeedPlanner({ feedSchedule, totalFeed, temperature, seasonInfo, noFeeding, noFeedingMessage }: FeedPlannerProps) {
  // Show no feeding message if temperature is too low
  if (noFeeding && noFeedingMessage) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <span className="text-2xl">❄️</span>
            Geen voeren vandaag
          </CardTitle>
          <CardDescription className="text-red-600 dark:text-red-400">
            {noFeedingMessage}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              Het filter blijft wel draaien om afvalresten af te breken, maar de koi hoeven niet gevoerd te worden.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (feedSchedule.length === 0) {
    return null
  }

  const getTemperatureColor = (temp: number) => {
    if (temp < 15) return 'text-blue-600'
    if (temp < 20) return 'text-green-600'
    return 'text-orange-600'
  }

  const getTemperatureLabel = (temp: number) => {
    if (temp < 15) return 'Koud'
    if (temp < 20) return 'Matig'
    return 'Warm'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Voerplanner
        </CardTitle>
        <CardDescription>
          Optimale voertijden voor vandaag
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Time window info */}
          {feedSchedule.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Voerbeurten zijn aangepast aan temperatuur en seizoen</strong>
                {temperature < 15 && (seasonInfo.season === 'spring' || seasonInfo.season === 'autumn') && (
                  <span className="block mt-1">
                    ⚠️ Temperatuur is laag ({temperature.toFixed(1)}°C). Voer pas later op de dag wanneer het water is opgewarmd.
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Feeding schedule */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">
              {feedSchedule.length} voerbeurten per dag
            </h4>
            
            <div className="grid gap-3">
              {feedSchedule.map((feed, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{feed.time}</div>
                      <div className="text-sm text-muted-foreground">
                        {getTemperatureLabel(temperature)} water
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-primary">
                      {feed.amount.toFixed(1)}g
                    </div>
                    <div className="text-xs text-muted-foreground">
                      per beurt
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Dagadvies</h4>
                <p className="text-sm text-muted-foreground">
                  Optimale voertijden voor vandaag
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {totalFeed.toFixed(1)}g
                </div>
                <div className="text-sm text-muted-foreground">
                  totaal per dag
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}