import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TwoFactorService } from '@/lib/2fa'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, Smartphone, Key } from 'lucide-react'

interface TwoFactorVerificationProps {
  userEmail: string
  onVerificationSuccess: () => void
  onVerificationFailed: () => void
  onCancel: () => void
}

export function TwoFactorVerification({ 
  userEmail, 
  onVerificationSuccess, 
  onVerificationFailed,
  onCancel 
}: TwoFactorVerificationProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  
  const [token, setToken] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const handleTokenVerification = async () => {
    if (!token || token.length !== 6) {
      toast({
        title: t("settings.error"),
        description: "Please enter a valid 6-digit code",
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)
    try {
      // Get user's 2FA secret from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('two_factor_secret')
        .eq('email', userEmail)
        .single()

      if (userError || !userData?.two_factor_secret) {
        console.error('Error fetching user 2FA secret:', userError)
        onVerificationFailed()
        return
      }

      // Verify the token against the stored secret
      const isValid = TwoFactorService.verifyToken(userData.two_factor_secret, token)
      
      if (isValid) {
        onVerificationSuccess()
      } else {
        onVerificationFailed()
      }
    } catch (error) {
      console.error('Error verifying 2FA token:', error)
      onVerificationFailed()
    } finally {
      setIsVerifying(false)
    }
  }

  const handleBackupCodeVerification = async () => {
    if (!backupCode || backupCode.length !== 8) {
      toast({
        title: t("settings.error"),
        description: "Please enter a valid 8-character backup code",
        variant: "destructive",
      })
      return
    }

    setIsVerifying(true)
    try {
      // Get user's backup codes from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('two_factor_backup_codes')
        .eq('email', userEmail)
        .single()

      if (userError || !userData?.two_factor_backup_codes) {
        console.error('Error fetching user backup codes:', userError)
        onVerificationFailed()
        return
      }

      // Verify the backup code
      const isValid = TwoFactorService.verifyBackupCode(userData.two_factor_backup_codes, backupCode)
      
      if (isValid) {
        // Remove used backup code from database
        const updatedCodes = userData.two_factor_backup_codes.filter((code: string) => code !== backupCode)
        await supabase
          .from('users')
          .update({ two_factor_backup_codes: updatedCodes })
          .eq('email', userEmail)
        
        onVerificationSuccess()
      } else {
        onVerificationFailed()
      }
    } catch (error) {
      console.error('Error verifying backup code:', error)
      onVerificationFailed()
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Enter the verification code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!useBackupCode ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="2fa-token">Verification Code</Label>
              <Input
                id="2fa-token"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
            </div>
            
            <Button 
              onClick={handleTokenVerification} 
              disabled={isVerifying || token.length !== 6}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify'}
            </Button>
            
            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => setUseBackupCode(true)}
                className="text-sm"
              >
                Use backup code instead
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                Enter one of your backup codes. Each code can only be used once.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="backup-code">Backup Code</Label>
              <Input
                id="backup-code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="text-center text-lg tracking-widest font-mono"
              />
            </div>
            
            <Button 
              onClick={handleBackupCodeVerification} 
              disabled={isVerifying || backupCode.length !== 8}
              className="w-full"
            >
              {isVerifying ? 'Verifying...' : 'Verify Backup Code'}
            </Button>
            
            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => setUseBackupCode(false)}
                className="text-sm"
              >
                Use authenticator app instead
              </Button>
            </div>
          </>
        )}
        
        <div className="text-center">
          <Button variant="ghost" onClick={onCancel} className="text-sm">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
