import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function AuthDebug() {
  const { user, session, loading } = useAuth()
  const [authUser, setAuthUser] = useState<any>(null)
  const [dbUser, setDbUser] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setAuthUser(authUser)

      if (authUser) {
        const { data: dbUser, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        if (error) {
          console.log('Debug - DB User error:', error)
        }
        setDbUser(dbUser)
      }
    }

    checkAuth()
    
    // Check every 2 seconds for updates
    const interval = setInterval(checkAuth, 2000)
    return () => clearInterval(interval)
  }, [])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-md">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      <div className="space-y-1">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>Session: {session ? 'exists' : 'null'}</div>
        <div>User: {user ? user.email : 'null'}</div>
        <div>Auth User: {authUser ? authUser.email : 'null'}</div>
        <div>DB User: {dbUser ? dbUser.email : 'null'}</div>
        <div>User Role: {user?.role || 'none'}</div>
        <div>Session User ID: {session?.user?.id || 'null'}</div>
        <div>Auth User ID: {authUser?.id || 'null'}</div>
        <div>DB User ID: {dbUser?.id || 'null'}</div>
      </div>
    </div>
  )
}
