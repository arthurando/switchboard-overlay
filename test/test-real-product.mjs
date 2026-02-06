import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function getBase64Font() {
  return fs.readFileSync(path.join(projectRoot, 'fonts', 'elle-bold.ttf')).toString('base64');
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

function escapeXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function estimateTextWidth(text, fontSize, letterSpacingEm) {
  const avgCharWidth = fontSize * 0.58;
  const letterSpacingPx = fontSize * letterSpacingEm;
  return text.length * avgCharWidth + Math.max(0, text.length - 1) * letterSpacingPx;
}

function wrapText(text, maxWidth, fontSize, letterSpacingEm) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${cur} ${words[i]}`;
    if (estimateTextWidth(test, fontSize, letterSpacingEm) <= maxWidth) {
      cur = test;
    } else {
      lines.push(cur);
      cur = words[i];
    }
  }
  lines.push(cur);
  return lines;
}

function generateTextSVG(text, w = 1080, h = 1080) {
  const fontSize = 35, letterSpacingEm = 0.074, padding = 13;
  const bottomOffset = 85;
  const lineHeight = fontSize * 1.2;
  const textBoxX = 235, textBoxWidth = 835;
  const rightEdge = textBoxX + textBoxWidth;
  const lines = wrapText(text, textBoxWidth - padding * 2, fontSize, letterSpacingEm);
  if (!lines.length) return null;

  const maxLineWidth = Math.max(...lines.map(l => estimateTextWidth(l, fontSize, letterSpacingEm)));
  const bgWidth = maxLineWidth + padding * 2;

  const totalTextHeight = lines.length * lineHeight;
  const bgHeight = totalTextHeight + padding * 2;

  const bgTopY = h - bgHeight - bottomOffset;
  const bgLeftX = rightEdge - bgWidth;
  const firstBaseY = bgTopY + padding + fontSize;

  const tspans = lines.map((line, i) =>
    `<tspan x="${rightEdge - padding}" y="${firstBaseY + i * lineHeight}">${escapeXml(line)}</tspan>`
  ).join('\n        ');

  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><style>${getFontFaceCSS()}</style></defs>
    <rect x="${bgLeftX}" y="${bgTopY}" width="${bgWidth}" height="${bgHeight}" fill="white" />
    <text font-family="Elle, sans-serif" font-weight="700" font-size="${fontSize}px"
          letter-spacing="${letterSpacingEm}em" fill="black" text-anchor="end">
      ${tspans}
    </text>
  </svg>`);
}

async function downloadImage(url) {
  const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return Buffer.from(data);
}

async function main() {
  const productUrl = 'https://cdn.shopify.com/s/files/1/0712/1135/2318/files/IMG-0786.jpg?v=1769966884';
  const coverUrl = 'https://i.postimg.cc/4dv39JsQ/cover.png';
  const titleText = '韓國 Wacky Willy Reel Cap【WW117】';

  console.log('Downloading product image + cover frame...');
  const [productBuf, coverBuf] = await Promise.all([
    downloadImage(productUrl),
    downloadImage(coverUrl),
  ]);
  console.log(`Product: ${productBuf.length} bytes, Cover: ${coverBuf.length} bytes`);

  // Resize product to 1080x1080
  const resized = await sharp(productBuf)
    .resize(1080, 1080, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  // Resize cover frame to 1080x1080
  const coverMeta = await sharp(coverBuf).metadata();
  let processedCover = coverBuf;
  if (coverMeta.width !== 1080 || coverMeta.height !== 1080) {
    processedCover = await sharp(coverBuf)
      .resize(1080, 1080, { fit: 'cover', position: 'center' })
      .toBuffer();
  }

  // Generate text SVG
  const textSvg = generateTextSVG(titleText);

  // Composite: product base -> text underneath -> cover frame on top
  const compositeInputs = [];
  if (textSvg) {
    compositeInputs.push({ input: textSvg, top: 0, left: 0 });
  }
  compositeInputs.push({ input: processedCover, gravity: 'center' });

  const result = await sharp(resized)
    .composite(compositeInputs)
    .png()
    .toBuffer();

  const outPath = path.join('C:\\Users\\user\\Desktop', 'test-result-real.png');
  fs.writeFileSync(outPath, result);
  console.log(`Output: ${outPath} (${result.length} bytes)`);
}

main().catch(console.error);
