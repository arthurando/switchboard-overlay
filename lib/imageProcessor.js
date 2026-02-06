/**
 * Image Processing Library
 * Uses Sharp for high-performance image manipulation
 * Supports product image + overlay compositing with optional text overlay
 */

import sharp from 'sharp';
import axios from 'axios';
import { getFontFaceCSS } from './fontLoader.js';

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
 * Escape XML special characters for safe SVG embedding
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
 * Estimate text width for a line using character-level approximation
 * Elle Bold is a sans-serif with consistent glyph widths
 *
 * @param {string} text - Text to measure
 * @param {number} fontSize - Font size in px
 * @param {number} letterSpacingEm - Letter spacing in em units
 * @returns {number} - Estimated width in px
 */
function estimateTextWidth(text, fontSize, letterSpacingEm) {
  const avgCharWidth = fontSize * 0.58; // Sans-serif bold average
  const letterSpacingPx = fontSize * letterSpacingEm;
  const charCount = text.length;
  return charCount * avgCharWidth + Math.max(0, charCount - 1) * letterSpacingPx;
}

/**
 * Wrap text into lines that fit within maxWidth
 *
 * @param {string} text - Input text
 * @param {number} maxWidth - Max width in px
 * @param {number} fontSize - Font size in px
 * @param {number} letterSpacingEm - Letter spacing in em units
 * @returns {string[]} - Array of text lines
 */
function wrapText(text, maxWidth, fontSize, letterSpacingEm) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    const testWidth = estimateTextWidth(testLine, fontSize, letterSpacingEm);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);

  return lines;
}

/**
 * Generate SVG with text overlay for compositing onto the product image
 *
 * Text specs (on 1080x1080 canvas):
 * - Position: x=235..1070, y=824..1080 (bottom-right area)
 * - Font: Elle Bold, 35px, letter-spacing 0.074em
 * - Color: black text on white background
 * - Alignment: right-aligned, bottom-aligned
 * - Background: white with 13px padding
 *
 * @param {string} text - Product title text
 * @param {number} canvasWidth - Canvas width (default 1080)
 * @param {number} canvasHeight - Canvas height (default 1080)
 * @returns {Buffer} - SVG as buffer for Sharp compositing
 */
function generateTextSVG(text, canvasWidth = 1080, canvasHeight = 1080) {
  const fontSize = 35;
  const letterSpacingEm = 0.074;
  const padding = 13;
  const bottomOffset = 85; // raise text up from canvas bottom
  const lineHeight = fontSize * 1.2;
  const textBoxWidth = 835;
  const textBoxX = 235;
  const rightEdge = textBoxX + textBoxWidth; // 1070

  const fontFaceCSS = getFontFaceCSS();
  const lines = wrapText(text, textBoxWidth - padding * 2, fontSize, letterSpacingEm);

  if (lines.length === 0) return null;

  // Calculate widest line to size background to text only
  const maxLineWidth = Math.max(...lines.map(l => estimateTextWidth(l, fontSize, letterSpacingEm)));
  const bgWidth = maxLineWidth + padding * 2;

  const totalTextHeight = lines.length * lineHeight;
  const bgHeight = totalTextHeight + padding * 2;

  // Bottom-aligned with offset: raised up from canvas bottom
  const bgTopY = canvasHeight - bgHeight - bottomOffset;
  const bgLeftX = rightEdge - bgWidth; // right-align the background
  const firstLineBaselineY = bgTopY + padding + fontSize;

  const tspans = lines.map((line, i) => {
    const y = firstLineBaselineY + i * lineHeight;
    return `<tspan x="${rightEdge - padding}" y="${y}">${escapeXml(line)}</tspan>`;
  }).join('\n        ');

  const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        ${fontFaceCSS}
      </style>
    </defs>
    <rect x="${bgLeftX}" y="${bgTopY}" width="${bgWidth}" height="${bgHeight}" fill="white" />
    <text
      font-family="Elle, sans-serif"
      font-weight="700"
      font-size="${fontSize}px"
      letter-spacing="${letterSpacingEm}em"
      fill="black"
      text-anchor="end"
    >
      ${tspans}
    </text>
  </svg>`;

  return Buffer.from(svg);
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
      const textSvgBuffer = generateTextSVG(titleText.trim(), width, height);
      if (textSvgBuffer) {
        compositeInputs.push({
          input: textSvgBuffer,
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
