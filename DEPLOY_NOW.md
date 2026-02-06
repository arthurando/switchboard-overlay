# 🚀 Deploy to Vercel (2 Minutes)

## ✅ GitHub Repo Created
**Repository**: https://github.com/arthurando/switchboard-overlay

## 🎯 Quick Deploy via Vercel Web UI

### Step 1: Import from GitHub (1 minute)

1. **Go to Vercel**: https://vercel.com/new
2. **Import Git Repository**
3. **Search for**: `switchboard-overlay`
4. **Click "Import"**

### Step 2: Configure Environment Variables (1 minute)

Before clicking "Deploy", add these environment variables:

Click **"Environment Variables"** and add:

| Name | Value | Where to Get It |
|------|-------|-----------------|
| `R2_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard → R2 |
| `R2_ACCESS_KEY_ID` | Your R2 access key | From your existing R2 API token |
| `R2_SECRET_ACCESS_KEY` | Your R2 secret key | From your existing R2 API token |
| `R2_BUCKET_NAME` | `switchboard-images` | Your R2 bucket name |
| `R2_DEV_SUBDOMAIN` | `pub-xxxxx.r2.dev` | R2 bucket public URL subdomain |

**Since you mentioned you have R2 credentials via Cloudflare MCP**, you should already have:
- Account ID
- Access Key
- Secret Key

### Step 3: Deploy! (30 seconds)

1. Click **"Deploy"**
2. Wait for build to complete (~1 minute)
3. **Copy your deployment URL** (e.g., `https://switchboard-xxxxx.vercel.app`)

---

## ✅ After Deployment

### Test Your API

```bash
curl -X POST https://YOUR_URL.vercel.app/api/overlay \
  -H "Content-Type: application/json" \
  -d '{"template":"product-cover","sizes":[{"width":1080,"height":1080}],"elements":{"product-image":{"url":"https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png"},"stt-cover":{"url":"https://i.postimg.cc/4dv39JsQ/cover.png"}}}'
```

**Expected response**:
```json
{
  "sizes": [{
    "url": "https://pub-xxxxx.r2.dev/product-covers/...",
    "width": 1080,
    "height": 1080
  }]
}
```

### Update Google Apps Script

Change these 2 lines in your Google Script:

```javascript
// OLD
const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';

// NEW
const SWITCHBOARD_ENDPOINT = 'https://YOUR_URL.vercel.app/api/overlay';
```

**That's it!** 🎉

---

## 🔧 Alternative: Deploy via CLI

If you prefer CLI deployment:

```bash
cd "C:\Users\user\Claude Project\projects\Switchboard"

# Set up project
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Scope: Your account
# - Link to existing project? No
# - Project name: switchboard
# - Directory: ./ (press Enter)
# - Override settings? No

# Then add environment variables:
vercel env add R2_ACCOUNT_ID production
vercel env add R2_ACCESS_KEY_ID production
vercel env add R2_SECRET_ACCESS_KEY production
vercel env add R2_BUCKET_NAME production
vercel env add R2_DEV_SUBDOMAIN production

# Deploy to production
vercel --prod
```

---

## 📋 Checklist

- [x] ✅ GitHub repo created: https://github.com/arthurando/switchboard-overlay
- [ ] 🚀 Deploy to Vercel
- [ ] 🔑 Add R2 environment variables
- [ ] 🧪 Test API endpoint
- [ ] 📝 Update Google Apps Script (2 lines)
- [ ] ✅ Test end-to-end with real data

---

## 🆘 Need Your R2 Credentials?

If you need to retrieve your existing R2 credentials:

1. **Cloudflare Dashboard** → **R2**
2. **Account ID**: Shown in URL or dashboard
3. **API Tokens**: R2 → Manage R2 API Tokens

Or check your Cloudflare MCP configuration where you already have them stored!

---

## 🎯 Next Steps After Deploy

1. Copy your Vercel URL
2. Update Google Script endpoint
3. Test with: `runScheduleExecution()`
4. Verify images appear in R2 bucket
5. Verify Pabbly receives URLs
6. Done! 🎉

**Total time**: ~5 minutes

**Annual savings**: $348-1188 💰
