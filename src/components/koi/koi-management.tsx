import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Fish, Plus, Calendar, Ruler, Heart } from "lucide-react"

interface Koi {
  id: string
  name: string
  variety: string
  age: number
  length: number
  weight?: number
  color: string
  healthStatus: "excellent" | "good" | "needs-attention"
  dateAdded: string
  notes?: string
}

interface KoiManagementProps {
  onNavigate: (tab: string) => void
}

export function KoiManagement({ onNavigate }: KoiManagementProps) {
  // Mock data - will be replaced with real data later
  const koiList: Koi[] = [
    {
      id: "1",
      name: "Sakura",
      variety: "Kohaku",
      age: 3,
      length: 45,
      weight: 1.2,
      color: "White with red markings",
      healthStatus: "excellent",
      dateAdded: "2021-05-15",
      notes: "Beautiful red pattern development"
    },
    {
      id: "2",
      name: "Yuki",
      variety: "Showa Sanshoku",
      age: 5,
      length: 52,
      weight: 1.8,
      color: "Black, red, and white",
      healthStatus: "good",
      dateAdded: "2020-03-10",
    },
    {
      id: "3",
      name: "Hoshi",
      variety: "Asagi",
      age: 2,
      length: 35,
      color: "Blue-grey with red belly",
      healthStatus: "excellent",
      dateAdded: "2022-08-20",
    },
    {
      id: "4",
      name: "Kenzo",
      variety: "Sanke",
      age: 4,
      length: 48,
      weight: 1.5,
      color: "White with red and black",
      healthStatus: "needs-attention",
      dateAdded: "2021-01-12",
      notes: "Monitor for fin rot - treatment ongoing"
    }
  ]

  const getHealthColor = (status: string) => {
    switch (status) {
      case "excellent": return "bg-success text-success-foreground"
      case "good": return "bg-primary text-primary-foreground"
      case "needs-attention": return "bg-warning text-warning-foreground"
      default: return "bg-muted text-muted-foreground"
    }
  }

  const getHealthLabel = (status: string) => {
    switch (status) {
      case "excellent": return "Excellent"
      case "good": return "Good"
      case "needs-attention": return "Needs Attention"
      default: return "Unknown"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Koi Collection</h1>
          <p className="text-muted-foreground">Manage information about your koi fish</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add New Koi
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Koi</p>
                <p className="text-2xl font-bold">{koiList.length}</p>
              </div>
              <Fish className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Average Age</p>
                <p className="text-2xl font-bold">
                  {Math.round(koiList.reduce((acc, koi) => acc + koi.age, 0) / koiList.length * 10) / 10} years
                </p>
              </div>
              <Calendar className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-water">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Largest Koi</p>
                <p className="text-2xl font-bold">
                  {Math.max(...koiList.map(k => k.length))}cm
                </p>
              </div>
              <Ruler className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Koi Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {koiList.map((koi) => (
          <Card key={koi.id} className="hover:shadow-water transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{koi.name}</CardTitle>
                <Badge className={getHealthColor(koi.healthStatus)}>
                  {getHealthLabel(koi.healthStatus)}
                </Badge>
              </div>
              <CardDescription>{koi.variety}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Age:</span>
                  <span>{koi.age} years</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Length:</span>
                  <span>{koi.length} cm</span>
                </div>
                {koi.weight && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Weight:</span>
                    <span>{koi.weight} kg</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Color:</span>
                  <span className="text-right">{koi.color}</span>
                </div>
              </div>

              {koi.notes && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{koi.notes}</p>
                </div>
              )}

              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Edit Details
                </Button>
                <Button variant="outline" size="sm">
                  <Heart className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Care Tips */}
      <Card className="bg-gradient-water">
        <CardHeader>
          <CardTitle className="text-lg">Koi Care Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Feeding Schedule</h4>
              <ul className="space-y-1 text-sm">
                <li>• Spring/Fall: 1-2 times daily when water is 10-18°C</li>
                <li>• Summer: 2-3 times daily when water is 18-25°C</li>
                <li>• Winter: Stop feeding when water drops below 10°C</li>
                <li>• Feed only what they can consume in 5 minutes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Health Monitoring</h4>
              <ul className="space-y-1 text-sm">
                <li>• Watch for changes in swimming behavior</li>
                <li>• Check for white spots, red streaks, or fin damage</li>
                <li>• Monitor appetite and feeding response</li>
                <li>• Quarantine new fish for 2-4 weeks</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}