# 🎯 Next Steps - Deployment Checklist

## ✅ Completed

- [x] Project structure created
- [x] Dependencies installed (59 packages)
- [x] Security vulnerabilities fixed (Next.js 15.1.6)
- [x] Build tested successfully
- [x] All files verified

## 📋 What You Need to Do

### Step 1: Test Locally (5 minutes)

Open a **new terminal** and run:

```bash
cd "C:\Users\user\Claude Project\projects\Switchboard"
npm run dev
```

Then open these URLs in your browser:

1. **API Documentation**: http://localhost:3000
2. **Interactive Tester**: http://localhost:3000/test.html

**In the tester**:
- Click "Generate Overlay"
- Verify image is created
- Download and check the result

**If it works** ✅ → Continue to Step 2
**If it fails** ❌ → Check console for errors, review DEPLOYMENT.md

---

### Step 2: Deploy to Vercel (5 minutes)

#### Option A: Vercel CLI (Fastest)

```bash
# Install Vercel CLI (one-time)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd "C:\Users\user\Claude Project\projects\Switchboard"
vercel --prod
```

**Follow the prompts**:
- Set up and deploy? **Yes**
- Which scope? **Your account**
- Link to existing project? **No**
- What's your project's name? **switchboard** (or any name)
- In which directory is your code located? **./** (just press Enter)
- Want to override settings? **No**

**You'll get a URL like**: `https://switchboard-xyz123.vercel.app`

**✅ COPY THIS URL - You need it for the next step!**

#### Option B: GitHub + Vercel Web UI

If you prefer using the web interface:

1. **Create GitHub repo**:
   ```bash
   cd "C:\Users\user\Claude Project\projects\Switchboard"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/switchboard.git
   git push -u origin main
   ```

2. **Deploy via Vercel**:
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your repo
   - Click "Deploy"
   - Copy the deployment URL

---

### Step 3: Test Your Deployed API (2 minutes)

Test your live API with this command (replace YOUR_URL):

```bash
curl -X POST https://YOUR_URL.vercel.app/api/overlay \
  -H "Content-Type: application/json" \
  -d '{"template":"product-cover","sizes":[{"width":1080,"height":1080}],"elements":{"product-image":{"url":"https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png"},"stt-cover":{"url":"https://i.postimg.cc/4dv39JsQ/cover.png"}}}' \
  --output test-result.png
```

**If successful**: You'll get a `test-result.png` file
**If failed**: Check Vercel logs at https://vercel.com/dashboard

---

### Step 4: Update Your Google Apps Script (10 minutes)

#### 4.1 Open Your Script

Go to your Google Sheets → Extensions → Apps Script

#### 4.2 Update Configuration

Find these lines at the top:

```javascript
const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';
const SWITCHBOARD_API_KEY = '9dde8637-7554-4741-a259-61216f790c79';
```

**Replace with**:

```javascript
const SWITCHBOARD_ENDPOINT = 'https://YOUR_URL.vercel.app/api/overlay';
const SWITCHBOARD_API_KEY = ''; // Empty - no key needed
```

#### 4.3 Replace the createProductCover_ Function

Open `google-script-revised.js` in this project folder.

Find the `createProductCover_()` function and **replace** your existing one.

#### 4.4 Add New Helper Functions

Copy these TWO new functions from `google-script-revised.js`:

1. `fetchImageAndSave_()` - Downloads image from API and saves to Drive
2. `getDriveFolder_()` - Creates/gets the Drive folder

**Paste them right after `createProductCover_()` in your script**.

#### 4.5 Remove Old Helper

You can **delete** this function if it exists:

```javascript
function extractSwitchboardUrl_(resp) { ... }
```

It's no longer needed.

---

### Step 5: Test End-to-End (5 minutes)

#### 5.1 Create Test Function

Add this to your Google Apps Script:

```javascript
function testNewSwitchboard() {
  Logger.log('🧪 Testing new Switchboard API...');

  const testImageUrl = 'https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png';
  const testTitle = 'Test Product';

  try {
    const result = createProductCover_(testImageUrl, testTitle);

    Logger.log('✅ SUCCESS!');
    Logger.log('Result URL: ' + result);
    Logger.log('\nOpen this URL to verify:');
    Logger.log(result);

    return result;
  } catch (error) {
    Logger.log('❌ ERROR: ' + error.message);
    Logger.log(error.stack);
    throw error;
  }
}
```

#### 5.2 Run the Test

1. Click "Run" → Select `testNewSwitchboard`
2. Authorize if prompted (first time only)
3. Check the logs (View → Logs)

**Expected output**:
```
🧪 Testing new Switchboard API...
✅ SUCCESS!
Result URL: https://drive.google.com/uc?export=view&id=XXXXX
```

#### 5.3 Verify the Image

1. Copy the Drive URL from the logs
2. Paste it in your browser
3. Verify the overlay image looks correct

#### 5.4 Check Google Drive

1. Go to Google Drive
2. Find folder: **"Product Covers - Switchboard"**
3. Verify image was created with timestamp filename

---

### Step 6: Test with Real Workflow (10 minutes)

#### 6.1 Run Actual Schedule Execution

1. Find a row in your `FB_ScheduleExecution` sheet
2. Set the DateTime to NOW (current time)
3. Run `runScheduleExecution()`
4. Check the logs for any errors

#### 6.2 Verify Pabbly Receives Images

1. Check your Pabbly workflow history
2. Verify it received the Google Drive URL
3. Verify Facebook post shows the image correctly

---

## 🎯 Success Criteria

You'll know everything is working when:

- ✅ Local test works (http://localhost:3000/test.html)
- ✅ Vercel deployment succeeds
- ✅ Test API endpoint returns image
- ✅ Google Script test function succeeds
- ✅ Image appears in Google Drive folder
- ✅ Drive URL works when opened
- ✅ Pabbly receives the Drive URL
- ✅ Facebook post displays the image

---

## 🆘 Troubleshooting

### Issue: Local dev server won't start

**Solution**:
```bash
# Kill any process on port 3000
npx kill-port 3000

# Try again
npm run dev
```

### Issue: Vercel deployment fails

**Check**:
1. Run `npm run build` locally first
2. Check for build errors
3. Review Vercel deployment logs

### Issue: Google Script can't reach API

**Check**:
1. Verify Vercel URL is correct (should end with `/api/overlay`)
2. Test URL directly with curl
3. Check Vercel function logs for errors

### Issue: Image not appearing in Facebook

**Try different Drive URL formats**:

In `fetchImageAndSave_()`, try these:

```javascript
// Option 1 (current)
return `https://drive.google.com/uc?export=view&id=${file.getId()}`;

// Option 2 - Direct download
return `https://drive.google.com/uc?export=download&id=${file.getId()}`;

// Option 3 - Thumbnail
return `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1080`;
```

### Issue: Images processing too slowly

**Optimization**:
1. Reduce overlay image size (should be exactly 1080x1080)
2. Use WebP format for smaller file sizes
3. Upgrade to Vercel Pro for 60s timeout (if hitting 30s limit)

---

## 📊 Monitoring

### Vercel Dashboard

- **URL**: https://vercel.com/dashboard
- **Check**: Deployment status, function logs, errors

### Google Drive

- **Folder**: "Product Covers - Switchboard"
- **Monitor**: Storage usage (15GB free limit)

### Weekly Maintenance

Run this cleanup script to delete old images:

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

  Logger.log(`🗑️ Cleaned up ${deleted} old images`);
}
```

Set up a **weekly trigger** for this function in Apps Script.

---

## 🎉 You're Done!

Once all steps are complete:

1. ✅ Switchboard is self-hosted on Vercel
2. ✅ No more monthly subscription
3. ✅ Unlimited image generation
4. ✅ Images saved to your Google Drive
5. ✅ Everything works exactly as before

**Estimated annual savings**: $348 - $1188 💰

---

## 📞 Need Help?

**Documentation**:
- Quick reference: `QUICKSTART.md`
- Full deployment guide: `DEPLOYMENT.md`
- Google Script integration: `GOOGLE_SCRIPT_INTEGRATION.md`
- Architecture overview: `PROJECT_SUMMARY.md`

**Logs to check**:
- Vercel: `vercel logs --follow`
- Google Script: View → Logs in Apps Script editor
- Browser: F12 → Console tab

**Common fixes**:
- Clear browser cache
- Restart Vercel deployment
- Check API endpoint URL is correct
- Verify images URLs are publicly accessible

---

## ⏭️ Future Enhancements (Optional)

Once everything is working, you can:

1. **Add API authentication** (see DEPLOYMENT.md)
2. **Implement text overlays** (scaffolded in code)
3. **Set up monitoring alerts** (Vercel integrations)
4. **Add custom overlay templates**
5. **Optimize for faster processing**

But for now, focus on getting the basic setup working! 🚀
