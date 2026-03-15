/**
 * Switchboard Image Overlay API with R2 Storage
 *
 * POST /api/overlay
 * {
 *   "template": "product-cover",
 *   "sizes": [{ "width": 1080, "height": 1080 }],
 *   "elements": {
 *     "product-image": { "url": "https://..." },
 *     "stt-cover": { "url": "https://..." },
 *     "product-title": { "text": "Product Title" }
 *   }
 * }
 *
 * Returns: JSON with R2 public URL (Switchboard-compatible format)
 * {
 *   "sizes": [{ "url": "https://images.yourdomain.com/...", "width": 1080, "height": 1080 }]
 * }
 */

import fs from 'fs';
import path from 'path';
// IMPORTANT: Do NOT statically import imageProcessor or sharp here.
// Static imports cause Sharp/libvips to initialize before fontconfig is configured,
// which caches font info without our custom fonts → CJK renders as tofu.
// All Sharp-dependent modules must be dynamically imported AFTER fontconfig init.

const API_VERSION = '2026-02-07';

// IMPORTANT: Explicit file references for Vercel's @vercel/nft file tracer.
// Without these, font files may not be included in the serverless bundle.
// DO NOT use .filter() — it can prevent NFT from statically tracing the paths.
const _fontRef1 = path.join(process.cwd(), 'fonts', 'elle-bold.ttf');
const _fontRef2 = path.join(process.cwd(), 'fonts', 'NotoSansTC.ttf');
const _fontRef3 = path.join(process.cwd(), 'fonts', 'MElle-HK-Xbold.ttf');
void fs.existsSync(_fontRef1);
void fs.existsSync(_fontRef2);
void fs.existsSync(_fontRef3);

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // GET ?test=cjk — render CJK test from WITHIN the overlay function context
  if (req.method === 'GET' && req.query.test === 'cjk') {
    const sharp = (await import('sharp')).default;
    const { initFontconfig: initFC, getFontPath: getFP } = await import('../../lib/fontLoader');
    initFC();
    const mellePath = getFP('MElle-HK-Xbold.ttf');
    const text = req.query.text || '韓國 AKIII Classic 凱蒂貓【SM660A】';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const opts = {
      text: `<span foreground="black" font_desc="MElle HK Xbold Bold 60">${escaped}</span>`,
      font: 'MElle HK Xbold 60',
      width: 1000,
      align: 'center',
      wrap: 'word-char',
      rgba: true,
      dpi: 72,
    };
    if (fs.existsSync(mellePath)) opts.fontfile = mellePath;
    const buf = await sharp({ text: opts }).flatten({ background: { r: 255, g: 255, b: 255 } }).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Font-Path', mellePath);
    res.setHeader('X-Font-Exists', String(fs.existsSync(mellePath)));
    return res.send(buf);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { template, sizes, elements, mode } = req.body;

    // Validate request: product-image always required
    if (!elements || !elements['product-image']?.url) {
      return res.status(400).json({
        error: 'Missing required element: product-image.url'
      });
    }

    // Legacy mode requires stt-cover; v3 mode does not
    if (mode !== 'v3' && !elements['stt-cover']?.url) {
      return res.status(400).json({
        error: 'Missing required element: stt-cover.url (required in legacy mode, use mode:"v3" to skip)'
      });
    }

    const productImageUrl = elements['product-image'].url;
    const overlayImageUrl = elements['stt-cover']?.url;
    const titleText = elements['product-title']?.text || '';
    const targetWidth = sizes?.[0]?.width || 1080;
    const targetHeight = sizes?.[0]?.height || 1080;

    let imageBuffer;

    if (mode === 'v3') {
      // V3 mode: inline pipeline — generate text overlay, then download image, then composite
      // Avoids processImageOverlay which has CJK rendering issues due to Sharp state
      const sharp = (await import('sharp')).default;
      const axios = (await import('axios')).default;
      const { generateV3TextOverlay } = await import('../../lib/v3TextOverlay.js');

      // Step 1: Generate text overlay FIRST (before any image processing)
      const v3Overlay = await generateV3TextOverlay(targetWidth, targetHeight, elements);

      // Step 2: Download and resize product image
      const imgResp = await axios.get(productImageUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const resizedProduct = await sharp(Buffer.from(imgResp.data))
        .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer();

      // Step 3: Composite text overlay onto product image
      imageBuffer = await sharp(resizedProduct)
        .composite([{ input: v3Overlay, top: 0, left: 0 }])
        .png({ compressionLevel: 6 })
        .toBuffer();
    } else {
      // Legacy mode: dynamically import processImageOverlay
      const { processImageOverlay } = await import('../../lib/imageProcessor');
      imageBuffer = await processImageOverlay({
        productImageUrl,
        overlayImageUrl,
        titleText,
        mode,
        elements,
        width: targetWidth,
        height: targetHeight,
      });
    }

    // Upload to R2 (dynamic import)
    const { uploadToR2 } = await import('../../lib/r2Storage');
    const { url, key } = await uploadToR2(imageBuffer, 'image/png');

    // Check font availability for debug
    const { getFontPath, getFontsDir } = await import('../../lib/fontLoader');
    const mellePath = getFontPath('MElle-HK-Xbold.ttf');
    const melleExists = fs.existsSync(mellePath);

    // Return Switchboard-compatible response
    return res.status(200).json({
      sizes: [
        {
          url,
          width: targetWidth,
          height: targetHeight,
          key,
        }
      ],
      template,
      _version: API_VERSION,
      _fonts: {
        melleHK: { path: mellePath, exists: melleExists, size: melleExists ? fs.statSync(mellePath).size : 0 },
        fontsDir: getFontsDir(),
      },
    });

  } catch (error) {
    console.error('[API] ❌ Error:', error);

    return res.status(500).json({
      error: 'Failed to process image overlay',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
