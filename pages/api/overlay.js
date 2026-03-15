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
import { processImageOverlay } from '../../lib/imageProcessor';
import { uploadToR2 } from '../../lib/r2Storage';
import { getFontsDir, getFontPath } from '../../lib/fontLoader';

const API_VERSION = '2026-02-07';

// IMPORTANT: Explicit file references for Vercel's @vercel/nft file tracer.
// Without these, font files may not be included in the serverless bundle.
const _fontTraceRefs = [
  path.join(process.cwd(), 'fonts', 'elle-bold.ttf'),
  path.join(process.cwd(), 'fonts', 'NotoSansTC.ttf'),
  path.join(process.cwd(), 'fonts', 'MElle-HK-Xbold.ttf'),
].filter(p => fs.existsSync(p));

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
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

    // Process the image
    const imageBuffer = await processImageOverlay({
      productImageUrl,
      overlayImageUrl,
      titleText,
      mode,
      elements,
      width: targetWidth,
      height: targetHeight,
    });

    // Upload to R2
    const { url, key } = await uploadToR2(imageBuffer, 'image/png');

    console.log(`[API] ✅ Uploaded to R2: ${url}`);

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
