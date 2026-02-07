/**
 * Font Loader & Fontconfig Registration
 *
 * Registers the fonts/ directory with fontconfig so that:
 * - librsvg (Sharp SVG renderer) can find custom fonts
 * - Pango (Sharp text API) can find custom fonts
 *
 * Fonts:
 * - Elle Bold (elle-bold.ttf) — Display font for Latin text
 * - Noto Sans TC (NotoSansTC.ttf) — CJK font for Chinese characters
 *
 * On Vercel serverless, font files may not be at process.cwd().
 * This module searches multiple candidate paths and copies fonts
 * to /tmp/switchboard-fonts/ for reliable access.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let fontconfigInitialized = false;
let resolvedFontsDir = null;

const FONT_FILES = ['elle-bold.ttf', 'NotoSansTC.ttf'];
const TMP_FONTS_DIR = path.join(os.tmpdir(), 'switchboard-fonts');

/**
 * Find the fonts directory by checking multiple candidate paths.
 * If found, copies fonts to /tmp for guaranteed access.
 */
function findFontsDir() {
  if (resolvedFontsDir) return resolvedFontsDir;

  const candidates = [
    path.join(__dirname, '..', 'fonts'),       // relative to lib/ (most reliable)
    path.join(process.cwd(), 'fonts'),          // project root
    path.join(process.cwd(), '..', 'fonts'),    // one level up
    '/var/task/fonts',                           // Vercel /var/task
  ];

  console.log(`[fontLoader] __dirname: ${__dirname}`);
  console.log(`[fontLoader] process.cwd(): ${process.cwd()}`);

  // Find the first source directory with fonts
  let sourceDir = null;
  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    console.log(`[fontLoader] Checking candidate: ${resolved}`);

    if (!fs.existsSync(resolved)) {
      console.log(`[fontLoader]   → does not exist`);
      continue;
    }

    const found = FONT_FILES.filter(f => fs.existsSync(path.join(resolved, f)));
    console.log(`[fontLoader]   → found ${found.length}/${FONT_FILES.length} fonts: ${found.join(', ')}`);

    if (found.length > 0) {
      sourceDir = resolved;
      break;
    }
  }

  // Check if /tmp already has correct fonts (validates sizes against source)
  if (sourceDir && allFontsExistIn(TMP_FONTS_DIR, sourceDir)) {
    resolvedFontsDir = TMP_FONTS_DIR;
    console.log(`[fontLoader] ✅ Fonts already in tmp (size-verified): ${TMP_FONTS_DIR}`);
    return resolvedFontsDir;
  }

  if (sourceDir) {
    // Copy fonts to /tmp (force overwrite to handle stale cache)
    copyFontsToTmp(sourceDir, FONT_FILES.filter(f => fs.existsSync(path.join(sourceDir, f))));
    resolvedFontsDir = TMP_FONTS_DIR;
    console.log(`[fontLoader] ✅ Copied fonts to: ${TMP_FONTS_DIR}`);
    return resolvedFontsDir;
  }

  // Fallback: use __dirname-based path directly
  resolvedFontsDir = path.resolve(path.join(__dirname, '..', 'fonts'));
  console.log(`[fontLoader] ⚠️ No fonts found, falling back to: ${resolvedFontsDir}`);
  return resolvedFontsDir;
}

/**
 * Check if all required font files exist in a directory with correct sizes.
 * Compares against source fonts to detect stale /tmp cache from old deployments.
 */
function allFontsExistIn(dir, sourceDir) {
  if (!fs.existsSync(dir)) return false;
  return FONT_FILES.every(f => {
    const tmpPath = path.join(dir, f);
    if (!fs.existsSync(tmpPath)) return false;
    // If source dir provided, validate file sizes match
    if (sourceDir) {
      const srcPath = path.join(sourceDir, f);
      if (fs.existsSync(srcPath)) {
        const srcSize = fs.statSync(srcPath).size;
        const tmpSize = fs.statSync(tmpPath).size;
        if (srcSize !== tmpSize) {
          console.log(`[fontLoader] ⚠️ Size mismatch for ${f}: src=${srcSize}, tmp=${tmpSize} - will re-copy`);
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * Copy font files to /tmp for guaranteed serverless access
 */
function copyFontsToTmp(sourceDir, fontFiles) {
  if (!fs.existsSync(TMP_FONTS_DIR)) {
    fs.mkdirSync(TMP_FONTS_DIR, { recursive: true });
  }

  for (const fontFile of fontFiles) {
    const src = path.join(sourceDir, fontFile);
    const dst = path.join(TMP_FONTS_DIR, fontFile);
    const srcSize = fs.statSync(src).size;
    const dstExists = fs.existsSync(dst);
    const dstSize = dstExists ? fs.statSync(dst).size : 0;

    // Always copy if sizes differ (handles font file updates across deployments)
    if (!dstExists || srcSize !== dstSize) {
      fs.copyFileSync(src, dst);
      console.log(`[fontLoader] Copied ${fontFile} (${(srcSize / 1024 / 1024).toFixed(1)}MB) → ${dst}${dstExists ? ' (replaced stale cache)' : ''}`);
    }
  }
}

/**
 * Get the absolute path to the fonts directory
 */
export function getFontsDir() {
  return findFontsDir();
}

/**
 * Get the absolute path to a specific font file
 */
export function getFontPath(filename) {
  const fontPath = path.join(getFontsDir(), filename);
  const exists = fs.existsSync(fontPath);
  if (!exists) {
    console.error(`[fontLoader] ❌ Font file NOT found: ${fontPath}`);
  } else {
    const size = fs.statSync(fontPath).size;
    console.log(`[fontLoader] ✅ Font file: ${fontPath} (${(size / 1024).toFixed(0)}KB)`);
  }
  return fontPath;
}

/**
 * Register fonts directory with fontconfig
 * Creates a fonts.conf in /tmp that points to our fonts/ directory
 * Sets FONTCONFIG_FILE env var so librsvg and Pango can find our fonts
 */
export function initFontconfig() {
  if (fontconfigInitialized) return;

  const fontsDir = getFontsDir();
  const cacheDir = path.join(os.tmpdir(), 'switchboard-fc-cache');
  const confPath = path.join(os.tmpdir(), 'switchboard-fonts.conf');

  // Create fontconfig cache directory
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // List font files found
  try {
    const files = fs.readdirSync(fontsDir);
    console.log(`[fontLoader] Font files in ${fontsDir}: ${files.join(', ')}`);
  } catch (e) {
    console.error(`[fontLoader] ❌ Cannot read fonts dir ${fontsDir}: ${e.message}`);
  }

  // Write fontconfig configuration
  // Registers fonts directory AND sets up CJK fallback chain:
  // Elle Bold → Noto Sans TC (for Chinese/CJK characters)
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>

  <!-- Match "Elle" family -->
  <match target="pattern">
    <test name="family"><string>Elle</string></test>
    <edit name="family" mode="prepend" binding="strong">
      <string>Elle</string>
    </edit>
  </match>

  <!-- Match "Elle Bold" family (Pango may parse font desc as family="Elle Bold") -->
  <match target="pattern">
    <test name="family"><string>Elle Bold</string></test>
    <edit name="family" mode="prepend" binding="strong">
      <string>Elle Bold</string>
    </edit>
  </match>

  <!-- CJK fallback: append Noto Sans TC when Elle cannot render characters -->
  <!-- IMPORTANT: Must use "Noto Sans TC" - the actual internal family name of NotoSansTC.ttf -->
  <match target="pattern">
    <test name="family"><string>Elle</string></test>
    <edit name="family" mode="append" binding="weak">
      <string>Noto Sans TC</string>
    </edit>
  </match>

  <match target="pattern">
    <test name="family"><string>Elle Bold</string></test>
    <edit name="family" mode="append" binding="weak">
      <string>Noto Sans TC</string>
    </edit>
  </match>

  <!-- Default sans-serif fallback to Noto Sans TC -->
  <match target="pattern">
    <test name="family"><string>sans-serif</string></test>
    <edit name="family" mode="prepend" binding="strong">
      <string>Noto Sans TC</string>
    </edit>
  </match>

  <!-- Global fallback: any unresolved font gets Noto Sans TC -->
  <match target="pattern">
    <edit name="family" mode="append_last">
      <string>Noto Sans TC</string>
    </edit>
  </match>
</fontconfig>`;

  fs.writeFileSync(confPath, conf);
  process.env.FONTCONFIG_FILE = confPath;

  fontconfigInitialized = true;
  console.log(`[fontLoader] ✅ Fontconfig written: ${confPath}`);
  console.log(`[fontLoader] ✅ Fonts dir: ${fontsDir}`);
}
