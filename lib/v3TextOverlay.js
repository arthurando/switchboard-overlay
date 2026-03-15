/**
 * V3 Text Overlay Generator
 * Multi-zone white text on transparent background for Social Content v3.
 *
 * Zone A: Top-left branding (brand-label) — white bold text
 * Zone B: Bottom-center product title with stt_code — white bold text on gradient
 *
 * Uses Sharp Pango text API with Elle Bold (Latin) and Noto Sans TC (CJK).
 */

import sharp from 'sharp';
import fs from 'fs';
import { initFontconfig, getFontPath } from './fontLoader.js';

const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u3040-\u309f\u30a0-\u30ff]/;

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
 * Render a text block with drop shadow for better readability.
 * Shadow: black text offset 2px down-right, blurred.
 * Foreground: white text on top.
 * Returns { buffer, width, height }.
 */
async function renderTextBlock(text, fontSize, { maxWidth, fontPath, align = 'right' }) {
  const font = 'MElle HK Xbold';
  const fontFile = fontPath;
  const escaped = escapeXml(text.trim());
  const shadowOffset = Math.max(2, Math.round(fontSize / 20));
  const shadowBlur = Math.max(3, Math.round(fontSize / 12));

  const baseOpts = {
    font: `${font} ${fontSize}`,
    width: maxWidth,
    align,
    rgba: true,
    dpi: 72,
    wrap: 'word-char',
  };
  // Render shadow (black text)
  const shadowPango = `<span foreground="black" font_desc="${font} Bold ${fontSize}">${escaped}</span>`;
  const shadowBuf = await sharp({ text: { ...baseOpts, text: shadowPango } })
    .blur(shadowBlur)
    .ensureAlpha()
    .png()
    .toBuffer();

  // Render foreground (white text)
  const fgPango = `<span foreground="white" font_desc="${font} Bold ${fontSize}">${escaped}</span>`;
  const fgBuf = await sharp({ text: { ...baseOpts, text: fgPango } }).png().toBuffer();
  const fgMeta = await sharp(fgBuf).metadata();

  // Composite: shadow (offset) + foreground on transparent canvas
  const canvasW = fgMeta.width + shadowOffset + shadowBlur * 2;
  const canvasH = fgMeta.height + shadowOffset + shadowBlur * 2;

  const buf = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: shadowBuf, top: shadowOffset, left: shadowOffset },
      { input: fgBuf, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  return { buffer: buf, width: canvasW, height: canvasH };
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
  const notoFontPath = getFontPath('MElle-HK-Xbold.ttf');
  const compositeInputs = [];

  // --- Zone A: Top-left branding (with shadow) ---
  const brandText = elements['brand-label']?.text || 'STT MALL HK';
  const brandBlock = await renderTextBlock(brandText, 60, { maxWidth: width - 80, fontPath, align: 'left' });
  compositeInputs.push({ input: brandBlock.buffer, top: 40, left: 40 });

  // --- Zone B: Bottom-center product title + stt_code ---
  // Format: "{Product Title}【{stt_code}】" — single line, centered, with gradient
  const titleText = elements['product-title']?.text || '';
  const ctaText = elements['order-cta']?.text || '';

  // Extract stt_code from order-cta (e.g., "留言 SM1146 下單" → "SM1146")
  const codeMatch = ctaText.match(/[A-Z]{1,3}\d{3,5}/i);
  const sttCode = codeMatch ? codeMatch[0] : '';

  // Build the bottom line: "Product Title【STT_CODE】"
  const bottomLine = sttCode ? `${titleText}【${sttCode}】` : titleText;

  if (bottomLine) {
    // Render the bottom-center text at 48px (with shadow)
    const textBlock = await renderTextBlock(bottomLine, 48, { maxWidth: width - 80, fontPath, align: 'center' });
    const textBuf = textBlock.buffer;
    const textMeta = { width: textBlock.width, height: textBlock.height };

    // Create a subtle dark gradient behind the text for readability
    const gradientHeight = textMeta.height + 80;
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
    const textLeft = Math.max(0, Math.floor((width - textMeta.width) / 2));
    const textTop = height - textMeta.height - 30;
    compositeInputs.push({ input: textBuf, top: textTop, left: textLeft });
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
