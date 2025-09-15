# Standalone Landing Page Build

This directory contains the standalone version of the Koi Sensei landing page, ready for FTP upload.

## What's Included

- **standalone-index.html** - The main HTML file
- **assets/** - All CSS, JavaScript, and image files
- **favicon.ico** - Website icon
- **robots.txt** - Search engine instructions

## Features

✅ **No login functionality** - Clean landing page without authentication
✅ **Language switcher** - Dutch/English language support
✅ **Responsive design** - Works on all devices
✅ **Development messaging** - Clearly indicates app is in development
✅ **Professional appearance** - Ready for production use

## Upload Instructions

1. Upload all files from the `dist-standalone/` directory to your FTP server
2. Make sure `standalone-index.html` is accessible as your main page
3. The page will work immediately without any server-side requirements

## Troubleshooting

### "Forbidden" Error
If visitors get a "forbidden" error, make sure:
- All files are uploaded to the same directory
- The server supports relative paths (most do)
- File permissions are set correctly (644 for files, 755 for directories)

### Testing Locally
You can test the build locally by:
1. Opening `dist-standalone/test.html` in your browser
2. Clicking the link to the main page
3. Or using a local server: `cd dist-standalone && python -m http.server 8080`

## File Structure

```
dist-standalone/
├── index.html              (Auto-redirect to main page)
├── standalone-index.html   (Main landing page)
├── test.html              (Test page for verification)
├── assets/
│   ├── main-[hash].js     (JavaScript bundle)
│   ├── main-[hash].css    (Styles)
│   └── koi-sensei-logo-[hash].svg
├── favicon.ico
├── placeholder.svg
└── robots.txt
```

## How It Works

- **index.html** - Loads the main page content without changing the URL (keeps URL clean)
- **standalone-index.html** - The actual landing page with all functionality
- **Clean URLs** - Visitors see `yoursite.com/` instead of `yoursite.com/standalone-index.html`

### URL Behavior
- **Visit** `yoursite.com/` → Shows landing page, URL stays `yoursite.com/`
- **Visit** `yoursite.com/standalone-index.html` → Also works directly
- **No redirect** - Content is loaded dynamically to keep URL clean

## Rebuilding

To rebuild the standalone version:

```bash
npm run build:standalone
```

This will create a fresh `dist-standalone/` directory with the latest changes.
