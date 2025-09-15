import React, { createContext, useContext, useEffect, useState } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase, User } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
  updateProfile: (updates: Partial<User>) => Promise<{ error: any }>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Set a timeout to stop loading after 3 seconds
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Authentication timeout - stopping loading')
        setLoading(false)
      }
    }, 3000)

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      
      console.log('Initial session:', session)
      setSession(session)
      if (session?.user) {
        console.log('Session user found:', session.user.id)
        createUserFromAuth(session.user)
      } else {
        console.log('No session user, setting loading to false')
        setUser(null)
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Error getting initial session:', error)
      if (mounted) {
        setUser(null)
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      console.log('Auth state change:', event, session)
      setSession(session)
      if (session?.user) {
        console.log('Auth change - user found:', session.user.id)
        createUserFromAuth(session.user)
      } else {
        console.log('Auth change - no user, setting loading to false')
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const createUserFromAuth = async (authUser: any) => {
    try {
      console.log('Creating user from auth:', authUser.email)
      
      // First, try to get user data from database
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (dbUser && !dbError) {
        // Use database user data (includes 2FA status)
        console.log('Using database user data:', dbUser)
        setUser(dbUser)
        setLoading(false)
        return
      }
      
      // If no database user, create temporary profile
      const userProfile = {
        id: authUser.id,
        email: authUser.email!,
        full_name: authUser.user_metadata?.full_name || '',
        profile_photo_url: authUser.user_metadata?.profile_photo_url || '',
        street: authUser.user_metadata?.street || '',
        house_number: authUser.user_metadata?.house_number || '',
        postal_code: authUser.user_metadata?.postal_code || '',
        city: authUser.user_metadata?.city || '',
        country: authUser.user_metadata?.country || '',
        role: authUser.email === 'admin@koisensei.nl' ? 'admin' : 'user',
        two_factor_enabled: false,
        two_factor_setup_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      console.log('Setting temporary user profile:', userProfile)
      setUser(userProfile)
      setLoading(false)
      
      // Try to sync with database in background (non-blocking)
      syncUserWithDatabase(userProfile)
      
    } catch (error) {
      console.error('Error creating user from auth:', error)
      setUser(null)
      setLoading(false)
    }
  }

  const syncUserWithDatabase = async (userProfile: any) => {
    try {
      console.log('Syncing user with database...')
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userProfile.id)
        .single()
      
      if (error && error.code === 'PGRST116') {
        // User profile doesn't exist, create it
        console.log('Creating user profile in database...')
        await supabase.from('users').insert(userProfile)
        console.log('User profile created in database')
      } else if (!error) {
        console.log('User profile already exists in database:', data)
      }
    } catch (dbError) {
      console.log('Database sync failed:', dbError)
    }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (!error) {
      // Wait a moment for the auth user to be created
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Create user profile manually
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { error: profileError } = await supabase.from('users').insert({
          id: authUser.id,
          email: authUser.email!,
          full_name: fullName,
          role: email === 'admin@koisensei.nl' ? 'admin' : 'user',
          two_factor_enabled: false,
        })
        
        if (profileError) {
          console.error('Error creating user profile:', profileError)
        }
      }
    }

    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (!error) {
      // Check if user profile exists, create if not
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (!existingUser) {
          // Create user profile if it doesn't exist
          const { error: profileError } = await supabase.from('users').insert({
            id: authUser.id,
            email: authUser.email!,
            full_name: authUser.user_metadata?.full_name || '',
            role: email === 'admin@koisensei.nl' ? 'admin' : 'user',
            two_factor_enabled: false,
            two_factor_setup_completed: false,
            last_login_at: new Date().toISOString(),
          })
          
          if (profileError) {
            console.error('Error creating user profile:', profileError)
          }
        } else {
          // Update last login time for existing user
          const { error: updateError } = await supabase
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', authUser.id)
          
          if (updateError) {
            console.error('Error updating last login:', updateError)
          }
          
          // Update local user state with database data (including 2FA status)
          setUser(existingUser)
        }
      }
    }
    
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return { error: new Error('No user logged in') }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)

    if (!error) {
      setUser({ ...user, ...updates })
    }

    return { error }
  }

  const isAdmin = user?.role === 'admin'

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    isAdmin,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
