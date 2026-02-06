# 🎨 Switchboard - Self-Hosted Image Overlay Service

A production-ready, self-hosted replacement for Switchboard.ai API. Processes product images with custom overlays and stores them in Cloudflare R2.

**Live Demo**: https://switchboard-rust.vercel.app

---

## ✨ Features

- ✅ **Fast Image Processing** - High-performance image manipulation with Sharp
- ✅ **Cloudflare R2 Storage** - Unlimited, cost-effective object storage
- ✅ **Auto-Resize & Overlay** - Automatically resizes and composites images
- ✅ **Public URLs** - Returns publicly accessible R2 URLs
- ✅ **Switchboard.ai Compatible** - Drop-in replacement for existing integrations
- ✅ **Zero Cost** - Free tier covers most use cases (Vercel + Cloudflare R2)
- ✅ **CORS Enabled** - Works from Google Apps Script and browsers

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Cloudflare account (free)
- Vercel account (free)

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/switchboard.git
cd switchboard
npm install
```

### 2. Configure R2 Storage

1. **Create R2 Bucket**:
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
   - Create bucket (any name, e.g., `switchboard`)
   - Enable public access to get R2.dev subdomain

2. **Create R2 API Credentials**:
   - R2 → Manage R2 API Tokens → Create API Token
   - Permissions: Admin Read & Write
   - Copy Access Key ID and Secret Access Key

3. **Configure Environment Variables**:

Create `.env.local`:

```bash
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_BUCKET_NAME=your_bucket_name
R2_DEV_SUBDOMAIN=pub-xxxxx.r2.dev
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
```

### 3. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000/test.html to test the API.

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variables
vercel env add R2_ACCOUNT_ID production
vercel env add R2_BUCKET_NAME production
vercel env add R2_DEV_SUBDOMAIN production
vercel env add R2_ACCESS_KEY_ID production
vercel env add R2_SECRET_ACCESS_KEY production

# Deploy to production
vercel --prod
```

---

## 📖 API Reference

### POST /api/overlay

Creates an image overlay and uploads to R2 storage.

**Request:**

```bash
curl -X POST https://your-deployment.vercel.app/api/overlay \
  -H "Content-Type: application/json" \
  -d '{
    "template": "product-cover",
    "sizes": [{ "width": 1080, "height": 1080 }],
    "elements": {
      "product-image": { "url": "https://example.com/product.jpg" },
      "stt-cover": { "url": "https://example.com/overlay.png" }
    }
  }'
```

**Response:**

```json
{
  "sizes": [{
    "url": "https://pub-xxxxx.r2.dev/product-covers/timestamp-xxx.png",
    "width": 1080,
    "height": 1080,
    "key": "product-covers/timestamp-xxx.png"
  }],
  "template": "product-cover"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `template` | string | Yes | Template name (currently supports `product-cover`) |
| `sizes` | array | Yes | Array of size objects with `width` and `height` |
| `elements.product-image.url` | string | Yes | URL of the product image |
| `elements.stt-cover.url` | string | Yes | URL of the overlay image |
| `elements.product-title.text` | string | No | Text overlay (not yet implemented) |

**Error Response:**

```json
{
  "error": "Failed to process image overlay",
  "message": "Detailed error message"
}
```

---

## 🔌 Integration Examples

### Google Apps Script

Replace your existing Switchboard.ai integration:

```javascript
// OLD (Switchboard.ai)
const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';
const SWITCHBOARD_API_KEY = 'your-switchboard-key';

// NEW (Self-hosted)
const SWITCHBOARD_ENDPOINT = 'https://your-deployment.vercel.app/api/overlay';
const SWITCHBOARD_API_KEY = ''; // No key needed

function createProductCover(productImageUrl, title) {
  const payload = {
    template: 'product-cover',
    sizes: [{ width: 1080, height: 1080 }],
    elements: {
      'product-image': { url: productImageUrl },
      'stt-cover': { url: 'https://your-overlay-url.png' }
    }
  };

  const response = UrlFetchApp.fetch(SWITCHBOARD_ENDPOINT, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });

  const result = JSON.parse(response.getContentText());
  return result.sizes[0].url; // Returns R2 public URL
}
```

### JavaScript/Node.js

```javascript
async function generateOverlay(productImageUrl) {
  const response = await fetch('https://your-deployment.vercel.app/api/overlay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: 'product-cover',
      sizes: [{ width: 1080, height: 1080 }],
      elements: {
        'product-image': { url: productImageUrl },
        'stt-cover': { url: 'https://your-overlay-url.png' }
      }
    })
  });

  const result = await response.json();
  return result.sizes[0].url;
}
```

### cURL

```bash
curl -X POST https://your-deployment.vercel.app/api/overlay \
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

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ACCOUNT_ID` | Cloudflare account ID | `c445af539869ea686e60221bcf274752` |
| `R2_BUCKET_NAME` | R2 bucket name | `switchboard` |
| `R2_DEV_SUBDOMAIN` | R2 public subdomain | `pub-xxxxx.r2.dev` |
| `R2_ACCESS_KEY_ID` | R2 API access key ID | `a1ec15c6ab08f2d75ab3817dbaa13751` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret key | `d28d984f74962be17c3d77139fc8d77bc545fcf5c1bc47f68b6fead26e7661cf` |
| `R2_PUBLIC_DOMAIN` | Optional custom domain | `images.yourdomain.com` |

### Vercel Configuration (vercel.json)

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

### Image Limits

- **Max request body**: 10MB
- **Max image size**: 10000x10000 pixels
- **Download timeout**: 15 seconds
- **Supported formats**: JPEG, PNG, WebP, GIF, SVG

---

## 🏗️ Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Client    │─────▶│ Vercel API   │─────▶│ Cloudflare  │
│ (Browser/   │      │ (Next.js)    │      │ R2 Storage  │
│  Script)    │◀─────│              │      │             │
└─────────────┘      └──────────────┘      └─────────────┘
     │                      │                      │
     │  1. POST request     │  2. Process images   │
     │                      │  3. Upload to R2     │
     │  4. Return R2 URL◀───┘                      │
     │                                              │
     └──────────────────────────────────────────────┘
                5. Access image via public URL
```

**Flow:**
1. Client sends POST request with image URLs
2. Next.js API downloads and processes images with Sharp
3. Composite image uploaded to Cloudflare R2
4. API returns public R2 URL
5. Client accesses image directly from R2

---

## 📊 Performance & Costs

### Performance

- **Processing time**: 1-5 seconds (depending on image size)
- **Cold start**: ~1-2 seconds (Vercel serverless)
- **Warm requests**: <1 second
- **Global CDN**: Cloudflare's network (200+ cities)

### Cost Comparison

| Service | Cost | Limits |
|---------|------|--------|
| **Switchboard.ai** | $29-99/month | Limited API calls |
| **Self-hosted (this)** | $0/month | Generous free tiers |

**Breakdown:**
- **Vercel Free Tier**: 100GB bandwidth, 100h serverless execution/month
- **Cloudflare R2 Free Tier**: 10GB storage, 10M reads/month, unlimited writes
- **Estimated usage**: <1% of free tier limits for typical use

**Annual Savings**: $348 - $1,188 💰

---

## 🛠️ Tech Stack

- **[Next.js 15](https://nextjs.org/)** - React framework with API routes
- **[Sharp](https://sharp.pixelplumbing.com/)** - High-performance Node.js image processing
- **[AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)** - S3-compatible R2 client
- **[Cloudflare R2](https://developers.cloudflare.com/r2/)** - Object storage (S3-compatible)
- **[Vercel](https://vercel.com/)** - Serverless deployment platform

---

## 📁 Project Structure

```
switchboard/
├── pages/
│   ├── api/
│   │   └── overlay.js          # Main API endpoint
│   └── index.js                 # Landing page
├── lib/
│   ├── imageProcessor.js        # Sharp image processing logic
│   └── r2Storage.js             # R2 upload/download handlers
├── public/
│   └── test.html                # API testing page
├── .env.local                   # Environment variables (local)
├── vercel.json                  # Vercel configuration
├── package.json                 # Dependencies
├── STATUS.md                    # Project status
└── README.md                    # This file
```

---

## 🧪 Testing

### Local Testing

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open test page:
   ```
   http://localhost:3000/test.html
   ```

3. Or use cURL:
   ```bash
   curl -X POST http://localhost:3000/api/overlay \
     -H "Content-Type: application/json" \
     -d @test-request.json
   ```

### Production Testing

```bash
curl -X POST https://switchboard-rust.vercel.app/api/overlay \
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

---

## 🐛 Troubleshooting

### Error: "R2 credentials not configured"

- Verify environment variables are set in Vercel
- Run `vercel env ls` to check
- Re-add variables without trailing newlines:
  ```bash
  echo -n "your_value" | vercel env add VAR_NAME production
  ```

### Error: "Failed to download image"

- Check image URL is publicly accessible
- Verify URL returns valid image (not HTML/error page)
- Check if image is too large (>10MB)

### Error: "The specified bucket name is not valid"

- Verify `R2_BUCKET_NAME` matches your actual bucket name
- Check for trailing spaces/newlines in environment variable

### Images return 404

- Verify R2 bucket has public access enabled
- Check `R2_DEV_SUBDOMAIN` is correct
- Wait 1-2 minutes for R2 propagation

### Vercel deployment fails

- Run `npm run build` locally first to catch errors
- Check Node.js version (18+ required)
- Verify all dependencies are in `package.json`

---

## 📚 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Detailed deployment guide
- **[STATUS.md](./STATUS.md)** - Project status and configuration
- **[NEXT_STEPS.md](./NEXT_STEPS.md)** - Next steps after deployment
- **[GOOGLE_SCRIPT_INTEGRATION.md](./GOOGLE_SCRIPT_INTEGRATION.md)** - Google Apps Script integration

---

## 🤝 Contributing

This is a personal project, but feel free to fork and modify for your needs!

---

## 📄 License

MIT License - feel free to use this for any purpose.

---

## 🙏 Acknowledgments

- Built as a cost-effective replacement for [Switchboard.ai](https://switchboard.ai)
- Uses [Sharp](https://sharp.pixelplumbing.com/) for fast image processing
- Deployed on [Vercel](https://vercel.com) and [Cloudflare R2](https://developers.cloudflare.com/r2/)

---

## 📞 Support

For issues or questions:
1. Check the [troubleshooting section](#-troubleshooting)
2. Review Vercel logs: `vercel logs`
3. Check R2 bucket settings in Cloudflare Dashboard

---

**Built with ❤️ to save $348-$1,188/year on image processing**
