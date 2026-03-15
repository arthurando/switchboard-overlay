/**
 * V3 Text Overlay Generator
 * Multi-zone white text on transparent background for Social Content v3.
 *
 * Zone A: Top-left branding (brand-label) — white bold text
 * Zone B: Bottom-center product title with stt_code — white bold text on gradient
 *
 * Uses Sharp Pango text API with MElle HK Xbold (CJK + Latin).
 */

import sharp from 'sharp';
import fs from 'fs';
import { initFontconfig, getFontPath } from './fontLoader.js';

/**
 * Escape XML special characters for Pango markup
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
 * Render a text block as white text on transparent background.
 * Simple single-pass render — no shadow composite.
 * Returns { buffer, width, height }.
 */
async function renderTextBlock(text, fontSize, { maxWidth, fontPath, align = 'right' }) {
  const font = 'MElle HK Xbold';
  const escaped = escapeXml(text.trim());

  const opts = {
    text: `<span foreground="white" font_desc="${font} Bold ${fontSize}">${escaped}</span>`,
    font: `${font} ${fontSize}`,
    width: maxWidth,
    align,
    rgba: true,
    dpi: 72,
    wrap: 'word-char',
  };
  if (fontPath && fs.existsSync(fontPath)) opts.fontfile = fontPath;

  const buf = await sharp({ text: opts }).png().toBuffer();
  const meta = await sharp(buf).metadata();

  return { buffer: buf, width: meta.width, height: meta.height };
}

/**
 * Generate v3 text overlay: multi-zone white text on transparent background.
 *
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {Object} elements - Map of element names to { text } objects
 * @returns {Promise<Buffer>} - RGBA PNG buffer
 */
export async function generateV3TextOverlay(width, height, elements) {
  initFontconfig();

  const fontPath = getFontPath('MElle-HK-Xbold.ttf');
  const compositeInputs = [];

  // --- Zone A: Top-left branding ---
  const brandText = elements['brand-label']?.text || 'STT MALL HK';
  const brandBlock = await renderTextBlock(brandText, 60, { maxWidth: width - 80, fontPath, align: 'left' });
  compositeInputs.push({ input: brandBlock.buffer, top: 40, left: 40 });

  // --- Zone B: Bottom-center product title + stt_code ---
  const titleText = elements['product-title']?.text || '';
  const ctaText = elements['order-cta']?.text || '';

  // Extract stt_code from order-cta (e.g., "留言 SM1146 下單" → "SM1146")
  const codeMatch = ctaText.match(/[A-Z]{1,3}\d{3,5}/i);
  const sttCode = codeMatch ? codeMatch[0] : '';

  // Build the bottom line: "{stt_code} {Product Title}"
  const bottomLine = sttCode ? `${sttCode} ${titleText}` : titleText;

  if (bottomLine) {
    const textBlock = await renderTextBlock(bottomLine, 48, { maxWidth: width - 80, fontPath, align: 'center' });

    // Create a subtle dark gradient behind the text for readability
    const gradientHeight = textBlock.height + 80;
    const gradientSvg = Buffer.from(
      `<svg width="${width}" height="${gradientHeight}">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="black" stop-opacity="0"/>
            <stop offset="1" stop-color="black" stop-opacity="0.5"/>
          </linearGradient>
        </defs>
        <rect width="${width}" height="${gradientHeight}" fill="url(#g)"/>
      </svg>`
    );

    // Position gradient at bottom
    const gradientTop = height - gradientHeight;
    compositeInputs.push({ input: gradientSvg, top: gradientTop, left: 0 });

    // Center the text horizontally, 30px from bottom
    const textLeft = Math.max(0, Math.floor((width - textBlock.width) / 2));
    const textTop = height - textBlock.height - 30;
    compositeInputs.push({ input: textBlock.buffer, top: textTop, left: textLeft });
  }

  // --- Composite onto transparent canvas ---
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(compositeInputs)
    .png()
    .toBuffer();
}
