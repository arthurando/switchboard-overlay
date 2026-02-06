/***** SWITCHBOARD (R2 STORAGE) - SIMPLIFIED INTEGRATION
 *
 * ✅ NO MORE GOOGLE DRIVE - Uses Cloudflare R2 for temporary storage
 * ✅ SAME API AS BEFORE - Just change the endpoint URL
 * ✅ MINIMAL CHANGES - Only update SWITCHBOARD_ENDPOINT
 *
 *****************************************************************************/

/* ========================= CONFIG ========================= */
const PABBLY_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTY1MDYzNDA0MzA1MjZiNTUzNzUxM2Ii_pc';
const VIDEO_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTY1MDYzMDA0MzI1MjZlNTUzMTUxM2Ii_pc';

// ✅ NEW: Self-hosted Switchboard API with R2 storage
const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay'; // ⚠️ UPDATE THIS
const SWITCHBOARD_API_KEY = ''; // Not needed

const COLLECTION_COVER_OVERLAY_URL = 'https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png';
const PRODUCT_COVER_OVERLAY_URL = 'https://i.postimg.cc/4dv39JsQ/cover.png';

const REUSABLE_TAILS = Array.from({length:9}, (_,i)=>`https://cdn.shopify.com/s/files/1/0712/1135/2318/files/Reusable-Last-${i+1}.png`);
const SEND_SINGLE_TO_PABBLY = true;

const PROMO_FOOTER_MESSAGE = '\n\n🔥 驚錯過限時減價？ 即刻加入我哋嘅 WhatsApp 社群，第一時間收最新、最抵嘅 Hot Offers！ 👉 留言  【Whatsapp】 立即入谷';

/* ========================= SWITCHBOARD - R2 STORAGE ========================= */

/**
 * ✅ UPDATED: Works exactly like before, but now uses R2 storage
 *
 * This function is UNCHANGED from your original script.
 * The API now returns the same JSON format as old Switchboard:
 * { "sizes": [{ "url": "https://...", "width": 1080, "height": 1080 }] }
 */
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

/**
 * ✅ UPDATED: Now also works with R2 URLs
 */
function extractSwitchboardUrl_(resp) {
  // R2 response format (same as old Switchboard)
  if (resp?.sizes?.[0]?.url) return resp.sizes[0].url;

  // Fallback formats
  if (resp?.results?.[0]?.url) return resp.results[0].url;
  if (resp?.results?.[0]?.assets?.[0]?.url) return resp.results[0].assets[0].url;
  if (resp?.url) return resp.url;

  Logger.log('[extractSwitchboardUrl_] ❌ Could not extract URL from response');
  Logger.log(JSON.stringify(resp, null, 2));

  return '';
}

/**
 * ✅ UNCHANGED: This function remains exactly the same
 */
function fetchJson_(url, method, apiKey, payload) {
  const res = UrlFetchApp.fetch(url, {
    method: method || 'post',
    contentType: 'application/json',
    headers: apiKey ? { 'X-API-Key': apiKey } : {},
    muteHttpExceptions: true,
    payload: payload ? JSON.stringify(payload) : undefined
  });

  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error(`HTTP ${code}: ${text}`);
  }

  return JSON.parse(text);
}

/* ========================= THE REST OF YOUR SCRIPT ========================= */

// ✅ NO OTHER CHANGES NEEDED
// Your entire existing script continues to work as-is.
// Just copy/paste all your other functions below:
// - runScheduleExecution()
// - appendPromoFooter_()
// - determineContentLookupKey_()
// - getContentForPost_()
// - buildImagesForProductsEnhanced_()
// - All utility functions
// - etc.

// Example: Here's the main execution function (unchanged)

function runScheduleExecution() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('FB_ScheduleExecution');
  if (!sh) { Logger.log('Missing sheet "FB_ScheduleExecution"'); return; }

  const data = sh.getDataRange().getValues();
  if (data.length < 2) { Logger.log('No rows to process.'); return; }

  const headers = data[0].map(String);
  const idx = indexMap_(headers);
  ensureCols_(idx, ['DateTime', 'Key', 'Status', 'Notes'], 'FB_ScheduleExecution');

  const registry = safeBuildRegistry_();
  const registryByName = {};
  (registry || []).forEach(f => { registryByName[f.name] = f; });

  const allProducts = getProductsFromSheet();
  const productsById = indexBy_(allProducts, p => String(p.id || ''));
  const prodIdx = buildIndexesForProducts_(allProducts);
  const collections = buildCollectionsFromProducts_(allProducts);

  const now = new Date();

  for (let r = 1; r < data.length; r++) {
    const rowNum = r + 1;
    const row = data[r];

    try {
      const rawDt = row[idx.DateTime];
      const keyStr = String(row[idx.Key] || '').trim();

      if (!rawDt || !keyStr) continue;

      const when = parseSheetDateTime_(rawDt, sh);
      if (!when || isNaN(when.getTime())) {
        Logger.log(`Row ${rowNum} skipped: invalid DateTime`);
        continue;
      }

      if (when.getTime() > new Date().getTime()) {
        sh.getRange(rowNum, idx.Status + 1).setValue('Scheduled (pending)');
        continue;
      }

      Logger.log(`\n=== Executing row ${rowNum} | Key="${keyStr}" ===`);

      let noteObj = {};
      try {
        noteObj = JSON.parse(row[idx.Notes] || '{}');
      } catch (_) {}
      if (!Array.isArray(noteObj.perKey)) noteObj.perKey = [];

      const keyParts = splitKeysRespectingQuotes_(keyStr);
      const perKeyMap = {};
      noteObj.perKey.forEach(k => { perKeyMap[k.keyRaw] = k; });

      let completedCount = 0;

      for (let i = 0; i < keyParts.length; i++) {
        const keyRaw = keyParts[i];

        if (perKeyMap[keyRaw]?.status === 'Completed') {
          completedCount++;
          continue;
        }

        Logger.log(`-- Processing key #${i + 1}: ${keyRaw}`);

        const resultRecord = {
          keyRaw,
          startedAt: new Date().toISOString(),
          status: 'Pending'
        };

        try {
          const token = parseSingleTokenEnhanced_(keyRaw, registryByName);
          if (!token?.name) throw new Error(`Key "${keyRaw}" could not be parsed.`);

          // ... REST OF YOUR EXECUTION LOGIC ...
          // (Copy all your existing logic here - it remains unchanged)

          resultRecord.status = 'Completed';
          resultRecord.completedAt = new Date().toISOString();
          completedCount++;

        } catch (err) {
          const msg = String(err?.message || err);
          Logger.log(`Key "${keyRaw}" FAILED: ${msg}`);
          resultRecord.status = 'Failed';
          resultRecord.error = msg;
          resultRecord.failedAt = new Date().toISOString();
        }

        perKeyMap[keyRaw] = resultRecord;
        noteObj.perKey = keyParts.map(k => perKeyMap[k]).filter(Boolean);
        sh.getRange(rowNum, idx.Notes + 1).setValue(JSON.stringify(noteObj));
        SpreadsheetApp.flush();
      }

      sh.getRange(rowNum, idx.Status + 1).setValue(`${completedCount}/${keyParts.length} Completed`);

    } catch (err) {
      const msg = String(err?.message || err);
      Logger.log(`Row ${rowNum} FAILED: ${msg}`);
      sh.getRange(rowNum, idx.Status + 1).setValue('Row Failed');
    }
  }
}

/* ========================= PASTE ALL YOUR OTHER FUNCTIONS BELOW ========================= */

// TODO: Copy/paste all remaining functions from your original script:
// - appendPromoFooter_()
// - appendPromoFooterToFooter_()
// - determineContentLookupKey_()
// - getContentForPost_()
// - lookupInContentSheet_()
// - lookupInProductsSheet_()
// - buildVarsForContent_()
// - substituteVariables_()
// - buildImagesForProductsEnhanced_()
// - buildCollectionsFromProducts_()
// - resolveCollectionNameToProducts_()
// - sendWebhookToPabbly_()
// - All utility functions
// - etc.

// ⚠️ NOTE: These functions are NOT included here to keep this file concise.
// You should copy them from your original script - they remain 100% unchanged.
