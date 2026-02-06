# 🪣 Cloudflare R2 Setup Guide

## Why R2?

✅ **More stable** than Google Drive for programmatic access
✅ **Better performance** - CDN integration, faster URLs
✅ **Free tier** - 10GB storage, 1 million Class A operations/month
✅ **Auto-cleanup** - Delete images after upload to save storage
✅ **S3-compatible** - Industry standard, well-supported

**Cost**: FREE for your use case (well under limits)

---

## Step 1: Create Cloudflare Account (2 minutes)

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email (free account)
3. Verify email

**No credit card required for R2!**

---

## Step 2: Create R2 Bucket (3 minutes)

### 2.1 Enable R2

1. Login to Cloudflare Dashboard
2. Click **R2** in sidebar
3. Click **Purchase R2 Plan** (select FREE plan - $0/month)
4. Confirm

### 2.2 Create Bucket

1. Click **Create bucket**
2. Bucket name: `switchboard-images` (or your choice)
3. Location: **Automatic** (closest to your users)
4. Click **Create bucket**

### 2.3 Enable Public Access (Important!)

1. Select your bucket
2. Click **Settings** tab
3. Under **Public access**:
   - Toggle **Allow Access** to ON
   - Copy the **R2.dev subdomain** (e.g., `pub-abc123.r2.dev`)
   - Save this - you'll need it later!

---

## Step 3: Create API Token (2 minutes)

### 3.1 Generate Token

1. In Cloudflare Dashboard, go to **R2**
2. Click **Manage R2 API Tokens**
3. Click **Create API Token**
4. Configure:
   - **Token name**: `Switchboard API`
   - **Permissions**:
     - ✅ Object Read & Write
     - ✅ Allow Edit (for delete operations)
   - **Specify bucket**: Select `switchboard-images`
   - **TTL**: No expiry
5. Click **Create API Token**

### 3.2 Save Credentials

You'll see:
- **Access Key ID**: `abc123...`
- **Secret Access Key**: `xyz789...`
- **Account ID**: Your Cloudflare account ID

**⚠️ IMPORTANT**: Copy these NOW - you can't view them again!

Save them securely:
```
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=switchboard-images
R2_DEV_SUBDOMAIN=pub-abc123.r2.dev
```

---

## Step 4: Configure Vercel Environment Variables (3 minutes)

### 4.1 Add to Vercel

**Via Vercel Dashboard**:

1. Go to https://vercel.com/dashboard
2. Select your Switchboard project
3. Click **Settings** → **Environment Variables**
4. Add each variable:

| Name | Value | Example |
|------|-------|---------|
| `R2_ACCOUNT_ID` | Your Cloudflare account ID | `abc123def456` |
| `R2_ACCESS_KEY_ID` | API token access key | `1234567890abcdef` |
| `R2_SECRET_ACCESS_KEY` | API token secret | `secretkey123456` |
| `R2_BUCKET_NAME` | Bucket name | `switchboard-images` |
| `R2_DEV_SUBDOMAIN` | R2.dev subdomain | `pub-abc123.r2.dev` |

5. Click **Save** for each
6. **Redeploy** your project for changes to take effect

**Via Vercel CLI**:

```bash
cd "C:\Users\user\Claude Project\projects\Switchboard"

vercel env add R2_ACCOUNT_ID
# Paste your account ID

vercel env add R2_ACCESS_KEY_ID
# Paste your access key

vercel env add R2_SECRET_ACCESS_KEY
# Paste your secret key

vercel env add R2_BUCKET_NAME
# Enter: switchboard-images

vercel env add R2_DEV_SUBDOMAIN
# Paste your R2.dev subdomain

# Redeploy
vercel --prod
```

### 4.2 Local Development (.env.local)

Create `.env.local` for local testing:

```bash
cd "C:\Users\user\Claude Project\projects\Switchboard"
```

Create file `.env.local`:
```env
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_here
R2_SECRET_ACCESS_KEY=your_secret_key_here
R2_BUCKET_NAME=switchboard-images
R2_DEV_SUBDOMAIN=pub-abc123.r2.dev
```

**⚠️ Never commit .env.local to git!** (Already in .gitignore)

---

## Step 5: Test R2 Integration (2 minutes)

### 5.1 Install Updated Dependencies

```bash
cd "C:\Users\user\Claude Project\projects\Switchboard"
npm install
```

### 5.2 Test Locally

```bash
npm run dev
```

Visit http://localhost:3000/test.html and click "Generate Overlay"

**Expected**:
- Image processes successfully
- Returns JSON: `{ "sizes": [{ "url": "https://pub-abc123.r2.dev/..." }] }`
- Opening URL shows the image

### 5.3 Verify in R2

1. Go to Cloudflare Dashboard → R2 → Your bucket
2. Click **Objects** tab
3. You should see: `product-covers/TIMESTAMP-RANDOM.png`
4. Click the file → Copy object URL
5. Open in browser - should show the image!

---

## Step 6: Deploy & Test Live (2 minutes)

```bash
vercel --prod
```

Test your production API:

```bash
curl -X POST https://YOUR_URL.vercel.app/api/overlay \
  -H "Content-Type: application/json" \
  -d '{"template":"product-cover","sizes":[{"width":1080,"height":1080}],"elements":{"product-image":{"url":"https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png"},"stt-cover":{"url":"https://i.postimg.cc/4dv39JsQ/cover.png"}}}'
```

**Expected response**:
```json
{
  "sizes": [
    {
      "url": "https://pub-abc123.r2.dev/product-covers/1234567890-abc.png",
      "width": 1080,
      "height": 1080,
      "key": "product-covers/1234567890-abc.png"
    }
  ],
  "template": "product-cover"
}
```

---

## Step 7: Update Google Apps Script (SIMPLIFIED!)

### ✅ GOOD NEWS: Minimal Changes!

The API now returns JSON (same as old Switchboard), so your script needs **almost no changes**:

**Only change these 2 lines**:

```javascript
// OLD
const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';
const SWITCHBOARD_API_KEY = '9dde8637-7554-4741-a259-61216f790c79';

// NEW
const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay';
const SWITCHBOARD_API_KEY = ''; // Empty
```

**That's it!** 🎉

Everything else works exactly the same because:
- ✅ API returns same JSON format
- ✅ `createProductCover_()` unchanged
- ✅ `extractSwitchboardUrl_()` unchanged
- ✅ `fetchJson_()` unchanged
- ✅ No Google Drive code needed
- ✅ No new functions to add

---

## R2 Free Tier Limits

| Resource | Free Tier | Your Usage | Status |
|----------|-----------|------------|--------|
| **Storage** | 10 GB/month | ~0.1 GB (1000 images) | ✅ 1% used |
| **Class A ops** | 1M/month | ~5K (daily uploads) | ✅ 0.5% used |
| **Class B ops** | 10M/month | ~10K (daily reads) | ✅ 0.1% used |
| **Egress** | Free | Unlimited | ✅ FREE |

**Estimated usage**:
- 100 images/day = 3,000/month
- 1 MB/image = 3 GB storage
- Well under all limits! ✅

**Cost**: $0.00/month for your usage

---

## Optional: Custom Domain (Recommended)

For professional URLs like `https://images.yourdomain.com`

### Prerequisites
- Own a domain (can be managed by Cloudflare)

### Setup

1. **Add Domain to Cloudflare** (if not already):
   - Cloudflare Dashboard → Add Site
   - Follow DNS setup instructions

2. **Create R2 Custom Domain**:
   - R2 → Your bucket → Settings
   - Under **Custom Domains**, click **Connect Domain**
   - Enter: `images.yourdomain.com` (or subdomain of your choice)
   - Click **Connect domain**

3. **Update Environment Variable**:
   ```bash
   vercel env add R2_PUBLIC_DOMAIN
   # Enter: images.yourdomain.com

   # Remove R2_DEV_SUBDOMAIN (no longer needed)
   vercel env rm R2_DEV_SUBDOMAIN

   # Redeploy
   vercel --prod
   ```

**Result**: Images now use `https://images.yourdomain.com/...` instead of R2.dev URLs

---

## Automatic Cleanup (Optional)

Images are stored temporarily. Set up auto-cleanup to save storage:

### Option 1: Vercel Cron Job

Create `pages/api/cleanup.js`:

```javascript
import { cleanupOldImages } from '../../lib/r2Storage';

export default async function handler(req, res) {
  // Verify cron secret for security
  if (req.headers['x-vercel-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const deletedCount = await cleanupOldImages(24); // 24 hours
    return res.json({ success: true, deleted: deletedCount });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Set environment variable:
```bash
vercel env add CRON_SECRET
# Enter a random secret key
```

**Result**: Runs daily at 2 AM, deletes images older than 24 hours

### Option 2: Cloudflare Workers (Advanced)

Use Cloudflare Workers for more control over cleanup logic.

---

## Troubleshooting

### Error: "R2 credentials not configured"

**Solution**: Verify environment variables are set:
```bash
vercel env ls
```

Should show all R2_* variables.

### Error: "Failed to upload to R2"

**Check**:
1. R2 API token has correct permissions
2. Bucket name matches `R2_BUCKET_NAME`
3. Account ID is correct
4. Check Vercel function logs: `vercel logs`

### Images not appearing when opened

**Check**:
1. Bucket has **public access** enabled
2. R2.dev subdomain is correct
3. Try accessing URL directly in browser
4. Check Cloudflare R2 logs for access errors

### "No such bucket" error

**Solution**: Verify bucket name in env vars matches actual bucket name (case-sensitive)

---

## Summary

✅ **Setup time**: ~15 minutes
✅ **Cost**: $0.00/month
✅ **Storage**: Temporary (auto-cleanup available)
✅ **Performance**: Fast global CDN
✅ **Reliability**: 99.9% uptime SLA
✅ **Integration**: Same as old Switchboard API

**vs Google Drive**:
- ✅ More stable for programmatic access
- ✅ Better performance (CDN)
- ✅ Simpler Google Script (no Drive API code)
- ✅ Professional URLs
- ✅ Built-in cleanup options

**Next steps**:
1. ✅ R2 bucket created
2. ✅ API tokens configured
3. ✅ Vercel env vars set
4. ✅ Code deployed
5. ⏭️ Update Google Script (2 lines!)
6. ⏭️ Test end-to-end

You're ready to go! 🚀
