import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase, User } from '@/lib/supabase'
import { EmailService } from '@/lib/email-service'

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

// Custom storage key for session persistence
const SESSION_STORAGE_KEY = 'koi-pond-session'

// Helper function to save session to localStorage
const saveSessionToStorage = (session: Session | null) => {
  if (typeof window === 'undefined') return
  
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
      console.log('Session saved to localStorage')
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
      console.log('Session removed from localStorage')
    }
  } catch (error) {
    console.error('Error saving session to localStorage:', error)
  }
}

// Helper function to check if a token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = token.split('.')
    if (parts.length !== 3) return true
    
    // Decode the payload (second part)
    const payload = JSON.parse(atob(parts[1]))
    
    // Check if token has expired (with 60 second buffer)
    const expirationTime = payload.exp * 1000 // Convert to milliseconds
    const now = Date.now()
    return now >= (expirationTime - 60000) // Expired if within 60 seconds of expiration
  } catch (error) {
    console.error('Error checking token expiration:', error)
    return true // Assume expired if we can't parse it
  }
}

// Helper function to read session from localStorage
const getSessionFromStorage = (): Session | null => {
  if (typeof window === 'undefined') return null
  
  try {
    const storedValue = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (storedValue) {
      const parsed = JSON.parse(storedValue)
      if (parsed && parsed.access_token && parsed.user && parsed.refresh_token) {
        // Check if access token is expired
        if (isTokenExpired(parsed.access_token)) {
          console.log('Session in localStorage has expired access token - will try refresh')
          // Still return it so we can try to refresh it
        } else {
          console.log('Found valid session in localStorage')
        }
        return parsed as Session
      }
    }
  } catch (error) {
    console.log('Error reading session from localStorage:', error)
  }
  
  console.log('No session found in localStorage')
  return null
}

// Helper function to fetch user from database using direct fetch with timeout and retry
const fetchUserFromDatabase = async (userId: string, accessToken: string, retries: number = 1): Promise<User | null> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4'
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout per attempt
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=id,email,full_name,role,two_factor_enabled,two_factor_setup_completed,created_at,updated_at,profile_photo_url,street,house_number,postal_code,city,country,last_login_at&limit=1`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      )
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        if (attempt < retries) {
          console.warn(`Failed to fetch user from database (attempt ${attempt + 1}/${retries + 1}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1))) // Exponential backoff
          continue
        }
        console.warn('Failed to fetch user from database:', response.status, response.statusText)
        return null
      }
      
      const data = await response.json()
      const userData = Array.isArray(data) ? data[0] : data
      
      if (!userData) {
        return null
      }
      
      // Convert to User type
      const user: User = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name || userData.email?.split('@')[0] || 'User',
        role: userData.role || 'user',
        two_factor_enabled: userData.two_factor_enabled ?? false,
        two_factor_setup_completed: userData.two_factor_setup_completed ?? false,
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString(),
        profile_photo_url: userData.profile_photo_url || '',
        street: userData.street || '',
        house_number: userData.house_number || '',
        postal_code: userData.postal_code || '',
        city: userData.city || '',
        country: userData.country || '',
        last_login_at: userData.last_login_at || undefined
      }
      
      return user
    } catch (error: any) {
      if (error.name === 'AbortError') {
        if (attempt < retries) {
          console.warn(`Fetch user timeout (attempt ${attempt + 1}/${retries + 1}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1))) // Exponential backoff
          continue
        }
        console.warn('Error fetching user from database: timeout after retries')
        return null
      }
      
      if (attempt < retries) {
        console.warn(`Error fetching user from database (attempt ${attempt + 1}/${retries + 1}), retrying:`, error)
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1))) // Exponential backoff
        continue
      }
      
      console.warn('Error fetching user from database:', error)
      return null
    }
  }
  
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncInProgress, setSyncInProgress] = useState(false)
  
  const syncedUserIdRef = useRef<string | null>(null)
  const processingSignInRef = useRef<string | null>(null)
  const userRef = useRef<User | null>(null)
  const lastSignInTimeRef = useRef<number>(0)
  const isInitializedRef = useRef<boolean>(false)
  const initialSessionReceivedRef = useRef<boolean>(false)
  const restoreAttemptedRef = useRef<boolean>(false) // Track if we've already attempted to restore session

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    let mounted = true
    let globalTimeoutId: NodeJS.Timeout | null = null

    // Global timeout to ensure loading is always set to false after max 8 seconds
    // This prevents the app from hanging on loading after inactivity
    globalTimeoutId = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth initialization timeout - forcing loading to false after 8 seconds')
        setLoading(false)
      }
    }, 8000) // 8 second global timeout

    // Check network connectivity quickly
    const checkNetworkConnectivity = async (): Promise<boolean> => {
      if (typeof window === 'undefined' || !('navigator' in window)) {
        return true // Assume online if we can't check
      }
      
      // Check if browser reports offline
      if (!navigator.onLine) {
        console.warn('Browser reports offline status')
        return false
      }
      
      // Quick connectivity check with a short timeout
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1000) // 1 second timeout
        
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
          cache: 'no-cache'
        }).catch(() => null)
        
        clearTimeout(timeoutId)
        return true // If we got here, we have connectivity (even if fetch failed, no-cors might fail but we're online)
      } catch (error) {
        // Network error - might be offline or slow connection
        console.warn('Network connectivity check failed:', error)
        return false
      }
    }

    // Initialize auth - Wait for INITIAL_SESSION, then check localStorage
    const initializeAuth = async () => {
      if (isInitializedRef.current) {
        return
      }
      isInitializedRef.current = true

      try {
        // Quick network check - if offline, use localStorage immediately
        const isOnline = await checkNetworkConnectivity()
        if (!isOnline) {
          console.warn('Network appears offline - using localStorage session only')
          // Skip Supabase checks and go straight to localStorage
          const storedSession = getSessionFromStorage()
          if (storedSession && storedSession.user) {
            const basicUserProfile = {
              id: storedSession.user.id,
              email: storedSession.user.email!,
              full_name: (storedSession.user.user_metadata?.full_name && storedSession.user.user_metadata.full_name !== 'Test User')
                ? storedSession.user.user_metadata.full_name
                : storedSession.user.email?.split('@')[0] || 'User',
              profile_photo_url: storedSession.user.user_metadata?.profile_photo_url || '',
              street: storedSession.user.user_metadata?.street || '',
              house_number: storedSession.user.user_metadata?.house_number || '',
              postal_code: storedSession.user.user_metadata?.postal_code || '',
              city: storedSession.user.user_metadata?.city || '',
              country: storedSession.user.user_metadata?.country || '',
              role: (storedSession.user.email === 'admin@koisensei.nl' ? 'admin' : 'user') as 'admin' | 'user',
              two_factor_enabled: false,
              two_factor_setup_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            setUser(basicUserProfile)
            setSession(storedSession)
            if (globalTimeoutId) {
              clearTimeout(globalTimeoutId)
              globalTimeoutId = null
            }
            setLoading(false)
            return
          }
        }
        
        // Wait for Supabase to initialize and fire INITIAL_SESSION event
        // This ensures Supabase has loaded its session from storage
        // But don't wait too long if a sign in is already in progress
        console.log('Waiting for Supabase INITIAL_SESSION event...')
        let waited = 0
        while (!initialSessionReceivedRef.current && waited < 2000 && mounted) {
          // If a sign in is in progress, don't wait - let SIGNED_IN handler take over
          if (processingSignInRef.current) {
            console.log('Sign in in progress, stopping INITIAL_SESSION wait')
            break
          }
          await new Promise(resolve => setTimeout(resolve, 100))
          waited += 100
        }
        
        // STEP 1: Check Supabase first (it should have loaded from localStorage)
        // Add timeout to prevent hanging on network issues
        let supabaseSession: Session | null = null
        let sessionError: any = null
        
        try {
          const sessionPromise = supabase.auth.getSession()
          const timeoutPromise = new Promise<{ data: { session: null }, error: null }>((resolve) => {
            setTimeout(() => resolve({ data: { session: null }, error: null }), 3000) // 3 second timeout
          })
          
          const result = await Promise.race([sessionPromise, timeoutPromise]) as any
          supabaseSession = result?.data?.session || null
          sessionError = result?.error || null
          
          if (!supabaseSession && !sessionError) {
            console.warn('getSession() timed out after 3 seconds - continuing with localStorage check')
          }
        } catch (err) {
          console.warn('Error getting session from Supabase (non-critical):', err)
          // Continue with localStorage check
        }
        
        if (!mounted) return

        if (supabaseSession?.user) {
          console.log('Session found via Supabase getSession():', supabaseSession.user.email)
          setSession(supabaseSession)
          saveSessionToStorage(supabaseSession) // Save to localStorage
          // Clear global timeout since we're proceeding
          if (globalTimeoutId) {
            clearTimeout(globalTimeoutId)
            globalTimeoutId = null
          }
          await createUserFromAuth(supabaseSession.user, true)
          return
        }
        
        // STEP 2: If Supabase has no session, check localStorage directly
        // But only if we're not currently processing a sign in
        if (processingSignInRef.current) {
          console.log('Sign in in progress, skipping localStorage restore - waiting for SIGNED_IN to complete')
          // Clear global timeout - SIGNED_IN handler will set loading to false
          if (globalTimeoutId) {
            clearTimeout(globalTimeoutId)
            globalTimeoutId = null
          }
          // Don't set loading to false here - let SIGNED_IN handler do it
          return
        }
        
        console.log('No session in Supabase, checking localStorage directly...')
        const storedSession = getSessionFromStorage()
        
        if (storedSession && storedSession.user) {
          console.log('Found session in localStorage on page load, restoring immediately...')
          
          // Try to fetch user from database FIRST (with timeout to prevent blocking)
          let dbUser: User | null = null
          try {
            const fetchPromise = fetchUserFromDatabase(storedSession.user.id, storedSession.access_token)
            const timeoutPromise = new Promise<null>((resolve) => {
              setTimeout(() => resolve(null), 1000) // Increased to 1 second timeout
            })
            
            dbUser = await Promise.race([fetchPromise, timeoutPromise])
          } catch (err) {
            console.warn('Failed to fetch user from database (non-critical):', err)
          }
          
          // Create basic user profile as fallback (don't use user_metadata.full_name if it's "Test User")
          const basicUserProfile = {
            id: storedSession.user.id,
            email: storedSession.user.email!,
            // Don't use user_metadata.full_name if it's "Test User" - use email instead
            full_name: (storedSession.user.user_metadata?.full_name && storedSession.user.user_metadata.full_name !== 'Test User')
              ? storedSession.user.user_metadata.full_name
              : storedSession.user.email?.split('@')[0] || 'User',
            profile_photo_url: storedSession.user.user_metadata?.profile_photo_url || '',
            street: storedSession.user.user_metadata?.street || '',
            house_number: storedSession.user.user_metadata?.house_number || '',
            postal_code: storedSession.user.user_metadata?.postal_code || '',
            city: storedSession.user.user_metadata?.city || '',
            country: storedSession.user.user_metadata?.country || '',
            role: (storedSession.user.email === 'admin@koisensei.nl' ? 'admin' : 'user') as 'admin' | 'user',
            two_factor_enabled: false,
            two_factor_setup_completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          // Set user and session IMMEDIATELY to prevent redirect
          // Use database user if available, otherwise use basic profile
          setUser(dbUser || basicUserProfile)
          setSession(storedSession)
          // Clear global timeout since we're setting loading to false
          if (globalTimeoutId) {
            clearTimeout(globalTimeoutId)
            globalTimeoutId = null
          }
          setLoading(false)
          
          // Continue fetching in background if we didn't get it yet
          if (!dbUser) {
            fetchUserFromDatabase(storedSession.user.id, storedSession.access_token).then(backgroundDbUser => {
              if (backgroundDbUser && mounted) {
                console.log('User data fetched from database, updating user state')
                setUser(backgroundDbUser)
              }
            }).catch(err => {
              console.warn('Failed to fetch user from database (non-critical):', err)
            })
          }
          
          // Now try to restore session in Supabase (this will refresh if needed)
          // Check if access_token is expired first
          const expiresAt = storedSession.expires_at
          const now = Math.floor(Date.now() / 1000)
          const isExpired = expiresAt ? expiresAt <= now : false
          
          if (isExpired) {
            console.log('Access token expired, attempting refresh via Supabase...')
            // Try to refresh the session with timeout
            try {
              const refreshPromise = supabase.auth.refreshSession()
              const timeoutPromise = new Promise<{ data: { session: null }, error: { message: string } }>((resolve) => {
                setTimeout(() => resolve({ data: { session: null }, error: { message: 'Refresh timeout' } }), 3000) // 3 second timeout
              })
              
              const result = await Promise.race([refreshPromise, timeoutPromise]) as any
              const refreshedSession = result?.data?.session
              const refreshError = result?.error
              
              if (!mounted) return
              
              if (!refreshError && refreshedSession) {
                console.log('Session refreshed successfully')
                setSession(refreshedSession)
                saveSessionToStorage(refreshedSession)
                createUserFromAuth(refreshedSession.user, true).catch(err => {
                  console.warn('Background user sync failed:', err)
                })
              } else {
                console.log('Failed to refresh session, but keeping user logged in:', refreshError?.message || 'timeout')
                // Keep user state - the refresh_token might still be valid for future refreshes
                // Supabase's autoRefreshToken will handle it
              }
            } catch (error) {
              console.log('Error refreshing session:', error)
              // Keep user state - don't clear it
            }
          } else {
            // Access token still valid, try to set session with timeout
            try {
              const setSessionPromise = supabase.auth.setSession({
                access_token: storedSession.access_token,
                refresh_token: storedSession.refresh_token
              })
              const timeoutPromise = new Promise<{ data: { session: null }, error: { message: string } }>((resolve) => {
                setTimeout(() => resolve({ data: { session: null }, error: { message: 'SetSession timeout' } }), 3000) // 3 second timeout
              })
              
              const result = await Promise.race([setSessionPromise, timeoutPromise]) as any
              const restoredSession = result?.data?.session
              const error = result?.error
              
              if (!mounted) return
              
              if (error || !restoredSession) {
                console.log('Failed to restore session in Supabase (non-critical):', error?.message || 'timeout')
                // Don't clear user state - keep it and let Supabase retry
              } else {
                console.log('Successfully restored session in Supabase')
                setSession(restoredSession)
                saveSessionToStorage(restoredSession)
                createUserFromAuth(restoredSession.user, true).catch(err => {
                  console.warn('Background user sync failed:', err)
                })
              }
            } catch (error) {
              console.log('Error restoring session in Supabase:', error)
              // Keep user state - don't clear it
            }
          }
          
          return
        }
        
        // No session found anywhere
        console.log('No session found in Supabase or localStorage')
        // Clear global timeout since we're setting loading to false
        if (globalTimeoutId) {
          clearTimeout(globalTimeoutId)
          globalTimeoutId = null
        }
        setLoading(false)
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          // Clear global timeout since we're handling the error
          if (globalTimeoutId) {
            clearTimeout(globalTimeoutId)
            globalTimeoutId = null
          }
          setLoading(false)
        }
      }
    }

    initializeAuth()

    return () => {
      mounted = false
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId)
      }
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('Auth state change:', event, session?.user?.email || 'no user')

      if (event === 'SIGNED_IN' && session?.user) {
        if (processingSignInRef.current === session.user.id) {
          console.log('SIGNED_IN already processing for user:', session.user.id)
          return
        }
        
        lastSignInTimeRef.current = Date.now()
        processingSignInRef.current = session.user.id
        console.log('SIGNED_IN event - setting session and user')
        setSession(session)
        // Save session to localStorage for persistence
        saveSessionToStorage(session)
        
        try {
          await createUserFromAuth(session.user, false, session.access_token)
          console.log('User created from auth successfully')
        } catch (error) {
          console.error('Error creating user from auth:', error)
          // Still set loading to false even if there's an error
          setLoading(false)
        }
        
        setTimeout(() => {
          if (processingSignInRef.current === session.user.id) {
            processingSignInRef.current = null
          }
        }, 2000)
      } else if (event === 'SIGNED_OUT') {
        // Ignore SIGNED_OUT events that happen right after a session restore attempt
        // These are often triggered by 403 errors when Supabase tries to validate an expired token
        const timeSinceLastSignIn = Date.now() - lastSignInTimeRef.current
        if (timeSinceLastSignIn < 5000) {
          console.log('SIGNED_OUT event ignored - too soon after session restore (likely 403 error)')
          return
        }
        
        // ALWAYS check localStorage first - if we have a session there, keep user logged in
        // But only if we haven't already attempted to restore and failed
        const storedSession = getSessionFromStorage()
        if (storedSession?.user && !restoreAttemptedRef.current) {
          console.log('SIGNED_OUT event ignored - still have session in localStorage, keeping user logged in')
          // Make sure user state is set
          if (!userRef.current || userRef.current.id !== storedSession.user.id) {
            // Try to fetch user from database FIRST (with timeout to prevent blocking)
            let dbUser: User | null = null
            try {
              const fetchPromise = fetchUserFromDatabase(storedSession.user.id, storedSession.access_token)
              const timeoutPromise = new Promise<null>((resolve) => {
                setTimeout(() => resolve(null), 500) // 500ms timeout
              })
              
              dbUser = await Promise.race([fetchPromise, timeoutPromise])
            } catch (err) {
              console.warn('Failed to fetch user from database during SIGNED_OUT restore (non-critical):', err)
            }
            
            // Create basic user profile as fallback (don't use user_metadata.full_name if it's "Test User")
            const basicUserProfile = {
              id: storedSession.user.id,
              email: storedSession.user.email!,
              // Don't use user_metadata.full_name if it's "Test User" - use email instead
              full_name: (storedSession.user.user_metadata?.full_name && storedSession.user.user_metadata.full_name !== 'Test User')
                ? storedSession.user.user_metadata.full_name
                : storedSession.user.email?.split('@')[0] || 'User',
              profile_photo_url: storedSession.user.user_metadata?.profile_photo_url || '',
              street: storedSession.user.user_metadata?.street || '',
              house_number: storedSession.user.user_metadata?.house_number || '',
              postal_code: storedSession.user.user_metadata?.postal_code || '',
              city: storedSession.user.user_metadata?.city || '',
              country: storedSession.user.user_metadata?.country || '',
              role: (storedSession.user.email === 'admin@koisensei.nl' ? 'admin' : 'user') as 'admin' | 'user',
              two_factor_enabled: false,
              two_factor_setup_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            
            // Use database user if available, otherwise use basic profile
            setUser(dbUser || basicUserProfile)
            setSession(storedSession)
            
            // Continue fetching in background if we didn't get it yet
            if (!dbUser) {
              fetchUserFromDatabase(storedSession.user.id, storedSession.access_token).then(backgroundDbUser => {
                if (backgroundDbUser && mounted) {
                  console.log('User data fetched from database during SIGNED_OUT restore, updating user state')
                  setUser(backgroundDbUser)
                }
              }).catch(err => {
                console.warn('Failed to fetch user from database during SIGNED_OUT restore (non-critical):', err)
              })
            }
          }
          return
        }
        
        // Ignore spurious SIGNED_OUT events that happen too soon after SIGNED_IN or session restore
        // (timeSinceLastSignIn already calculated above)
        if (timeSinceLastSignIn < 10000) {
          console.log('SIGNED_OUT event ignored - too soon after SIGNED_IN/session restore (spurious event)')
          return
        }
        
        // Check if we still have a valid session in Supabase
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (currentSession?.user) {
          console.log('SIGNED_OUT event ignored - still have valid session in Supabase')
          return
        }
        
        // If this is an explicit sign out (user clicked logout), always clear
        // Check if we're currently processing a sign in - if so, this might be a real logout
        if (processingSignInRef.current) {
          // A sign in is in progress, but we got SIGNED_OUT - this might be a real logout
          // Clear the processing flag and proceed with logout
          processingSignInRef.current = null
        }
        
        console.log('SIGNED_OUT event - clearing session and user')
        setSession(null)
        setUser(null)
        saveSessionToStorage(null) // Always clear from localStorage on SIGNED_OUT
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session) {
        console.log('TOKEN_REFRESHED event - updating session')
        setSession(session)
        // Update session in localStorage
        saveSessionToStorage(session)
        
        if (session.user && (!userRef.current || userRef.current.id !== session.user.id)) {
          await createUserFromAuth(session.user, true)
        }
      } else if (event === 'INITIAL_SESSION') {
        initialSessionReceivedRef.current = true
        // INITIAL_SESSION is handled by initializeAuth, but also handle it here
        if (session?.user && !userRef.current) {
          console.log('INITIAL_SESSION with user - setting session and user')
          setSession(session)
          await createUserFromAuth(session.user, true)
        } else if (!session && !userRef.current) {
          // INITIAL_SESSION with no session - check localStorage as fallback
          // But only if we're not currently processing a sign in
          if (processingSignInRef.current) {
            console.log('Sign in in progress during INITIAL_SESSION, skipping localStorage restore')
            setLoading(false)
            return
          }
          
          console.log('INITIAL_SESSION with no session - checking localStorage...')
          const storedSession = getSessionFromStorage()
          if (storedSession?.user) {
            console.log('Found session in localStorage during INITIAL_SESSION, restoring...')
            const basicUserProfile = {
              id: storedSession.user.id,
              email: storedSession.user.email!,
              full_name: storedSession.user.user_metadata?.full_name || storedSession.user.email?.split('@')[0] || 'User',
              profile_photo_url: storedSession.user.user_metadata?.profile_photo_url || '',
              street: storedSession.user.user_metadata?.street || '',
              house_number: storedSession.user.user_metadata?.house_number || '',
              postal_code: storedSession.user.user_metadata?.postal_code || '',
              city: storedSession.user.user_metadata?.city || '',
              country: storedSession.user.user_metadata?.country || '',
              role: (storedSession.user.email === 'admin@koisensei.nl' ? 'admin' : 'user') as 'admin' | 'user',
              two_factor_enabled: false,
              two_factor_setup_completed: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
            // Set user and session IMMEDIATELY to prevent redirect
            setUser(basicUserProfile)
            setSession(storedSession)
            setLoading(false)
            
            // Immediately fetch user from database to get correct name (non-blocking)
            fetchUserFromDatabase(storedSession.user.id, storedSession.access_token).then(dbUser => {
              if (dbUser && mounted) {
                console.log('User data fetched from database during INITIAL_SESSION, updating user state')
                setUser(dbUser)
              }
            }).catch(err => {
              console.warn('Failed to fetch user from database during INITIAL_SESSION (non-critical):', err)
            })
            
            // Mark that we're restoring so SIGNED_OUT doesn't clear it
            lastSignInTimeRef.current = Date.now()
            
            // Try to restore in Supabase in the background (non-blocking)
            // If it fails, we keep the user logged in with the localStorage session
            // Only attempt once to prevent loops
            if (!restoreAttemptedRef.current) {
              restoreAttemptedRef.current = true
              setTimeout(async () => {
                if (!mounted) return
                
                // Check if token is expired before attempting restore
                if (isTokenExpired(storedSession.access_token)) {
                  console.log('Access token expired, attempting refresh instead of setSession...')
                  try {
                    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
                    
                    if (!mounted) return
                    
                    if (!refreshError && refreshedSession) {
                      console.log('Session refreshed successfully during INITIAL_SESSION')
                      setSession(refreshedSession)
                      saveSessionToStorage(refreshedSession)
                      createUserFromAuth(refreshedSession.user, true).catch(err => {
                        console.warn('Background user sync failed:', err)
                      })
                    } else {
                      console.log('Failed to refresh session (non-critical), keeping localStorage session:', refreshError?.message)
                      // Don't clear anything - user stays logged in with localStorage session
                    }
                  } catch (error) {
                    console.log('Error refreshing session during INITIAL_SESSION (non-critical):', error)
                    // Keep user state - don't clear it
                  }
                } else {
                  console.log('Attempting to restore session in Supabase (background)...')
                  try {
                    const { data: { session: restoredSession }, error: setError } = await supabase.auth.setSession({
                      access_token: storedSession.access_token,
                      refresh_token: storedSession.refresh_token
                    })
                    
                    if (!mounted) return
                    
                    if (!setError && restoredSession) {
                      console.log('Session restored successfully in Supabase during INITIAL_SESSION')
                      setSession(restoredSession)
                      saveSessionToStorage(restoredSession)
                      createUserFromAuth(restoredSession.user, true).catch(err => {
                        console.warn('Background user sync failed:', err)
                      })
                    } else {
                      // Check if error is 403 Forbidden - means token is invalid/revoked
                      // In this case, try to refresh the token instead
                      if (setError && (setError.message?.includes('403') || setError.message?.includes('Forbidden') || setError.status === 403)) {
                        console.log('403 Forbidden when restoring session - token may be invalid, attempting refresh...')
                        try {
                          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
                          
                          if (!mounted) return
                          
                          if (!refreshError && refreshedSession) {
                            console.log('Session refreshed successfully after 403 error')
                            setSession(refreshedSession)
                            saveSessionToStorage(refreshedSession)
                            createUserFromAuth(refreshedSession.user, true).catch(err => {
                              console.warn('Background user sync failed:', err)
                            })
                          } else {
                            console.log('Failed to refresh session after 403 (non-critical), keeping localStorage session:', refreshError?.message)
                            // Don't clear anything - user stays logged in with localStorage session
                          }
                        } catch (refreshErr) {
                          console.log('Error refreshing session after 403 (non-critical):', refreshErr)
                          // Keep user state - don't clear it
                        }
                      } else {
                        // Other errors - but we keep the user logged in with localStorage session
                        console.log('Failed to restore session in Supabase (non-critical), keeping localStorage session:', setError?.message)
                        // Don't clear anything - user stays logged in
                      }
                    }
                  } catch (error: any) {
                    // Check if error is 403 Forbidden
                    if (error?.status === 403 || error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
                      console.log('403 Forbidden when restoring session - attempting refresh...')
                      try {
                        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
                        
                        if (!mounted) return
                        
                        if (!refreshError && refreshedSession) {
                          console.log('Session refreshed successfully after 403 error')
                          setSession(refreshedSession)
                          saveSessionToStorage(refreshedSession)
                          createUserFromAuth(refreshedSession.user, true).catch(err => {
                            console.warn('Background user sync failed:', err)
                          })
                        } else {
                          console.log('Failed to refresh session after 403 (non-critical), keeping localStorage session:', refreshError?.message)
                          // Don't clear anything - user stays logged in with localStorage session
                        }
                      } catch (refreshErr) {
                        console.log('Error refreshing session after 403 (non-critical):', refreshErr)
                        // Keep user state - don't clear it
                      }
                    } else {
                      console.log('Error restoring session during INITIAL_SESSION (non-critical):', error)
                      // Keep user state - don't clear it
                    }
                  }
                }
              }, 500)
            } else {
              console.log('Session restore already attempted, skipping to prevent loops')
            }
          } else {
            console.log('No session in localStorage during INITIAL_SESSION either')
            setLoading(false)
          }
        }
      } else if (session) {
        setSession(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId)
      }
    }
  }, []) // Only run once on mount - cleanup handles timeout

  const createUserFromAuth = async (authUser: SupabaseUser, skipLoadingUpdate = false, accessToken?: string) => {
    try {
      if (processingSignInRef.current === authUser.id && userRef.current?.id === authUser.id) {
        console.log('User already set and processing, skipping createUserFromAuth for:', authUser.email)
        if (!skipLoadingUpdate) {
          setLoading(false)
        }
        return
      }
      
      console.log('Creating user from auth:', authUser.email)
      
      // Create basic user profile as fallback (don't use user_metadata.full_name if it's "Test User")
      const basicUserProfile = {
        id: authUser.id,
        email: authUser.email!,
        // Don't use user_metadata.full_name if it's "Test User" - use email instead
        full_name: (authUser.user_metadata?.full_name && authUser.user_metadata.full_name !== 'Test User') 
          ? authUser.user_metadata.full_name 
          : authUser.email?.split('@')[0] || 'User',
        profile_photo_url: authUser.user_metadata?.profile_photo_url || '',
        street: authUser.user_metadata?.street || '',
        house_number: authUser.user_metadata?.house_number || '',
        postal_code: authUser.user_metadata?.postal_code || '',
        city: authUser.user_metadata?.city || '',
        country: authUser.user_metadata?.country || '',
        role: (authUser.email === 'admin@koisensei.nl' ? 'admin' : 'user') as 'admin' | 'user',
        two_factor_enabled: false,
        two_factor_setup_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      // Try to fetch user from database FIRST (with timeout to prevent blocking)
      const tokenToUse = accessToken || session?.access_token
      let dbUser: User | null = null
      
      if (tokenToUse) {
        try {
          // Try to fetch immediately with a timeout (fetchUserFromDatabase now has built-in timeout and retry)
          const fetchPromise = fetchUserFromDatabase(authUser.id, tokenToUse, 1) // 1 retry = 2 total attempts
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => resolve(null), 2000) // 2 second timeout (allows for retry)
          })
          
          dbUser = await Promise.race([fetchPromise, timeoutPromise])
          
          if (dbUser) {
            console.log('User data fetched from database in createUserFromAuth, using database data')
            setUser(dbUser)
            // Still sync in background for complete data, then set loading to false
            syncUserWithDatabase(dbUser)
              .then(() => {
                console.log('Sync completed, setting loading to false')
                setLoading(false)
              })
              .catch(error => {
                console.warn('Background sync failed (non-critical):', error)
                // Even if sync fails, set loading to false so user can use the app
                setLoading(false)
              })
            // If skipLoadingUpdate is false, also set it immediately (for faster UI)
            if (!skipLoadingUpdate) {
              console.log('Setting loading to false immediately')
              setLoading(false)
            }
            return
          }
        } catch (err) {
          console.warn('Failed to fetch user from database in createUserFromAuth (non-critical):', err)
        }
      }
      
      // If database fetch failed or timed out, use basic profile
      console.log('Setting user profile (basic/fallback):', basicUserProfile.email)
      setUser(basicUserProfile)
      
      // Sync with database in background, then set loading to false
      // Even if skipLoadingUpdate is true, we need to set loading to false after sync completes
      syncUserWithDatabase(basicUserProfile)
        .then(() => {
          // After sync completes, set loading to false
          // This ensures the UI is ready even if skipLoadingUpdate was true
          console.log('Sync completed, setting loading to false')
          setLoading(false)
        })
        .catch(error => {
          console.warn('Background sync failed (non-critical):', error)
          // Even if sync fails, set loading to false so user can use the app
          setLoading(false)
        })
      
      // If skipLoadingUpdate is false, also set it immediately (for faster UI)
      if (!skipLoadingUpdate) {
        console.log('Setting loading to false immediately')
        setLoading(false)
      }
      
      // Continue fetching in background to update with correct data
      if (tokenToUse && !dbUser) {
        fetchUserFromDatabase(authUser.id, tokenToUse).then(backgroundDbUser => {
          if (backgroundDbUser) {
            console.log('User data fetched from database in background, updating user state')
            setUser(backgroundDbUser)
          }
        }).catch(err => {
          console.warn('Failed to fetch user from database in background (non-critical):', err)
        })
      } else if (!tokenToUse) {
        // Fallback to Supabase query if no direct access token
        setTimeout(async () => {
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (currentSession) {
              const { data: quickUserData } = await supabase
                .from('users')
                .select('full_name')
                .eq('id', authUser.id)
                .limit(1)
                .maybeSingle()
              
              if (quickUserData?.full_name) {
                setUser(prev => prev ? { ...prev, full_name: quickUserData.full_name! } : prev)
              }
            }
          } catch (error) {
            // Ignore errors - we already have a basic profile
          }
        }, 100)
      }
    } catch (error) {
      console.error('Error in createUserFromAuth:', error)
      // Always set loading to false even if there's an error
      if (!skipLoadingUpdate) {
        setLoading(false)
      }
    }
  }

  const syncUserWithDatabase = async (userProfile: any) => {
    if (syncInProgress) {
      console.log('Sync already in progress, skipping...')
      // Don't set loading to false here - let the other sync handle it
      return
    }
    
    if (syncedUserIdRef.current === userProfile.id) {
      console.log('User data already synced, skipping sync...')
      // User already synced, so we can safely set loading to false
      setLoading(false)
      return
    }
    
    syncedUserIdRef.current = userProfile.id
    
    try {
      setSyncInProgress(true)
      console.log('Syncing user with database...')
      
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      if (!currentSession) {
        console.warn('No active session during sync, skipping database sync')
        // No session but we have user data, so set loading to false
        setLoading(false)
        return
      }
      
      const { data: userData, error: selectError } = await supabase
        .from('users')
        .select('id, email, full_name, role, two_factor_enabled, two_factor_setup_completed, created_at, updated_at, profile_photo_url, street, house_number, postal_code, city, country, last_login_at')
        .eq('id', userProfile.id)
        .limit(1)
      
      if (selectError) {
        if (selectError.code === '42P17') {
          console.log('Infinite recursion detected in RLS policy - skipping user sync')
          return
        }
        
        if (selectError.code === 'PGRST116' || (selectError as any).status === 406) {
          console.log('User profile not found, attempting to create...')
        } else {
          console.log('Database query error:', selectError)
          return
        }
      }
      
      if (!userData || userData.length === 0) {
        console.log('Creating user profile in database...')
        const minimalProfile = {
          id: userProfile.id,
          email: userProfile.email,
          full_name: userProfile.full_name || userProfile.email?.split('@')[0] || 'User',
          role: userProfile.role || 'user',
          two_factor_enabled: false,
          two_factor_setup_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        const { data: insertedData, error: insertError } = await supabase
          .from('users')
          .insert(minimalProfile)
          .select()
          .single()
        
        if (insertError) {
          if (insertError.code === '23505') {
            console.log('User profile already exists (likely created by trigger)')
            const { data: existingData } = await supabase
              .from('users')
              .select('id, email, full_name, role, two_factor_enabled, two_factor_setup_completed, created_at, updated_at')
              .eq('id', userProfile.id)
              .limit(1)
            
            if (existingData && existingData.length > 0) {
              setUser({ ...userProfile, ...existingData[0] })
            }
          } else {
            console.error('Failed to create user profile:', insertError)
          }
        } else if (insertedData) {
          console.log('User profile created in database')
          setUser({ ...userProfile, ...insertedData })
        }
      } else {
        const existingUser = userData[0]
        console.log('User profile found in database:', existingUser)
        
        const mergedUser: User = {
          id: existingUser.id,
          email: existingUser.email || userProfile.email,
          full_name: existingUser.full_name || userProfile.full_name,
          role: existingUser.role || userProfile.role,
          two_factor_enabled: existingUser.two_factor_enabled ?? false,
          two_factor_setup_completed: existingUser.two_factor_setup_completed ?? false,
          created_at: existingUser.created_at || userProfile.created_at,
          updated_at: existingUser.updated_at || userProfile.updated_at,
          profile_photo_url: existingUser.profile_photo_url || userProfile.profile_photo_url || '',
          street: existingUser.street || userProfile.street || '',
          house_number: existingUser.house_number || userProfile.house_number || '',
          postal_code: existingUser.postal_code || userProfile.postal_code || '',
          city: existingUser.city || userProfile.city || '',
          country: existingUser.country || userProfile.country || '',
          last_login_at: existingUser.last_login_at || undefined
        }
        
        setUser(mergedUser)
        console.log('Updated user state with complete database profile data')
      }
    } catch (dbError: any) {
      console.error('Database sync failed:', dbError)
      if (syncedUserIdRef.current === userProfile.id) {
        syncedUserIdRef.current = null
      }
      // Even if sync fails, set loading to false so user can use the app
      setLoading(false)
    } finally {
      setSyncInProgress(false)
      // Ensure loading is set to false after sync completes (even if it was already set)
      // This is a safety measure to prevent the app from hanging on loading
      setLoading(false)
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
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { error: profileError } = await supabase.from('users').insert({
          id: authUser.id,
          email: authUser.email!,
          full_name: fullName,
          role: email === 'admin@koisensei.nl' ? 'admin' : 'user',
          two_factor_enabled: false,
          approval_status: email === 'admin@koisensei.nl' ? 'approved' : 'pending',
        })
        
        if (profileError) {
          console.error('Error creating user profile:', profileError)
        } else {
          if (email !== 'admin@koisensei.nl') {
            EmailService.sendNewUserNotificationToAdmins(email, fullName).catch(error => {
              console.warn('Failed to send admin notification:', error)
            })
          }
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
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (!existingUser) {
          const { error: profileError } = await supabase.from('users').insert({
            id: authUser.id,
            email: authUser.email!,
            full_name: authUser.user_metadata?.full_name || '',
            role: email === 'admin@koisensei.nl' ? 'admin' : 'user',
            two_factor_enabled: false,
            two_factor_setup_completed: false,
            last_login_at: new Date().toISOString(),
            approval_status: email === 'admin@koisensei.nl' ? 'approved' : 'pending',
          })
          
          if (profileError && profileError.code !== '23505') {
            console.error('Error creating user profile:', profileError)
          }
        } else {
          // Auto-approve existing users who have logged in before (have last_login_at)
          // This prevents blocking existing active accounts when approval system was added
          // If a user has logged in before, they are clearly an existing active user
          if (existingUser.approval_status === 'pending' && existingUser.last_login_at) {
            console.log('Auto-approving existing user with previous login history')
            const { error: approveError } = await supabase
              .from('users')
              .update({ 
                approval_status: 'approved',
                approved_at: new Date().toISOString()
              })
              .eq('id', authUser.id)
            
            if (approveError) {
              console.error('Error auto-approving user:', approveError)
              // Even if update fails, allow login for existing users with login history
              // This is a safety measure to prevent blocking legitimate users
            } else {
              // Update existingUser object to reflect approved status
              existingUser.approval_status = 'approved'
              existingUser.approved_at = new Date().toISOString()
            }
          }
          
          if (existingUser.approval_status === 'pending') {
            await supabase.auth.signOut()
            return { error: { message: 'Your account is pending approval. Please wait for an administrator to approve your registration.' } }
          }
          
          if (existingUser.approval_status === 'rejected') {
            await supabase.auth.signOut()
            return { error: { message: 'Your account has been rejected. Please contact support if you believe this is an error.' } }
          }
          
          const { error: updateError } = await supabase
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', authUser.id)
          
          if (updateError) {
            console.error('Error updating last login:', updateError)
          }
          
          setUser(existingUser)
        }
      }
    }
    
    return { error }
  }

  const signOut = async () => {
    console.log('Explicit sign out requested')
    // Clear processing flags
    processingSignInRef.current = null
    syncedUserIdRef.current = null
    
    // Clear state and storage
    setUser(null)
    setSession(null)
    saveSessionToStorage(null) // Clear from localStorage
    setLoading(false)
    
    // Sign out from Supabase
    await supabase.auth.signOut()
    
    // Double-check: ensure localStorage is cleared
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(SESSION_STORAGE_KEY)
        console.log('Session storage cleared after sign out')
      } catch (error) {
        console.error('Error clearing session storage:', error)
      }
    }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return { error: new Error('No user logged in') }

    // Check if Supabase has a session
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    
    // Use direct fetch if no Supabase session but we have React session
    if (!currentSession && session?.access_token) {
      try {
        console.log('Updating user profile using direct fetch with access token...')
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pbpuvumeshaeplbwbwzv.supabase.co'
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDc2MDMsImV4cCI6MjA3MzAyMzYwM30.RK3zOzlTGZ38ieRc7o6phdrHW8yhJTiXDHwUnEOrKt4'
        
        const response = await fetch(
          `${supabaseUrl}/rest/v1/users?id=eq.${user.id}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(updates)
          }
        )
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const error = new Error(`Update failed: ${response.status} ${response.statusText}`)
          return { error }
        }
        
        // Update local user state
        setUser({ ...user, ...updates })
        
        return { error: null }
      } catch (error: any) {
        console.error('Error updating profile with direct fetch:', error)
        return { error }
      }
    }
    
    // Fallback to normal Supabase update if session is available
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
