// Script to execute database extensions for Sprint 1
// This script will run the SQL commands to create the new tables

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Supabase credentials
const supabaseUrl = 'https://pbpuvumeshaeplbwbwzv.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBicHV2dW1lc2hhZXBsYndid3p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzQ0NzYwMywiZXhwIjoyMDczMDIzNjAzfQ.YourServiceKeyHere'

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function executeDatabaseExtensions() {
  try {
    console.log('🚀 Starting database extensions for Sprint 1...')
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'sprint1-database-extensions.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        try {
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement })
          
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error.message)
            // Continue with next statement
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`)
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message)
        }
      }
    }
    
    console.log('🎉 Database extensions completed!')
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message)
    process.exit(1)
  }
}

// Check if we have the service key
if (!supabaseServiceKey || supabaseServiceKey.includes('YourServiceKeyHere')) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required')
  console.log('Please set the SUPABASE_SERVICE_KEY environment variable with your service role key')
  process.exit(1)
}

executeDatabaseExtensions()
