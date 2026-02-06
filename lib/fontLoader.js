/**
 * Font Loader for SVG Text Rendering
 * Reads Elle Bold TTF, caches as base64 for embedding in SVG @font-face
 */

import fs from 'fs';
import path from 'path';

let cachedBase64 = null;

/**
 * Get base64-encoded font data (cached after first read)
 */
export function getBase64Font() {
  if (!cachedBase64) {
    const fontPath = path.join(process.cwd(), 'fonts', 'elle-bold.ttf');
    const fontBuffer = fs.readFileSync(fontPath);
    cachedBase64 = fontBuffer.toString('base64');
  }
  return cachedBase64;
}

/**
 * Get @font-face CSS block for SVG embedding
 */
export function getFontFaceCSS() {
  const base64 = getBase64Font();
  return `@font-face {
      font-family: 'Elle';
      src: url('data:font/truetype;base64,${base64}') format('truetype');
      font-weight: 700;
      font-style: normal;
    }`;
}
