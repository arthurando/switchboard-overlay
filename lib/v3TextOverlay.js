/**
 * V3 Text Overlay Generator
 * Multi-zone white text on transparent background for Social Content v3.
 *
 * Zone A: Top-left branding (brand-label)
 * Zone B: Bottom-right stack (product-title, order-cta, variant-info)
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
 * Render a single text block as an RGBA PNG buffer.
 * Returns { buffer, width, height }.
 */
async function renderTextBlock(text, fontSize, { maxWidth, fontPath, notoFontPath }) {
  const isCJK = CJK_REGEX.test(text);
  const font = isCJK ? 'Noto Sans TC' : 'Elle Bold';
  const fontFile = isCJK ? notoFontPath : fontPath;
  const escaped = escapeXml(text.trim());

  const pango = `<span foreground="white" font_desc="${font} Bold ${fontSize}">${escaped}</span>`;
  const opts = {
    text: pango,
    font: `${font} ${fontSize}`,
    width: maxWidth,
    align: 'right',
    rgba: true,
    dpi: 72,
    wrap: 'word-char',
  };

  if (fs.existsSync(fontFile)) {
    opts.fontfile = fontFile;
  }

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

  const fontPath = getFontPath('elle-bold.ttf');
  const notoFontPath = getFontPath('NotoSansTC.ttf');
  const compositeInputs = [];

  // --- Zone A: Top-left branding ---
  const brandText = elements['brand-label']?.text || 'STT MALL HK';
  const brandIsCJK = CJK_REGEX.test(brandText);
  const brandFont = brandIsCJK ? 'Noto Sans TC' : 'Elle Bold';
  const brandFontFile = brandIsCJK ? notoFontPath : fontPath;
  const brandEscaped = escapeXml(brandText.trim());

  const brandPango = `<span foreground="white" font_desc="${brandFont} Bold 60">${brandEscaped}</span>`;
  const brandOpts = {
    text: brandPango,
    font: `${brandFont} 60`,
    rgba: true,
    dpi: 72,
  };
  if (fs.existsSync(brandFontFile)) {
    brandOpts.fontfile = brandFontFile;
  }

  const brandBuffer = await sharp({ text: brandOpts }).png().toBuffer();
  compositeInputs.push({ input: brandBuffer, top: 40, left: 40 });

  // --- Zone B: Bottom-right stack ---
  const rightMargin = 40;
  const bottomMargin = 100;
  const maxTextWidth = 600;
  const spacing = 8;
  const fontOpts = { maxWidth: maxTextWidth, fontPath, notoFontPath };

  const zoneBParts = [];

  if (elements['product-title']?.text) {
    zoneBParts.push(await renderTextBlock(elements['product-title'].text, 36, fontOpts));
  }
  if (elements['order-cta']?.text) {
    zoneBParts.push(await renderTextBlock(elements['order-cta'].text, 26, fontOpts));
  }
  if (elements['variant-info']?.text) {
    zoneBParts.push(await renderTextBlock(elements['variant-info'].text, 26, fontOpts));
  }

  // Stack vertically, right-aligned, anchored to bottom-right
  if (zoneBParts.length > 0) {
    const totalHeight = zoneBParts.reduce((s, p) => s + p.height, 0)
      + (zoneBParts.length - 1) * spacing;

    let cursorY = height - bottomMargin - totalHeight;

    for (const part of zoneBParts) {
      const leftX = Math.max(0, width - rightMargin - part.width);
      const topY = Math.max(0, cursorY);
      compositeInputs.push({ input: part.buffer, top: topY, left: leftX });
      cursorY += part.height + spacing;
    }
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
