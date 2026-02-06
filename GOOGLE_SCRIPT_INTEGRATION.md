# Google Apps Script Integration

## Step 1: Deploy Switchboard to Vercel

1. Push this code to GitHub
2. Import to Vercel: https://vercel.com/new
3. Deploy and get your URL (e.g., `https://switchboard-xyz.vercel.app`)

## Step 2: Update Your Google Script

Replace the old Switchboard configuration:

```javascript
// ❌ OLD - Delete these lines
const SWITCHBOARD_ENDPOINT = 'https://api.canvas.switchboard.ai/';
const SWITCHBOARD_API_KEY = '9dde8637-7554-4741-a259-61216f790c79';

// ✅ NEW - Add this instead
const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay';
const SWITCHBOARD_API_KEY = ''; // No API key needed (it's your own service!)
```

## Step 3: Update the createProductCover_ Function

**No changes needed!** Your existing function will work as-is:

```javascript
function createProductCover_(productImageUrl, titleText) {
  const payload = {
    template: 'product-cover',
    sizes: [{ width: 1080, height: 1080 }],
    elements: {
      'product-image': { url: productImageUrl || '' },
      'stt-cover': { url: PRODUCT_COVER_OVERLAY_URL },
      'product-title': { text: titleText || '' }
    }
  };

  const resp = fetchJson_(SWITCHBOARD_ENDPOINT, 'post', SWITCHBOARD_API_KEY, payload);
  return extractSwitchboardUrl_(resp);
}
```

## Step 4: Update extractSwitchboardUrl_ Function

The response format is different. Update this helper:

```javascript
// ❌ OLD
function extractSwitchboardUrl_(resp) {
  if (resp?.sizes?.[0]?.url) return resp.sizes[0].url;
  if (resp?.results?.[0]?.url) return resp.results[0].url;
  if (resp?.results?.[0]?.assets?.[0]?.url) return resp.results[0].assets[0].url;
  if (resp?.url) return resp.url;
  return '';
}

// ✅ NEW
function extractSwitchboardUrl_(resp) {
  // Your self-hosted API returns image directly as blob
  // UrlFetchApp.fetch() will have the image in response body
  // We need to handle this differently

  // The image is already in 'resp' from fetchJson_
  // We'll need to modify fetchJson_ to handle binary responses
  return resp; // This will be the image URL after we fix fetchJson_
}
```

## Step 5: Update fetchJson_ to Handle Image Responses

The self-hosted API returns images directly, not JSON with URLs. Update:

```javascript
function fetchJson_(url, method, apiKey, payload) {
  const options = {
    method: method || 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: payload ? JSON.stringify(payload) : undefined
  };

  if (apiKey) {
    options.headers = { 'X-API-Key': apiKey };
  }

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();

  if (code < 200 || code >= 300) {
    const text = res.getContentText();
    throw new Error(`HTTP ${code}: ${text}`);
  }

  const contentType = res.getHeaders()['Content-Type'] || '';

  // If response is an image, save to Drive and return URL
  if (contentType.includes('image/')) {
    const blob = res.getBlob();
    const folder = getDriveFolder_(); // You'll need to implement this
    const timestamp = new Date().getTime();
    const fileName = `product_cover_${timestamp}.png`;
    const file = folder.createFile(blob.setName(fileName));

    // Make file publicly accessible
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Return public URL
    return file.getUrl();
  }

  // Otherwise parse as JSON (for error responses)
  return JSON.parse(res.getContentText());
}

function getDriveFolder_() {
  // Get or create a folder for product covers
  const folderName = 'Product Covers - Switchboard';
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}
```

## Full Updated Functions

Here's the complete updated code for your Google Script:

```javascript
/* ========================= CONFIG ========================= */
const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay';
const SWITCHBOARD_API_KEY = ''; // Not needed for self-hosted
const PRODUCT_COVER_OVERLAY_URL = 'https://i.postimg.cc/4dv39JsQ/cover.png';

/* ========================= SWITCHBOARD ========================= */

function createProductCover_(productImageUrl, titleText) {
  const payload = {
    template: 'product-cover',
    sizes: [{ width: 1080, height: 1080 }],
    elements: {
      'product-image': { url: productImageUrl || '' },
      'stt-cover': { url: PRODUCT_COVER_OVERLAY_URL },
      'product-title': { text: titleText || '' }
    }
  };

  const imageUrl = fetchImageAndSave_(SWITCHBOARD_ENDPOINT, payload);
  return imageUrl;
}

function fetchImageAndSave_(url, payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();

  if (code < 200 || code >= 300) {
    const text = res.getContentText();
    throw new Error(`HTTP ${code}: ${text}`);
  }

  const contentType = res.getHeaders()['Content-Type'] || '';

  // Response should be an image
  if (!contentType.includes('image/')) {
    throw new Error(`Expected image response, got: ${contentType}`);
  }

  const blob = res.getBlob();
  const folder = getDriveFolder_();
  const timestamp = new Date().getTime();
  const fileName = `product_cover_${timestamp}.png`;
  const file = folder.createFile(blob.setName(fileName));

  // Make file publicly accessible
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Return direct download URL (better for Pabbly)
  return `https://drive.google.com/uc?export=view&id=${file.getId()}`;
}

function getDriveFolder_() {
  const folderName = 'Product Covers - Switchboard';
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}
```

## Benefits of Self-Hosted Solution

✅ **No API Costs** - Run on Vercel's free tier
✅ **Full Control** - Customize image processing logic
✅ **No Rate Limits** - Your own infrastructure
✅ **Better Privacy** - Images processed on your servers
✅ **Google Drive Integration** - Images saved to your Drive

## Testing

1. Deploy to Vercel
2. Update `SWITCHBOARD_ENDPOINT` with your Vercel URL
3. Run a test function:

```javascript
function testSwitchboard() {
  const testUrl = 'https://cdn.shopify.com/s/files/1/0712/1135/2318/products/example.jpg';
  const result = createProductCover_(testUrl, 'Test Product');
  Logger.log('Result URL: ' + result);
}
```

## Troubleshooting

### "HTTP 404" error
- Verify your Vercel URL is correct
- Make sure deployment succeeded
- Check API endpoint is `/api/overlay`

### "Expected image response" error
- Check Vercel function logs for errors
- Verify product image URL is accessible
- Test API directly with curl/Postman

### Images not appearing
- Check Google Drive folder permissions
- Verify file.setSharing() succeeded
- Try using file.getDownloadUrl() instead

## Next Steps

Once working, you can:
1. Add authentication to your API
2. Implement text overlay with custom fonts
3. Add image caching to reduce processing
4. Monitor usage in Vercel dashboard
