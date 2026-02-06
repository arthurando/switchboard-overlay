/**
 * Image Processing Library
 * Uses Sharp for high-performance image manipulation
 */

import sharp from 'sharp';
import axios from 'axios';

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
 * Process image overlay
 *
 * @param {Object} options
 * @param {string} options.productImageUrl - Base product image URL
 * @param {string} options.overlayImageUrl - Overlay/frame image URL
 * @param {string} options.titleText - Product title text (optional, for future use)
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

    // Step 4: Composite overlay on top of product image
    const finalImage = await sharp(resizedProductImage)
      .composite([
        {
          input: processedOverlay,
          gravity: 'center',
        },
      ])
      .png({ quality: 90, compressionLevel: 6 })
      .toBuffer();

    return finalImage;

  } catch (error) {
    console.error('Image processing error:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Alternative: Process with text overlay support (future enhancement)
 */
export async function processImageWithText({
  productImageUrl,
  overlayImageUrl,
  titleText,
  width = 1080,
  height = 1080,
  textOptions = {},
}) {
  // For future implementation: Add text rendering using sharp's text() method
  // or composite with SVG text overlay

  const imageBuffer = await processImageOverlay({
    productImageUrl,
    overlayImageUrl,
    titleText,
    width,
    height,
  });

  // If titleText provided, add it to the image
  if (titleText && titleText.trim()) {
    // SVG text overlay implementation
    const textSvg = `
      <svg width="${width}" height="${height}">
        <style>
          .title {
            fill: ${textOptions.color || '#ffffff'};
            font-size: ${textOptions.fontSize || 48}px;
            font-family: ${textOptions.fontFamily || 'Arial, sans-serif'};
            font-weight: bold;
            text-anchor: middle;
          }
        </style>
        <text x="50%" y="${textOptions.y || height - 100}" class="title">${escapeXml(titleText)}</text>
      </svg>
    `;

    return await sharp(imageBuffer)
      .composite([
        {
          input: Buffer.from(textSvg),
          gravity: 'center',
        },
      ])
      .png()
      .toBuffer();
  }

  return imageBuffer;
}

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
