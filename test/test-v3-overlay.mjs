/**
 * Test for v3 text overlay rendering
 * Tests multi-zone white text on transparent background
 *
 * Run: node test/test-v3-overlay.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Dynamic import of the v3 overlay module (file:// URL required on Windows ESM)
import { pathToFileURL } from 'url';
const { generateV3TextOverlay } = await import(
  pathToFileURL(path.join(projectRoot, 'lib', 'v3TextOverlay.js')).href
);

async function testV3Overlay() {
  const testCases = [
    {
      name: 'v3-full',
      desc: 'All zones populated',
      elements: {
        'brand-label': { text: 'STT MALL HK' },
        'product-title': { text: '韓國 Rejuran 修復面膜' },
        'order-cta': { text: '留言 ST0234 下單' },
        'variant-info': { text: '5片裝 | 25ml' },
      },
    },
    {
      name: 'v3-title-only',
      desc: 'Only brand + title',
      elements: {
        'brand-label': { text: 'STT MALL HK' },
        'product-title': { text: 'Premium Korean Skincare Set' },
      },
    },
    {
      name: 'v3-long-title',
      desc: 'Long CJK title that wraps',
      elements: {
        'brand-label': { text: 'STT MALL HK' },
        'product-title': { text: '韓國超人氣保濕修復面膜套裝組合限量版特別推出' },
        'order-cta': { text: '留言 ST9999 下單' },
        'variant-info': { text: '黑/白/粉紅 | S/M/L' },
      },
    },
    {
      name: 'v3-latin-only',
      desc: 'All Latin text (Elle Bold)',
      elements: {
        'brand-label': { text: 'STT MALL HK' },
        'product-title': { text: 'Summer Collection 2026' },
        'order-cta': { text: 'Comment ST1234 to order' },
        'variant-info': { text: 'Black/White | S/M/L' },
      },
    },
    {
      name: 'v3-no-brand',
      desc: 'No brand label (should use default)',
      elements: {
        'product-title': { text: '測試產品' },
        'order-cta': { text: '留言 ST0001 下單' },
      },
    },
    {
      name: 'v3-1350h',
      desc: '1080x1350 canvas (IG portrait)',
      width: 1080,
      height: 1350,
      elements: {
        'brand-label': { text: 'STT MALL HK' },
        'product-title': { text: '韓國 Rejuran 修復面膜' },
        'order-cta': { text: '留言 ST0234 下單' },
        'variant-info': { text: '5片裝 | 25ml' },
      },
    },
  ];

  // Create a dark background to verify white text is visible
  const makeBase = async (w = 1080, h = 1080) =>
    sharp({
      create: { width: w, height: h, channels: 3, background: { r: 40, g: 40, b: 40 } },
    }).png().toBuffer();

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const w = tc.width || 1080;
    const h = tc.height || 1080;
    console.log(`\n--- Test: ${tc.name} (${tc.desc}) [${w}x${h}] ---`);

    try {
      const overlay = await generateV3TextOverlay(w, h, tc.elements);

      // Basic assertions
      if (!overlay || !(overlay instanceof Buffer)) {
        throw new Error('generateV3TextOverlay must return a Buffer');
      }

      const meta = await sharp(overlay).metadata();
      if (meta.width !== w || meta.height !== h) {
        throw new Error(`Expected ${w}x${h}, got ${meta.width}x${meta.height}`);
      }
      if (meta.channels !== 4) {
        throw new Error(`Expected 4 channels (RGBA), got ${meta.channels}`);
      }

      // Composite onto dark background for visual verification
      const base = await makeBase(w, h);
      const result = await sharp(base)
        .composite([{ input: overlay, top: 0, left: 0 }])
        .png()
        .toBuffer();

      const outPath = path.join(projectRoot, `test-result-${tc.name}.png`);
      fs.writeFileSync(outPath, result);
      console.log(`  PASS - output: ${outPath} (${result.length} bytes)`);
      passed++;
    } catch (err) {
      console.error(`  FAIL - ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

testV3Overlay().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
