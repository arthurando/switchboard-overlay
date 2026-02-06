/**
 * Local test for text overlay rendering
 * Tests SVG text generation with Sharp without needing API/R2
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Simulate the font loader
function getBase64Font() {
  const fontPath = path.join(projectRoot, 'fonts', 'elle-bold.ttf');
  return fs.readFileSync(fontPath).toString('base64');
}

function getFontFaceCSS() {
  const base64 = getBase64Font();
  return `@font-face {
      font-family: 'Elle';
      src: url('data:font/truetype;base64,${base64}') format('truetype');
      font-weight: 700;
      font-style: normal;
    }`;
}

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function estimateTextWidth(text, fontSize, letterSpacingEm) {
  const avgCharWidth = fontSize * 0.58;
  const letterSpacingPx = fontSize * letterSpacingEm;
  const charCount = text.length;
  return charCount * avgCharWidth + Math.max(0, charCount - 1) * letterSpacingPx;
}

function wrapText(text, maxWidth, fontSize, letterSpacingEm) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let currentLine = words[0];
  for (let i = 1; i < words.length; i++) {
    const testLine = `${currentLine} ${words[i]}`;
    if (estimateTextWidth(testLine, fontSize, letterSpacingEm) <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

function generateTextSVG(text, canvasWidth = 1080, canvasHeight = 1080) {
  const fontSize = 35;
  const letterSpacingEm = 0.074;
  const padding = 13;
  const lineHeight = fontSize * 1.2;
  const textBoxX = 235;
  const textBoxWidth = 835;
  const rightEdge = textBoxX + textBoxWidth;

  const fontFaceCSS = getFontFaceCSS();
  const lines = wrapText(text, textBoxWidth - padding * 2, fontSize, letterSpacingEm);
  if (lines.length === 0) return null;

  const totalTextHeight = lines.length * lineHeight;
  const bgHeight = totalTextHeight + padding * 2;
  const bgTopY = canvasHeight - bgHeight;
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
    <rect x="${textBoxX}" y="${bgTopY}" width="${textBoxWidth}" height="${bgHeight}" fill="white" />
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

async function testTextOverlay() {
  const testCases = [
    { name: 'short', text: 'Simple Title' },
    { name: 'medium', text: 'Premium Quality Product With Longer Name' },
    { name: 'long', text: 'This Is A Very Long Product Title That Should Wrap To Multiple Lines On The Canvas' },
    { name: 'special', text: 'Tom & Jerry\'s <Special> "Edition"' },
  ];

  // Create a 1080x1080 grey background as base
  const baseImage = await sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 3,
      background: { r: 200, g: 200, b: 200 },
    },
  }).png().toBuffer();

  for (const tc of testCases) {
    console.log(`\nTest: ${tc.name} -> "${tc.text}"`);
    const lines = wrapText(tc.text, 835 - 26, 35, 0.074);
    console.log(`  Lines: ${lines.length} -> ${JSON.stringify(lines)}`);

    const svgBuffer = generateTextSVG(tc.text);
    if (!svgBuffer) {
      console.log('  SKIP: no SVG generated');
      continue;
    }

    const result = await sharp(baseImage)
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png()
      .toBuffer();

    const outPath = path.join(projectRoot, `test-result-${tc.name}.png`);
    fs.writeFileSync(outPath, result);
    console.log(`  Output: ${outPath} (${result.length} bytes)`);
  }

  console.log('\nAll tests complete! Check test-result-*.png files.');
}

testTextOverlay().catch(console.error);
