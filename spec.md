# Switchboard - Image Overlay Service

## Overview

Self-hosted image overlay API that replaces Switchboard.ai subscription service. Processes product images with custom overlays (text, images) and stores the composited results in Cloudflare R2 storage. Built as a drop-in replacement for Switchboard.ai with API-compatible response format.

**Purpose:** Generate product cover images with branded overlays for STT Mall e-commerce at near-zero cost.

---

## Features

### 1. Image Compositing
- Sharp-based image processing for fast, high-quality results
- Multi-layer image overlay composition
- Automatic image resizing and fitting
- Multiple output sizes from single request
- PNG output with transparency support

### 2. Text Overlays
- Custom font support (Elle Bold, Noto Sans TC)
- Chinese and English typography
- Configurable text positioning, sizing, and styling
- Font file bundling for serverless deployment

### 3. Cloudflare R2 Storage
- S3-compatible object storage
- Public URL generation for processed images
- Automatic file naming with timestamps
- No egress fees (unlike AWS S3)

### 4. API Compatibility
- Drop-in replacement for Switchboard.ai API
- JSON request/response format
- CORS enabled for Google Apps Script integration
- 10MB request body limit

### 5. Template System
- Predefined layout templates (e.g., "product-cover")
- Element positioning and sizing
- Support for image URLs and text content
- Extensible template definitions

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (Pages Router) |
| **Runtime** | Node.js 18+ |
| **Image Processing** | Sharp 0.33 |
| **Storage** | Cloudflare R2 (S3-compatible) |
| **Storage SDK** | AWS SDK v3 (@aws-sdk/client-s3) |
| **HTTP Client** | Axios 1.6 |
| **Deployment** | Vercel |
| **Language** | JavaScript (Node.js) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SWITCHBOARD API                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/overlay                                              │
│     │                                                           │
│     ├──► 1. Parse Request (template, sizes, elements)          │
│     │                                                           │
│     ├──► 2. Process Each Size                                  │
│     │      │                                                    │
│     │      ├──► Fetch Images (product, overlay)                │
│     │      │                                                    │
│     │      ├──► Composite with Sharp                           │
│     │      │      ├─ Resize base image                         │
│     │      │      ├─ Overlay images                            │
│     │      │      └─ Add text layers                           │
│     │      │                                                    │
│     │      └──► Upload to R2                                   │
│     │             └─ Generate public URL                       │
│     │                                                           │
│     └──► 3. Return Results                                     │
│            { sizes: [{ url, width, height }] }                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### POST /api/overlay

Generate composite image with overlays.

**Request Body:**
```json
{
  "template": "product-cover",
  "sizes": [
    { "width": 1080, "height": 1080 },
    { "width": 800, "height": 800 }
  ],
  "elements": {
    "product-image": {
      "url": "https://example.com/product.jpg"
    },
    "stt-cover": {
      "url": "https://example.com/overlay.png"
    },
    "product-title": {
      "text": "Product Name",
      "fontSize": 48,
      "color": "#000000"
    }
  }
}
```

**Response:**
```json
{
  "sizes": [
    {
      "url": "https://pub-xxxxx.r2.dev/overlay-1234567890.png",
      "width": 1080,
      "height": 1080
    },
    {
      "url": "https://pub-xxxxx.r2.dev/overlay-1234567891.png",
      "width": 800,
      "height": 800
    }
  ]
}
```

**Response Format:** Switchboard.ai-compatible JSON structure for drop-in replacement.

### GET /api/debug-fonts

Debugging endpoint to verify font file availability in serverless environment.

**Response:**
```json
{
  "fontsDir": "/var/task/fonts",
  "exists": true,
  "files": ["elle-bold.ttf", "NotoSansTC.ttf"]
}
```

---

## Template System

### Product-Cover Template

Default template for STT Mall product images.

**Layout:**
- Base canvas: Specified width × height
- Product image: Fitted to canvas, maintain aspect ratio
- Overlay image: Positioned on top (e.g., branded frame)
- Text layers: Title, description, price (optional)

**Element Types:**
- `product-image` - Main product photo (URL)
- `stt-cover` - Brand overlay frame (URL)
- `product-title` - Product name (text)
- `product-description` - Product details (text)
- `product-price` - Price display (text)

**Configuration:**
```javascript
{
  template: "product-cover",
  elements: {
    "product-image": { url: "..." },
    "stt-cover": { url: "..." },
    "product-title": { text: "...", fontSize: 48 }
  }
}
```

---

## Storage Configuration

### Cloudflare R2

**Bucket:** Configured via `R2_BUCKET_NAME` env var
**Public Access:** Enabled via R2 public subdomain (`pub-xxxxx.r2.dev`)
**Region:** Auto (Cloudflare global network)
**Pricing:** Free tier (10 GB storage, unlimited egress)

**File Naming:**
- Format: `overlay-{timestamp}.png`
- Example: `overlay-1738901234567.png`
- Unique per request to avoid collisions

**S3-Compatible Endpoint:**
```
https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

---

## Environment Variables

Required in Vercel deployment:

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET_NAME` | R2 bucket name for image storage |
| `R2_DEV_SUBDOMAIN` | R2 public subdomain (e.g., `pub-xxxxx.r2.dev`) |
| `R2_ACCESS_KEY_ID` | R2 API access key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API secret access key |

All credentials stored in Vercel project settings (never in code).

---

## Font System

### Included Fonts

Located in `fonts/` directory:
- `elle-bold.ttf` - English branding font
- `NotoSansTC.ttf` - Traditional Chinese font

### Vercel Deployment Considerations

**Problem:** Serverless functions exclude non-JS files unless explicitly traced.

**Solution:** Explicit file references in API route for Vercel's @vercel/nft bundler:

```javascript
const _fontTraceRefs = [
  path.join(process.cwd(), 'fonts', 'elle-bold.ttf'),
  path.join(process.cwd(), 'fonts', 'NotoSansTC.ttf'),
].filter(p => fs.existsSync(p));
```

This ensures font files are included in the serverless bundle.

---

## Integration

### Google Apps Script

Primary consumer of the API. Used in Google Sheets automation for bulk product image generation.

**CORS:** Enabled to allow Apps Script requests
**Authentication:** None (publicly accessible API)
**Rate Limiting:** None (low volume use case)

**Sample Integration:**
```javascript
function generateProductCover(productUrl, overlayUrl, title) {
  const payload = {
    template: "product-cover",
    sizes: [{ width: 1080, height: 1080 }],
    elements: {
      "product-image": { url: productUrl },
      "stt-cover": { url: overlayUrl },
      "product-title": { text: title }
    }
  };

  const response = UrlFetchApp.fetch(
    "https://switchboard-rust.vercel.app/api/overlay",
    {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    }
  );

  const result = JSON.parse(response.getContentText());
  return result.sizes[0].url; // R2 public URL
}
```

---

## Deployment

**Platform:** Vercel
**Production URL:** `https://switchboard-rust.vercel.app`
**Region:** Auto (Vercel Edge Network)
**Build Command:** `npm run build`
**Output Directory:** `.next`

### Deployment Process

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to production
vercel --prod

# Set environment variables
vercel env add R2_ACCOUNT_ID
vercel env add R2_BUCKET_NAME
# ... etc
```

**Auto-deployment:** Enabled on git push to main branch (GitHub integration).

---

## Cost Analysis

### Before (Switchboard.ai)
- **Subscription:** $29-99/month ($348-1,188/year)
- **Usage limits:** Tier-based pricing
- **Lock-in:** Vendor dependency

### After (Self-hosted)
- **Vercel Hosting:** $0/month (Hobby tier)
- **Cloudflare R2:** $0/month (Free tier: 10GB storage, unlimited egress)
- **Total:** $0/month (within free tiers)

**Annual Savings:** $348 - $1,188

---

## Development

### Local Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with R2 credentials

# Run development server
npm run dev

# Open test page
http://localhost:3000/test.html
```

### Test API

```bash
curl -X POST http://localhost:3000/api/overlay \
  -H "Content-Type: application/json" \
  -d '{
    "template": "product-cover",
    "sizes": [{"width": 1080, "height": 1080}],
    "elements": {
      "product-image": {"url": "https://example.com/product.jpg"},
      "stt-cover": {"url": "https://example.com/overlay.png"}
    }
  }'
```

### Debug Fonts

```bash
curl http://localhost:3000/api/debug-fonts
```

---

## Key Files

| File | Purpose |
|------|---------|
| `pages/api/overlay.js` | Main API endpoint for image compositing |
| `pages/api/debug-fonts.js` | Font debugging endpoint |
| `lib/imageProcessor.js` | Sharp-based image processing logic |
| `lib/r2Storage.js` | Cloudflare R2 upload and URL generation |
| `lib/fontLoader.js` | Font file loading utilities |
| `pages/index.js` | Landing page |
| `pages/test.html` | Manual testing interface |
| `fonts/` | Font files (elle-bold.ttf, NotoSansTC.ttf) |
| `next.config.js` | Next.js configuration |
| `vercel.json` | Vercel deployment config |

---

## Error Handling

### Common Errors

**Font Loading Failed:**
- Check font files exist in `fonts/` directory
- Verify Vercel bundled fonts (check with `/api/debug-fonts`)
- Ensure `_fontTraceRefs` in overlay.js

**Image Download Failed:**
- Verify image URLs are accessible
- Check CORS on source images
- Increase timeout for large images

**R2 Upload Failed:**
- Verify R2 credentials in environment variables
- Check R2 bucket exists and is accessible
- Verify R2_DEV_SUBDOMAIN matches bucket config

**Sharp Processing Error:**
- Check image format is supported (JPEG, PNG, WebP)
- Verify image is not corrupted
- Check memory limits in Vercel (10MB max for Hobby tier)

---

## Performance

**Average Request Time:** 2-4 seconds (1080x1080 image)
- Image download: ~500ms
- Sharp processing: ~1s
- R2 upload: ~500ms
- Network overhead: ~500ms

**Concurrent Requests:** Handled by Vercel serverless (auto-scaling)
**Max Image Size:** 10MB (Vercel body limit)

---

## Future Enhancements

- [ ] Image caching to avoid reprocessing identical requests
- [ ] Additional templates (social media, email headers)
- [ ] Batch processing API for multiple images
- [ ] Webhook support for async processing
- [ ] Analytics and usage tracking
- [ ] Authentication and API key system
- [ ] Rate limiting for public API

---

## Notes

- Drop-in replacement for Switchboard.ai with compatible API format
- Zero monthly cost within Vercel and Cloudflare free tiers
- Deployed to production: `switchboard-rust.vercel.app`
- GitHub repository: `arthurando/switchboard-overlay` (private)
- Primary consumer: Google Apps Script in STT Mall product pipeline
- Font files must be explicitly traced for Vercel bundling
- R2 public URLs never expire (static hosting)
