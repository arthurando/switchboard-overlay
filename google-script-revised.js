/***** FB_ScheduleExecution + CONTENT + SWITCHBOARD (SELF-HOSTED) + PABBLY WEBHOOK
 *
 * ✅ UPDATED TO USE SELF-HOSTED SWITCHBOARD API
 *
 * Changes from original:
 * 1. SWITCHBOARD_ENDPOINT now points to your Vercel deployment
 * 2. No API key needed (it's your own service)
 * 3. fetchImageAndSave_() saves images to Google Drive
 * 4. getDriveFolder_() manages Drive storage folder
 *
 *****************************************************************************/

/* ========================= CONFIG ========================= */
const PABBLY_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTY1MDYzNDA0MzA1MjZiNTUzNzUxM2Ii_pc';
const VIDEO_WEBHOOK_URL = 'https://connect.pabbly.com/workflow/sendwebhookdata/IjU3NjYwNTY1MDYzMDA0MzI1MjZlNTUzMTUxM2Ii_pc';

// ✅ NEW: Self-hosted Switchboard API
const SWITCHBOARD_ENDPOINT = 'https://your-project.vercel.app/api/overlay'; // ⚠️ UPDATE THIS after deploying
const SWITCHBOARD_API_KEY = ''; // Not needed for self-hosted

const COLLECTION_COVER_OVERLAY_URL = 'https://cdn.shopify.com/s/files/1/0712/1135/2318/files/reusable-collection-cover-polariod.png';
const PRODUCT_COVER_OVERLAY_URL = 'https://i.postimg.cc/4dv39JsQ/cover.png';

const REUSABLE_TAILS = Array.from({length:9}, (_,i)=>`https://cdn.shopify.com/s/files/1/0712/1135/2318/files/Reusable-Last-${i+1}.png`);
const SEND_SINGLE_TO_PABBLY = true;

const PROMO_FOOTER_MESSAGE = '\n\n🔥 驚錯過限時減價？ 即刻加入我哋嘅 WhatsApp 社群，第一時間收最新、最抵嘅 Hot Offers！ 👉 留言  【Whatsapp】 立即入谷';

/* ========================= MAIN RUNNER ========================= */
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

          // MANUAL POST HANDLING
          if (token.name === 'manual') {
            const manualKey = token.params.key || token.params.postName || 'default';

            Logger.log(`Manual post detected: "${manualKey}"`);

            const contentLookupKey = {
              keyType: 'manual',
              key: manualKey
            };

            const varsForContent = {
              function_name: 'manual'
            };

            const content = getContentForPost_(contentLookupKey, varsForContent);

            if (!content) {
              throw new Error(`No content found for manual post "${manualKey}"`);
            }

            const manualCoverRaw = content?.CollectionCoverManual || content?.ProductCoverURL || '';

            if (!manualCoverRaw) {
              throw new Error(`Manual post "${manualKey}" has no Collection Cover Manual or Product Cover URL`);
            }

            const manualCoverURLs = manualCoverRaw
              .split(',')
              .map(url => String(url || '').trim())
              .filter(url => url.length > 0);

            if (!manualCoverURLs.length) {
              throw new Error(`Manual post "${manualKey}" - URLs parsed to empty array`);
            }

            const promotionalParagraphWithFooter = appendPromoFooter_(content?.PromotionalParagraph || '');

            const payload = {
              'promotional-paragraph': promotionalParagraphWithFooter,
              'product-image': manualCoverURLs.join(','),
              'footer': appendPromoFooterToFooter_(content?.Footer || '')
            };

            const pabblyResp = sendWebhookToPabbly_(
              payload['product-image'],
              payload['promotional-paragraph'],
              payload['footer']
            );

            if (String(pabblyResp.status).toLowerCase() !== 'success') {
              throw new Error(`Pabbly rejected manual post: ${JSON.stringify(pabblyResp)}`);
            }

            resultRecord.status = 'Completed';
            resultRecord.completedAt = new Date().toISOString();
            resultRecord.payload = payload;
            resultRecord.response = pabblyResp;
            completedCount++;

            perKeyMap[keyRaw] = resultRecord;
            noteObj.perKey = keyParts.map(k => perKeyMap[k]).filter(Boolean);
            sh.getRange(rowNum, idx.Notes + 1).setValue(JSON.stringify(noteObj));
            SpreadsheetApp.flush();
            continue;
          }

          // REGULAR FUNCTION HANDLING
          const entry = registryByName[token.name];
          if (!entry?.execute) throw new Error(`Unknown function "${token.name}"`);

          let resolvedProducts = entry.execute({
            products: allProducts,
            collections,
            now,
            params: token.params || {},
            productsById,
            prodIdx,
            utils: {
              getLocalCollections: () => buildCollectionsFromProducts_(allProducts),
              rankCollectionsByMetric: rankCollectionsByMetric_
            }
          }) || [];

          const products = dedupeProducts(resolvedProducts);
          Logger.log(`Key "${keyRaw}": ${products.length} product(s).`);
          if (!products.length) throw new Error(`No products for key "${keyRaw}".`);

          const isSingle = token._single === true || products.length === 1;
          const isVideo = token._video === true;
          const p0 = products[0] ? normalizeProduct_(products[0]) : null;

          const contentLookupKey = determineContentLookupKey_(token, p0);

          const varsForContent = buildVarsForContent_({
            product: p0,
            params: token.params,
            resolvedCollectionTitle: p0?._resolvedCollectionTitle
          });

          if (p0?.title) {
            const skuCode = extractSkuFromTitle_(p0.title);
            if (skuCode) {
              varsForContent.skuCode = skuCode;
              varsForContent.sku_code = skuCode;
            }
          }

          const content = getContentForPost_(contentLookupKey, varsForContent);

          if (!content) {
            Logger.log(`Warning: No content found for ${contentLookupKey.keyType}:${contentLookupKey.key}`);
          }

          const footerText = content?.Footer || '';
          let payload, pabblyResp;

          if (isVideo) {
            const skuCode = varsForContent.skuCode || '';
            if (!skuCode) throw new Error(`No SKU code found in product title`);

            const videoUrl = `https://video.shoppingtaitai.com/${skuCode}.mp4`;

            const promotionalParagraphWithFooter = appendPromoFooter_(content?.PromotionalParagraph || '');

            payload = {
              'promotional-paragraph': promotionalParagraphWithFooter,
              'video-urls': videoUrl,
              'footer': appendPromoFooterToFooter_(footerText)
            };

            const response = UrlFetchApp.fetch(VIDEO_WEBHOOK_URL, {
              method: 'post',
              contentType: 'application/json',
              payload: JSON.stringify(payload),
              muteHttpExceptions: true
            });

            pabblyResp = JSON.parse(response.getContentText() || '{}');

            if (String(pabblyResp.status).toLowerCase() !== 'success') {
              throw new Error(`Pabbly video webhook rejected: ${JSON.stringify(pabblyResp)}`);
            }

          } else if (isSingle) {
            const manualCoverURL = content?.ProductCoverURL || '';
            const useMultipleImages = token.params?.multipleImages === 'true' || token.params?.multipleImages === true;

            let coverURLs = [];

            if (manualCoverURL) {
              coverURLs = manualCoverURL.split(',').map(url => url.trim()).filter(Boolean);
            } else if (useMultipleImages) {
              const images = [
                p0.image_url_1,
                p0.image_url_2,
                p0.image_url_3,
                p0.image_url_4
              ].filter(Boolean);

              for (const img of images) {
                const generatedCover = createProductCover_(img, p0.product_title || p0.title || '');
                if (generatedCover) coverURLs.push(generatedCover);
              }

              if (coverURLs.length > 1) {
                const tailPic = REUSABLE_TAILS[Math.floor(Math.random() * REUSABLE_TAILS.length)];
                if (tailPic) coverURLs.push(tailPic);
              }
            } else {
              const img = bestImgFromProduct_(p0);
              if (img) {
                const generatedCover = createProductCover_(img, p0.product_title || p0.title || '');
                if (generatedCover) coverURLs.push(generatedCover);
              }
            }

            const promotionalParagraphWithFooter = appendPromoFooter_(content?.PromotionalParagraph || '');

            payload = {
              'promotional-paragraph': promotionalParagraphWithFooter,
              'product-image': coverURLs.join(','),
              'footer': appendPromoFooterToFooter_(footerText)
            };

            if (SEND_SINGLE_TO_PABBLY) {
              pabblyResp = sendWebhookToPabbly_(payload['product-image'], payload['promotional-paragraph'], payload['footer']);
              if (String(pabblyResp.status).toLowerCase() !== 'success') {
                throw new Error(`Pabbly rejected: ${JSON.stringify(pabblyResp)}`);
              }
            } else {
              pabblyResp = { status: 'success', message: 'Response Accepted' };
            }

          } else {
            const promotionalText = content?.PromotionalText ||
              (p0?._resolvedCollectionTitle || token.name);

            const productCoverOverride = content?.ProductCoverURL || '';

            let imageUrls = buildImagesForProductsEnhanced_(
              products,
              promotionalText,
              productCoverOverride
            );

            const manualCoverRaw = content?.CollectionCoverManual || content?.ProductCoverURL || '';
            if (manualCoverRaw) {
              const manualCovers = manualCoverRaw.split(',').map(url => url.trim()).filter(Boolean);
              if (manualCovers.length > 0) {
                if (imageUrls.length > 0) imageUrls.shift();
                imageUrls.unshift(...manualCovers);
              }
            }

            const promotionalParagraphWithFooter = appendPromoFooter_(content?.PromotionalParagraph || '');

            payload = {
              'promotional-paragraph': promotionalParagraphWithFooter,
              'product-image': imageUrls.filter(Boolean).join(','),
              'footer': appendPromoFooterToFooter_(footerText)
            };

            pabblyResp = sendWebhookToPabbly_(payload['product-image'], payload['promotional-paragraph'], payload['footer']);

            if (String(pabblyResp.status).toLowerCase() !== 'success') {
              throw new Error(`Pabbly rejected: ${JSON.stringify(pabblyResp)}`);
            }
          }

          resultRecord.status = 'Completed';
          resultRecord.completedAt = new Date().toISOString();
          resultRecord.payload = payload;
          resultRecord.response = pabblyResp;
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

/* ========================= FOOTER HELPERS ========================= */

function appendPromoFooter_(promotionalParagraph) {
  const text = String(promotionalParagraph || '').trim();
  if (!text) return PROMO_FOOTER_MESSAGE.trim();
  return text + PROMO_FOOTER_MESSAGE;
}

function appendPromoFooterToFooter_(footer) {
  const text = String(footer || '').trim();
  if (!text) return PROMO_FOOTER_MESSAGE.trim();
  return text + PROMO_FOOTER_MESSAGE;
}

/* ========================= CONTENT LOOKUP ========================= */

function determineContentLookupKey_(token, product) {
  const params = token.params || {};

  if (token.name === 'manual') {
    return {
      keyType: 'manual',
      key: params.key || params.postName || 'default'
    };
  }

  if (params.productTitle) {
    const keyType = token._video ? 'video' : 'product';
    return {
      keyType,
      key: String(params.productTitle).trim()
    };
  }

  if (params.collectionName) {
    return {
      keyType: 'collection',
      key: String(params.collectionName).trim()
    };
  }

  if (token._single === true && product?.title) {
    const keyType = token._video ? 'video' : 'product';
    return {
      keyType,
      key: String(product.title).trim()
    };
  }

  return {
    keyType: 'function',
    key: token.name
  };
}

function getContentForPost_(lookupKey, variables) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const contentSheet = ss.getSheetByName('Content');

  Logger.log(`[getContentForPost_] Lookup: ${lookupKey.keyType}:"${lookupKey.key}"`);
  Logger.log(`[getContentForPost_] Variables: ${JSON.stringify(variables)}`);

  const appendMessage = (promotionalParagraph) => {
    if (!variables.message || !String(variables.message).trim()) {
      return promotionalParagraph;
    }
    const messageText = String(variables.message).trim();
    return promotionalParagraph
      ? `${messageText}\n${promotionalParagraph}`
      : messageText;
  };

  if (contentSheet) {
    const content = lookupInContentSheet_(contentSheet, lookupKey.keyType, lookupKey.key, variables, appendMessage);
    if (content) {
      Logger.log(`[getContentForPost_] ✅ Found in Content sheet`);
      return content;
    }
    Logger.log(`[getContentForPost_] ❌ Not found in Content sheet`);
  }

  if (lookupKey.keyType === 'product' || lookupKey.keyType === 'video') {
    const productsSheet = ss.getSheetByName('Products');
    if (productsSheet) {
      const content = lookupInProductsSheet_(productsSheet, lookupKey.key, variables, appendMessage);
      if (content) {
        Logger.log(`[getContentForPost_] ✅ Found in Products sheet`);
        return content;
      }
      Logger.log(`[getContentForPost_] ❌ Not found in Products sheet`);
    }
  }

  if (contentSheet) {
    const defaultContent = lookupInContentSheet_(contentSheet, 'default', 'default', variables, appendMessage);
    if (defaultContent) {
      Logger.log(`[getContentForPost_] ✅ Using default fallback`);
      return defaultContent;
    }
  }

  if (variables.message && String(variables.message).trim()) {
    Logger.log(`[getContentForPost_] ✅ Using message-only fallback`);
    return {
      KeyType: 'fallback',
      Key: 'none',
      PromotionalParagraph: String(variables.message).trim(),
      PromotionalText: '',
      Footer: '',
      CollectionCoverManual: '',
      ProductCoverURL: '',
      Active: true,
      _fallback: true
    };
  }

  Logger.log(`[getContentForPost_] ❌ No content found anywhere`);
  return null;
}

function lookupInContentSheet_(sheet, keyType, key, variables, appendMessage) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  const headers = data[0];
  const rows = data.slice(1);
  const idx = indexMap_(headers);

  const norm = v => String(v || '').trim();
  const ci = v => norm(v).toLowerCase();

  const isActive = r => {
    const activeCol = idx.Active !== undefined ? idx.Active : idx.active;
    if (activeCol === undefined) return true;
    const v = r[activeCol];
    return v === true || String(v).toUpperCase() === 'TRUE';
  };

  const keyTypeNorm = norm(keyType);
  const keyCi = ci(key);

  const matchedRow = rows.find(r =>
    isActive(r) &&
    norm(r[idx.KeyType]) === keyTypeNorm &&
    ci(r[idx.Key]) === keyCi
  );

  if (!matchedRow) return null;

  const getCol = (colName) => {
    let colIdx = idx[colName];
    if (colIdx === undefined) {
      const normalized = String(colName).toLowerCase().trim();
      const found = Object.keys(idx).find(k =>
        String(k).toLowerCase().trim() === normalized
      );
      if (found) colIdx = idx[found];
    }
    if (colIdx === undefined) return '';
    const value = matchedRow[colIdx];
    return value != null ? String(value).trim() : '';
  };

  let promotionalParagraph = substituteVariables_(getCol('Promotional Paragraph'), variables);
  promotionalParagraph = appendMessage(promotionalParagraph);

  return {
    KeyType: getCol('KeyType'),
    Key: getCol('Key'),
    PromotionalParagraph: promotionalParagraph,
    PromotionalText: substituteVariables_(getCol('Promotional Text'), variables),
    Footer: substituteVariables_(getCol('Footer'), variables),
    CollectionCoverManual: substituteVariables_(getCol('Collection Cover Manual'), variables),
    ProductCoverURL: substituteVariables_(getCol('Product Cover URL'), variables),
    Active: matchedRow[idx.Active] !== undefined ? matchedRow[idx.Active] : true,
    _fromContentSheet: true
  };
}

function lookupInProductsSheet_(sheet, productTitle, variables, appendMessage) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  const headers = data[0];
  const idx = indexMap_(headers);

  const searchTitle = String(productTitle || '').trim().toLowerCase();
  if (!searchTitle) return null;

  const matchedRow = data.slice(1).find(r => {
    const title = String(r[idx['Product Title']] || '').trim().toLowerCase();
    return title === searchTitle;
  });

  if (!matchedRow) return null;

  Logger.log(`[lookupInProductsSheet_] ✅ Found product: "${matchedRow[idx['Product Title']]}"`);

  const productTitleVal = matchedRow[idx['Product Title']] || productTitle;
  const description = matchedRow[idx['Description']] || productTitleVal;
  const variantOptions = matchedRow[idx['Variant Options']] || '';
  const skuCode = variables.skuCode || variables.sku_code || extractSkuFromTitle_(productTitleVal);

  let promotionalParagraph = `【STT 直播精選】${productTitleVal}\n\n${variantOptions}\n\n${description}`;

  const varsWithVariantOptions = {
    ...variables,
    variant_options: variantOptions
  };

  promotionalParagraph = substituteVariables_(promotionalParagraph, varsWithVariantOptions);
  promotionalParagraph = appendMessage(promotionalParagraph);

  const footer = skuCode
    ? `留言關鍵字 ${skuCode} 自動回覆, 五件包郵~`
    : '';

  return {
    KeyType: 'product',
    Key: productTitleVal,
    PromotionalParagraph: promotionalParagraph,
    PromotionalText: productTitleVal,
    Footer: footer,
    CollectionCoverManual: '',
    ProductCoverURL: '',
    Active: true,
    _fromProductsSheet: true
  };
}

function buildVarsForContent_(opts) {
  const { product, params, resolvedCollectionTitle } = opts || {};

  const vars = {
    function_name: params?.functionName || ''
  };

  const colName = params?.collectionName || resolvedCollectionTitle || '';
  if (colName) {
    vars.collection_name = colName;
    vars.collection_url = getCollectionUrlFromSitemap_(colName);
    vars.collection_cover_url = getCollectionCoverFromSitemap_(colName);
  }

  if (params) {
    Object.keys(params).forEach(k => {
      vars[k] = params[k];
    });

    vars.vendor_name = params.vendorName || params.vendor_name || '';
    vars.price_threshold = params.maxPrice || params.minPrice || params.price_threshold || '';
    vars.days = params.days || '';
    vars.n = params.index || params.limit || params.topN || params.sampleK || params.n || '';
    vars.keywords = params.keywords || '';
    vars.message = params.message || '';
  }

  if (product) {
    vars.product_id = or_(product.id, product.product_id);
    vars.product_title = or_(product.title, product.product_title);
    vars.description = or_(product.description);
    vars.selling_price = or_(product.price, product.selling_price);
    vars.original_price = or_(product.compare_at_price, product.originalPrice);
    vars.vendor = or_(product.vendor);
    vars.product_url = or_(product.url, product.product_url);
    vars.product_cover_url = or_(product.product_cover_url, product.image_url_1);
    vars.image_url_1 = or_(product.image_url_1, getImage_(product, 0));
    vars.image_url_2 = or_(product.image_url_2, getImage_(product, 1));
    vars.image_url_3 = or_(product.image_url_3, getImage_(product, 2));
    vars.image_url_4 = or_(product.image_url_4, getImage_(product, 3));
    vars.keywords = or_(product.keywords);
    vars.message = or_(product.message, params?.message);
    vars.sku = or_(product.sku);
    vars.created_date = formatDate_(product.createdAt);
    vars.last_updated_date = formatDate_(product.updatedAt);
    vars.sales_last_7_days = or_(product.sales7);
    vars.sales_last_30_days = or_(product.sales30);
    vars.variant_options = or_(product.variant_options, product['Variant Options']);

    if (product.title) {
      const skuCode = extractSkuFromTitle_(product.title);
      if (skuCode) {
        vars.skuCode = skuCode;
        vars.sku_code = skuCode;
      }
    }
  }

  return vars;
}

function substituteVariables_(text, vars) {
  if (!text) return '';

  let result = String(text);

  if (!vars || typeof vars !== 'object' || Object.keys(vars).length === 0) {
    return result;
  }

  result = result.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });

  return result;
}

/* ========================= IMAGE BUILDERS ========================= */

function buildImagesForProductsEnhanced_(products, promotionalText, productCoverOverride) {
  const norm = (products || []).map(p => normalizeProduct_(p));
  if (!norm.length) return [];

  const productPics = norm.map(p => {
    const img = productCoverOverride || p.product_cover_url || p.image_url_1;
    const title = p.product_title || p.title || '';
    if (!img) return '';
    return createProductCover_(img, title);
  }).filter(Boolean);

  const finalPic = REUSABLE_TAILS[Math.floor(Math.random() * REUSABLE_TAILS.length)];

  return [...productPics, finalPic].filter(Boolean);
}

/* ========================= SWITCHBOARD - SELF-HOSTED ========================= */

/**
 * ✅ NEW: Create product cover using self-hosted Switchboard API
 *
 * This function:
 * 1. Calls your Vercel API endpoint
 * 2. Receives image as blob
 * 3. Saves to Google Drive
 * 4. Returns public URL
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

  const imageUrl = fetchImageAndSave_(SWITCHBOARD_ENDPOINT, payload);
  return imageUrl;
}

/**
 * ✅ NEW: Fetch image from API and save to Google Drive
 */
function fetchImageAndSave_(url, payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload)
  };

  Logger.log(`[fetchImageAndSave_] Calling: ${url}`);

  const res = UrlFetchApp.fetch(url, options);
  const code = res.getResponseCode();

  if (code < 200 || code >= 300) {
    const text = res.getContentText();
    Logger.log(`[fetchImageAndSave_] ❌ HTTP ${code}: ${text}`);
    throw new Error(`HTTP ${code}: ${text}`);
  }

  const contentType = res.getHeaders()['Content-Type'] || '';
  Logger.log(`[fetchImageAndSave_] Response Content-Type: ${contentType}`);

  // Response should be an image
  if (!contentType.includes('image/')) {
    const preview = res.getContentText().substring(0, 200);
    Logger.log(`[fetchImageAndSave_] ❌ Expected image, got: ${contentType} | Preview: ${preview}`);
    throw new Error(`Expected image response, got: ${contentType}`);
  }

  const blob = res.getBlob();
  const folder = getDriveFolder_();
  const timestamp = new Date().getTime();
  const fileName = `product_cover_${timestamp}.png`;

  Logger.log(`[fetchImageAndSave_] Creating file: ${fileName}`);

  const file = folder.createFile(blob.setName(fileName));

  // Make file publicly accessible
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Return direct view URL (better for Pabbly/Facebook)
  const viewUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;

  Logger.log(`[fetchImageAndSave_] ✅ Saved to Drive: ${viewUrl}`);

  return viewUrl;
}

/**
 * ✅ NEW: Get or create Google Drive folder for product covers
 */
function getDriveFolder_() {
  const folderName = 'Product Covers - Switchboard';
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  Logger.log(`[getDriveFolder_] Creating folder: ${folderName}`);
  return DriveApp.createFolder(folderName);
}

/* ========================= PABBLY ========================= */

function sendWebhookToPabbly_(productImagesCsv, promotionalParagraph, footer) {
  const payload = {
    'promotional-paragraph': promotionalParagraph || '',
    'product-image': productImagesCsv || '',
    'footer': footer || ''
  };

  const response = UrlFetchApp.fetch(PABBLY_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const parsed = JSON.parse(response.getContentText() || '{}');
  return parsed?.status ? parsed : { raw: response.getContentText() };
}

/* ========================= UTILITIES ========================= */

// ... [PASTE ALL YOUR EXISTING UTILITY FUNCTIONS HERE]
// Including: collections, products, parsing, date handling, etc.
// (I've kept only the modified functions above for clarity)

// NOTE: Copy all remaining functions from your original script:
// - buildCollectionsFromProducts_
// - resolveCollectionNameToProducts_
// - splitKeysRespectingQuotes_
// - parseSingleTokenEnhanced_
// - parseParamsKV_
// - normalizeProduct_
// - cleanProducts
// - dedupeProducts
// - etc.
