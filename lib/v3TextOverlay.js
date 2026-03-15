/**
 * V3 Text Overlay Generator (SVG-based)
 * Multi-zone white text on transparent background for Social Content v3.
 *
 * Zone A: Top-left branding (brand-label) — white bold text with drop shadow
 * Zone B: Bottom-center product title — white bold text on gradient with drop shadow
 *
 * Uses SVG rendered via Sharp's librsvg (fontconfig resolves "MElle HK Xbold").
 * No Pango text API, no fontfile parameter — CJK renders correctly on Vercel Lambda.
 */

import sharp from 'sharp';
import { initFontconfig } from './fontLoader.js';

/**
 * Escape XML special characters for SVG text content
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
 * Wrap text into lines that fit within maxWidth at the given fontSize.
 *
 * CJK characters are treated as ~0.9em wide each.
 * Latin characters are treated as ~0.55em wide each.
 * Spaces are natural break points for Latin words.
 *
 * Returns an array of line strings.
 */
function wrapText(text, fontSize, maxWidth) {
  const CJK_RANGE = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u3040-\u309f\u30a0-\u30ff\u3010\u3011]/;

  function charWidth(ch) {
    return CJK_RANGE.test(ch) ? fontSize * 0.9 : fontSize * 0.55;
  }

  function measureStr(str) {
    let w = 0;
    for (const ch of str) w += charWidth(ch);
    return w;
  }

  // Tokenise: each CJK char is its own token; Latin words stay grouped
  const tokens = [];
  let latin = '';
  for (const ch of text) {
    if (CJK_RANGE.test(ch)) {
      if (latin) { tokens.push(latin); latin = ''; }
      tokens.push(ch);
    } else if (ch === ' ' || ch === '\n') {
      if (latin) { tokens.push(latin); latin = ''; }
      tokens.push(ch);
    } else {
      latin += ch;
    }
  }
  if (latin) tokens.push(latin);

  const lines = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const token of tokens) {
    if (token === '\n') {
      lines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
      continue;
    }

    const tokenWidth = measureStr(token);

    if (currentLine === '') {
      // First token on line — always accept
      currentLine = token.trimStart();
      currentWidth = measureStr(currentLine);
    } else if (currentWidth + tokenWidth <= maxWidth) {
      currentLine += token;
      currentWidth += tokenWidth;
    } else {
      // Overflow — push current line, start new
      lines.push(currentLine);
      currentLine = token.trimStart();
      currentWidth = measureStr(currentLine);
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [''];
}

/**
 * Build SVG <text> tspan elements for wrapped lines.
 * Each line is a <tspan> positioned with dy for line spacing.
 */
function buildTspans(lines, x, startY, fontSize, anchor) {
  const lineHeight = fontSize * 1.3;
  return lines.map((line, i) => {
    const y = startY + i * lineHeight;
    return `<tspan x="${x}" y="${y}" text-anchor="${anchor}">${escapeXml(line)}</tspan>`;
  }).join('\n    ');
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

  const fontFamily = 'MElle HK Xbold';
  const maxWidth = width - 80;

  // --- Zone A: Brand label ---
  const brandText = elements['brand-label']?.text || 'STT MALL HK';
  const brandEscaped = escapeXml(brandText.trim());
  const brandFontSize = 60;
  // SVG <text> y is baseline; approximate baseline = top + fontSize * 0.85
  const brandY = 40 + Math.round(brandFontSize * 0.85);

  // --- Zone B: Product title ---
  const titleText = (elements['product-title']?.text || '').trim();
  const titleFontSize = 48;
  const titleLineHeight = titleFontSize * 1.3;

  let titleSvgContent = '';
  let gradientSvg = '';
  let gradientHeight = 0;
  let gradientTop = height;

  if (titleText) {
    const titleLines = wrapText(titleText, titleFontSize, maxWidth);
    const titleBlockHeight = titleLines.length * titleLineHeight;

    // Position: 30px from bottom edge
    const titleBottomMargin = 30;
    const titleBlockTop = height - titleBlockHeight - titleBottomMargin;

    // Gradient behind text
    gradientHeight = titleBlockHeight + 80;
    gradientTop = height - gradientHeight;

    // Center-aligned text: x at midpoint, text-anchor middle
    const centerX = Math.round(width / 2);
    const firstLineY = titleBlockTop + Math.round(titleFontSize * 0.85);

    const tspans = buildTspans(titleLines, centerX, firstLineY, titleFontSize, 'middle');
    titleSvgContent = `
  <text font-family="${fontFamily}" font-size="${titleFontSize}" fill="white" filter="url(#shadow)">
    ${tspans}
  </text>`;
  }

  if (gradientHeight > 0) {
    gradientSvg = `
  <rect x="0" y="${gradientTop}" width="${width}" height="${gradientHeight}" fill="url(#grad)"/>`;
  }

  // --- Build full SVG ---
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="black" stop-opacity="0"/>
      <stop offset="1" stop-color="black" stop-opacity="0.5"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.8"/>
    </filter>
  </defs>${gradientSvg}
  <text x="40" y="${brandY}" font-family="${fontFamily}" font-size="${brandFontSize}" fill="white" filter="url(#shadow)">${brandEscaped}</text>${titleSvgContent}
</svg>`;

  const overlay = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .png()
    .toBuffer();

  return overlay;
}
