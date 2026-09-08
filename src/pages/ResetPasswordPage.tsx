import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react'

type PageState = 'loading' | 'form' | 'success' | 'invalid'

export default function ResetPasswordPage() {
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // If there's no code or token in the URL this isn't a real reset link.
    const hasCode = window.location.search.includes('code=')
    const hasToken = window.location.hash.includes('access_token')
    if (!hasCode && !hasToken) {
      setPageState('invalid')
      return
    }

    // detectSessionInUrl:true (set in supabase.ts) handles the PKCE code
    // exchange automatically. We just listen for the resulting event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('form')
      }
    })

    // Also cover the case where the exchange already completed before this
    // component mounted (e.g. hot reload, slow navigation).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPageState('form')
    })

    const timeout = setTimeout(() => {
      setPageState(prev => prev === 'loading' ? 'invalid' : prev)
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens lang zijn.')
      return
    }
    if (password !== confirmPassword) {
      setError('Wachtwoorden komen niet overeen.')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setIsSubmitting(false)

    if (error) {
      setError(error.message)
    } else {
      setPageState('success')
      setTimeout(() => { window.location.href = '/' }, 3000)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {pageState === 'loading' && (
          <>
            <CardHeader>
              <CardTitle>Wachtwoord opnieuw instellen</CardTitle>
              <CardDescription>Bezig met laden…</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </>
        )}

        {pageState === 'invalid' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                Ongeldige link
              </CardTitle>
              <CardDescription>
                Deze wachtwoord reset link is verlopen of al gebruikt.
                Vraag een nieuwe reset link aan via de loginpagina.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => { window.location.href = '/' }}>
                Terug naar inloggen
              </Button>
            </CardContent>
          </>
        )}

        {pageState === 'form' && (
          <>
            <CardHeader>
              <CardTitle>Nieuw wachtwoord instellen</CardTitle>
              <CardDescription>
                Kies een sterk wachtwoord van minimaal 6 tekens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nieuw wachtwoord</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoFocus
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(p => !p)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Wachtwoord opslaan
                </Button>
              </form>
            </CardContent>
          </>
        )}

        {pageState === 'success' && (
          <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle className="h-5 w-5" />
                Wachtwoord gewijzigd
              </CardTitle>
              <CardDescription>
                Je wachtwoord is succesvol bijgewerkt. Je wordt automatisch doorgestuurd…
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => { window.location.href = '/' }}>
                Nu inloggen
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
