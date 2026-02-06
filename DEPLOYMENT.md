# 🚀 Deployment Guide

## Prerequisites

- Node.js 18+ installed
- Vercel account (free tier works)
- Git installed

## Step-by-Step Deployment

### 1. Install Dependencies

```bash
cd "C:\Users\user\Claude Project\projects\Switchboard"
npm install
```

### 2. Test Locally

```bash
npm run dev
```

Visit http://localhost:3000

Test the API:
```bash
curl -X POST http://localhost:3000/api/overlay \
  -H "Content-Type: application/json" \
  -d "{\"template\":\"product-cover\",\"sizes\":[{\"width\":1080,\"height\":1080}],\"elements\":{\"product-image\":{\"url\":\"https://cdn.shopify.com/s/files/1/0712/1135/2318/products/example.jpg\"},\"stt-cover\":{\"url\":\"https://i.postimg.cc/4dv39JsQ/cover.png\"}}}" \
  --output test-result.png
```

### 3. Deploy to Vercel

#### Option A: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Scope: Your account
# - Link to existing project? No
# - Project name: switchboard-overlay (or your choice)
# - Directory: ./
# - Override settings? No

# Deploy to production
vercel --prod
```

You'll get a URL like: `https://switchboard-overlay.vercel.app`

#### Option B: GitHub + Vercel

1. **Create GitHub repository**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Switchboard overlay service"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/switchboard-overlay.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your GitHub repo
   - Click "Deploy"

#### Option C: Vercel Desktop

1. Download Vercel Desktop from https://vercel.com/desktop
2. Drag the `Switchboard` folder into Vercel
3. Click "Deploy"

### 4. Get Your API URL

After deployment, you'll receive a URL like:
```
https://switchboard-overlay-abc123.vercel.app
```

Your API endpoint is:
```
https://switchboard-overlay-abc123.vercel.app/api/overlay
```

### 5. Update Google Apps Script

1. Open your Google Sheets script editor
2. Find this line:
   ```javascript
   const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';
   ```

3. Replace with:
   ```javascript
   const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay';
   ```

4. Remove the API key (no longer needed):
   ```javascript
   const SWITCHBOARD_API_KEY = ''; // Empty now
   ```

5. Copy the new functions from `google-script-revised.js`:
   - `createProductCover_()`
   - `fetchImageAndSave_()`
   - `getDriveFolder_()`

### 6. Test End-to-End

Run this test function in Google Apps Script:

```javascript
function testSwitchboard() {
  const testImageUrl = 'https://cdn.shopify.com/s/files/1/0712/1135/2318/products/example.jpg';
  const testTitle = 'Test Product Title';

  Logger.log('Testing Switchboard...');

  const result = createProductCover_(testImageUrl, testTitle);

  Logger.log('✅ Success! Result URL: ' + result);

  // Try opening the URL
  Logger.log('Open this URL to view the image:');
  Logger.log(result);
}
```

## Verification Checklist

- [ ] Local development works (`npm run dev`)
- [ ] Vercel deployment succeeded
- [ ] API endpoint returns images (test with curl/Postman)
- [ ] Google Apps Script can call the API
- [ ] Images save to Google Drive
- [ ] Drive URLs are publicly accessible
- [ ] Pabbly receives the correct URLs

## Monitoring

### Vercel Dashboard

- View logs: https://vercel.com/dashboard/deployments
- Check function executions, errors, and performance
- Monitor bandwidth usage

### Google Apps Script

- View execution logs in Apps Script editor
- Check Google Drive folder: "Product Covers - Switchboard"

## Troubleshooting

### Error: "Failed to download image"

**Cause:** API can't access the source image URL

**Fix:**
- Verify image URL is publicly accessible
- Check URL returns valid image (not HTML error page)
- Test URL in browser

### Error: "HTTP 500" from Vercel

**Cause:** Server error processing image

**Fix:**
1. Check Vercel logs: `vercel logs`
2. Look for Sharp errors (unsupported format)
3. Verify both images are valid

### Error: "Expected image response, got: application/json"

**Cause:** API returned error instead of image

**Fix:**
- Check Vercel function logs for the actual error
- Verify SWITCHBOARD_ENDPOINT is correct (should end with `/api/overlay`)
- Test API directly with curl

### Images not showing in Facebook/Pabbly

**Cause:** Google Drive URL format issue

**Fix:**

Try different URL formats in `fetchImageAndSave_()`:

```javascript
// Option 1: Direct view (current)
return `https://drive.google.com/uc?export=view&id=${file.getId()}`;

// Option 2: Thumbnail
return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1080`;

// Option 3: Download
return `https://drive.google.com/uc?export=download&id=${file.getId()}`;
```

### Function timeout (30s limit exceeded)

**Upgrade to Vercel Pro** for 60s timeout, or:

1. Reduce image size before processing
2. Use smaller overlay images
3. Optimize Sharp settings:
   ```javascript
   .png({ quality: 80, compressionLevel: 9 })
   ```

## Performance Optimization

### Reduce Bandwidth

Enable caching:
```javascript
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
```

### Speed Up Processing

1. **Resize images before overlaying:**
   ```javascript
   const MAX_SIZE = 2000; // Limit input images
   if (metadata.width > MAX_SIZE || metadata.height > MAX_SIZE) {
     // Resize first
   }
   ```

2. **Use WebP format** (smaller file size):
   ```javascript
   .webp({ quality: 85 })
   ```

## Cost Estimates

### Vercel Hobby (Free)

- ✅ 100 GB bandwidth/month
- ✅ 100 hours serverless function execution
- ✅ Unlimited deployments
- ⚠️ 30s function timeout

**Your usage:**
- ~2 seconds per image
- 100 hours = 180,000 images/month
- More than enough for your needs

### Google Drive (Free)

- 15 GB storage (shared with Gmail, Photos)
- Unlimited traffic
- ~15,000 images at 1MB each

**Cleanup script** (delete old images):
```javascript
function cleanupOldImages() {
  const folder = getDriveFolder_();
  const files = folder.getFiles();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30); // Keep 30 days

  let deleted = 0;
  while (files.hasNext()) {
    const file = files.next();
    if (file.getDateCreated() < cutoff) {
      file.setTrashed(true);
      deleted++;
    }
  }

  Logger.log(`Cleaned up ${deleted} old images`);
}
```

## Security Recommendations

### Add API Key Authentication (Optional)

1. **In Vercel, add environment variable:**
   - Key: `SWITCHBOARD_API_KEY`
   - Value: (generate random key)

2. **Update API route:**
   ```javascript
   const apiKey = req.headers['x-api-key'];
   if (apiKey !== process.env.SWITCHBOARD_API_KEY) {
     return res.status(401).json({ error: 'Unauthorized' });
   }
   ```

3. **Update Google Script:**
   ```javascript
   function fetchImageAndSave_(url, payload) {
     const options = {
       method: 'post',
       contentType: 'application/json',
       headers: {
         'X-API-Key': 'YOUR_SECRET_KEY_HERE'
       },
       payload: JSON.stringify(payload),
       muteHttpExceptions: true
     };
     // ... rest of code
   }
   ```

### Rate Limiting

Add to `pages/api/overlay.js`:
```javascript
const rateLimit = {};

function checkRateLimit(ip) {
  const now = Date.now();
  const limit = 60; // requests per minute

  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 1, resetAt: now + 60000 };
    return true;
  }

  if (now > rateLimit[ip].resetAt) {
    rateLimit[ip] = { count: 1, resetAt: now + 60000 };
    return true;
  }

  if (rateLimit[ip].count >= limit) {
    return false;
  }

  rateLimit[ip].count++;
  return true;
}

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // ... rest of handler
}
```

## Next Steps

✅ Deploy and test
✅ Update Google Script
✅ Monitor first few runs
⏭️ Consider adding authentication
⏭️ Set up cleanup script for old images
⏭️ Monitor Vercel usage dashboard

## Support

If you encounter issues:
1. Check Vercel logs: `vercel logs --follow`
2. Check Google Apps Script logs
3. Test API with Postman/curl
4. Review this troubleshooting guide
