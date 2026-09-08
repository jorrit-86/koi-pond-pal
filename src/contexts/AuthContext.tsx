import React, { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser, Session, AuthError } from '@supabase/supabase-js'
import { supabase, User } from '@/lib/supabase'
import { EmailService } from '@/lib/email-service'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<User>) => Promise<{ error: Error | null }>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function buildBasicProfile(authUser: SupabaseUser): User {
  return {
    id: authUser.id,
    email: authUser.email!,
    full_name:
      authUser.user_metadata?.full_name && authUser.user_metadata.full_name !== 'Test User'
        ? authUser.user_metadata.full_name
        : authUser.email?.split('@')[0] ?? 'User',
    profile_photo_url: authUser.user_metadata?.profile_photo_url ?? '',
    street: authUser.user_metadata?.street ?? '',
    house_number: authUser.user_metadata?.house_number ?? '',
    postal_code: authUser.user_metadata?.postal_code ?? '',
    city: authUser.user_metadata?.city ?? '',
    country: authUser.user_metadata?.country ?? '',
    role: (authUser.email === 'admin@koisensei.nl' ? 'admin' : 'user') as 'admin' | 'user',
    two_factor_enabled: false,
    two_factor_setup_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select(
          'id, email, full_name, role, two_factor_enabled, two_factor_setup_completed, created_at, updated_at, profile_photo_url, street, house_number, postal_code, city, country, last_login_at'
        )
        .eq('id', authUser.id)
        .maybeSingle()

      if (error && error.code !== '42P17') {
        setUser(buildBasicProfile(authUser))
        return
      }

      if (userData) {
        setUser({
          id: userData.id,
          email: userData.email ?? authUser.email!,
          full_name: userData.full_name ?? authUser.email?.split('@')[0] ?? 'User',
          role: userData.role ?? 'user',
          two_factor_enabled: userData.two_factor_enabled ?? false,
          two_factor_setup_completed: userData.two_factor_setup_completed ?? false,
          created_at: userData.created_at,
          updated_at: userData.updated_at,
          profile_photo_url: userData.profile_photo_url ?? '',
          street: userData.street ?? '',
          house_number: userData.house_number ?? '',
          postal_code: userData.postal_code ?? '',
          city: userData.city ?? '',
          country: userData.country ?? '',
          last_login_at: userData.last_login_at ?? undefined,
        })
      } else {
        const basicProfile = buildBasicProfile(authUser)
        setUser(basicProfile)
        await createUserProfile(basicProfile)
      }
    } catch {
      setUser(buildBasicProfile(authUser))
    }
  }

  const createUserProfile = async (userProfile: User) => {
    try {
      await supabase.from('users').insert({
        id: userProfile.id,
        email: userProfile.email,
        full_name: userProfile.full_name,
        role: userProfile.role,
        two_factor_enabled: false,
        two_factor_setup_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch {
      // Non-critical: profile creation failure does not block the user
    }
  }

  useEffect(() => {
    let mounted = true

    // The callback must be synchronous. Awaiting Supabase DB calls directly
    // inside onAuthStateChange deadlocks because the client hasn't committed
    // its internal session state before our await resumes. Instead we:
    //   1. Set loading=false and a basic profile immediately (unblocks the UI)
    //   2. Defer the DB profile enrichment to the next tick via setTimeout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (newSession?.user) {
          setSession(newSession)
          setUser(buildBasicProfile(newSession.user))
        }
        setLoading(false)
        // Enrich the basic profile with DB data after Supabase finishes
        // committing the session internally (hence setTimeout 0)
        if (newSession?.user) {
          const authUser = newSession.user
          setTimeout(() => {
            if (mounted) loadUserProfile(authUser)
          }, 0)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && newSession) {
        setSession(newSession)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<{ error: AuthError | Error | null }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (!error) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()
      if (authUser) {
        const { error: profileError } = await supabase.from('users').insert({
          id: authUser.id,
          email: authUser.email!,
          full_name: fullName,
          role: email === 'admin@koisensei.nl' ? 'admin' : 'user',
          two_factor_enabled: false,
          approval_status: email === 'admin@koisensei.nl' ? 'approved' : 'pending',
        })

        if (!profileError && email !== 'admin@koisensei.nl') {
          EmailService.sendNewUserNotificationToAdmins(email, fullName).catch(() => {})
        }
      }
    }

    return { error }
  }

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: AuthError | Error | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (authUser) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (!existingUser) {
        await supabase.from('users').insert({
          id: authUser.id,
          email: authUser.email!,
          full_name: authUser.user_metadata?.full_name ?? '',
          role: email === 'admin@koisensei.nl' ? 'admin' : 'user',
          two_factor_enabled: false,
          two_factor_setup_completed: false,
          last_login_at: new Date().toISOString(),
          approval_status: email === 'admin@koisensei.nl' ? 'approved' : 'pending',
        })
      } else {
        if (existingUser.approval_status === 'pending' && existingUser.last_login_at) {
          await supabase
            .from('users')
            .update({
              approval_status: 'approved',
              approved_at: new Date().toISOString(),
            })
            .eq('id', authUser.id)
          existingUser.approval_status = 'approved'
        }

        if (existingUser.approval_status === 'pending') {
          await supabase.auth.signOut()
          return {
            error: new Error(
              'Your account is pending approval. Please wait for an administrator to approve your registration.'
            ),
          }
        }

        if (existingUser.approval_status === 'rejected') {
          await supabase.auth.signOut()
          return {
            error: new Error(
              'Your account has been rejected. Please contact support if you believe this is an error.'
            ),
          }
        }

        await supabase
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', authUser.id)
      }
    }

    return { error: null }
  }

  const signOut = async () => {
    setUser(null)
    setSession(null)
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string): Promise<{ error: AuthError | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updateProfile = async (updates: Partial<User>): Promise<{ error: Error | null }> => {
    if (!user) return { error: new Error('No user logged in') }

    const { error } = await supabase.from('users').update(updates).eq('id', user.id)

    if (!error) {
      setUser({ ...user, ...updates })
    }

    return { error: error as Error | null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updateProfile,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
