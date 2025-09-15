import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function DatabaseTest() {
  const [testResult, setTestResult] = useState<string>('Testing...')

  useEffect(() => {
    const testDatabase = async () => {
      try {
        // Test basic connection
        const { data, error } = await supabase
          .from('users')
          .select('count')
          .limit(1)
        
        if (error) {
          setTestResult(`Database Error: ${error.message}`)
        } else {
          setTestResult('Database connection: OK')
        }
      } catch (err) {
        setTestResult(`Connection Error: ${err}`)
      }
    }

    testDatabase()
  }, [])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed top-4 right-4 bg-red-500 text-white p-2 rounded text-xs">
      DB Test: {testResult}
    </div>
  )
}
