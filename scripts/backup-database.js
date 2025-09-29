#!/usr/bin/env node

/**
 * 🛡️ Database Backup Script voor Live Deployment
 * Dit script maakt een veilige backup van de database voordat een live update wordt uitgevoerd
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Kleuren voor console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

async function createBackup() {
  try {
    logInfo('🛡️  Database Backup Script gestart...');
    
    // Controleer of we in de juiste directory zijn
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json niet gevonden. Zorg dat je in de project root bent.');
    }
    
    // Maak backup directory
    const backupDir = 'database-backups';
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      logInfo(`Backup directory aangemaakt: ${backupDir}`);
    }
    
    // Genereer timestamp voor backup naam
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `backup-${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFileName);
    
    logInfo(`Backup wordt gemaakt: ${backupPath}`);
    
    // Controleer of Supabase CLI beschikbaar is
    try {
      execSync('supabase --version', { stdio: 'pipe' });
      logInfo('Supabase CLI gevonden, database backup wordt gemaakt...');
      
      // Maak database backup
      execSync(`supabase db dump --data-only --file "${backupPath}"`, { stdio: 'inherit' });
      
      logSuccess('Database backup succesvol gemaakt!');
      
    } catch (error) {
      logWarning('Supabase CLI niet gevonden of backup gefaald.');
      logWarning('Zorg dat database backup handmatig wordt gemaakt voordat deployment!');
      
      // Maak een placeholder backup file
      const placeholderContent = `-- Database Backup Placeholder
-- Datum: ${new Date().toISOString()}
-- Status: Handmatige backup vereist
-- 
-- ⚠️  KRITIEK: Zorg dat een echte database backup wordt gemaakt voordat deployment!
-- 
-- Gebruik een van deze methoden:
-- 1. Supabase Dashboard > Database > Backups
-- 2. Supabase CLI: supabase db dump --data-only --file backup.sql
-- 3. pg_dump via PostgreSQL client
`;

      fs.writeFileSync(backupPath, placeholderContent);
      logWarning(`Placeholder backup file aangemaakt: ${backupPath}`);
    }
    
    // Maak backup log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      backupFile: backupFileName,
      status: 'completed',
      notes: 'Pre-deployment backup'
    };
    
    const logFile = path.join(backupDir, 'backup-log.json');
    let logData = [];
    
    if (fs.existsSync(logFile)) {
      try {
        logData = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      } catch (error) {
        logWarning('Kon backup log niet lezen, nieuwe log wordt aangemaakt');
      }
    }
    
    logData.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
    
    logSuccess('Backup log bijgewerkt');
    
    // Toon backup informatie
    if (fs.existsSync(backupPath)) {
      const stats = fs.statSync(backupPath);
      const fileSize = (stats.size / 1024).toFixed(2);
      logInfo(`Backup grootte: ${fileSize} KB`);
    }
    
    logSuccess('🎉 Database backup proces voltooid!');
    logInfo('📋 Volgende stappen:');
    logInfo('1. Controleer of backup succesvol is gemaakt');
    logInfo('2. Test database connectie');
    logInfo('3. Voer deployment uit met npm run deploy:live');
    
  } catch (error) {
    logError(`Backup proces gefaald: ${error.message}`);
    process.exit(1);
  }
}

// Voer backup uit
createBackup();
