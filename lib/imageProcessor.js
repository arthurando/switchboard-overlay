/**
 * Image Processing Library
 * Uses Sharp for high-performance image manipulation
 * Supports product image + overlay compositing with text overlay
 *
 * Text rendering uses Sharp's Pango-based text API for:
 * - Direct TTF font loading (no system font dependency)
 * - CJK character support via Noto Sans TC
 * - Automatic word-char wrapping (handles Chinese text)
 */

import sharp from 'sharp';
import axios from 'axios';
import { initFontconfig, getFontPath } from './fontLoader.js';

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
      headers: {
        'User-Agent': 'Switchboard-Overlay/1.0',
      },
    });

    return Buffer.from(response.data);
  } catch (error) {
    throw new Error(`Failed to download image from ${url}: ${error.message}`);
  }
}

/**
 * Escape XML special characters for safe Pango markup embedding
 */
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate text overlay image using Sharp's Pango-based text API
 *
 * This replaces the old SVG @font-face approach which didn't work because
 * librsvg (Sharp's SVG renderer) ignores @font-face CSS rules.
 *
 * Instead, we:
 * 1. Register fonts with fontconfig so Pango can find them
 * 2. Use Sharp's text API with Pango markup for styling
 * 3. Use fontfile parameter for direct Elle Bold loading
 * 4. Pango handles CJK fallback to Noto Sans TC automatically
 *
 * Text specs (on 1080x1080 canvas):
 * - Position: bottom-right area (x=235..1070, y=~824..~995)
 * - Font: Elle Bold, 35px, letter-spacing 0.074em
 * - Color: black text on white background
 * - Alignment: right-aligned, bottom-aligned
 * - Background: white with 13px padding
 *
 * @param {string} text - Product title text
 * @param {number} canvasWidth - Canvas width (default 1080)
 * @param {number} canvasHeight - Canvas height (default 1080)
 * @returns {Promise<Buffer|null>} - PNG buffer for Sharp compositing, or null if no text
 */
async function generateTextOverlay(text, canvasWidth = 1080, canvasHeight = 1080) {
  if (!text || !text.trim()) return null;

  // Initialize fontconfig to register our fonts directory
  initFontconfig();

  const fontSize = 35;
  // Letter spacing: 0.074em = 0.074 * 35px = 2.59px = 2.59pt (at 72dpi)
  // Pango letter_spacing is in 1/1024 of a point: 2.59 * 1024 ≈ 2652
  const letterSpacingPango = Math.round(fontSize * 0.074 * 1024);
  const padding = 13;
  const bottomOffset = 85; // raise text block up from canvas bottom
  const textBoxWidth = 835;
  const textBoxX = 235;
  const rightEdge = textBoxX + textBoxWidth; // 1070

  const fontPath = getFontPath('elle-bold.ttf');
  const notoFontPath = getFontPath('NotoSansTC.ttf');
  const escapedText = escapeXml(text.trim());

  // Pango markup: specify font family with CJK fallback, letter spacing, and color
  const pangoMarkup = `<span letter_spacing="${letterSpacingPango}" foreground="black">${escapedText}</span>`;

  console.log(`[textOverlay] Rendering: "${text.trim().substring(0, 50)}..." (${text.trim().length} chars)`);
  console.log(`[textOverlay] Elle Bold font: ${fontPath}`);
  console.log(`[textOverlay] Noto Sans TC font: ${notoFontPath}`);

  // Detect if text contains CJK characters
  const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u3040-\u309f\u30a0-\u30ff]/.test(text);

  // Render text using Sharp's Pango text API
  // Strategy: use fontfile for direct font loading (most reliable on serverless)
  // For CJK text: use Noto Sans TC (supports both Latin + CJK)
  // For Latin-only text: use Elle Bold
  //
  // Also use fontconfig (via initFontconfig) as fallback font discovery
  // IMPORTANT: Font family must match the TTF's internal family name exactly.
  // Our NotoSansTC.ttf has internal name "Noto Sans TC Thin" (not "Noto Sans TC").
  const primaryFont = hasCJK ? 'Noto Sans TC Thin' : 'Elle Bold';
  const primaryFontFile = hasCJK ? notoFontPath : fontPath;

  console.log(`[textOverlay] Using font: ${primaryFont} (CJK: ${hasCJK})`);
  console.log(`[textOverlay] fontfile: ${primaryFontFile}`);

  // Check fontfile existence synchronously
  const fsSync = await import('fs');
  const fontfileExists = fsSync.existsSync(primaryFontFile);
  console.log(`[textOverlay] fontfile exists: ${fontfileExists}`);
  if (fontfileExists) {
    console.log(`[textOverlay] fontfile size: ${fsSync.statSync(primaryFontFile).size} bytes`);
  }

  const textOpts = {
    text: pangoMarkup,
    font: `${primaryFont} ${fontSize}`,
    width: textBoxWidth - padding * 2,
    align: 'right',
    rgba: true,
    dpi: 72,
    wrap: 'word-char',
  };

  // Only use fontfile if the file exists
  if (fontfileExists) {
    textOpts.fontfile = primaryFontFile;
    console.log(`[textOverlay] ✅ fontfile set: ${primaryFontFile}`);
  } else {
    console.log(`[textOverlay] ⚠️ fontfile not found, relying on fontconfig only`);
  }

  const textImage = sharp({ text: textOpts });

  const textBuffer = await textImage.png().toBuffer();
  const textMeta = await sharp(textBuffer).metadata();

  const textWidth = textMeta.width;
  const textHeight = textMeta.height;

  console.log(`[textOverlay] Text rendered: ${textWidth}x${textHeight}px`);

  // Create white background with text positioned inside (with padding)
  const bgWidth = textWidth + padding * 2;
  const bgHeight = textHeight + padding * 2;

  const bgWithText = await sharp({
    create: {
      width: bgWidth,
      height: bgHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    }
  })
    .composite([{
      input: textBuffer,
      top: padding,
      left: padding,
    }])
    .png()
    .toBuffer();

  // Position the text block on the full canvas: bottom-right area
  const bgTopY = Math.max(0, canvasHeight - bgHeight - bottomOffset);
  const bgLeftX = Math.max(0, rightEdge - bgWidth);

  console.log(`[textOverlay] Positioned at (${bgLeftX}, ${bgTopY}), bg size: ${bgWidth}x${bgHeight}`);

  // Create full canvas-sized transparent image with text block positioned
  const fullOverlay = await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }
  })
    .composite([{
      input: bgWithText,
      top: bgTopY,
      left: bgLeftX,
    }])
    .png()
    .toBuffer();

  return fullOverlay;
}

/**
 * Process image overlay
 *
 * @param {Object} options
 * @param {string} options.productImageUrl - Base product image URL
 * @param {string} options.overlayImageUrl - Overlay/frame image URL
 * @param {string} options.titleText - Product title text (optional)
 * @param {number} options.width - Target width (default: 1080)
 * @param {number} options.height - Target height (default: 1080)
 * @returns {Promise<Buffer>} - Processed image buffer
 */
export async function processImageOverlay({
  productImageUrl,
  overlayImageUrl,
  titleText = '',
  width = 1080,
  height = 1080,
}) {
  try {
    // Download both images concurrently
    const [productImageBuffer, overlayImageBuffer] = await Promise.all([
      downloadImage(productImageUrl),
      downloadImage(overlayImageUrl),
    ]);

    // Step 1: Resize product image to target dimensions
    const resizedProductImage = await sharp(productImageBuffer)
      .resize(width, height, {
        fit: 'cover', // Cover the entire area (crop if needed)
        position: 'center',
      })
      .toBuffer();

    // Step 2: Get overlay image metadata
    const overlayMetadata = await sharp(overlayImageBuffer).metadata();

    // Step 3: Resize overlay to match target dimensions if needed
    let processedOverlay = overlayImageBuffer;
    if (overlayMetadata.width !== width || overlayMetadata.height !== height) {
      processedOverlay = await sharp(overlayImageBuffer)
        .resize(width, height, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();
    }

    // Step 4: Build composite layers (order matters: text first, then cover frame on top)
    const compositeInputs = [];

    // Step 5: Add text overlay FIRST so it sits underneath the cover frame
    if (titleText && titleText.trim()) {
      const textOverlayBuffer = await generateTextOverlay(titleText.trim(), width, height);
      if (textOverlayBuffer) {
        compositeInputs.push({
          input: textOverlayBuffer,
          top: 0,
          left: 0,
        });
      }
    }

    // Step 6: Cover frame goes on top of everything
    compositeInputs.push({
      input: processedOverlay,
      gravity: 'center',
    });

    // Step 7: Composite all layers onto product image
    const finalImage = await sharp(resizedProductImage)
      .composite(compositeInputs)
      .png({ quality: 90, compressionLevel: 6 })
      .toBuffer();

    return finalImage;

  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
}
