#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Building standalone landing page...');

try {
  // Build the standalone version
  execSync('npx vite build --config vite.standalone.config.ts', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('✅ Standalone build completed successfully!');
  
  // Create index.html redirect file
  const distPath = path.join(process.cwd(), 'dist-standalone');
  const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Koi Sensei - Coming Soon</title>
    <meta name="description" content="Professional koi pond management solution coming soon. Monitor water quality, manage your koi collection, and gain insights into your pond health.">
    <script>
        // Replace the current page content with the standalone page content
        // This keeps the URL clean without redirecting
        fetch('./standalone-index.html')
            .then(response => response.text())
            .then(html => {
                document.open();
                document.write(html);
                document.close();
            })
            .catch(error => {
                console.error('Error loading page:', error);
                // Fallback: redirect if fetch fails
                window.location.href = './standalone-index.html';
            });
    </script>
</head>
<body>
    <p>Loading Koi Sensei...</p>
    <p>If the page doesn't load, <a href="./standalone-index.html">click here</a>.</p>
</body>
</html>`;

  const indexPath = path.join(distPath, 'index.html');
  fs.writeFileSync(indexPath, indexHtmlContent);

  console.log('📁 Output directory: dist-standalone/');
  console.log('🌐 You can now upload the contents of dist-standalone/ to your FTP server');
  console.log('📄 Added index.html redirect file for automatic server detection');
  
  // List the contents of the build directory
  if (fs.existsSync(distPath)) {
    console.log('\n📋 Build contents:');
    const files = fs.readdirSync(distPath, { recursive: true });
    files.forEach(file => {
      console.log(`   - ${file}`);
    });
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
