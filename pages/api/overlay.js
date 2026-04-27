/**
 * Switchboard Image Overlay API with R2 Storage
 *
 * POST /api/overlay
 * Returns: { sizes: [{ url, width, height, key }], template, _version }
 */

import fs from 'fs';
import path from 'path';

const API_VERSION = '2026-02-07';

// Explicit file refs for Vercel @vercel/nft file tracer — do not remove
const _fontRef1 = path.join(process.cwd(), 'fonts', 'elle-bold.ttf');
const _fontRef2 = path.join(process.cwd(), 'fonts', 'NotoSansTC.ttf');
const _fontRef3 = path.join(process.cwd(), 'fonts', 'MElle-HK-Xbold.ttf');
void fs.existsSync(_fontRef1);
void fs.existsSync(_fontRef2);
void fs.existsSync(_fontRef3);

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Parse body manually with explicit UTF-8 to preserve CJK characters
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))));
      req.on('error', reject);
    });

    const { template, sizes, elements, mode } = body;

    // Basic input validation (no zod installed — validate manually)
    if (!template || typeof template !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid field: template (string required)' });
    }
    if (!Array.isArray(sizes) || sizes.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid field: sizes (non-empty array required)' });
    }
    if (!elements || typeof elements !== 'object' || Array.isArray(elements)) {
      return res.status(400).json({ error: 'Missing or invalid field: elements (object required)' });
    }

    if (!elements?.['product-image']?.url) {
      return res.status(400).json({ error: 'Missing required element: product-image.url' });
    }
    if (mode !== 'v3' && !elements['stt-cover']?.url) {
      return res.status(400).json({
        error: 'Missing required element: stt-cover.url (required in legacy mode, use mode:"v3" to skip)',
      });
    }

    const productImageUrl = elements['product-image'].url;
    const targetWidth = sizes?.[0]?.width || 1080;
    const targetHeight = sizes?.[0]?.height || 1080;

    let imageBuffer;

    if (mode === 'v3') {
      // Init fontconfig BEFORE importing sharp-dependent modules
      const { initFontconfig } = await import('../../lib/fontLoader');
      initFontconfig();

      const sharp = (await import('sharp')).default;
      const { generateV3TextOverlay } = await import('../../lib/v3TextOverlay');

      // Generate text overlay (brand + title zones on transparent canvas)
      const textOverlay = await generateV3TextOverlay(targetWidth, targetHeight, elements);

      // Download and resize product image.
      // Force Accept: image/jpeg so Shopify CDN doesn't content-negotiate WebP;
      // sharp on this VPS image has no WebP support and would throw
      // "Input buffer contains unsupported image format" (caught on SM1408).
      const axios = (await import('axios')).default;
      const imgResp = await axios.get(productImageUrl, {
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: { 'Accept': 'image/jpeg,image/png,image/*;q=0.8' },
      });
      const resizedProduct = await sharp(Buffer.from(imgResp.data))
        .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
        .png()
        .toBuffer();

      // Composite text overlay onto product image
      // JPEG output (not PNG) — Instagram Graph container endpoint rejects
      // image/png with MEDIA_TYPE_PNG preflight error
      imageBuffer = await sharp(resizedProduct)
        .composite([{ input: textOverlay, top: 0, left: 0 }])
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } else {
      // Legacy mode
      const { processImageOverlay } = await import('../../lib/imageProcessor');
      imageBuffer = await processImageOverlay({
        productImageUrl,
        overlayImageUrl: elements['stt-cover'].url,
        titleText: elements['product-title']?.text || '',
        mode,
        elements,
        width: targetWidth,
        height: targetHeight,
      });
    }

    // Upload to R2
    const { uploadToR2 } = await import('../../lib/r2Storage');
    const { url, key } = await uploadToR2(imageBuffer, 'image/jpeg');

    return res.status(200).json({
      sizes: [{ url, width: targetWidth, height: targetHeight, key }],
      template,
      _version: API_VERSION,
    });
  } catch (error) {
    console.error('[API] overlay error:', error.message);
    return res.status(500).json({
      error: 'Failed to process image overlay',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
