import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { Droplets, Save, History } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WaterReading {
  ph: string
  kh: string
  gh: string
  nitrite: string
  nitrate: string
  phosphate: string
  temperature: string
  notes: string
}

interface ParameterFormProps {
  onNavigate: (tab: string) => void
}

export function ParameterForm({ onNavigate }: ParameterFormProps) {
  const { toast } = useToast()
  const [reading, setReading] = useState<WaterReading>({
    ph: "",
    kh: "",
    gh: "",
    nitrite: "",
    nitrate: "",
    phosphate: "",
    temperature: "",
    notes: ""
  })

  const handleInputChange = (field: keyof WaterReading, value: string) => {
    setReading(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    // Validate required fields
    if (!reading.ph || !reading.temperature) {
      toast({
        title: "Missing Information",
        description: "Please fill in at least pH and temperature values.",
        variant: "destructive",
      })
      return
    }

    // Here you would save to database
    toast({
      title: "Reading Saved",
      description: "Water parameters have been recorded successfully.",
    })
    
    // Reset form
    setReading({
      ph: "",
      kh: "",
      gh: "",
      nitrite: "",
      nitrate: "",
      phosphate: "",
      temperature: "",
      notes: ""
    })
  }

  const parameters = [
    {
      key: "ph" as keyof WaterReading,
      label: "pH Level",
      placeholder: "7.0",
      unit: "",
      range: "6.8 - 8.2"
    },
    {
      key: "kh" as keyof WaterReading,
      label: "KH (Carbonate Hardness)",
      placeholder: "4.0",
      unit: "°dH",
      range: "3 - 8 °dH"
    },
    {
      key: "gh" as keyof WaterReading,
      label: "GH (General Hardness)",
      placeholder: "8.0",
      unit: "°dH",
      range: "4 - 12 °dH"
    },
    {
      key: "nitrite" as keyof WaterReading,
      label: "Nitrite",
      placeholder: "0.1",
      unit: "mg/l",
      range: "0 - 0.3 mg/l"
    },
    {
      key: "nitrate" as keyof WaterReading,
      label: "Nitrate",
      placeholder: "15",
      unit: "mg/l",
      range: "< 25 mg/l"
    },
    {
      key: "phosphate" as keyof WaterReading,
      label: "Phosphate",
      placeholder: "0.3",
      unit: "mg/l",
      range: "< 0.5 mg/l"
    },
    {
      key: "temperature" as keyof WaterReading,
      label: "Water Temperature",
      placeholder: "18.5",
      unit: "°C",
      range: "15 - 25 °C"
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Water Parameters</h1>
          <p className="text-muted-foreground">Log your pond's water quality measurements</p>
        </div>
        <Button variant="outline" onClick={() => onNavigate("analytics")}>
          <History className="h-4 w-4 mr-2" />
          View History
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            New Water Reading
          </CardTitle>
          <CardDescription>
            Enter the current measurements from your water test kit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {parameters.map((param) => (
              <div key={param.key} className="space-y-2">
                <Label htmlFor={param.key} className="text-sm font-medium">
                  {param.label}
                  {param.unit && <span className="text-muted-foreground ml-1">({param.unit})</span>}
                </Label>
                <Input
                  id={param.key}
                  type="number"
                  step="0.1"
                  placeholder={param.placeholder}
                  value={reading[param.key]}
                  onChange={(e) => handleInputChange(param.key, e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Ideal range: {param.range}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any observations about water quality, pond condition, or koi behavior..."
              value={reading.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save Reading
            </Button>
            <Button variant="outline" onClick={() => onNavigate("dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-gradient-water">
        <CardHeader>
          <CardTitle className="text-lg">Testing Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>• Test water parameters weekly, or more frequently if issues arise</li>
            <li>• Always test at the same time of day for consistency</li>
            <li>• Clean test equipment between uses to avoid contamination</li>
            <li>• Keep test kits away from direct sunlight and extreme temperatures</li>
            <li>• Replace test kits annually or when reagents expire</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}