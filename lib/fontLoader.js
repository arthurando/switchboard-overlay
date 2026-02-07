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
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

let fontconfigInitialized = false;

/**
 * Get the absolute path to the fonts directory
 */
export function getFontsDir() {
  return path.join(process.cwd(), 'fonts');
}

/**
 * Get the absolute path to a specific font file
 */
export function getFontPath(filename) {
  return path.join(getFontsDir(), filename);
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
  console.log(`[fontLoader] Registered fonts dir: ${fontsDir}`);
  console.log(`[fontLoader] Cache dir: ${cacheDir}`);
  console.log(`[fontLoader] FONTCONFIG_FILE: ${confPath}`);
}
