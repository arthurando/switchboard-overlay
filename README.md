# 🎨 Switchboard Image Overlay Service

Self-hosted replacement for Switchboard.ai API - overlays product images with custom frames/covers.

## Features

- ✅ **Fast Image Processing** - Uses Sharp for high-performance image manipulation
- ✅ **Auto-Resize** - Automatically resizes images to target dimensions
- ✅ **Overlay Composition** - Seamlessly composites overlay images on product photos
- ✅ **Temporary Serving** - Returns images directly (no storage required)
- ✅ **CORS Enabled** - Works from Google Apps Script and browsers

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

### 3. Test API

```bash
curl -X POST http://localhost:3000/api/overlay \
  -H "Content-Type: application/json" \
  -d '{
    "template": "product-cover",
    "sizes": [{ "width": 1080, "height": 1080 }],
    "elements": {
      "product-image": { "url": "https://cdn.shopify.com/s/files/1/0712/1135/2318/products/example.jpg" },
      "stt-cover": { "url": "https://i.postimg.cc/4dv39JsQ/cover.png" }
    }
  }' \
  --output result.png
```

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option 2: GitHub Integration

1. Push this code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Deploy (auto-detects Next.js)

### Option 3: Vercel Desktop

1. Install [Vercel Desktop](https://vercel.com/desktop)
2. Drag project folder into Vercel
3. Deploy

## API Reference

### POST /api/overlay

**Request Body:**
```json
{
  "template": "product-cover",
  "sizes": [{ "width": 1080, "height": 1080 }],
  "elements": {
    "product-image": { "url": "https://..." },
    "stt-cover": { "url": "https://..." },
    "product-title": { "text": "Optional title" }
  }
}
```

**Response:**
- Content-Type: `image/png`
- Returns processed image buffer

**Error Response:**
```json
{
  "error": "Error message",
  "message": "Detailed message"
}
```

## Google Apps Script Integration

After deploying, replace the Switchboard API call:

```javascript
// BEFORE (old Switchboard API)
const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';
const SWITCHBOARD_API_KEY = '9dde8637-7554-4741-a259-61216f790c79';

// AFTER (your self-hosted API)
const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay';
const SWITCHBOARD_API_KEY = ''; // No API key needed
```

The function signature remains the same - no code changes needed!

## Configuration

### Memory Limits (vercel.json)

```json
{
  "functions": {
    "pages/api/**/*.js": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

- **memory**: 1024MB (adjust if processing larger images)
- **maxDuration**: 30 seconds (Vercel Pro allows 60s)

### Image Limits

- Max request body: 10MB
- Max response size: 10MB
- Download timeout: 15 seconds
- Supported formats: JPEG, PNG, WebP, GIF, SVG

## Troubleshooting

### Error: "Failed to download image"

- Check image URL is publicly accessible
- Verify URL returns valid image format
- Check if image is too large (>10MB)

### Error: "Image processing failed"

- Ensure Sharp can decode the image format
- Check if overlay image has transparency (PNG recommended)
- Verify image dimensions are reasonable (<10000x10000)

### Deployment Issues

- **Vercel build fails**: Run `npm install` and `npm run build` locally first
- **Function timeout**: Reduce image sizes or increase maxDuration (Vercel Pro)
- **Out of memory**: Increase memory allocation in vercel.json

## Performance

- Typical processing time: **500ms - 2s**
- Vercel Edge Network: Global CDN delivery
- Cold start: ~1-2s (subsequent requests: <1s)

## Cost

- **Vercel Hobby (Free)**: 100GB bandwidth/month, 100 hours serverless execution
- **Vercel Pro ($20/mo)**: 1TB bandwidth, unlimited execution, 60s timeout

For your use case (occasional image generation), **Hobby tier is sufficient**.

## Local Development

```bash
npm run dev   # Start dev server (http://localhost:3000)
npm run build # Build for production
npm start     # Run production build locally
```

## Tech Stack

- **Next.js 14** - React framework with API routes
- **Sharp** - High-performance image processing (Node.js)
- **Axios** - HTTP client for downloading images
- **Vercel** - Serverless deployment platform

## License

MIT

## Support

For issues, check:
1. Console logs in Vercel dashboard
2. API response error messages
3. Network tab in browser DevTools
