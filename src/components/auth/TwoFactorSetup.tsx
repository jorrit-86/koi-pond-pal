import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { TwoFactorService, TwoFactorSetup } from '@/lib/2fa'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Shield, Smartphone, Copy, Check, AlertTriangle, Download
} from 'lucide-react'

interface TwoFactorSetupProps {
  onSetupComplete?: () => void
}

export function TwoFactorSetup({ onSetupComplete }: TwoFactorSetupProps) {
  const { t } = useTranslation()
  const { user, updateProfile } = useAuth()
  const { toast } = useToast()
  
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [verificationToken, setVerificationToken] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [copiedCodes, setCopiedCodes] = useState(false)
  const [isDisabling, setIsDisabling] = useState(false)

  const generateSetup = async () => {
    if (!user) return
    
    setIsGenerating(true)
    try {
      const newSetup = await TwoFactorService.generateSetup(user.email, 'Koi Sensei')
      setSetup(newSetup)
    } catch (error) {
      console.error('Error generating 2FA setup:', error)
      toast({
        title: t("settings.error"),
        description: "Failed to generate 2FA setup",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const verifyAndEnable = async () => {
    if (!user || !setup || !verificationToken) return
    
    setIsVerifying(true)
    try {
      // Verify the token
      const isValid = TwoFactorService.verifyToken(setup.secret, verificationToken)
      
      if (!isValid) {
        toast({
          title: t("settings.error"),
          description: "Invalid verification code. Please enter a 6-digit code from your authenticator app.",
          variant: "destructive",
        })
        return
      }

      // Save to database
      const { error } = await supabase
        .from('users')
        .update({
          two_factor_secret: setup.secret,
          two_factor_backup_codes: setup.backupCodes,
          two_factor_enabled: true,
          two_factor_setup_completed: true
        })
        .eq('id', user.id)

      if (error) {
        console.error('Database error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      // Update local user state
      await updateProfile({
        two_factor_enabled: true,
        two_factor_setup_completed: true
      })

      toast({
        title: "Success",
        description: "2FA has been enabled successfully",
      })

      setShowBackupCodes(true)
      onSetupComplete?.()
    } catch (error) {
      console.error('Error enabling 2FA:', error)
      toast({
        title: t("settings.error"),
        description: `Failed to enable 2FA: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const copyBackupCodes = () => {
    if (!setup) return
    
    const codesText = setup.backupCodes.join('\n')
    navigator.clipboard.writeText(codesText)
    setCopiedCodes(true)
    
    toast({
      title: "Copied",
      description: "Backup codes copied to clipboard",
    })
    
    setTimeout(() => setCopiedCodes(false), 2000)
  }

  const downloadBackupCodes = () => {
    if (!setup) return
    
    const codesText = `Koi Sensei - 2FA Backup Codes\n\n${setup.backupCodes.join('\n')}\n\nKeep these codes safe!`
    const blob = new Blob([codesText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'koi-sensei-2fa-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const disable2FA = async () => {
    if (!user) return
    
    setIsDisabling(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          two_factor_enabled: false,
          two_factor_setup_completed: false,
          two_factor_secret: null,
          two_factor_backup_codes: null
        })
        .eq('id', user.id)

      if (error) throw error

      await updateProfile({
        two_factor_enabled: false,
        two_factor_setup_completed: false
      })

      toast({
        title: "Success",
        description: "2FA has been disabled successfully",
      })

      onSetupComplete?.()
    } catch (error) {
      console.error('Error disabling 2FA:', error)
      toast({
        title: t("settings.error"),
        description: "Failed to disable 2FA",
        variant: "destructive",
      })
    } finally {
      setIsDisabling(false)
    }
  }

  if (showBackupCodes && setup) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            2FA Enabled Successfully
          </CardTitle>
          <CardDescription>
            Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> These backup codes can only be used once. Store them in a safe place.
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
            {setup.backupCodes.map((code, index) => (
              <div key={index} className="font-mono text-sm">
                {code}
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={copyBackupCodes} variant="outline" size="sm">
              {copiedCodes ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedCodes ? 'Copied!' : 'Copy Codes'}
            </Button>
            <Button onClick={downloadBackupCodes} variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
          
          <Button onClick={() => setShowBackupCodes(false)} className="w-full">
            Continue
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Show 2FA enabled status if user has 2FA enabled
  if (user?.two_factor_enabled && user?.two_factor_setup_completed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Two-Factor Authentication Enabled
          </CardTitle>
          <CardDescription>
            Your account is protected with two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Two-factor authentication is active. You'll need to enter a verification code when signing in.
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={disable2FA} 
            disabled={isDisabling} 
            variant="destructive" 
            className="w-full"
          >
            {isDisabling ? 'Disabling...' : 'Disable 2FA'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Enable Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Add an extra layer of security to your account using an authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!setup ? (
          <div className="space-y-4">
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                You'll need an authenticator app like Google Authenticator or Microsoft Authenticator.
              </AlertDescription>
            </Alert>
            
            <Button onClick={generateSetup} disabled={isGenerating} className="w-full">
              {isGenerating ? 'Generating...' : 'Start Setup'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold mb-2">Scan QR Code</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Use your authenticator app to scan this QR code
              </p>
              <div className="flex justify-center">
                <img src={setup.qrCodeUrl} alt="2FA QR Code" className="border rounded-lg" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="verification-token">Enter verification code</Label>
              <Input
                id="verification-token"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
            <Button 
              onClick={verifyAndEnable} 
              disabled={isVerifying || verificationToken.length !== 6}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Enable 2FA'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
