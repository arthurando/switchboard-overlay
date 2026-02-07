/**
 * Debug endpoint to check font file availability on Vercel
 * GET /api/debug-fonts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFontsDir, getFontPath, initFontconfig } from '../../lib/fontLoader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT: This reference ensures Vercel's file tracer includes the fonts
// Without explicit fs references, outputFileTracingIncludes may not work
const FONT_REFS = [
  path.join(process.cwd(), 'fonts', 'elle-bold.ttf'),
  path.join(process.cwd(), 'fonts', 'NotoSansTC.ttf'),
];

export default async function handler(req, res) {
  const results = {
    version: '2026-02-07-v3',
    env: {
      cwd: process.cwd(),
      dirname: __dirname,
      platform: process.platform,
      tmpdir: require('os').tmpdir(),
      FONTCONFIG_FILE: process.env.FONTCONFIG_FILE || 'not set',
    },
    fontLoader: {
      fontsDir: getFontsDir(),
      elleBold: null,
      notoSansTC: null,
    },
    candidates: {},
    dirListing: {},
  };

  // Check font files via fontLoader
  const ellePath = getFontPath('elle-bold.ttf');
  const notoPath = getFontPath('NotoSansTC.ttf');

  results.fontLoader.elleBold = {
    path: ellePath,
    exists: fs.existsSync(ellePath),
    size: fs.existsSync(ellePath) ? fs.statSync(ellePath).size : 0,
  };

  results.fontLoader.notoSansTC = {
    path: notoPath,
    exists: fs.existsSync(notoPath),
    size: fs.existsSync(notoPath) ? fs.statSync(notoPath).size : 0,
  };

  // Check all candidate directories
  const candidates = [
    path.join(__dirname, '..', '..', 'fonts'),
    path.join(process.cwd(), 'fonts'),
    '/var/task/fonts',
    '/tmp/switchboard-fonts',
  ];

  for (const dir of candidates) {
    const resolved = path.resolve(dir);
    const exists = fs.existsSync(resolved);
    let files = [];
    if (exists) {
      try {
        files = fs.readdirSync(resolved).map(f => ({
          name: f,
          size: fs.statSync(path.join(resolved, f)).size,
        }));
      } catch (e) {
        files = [{ error: e.message }];
      }
    }
    results.candidates[resolved] = { exists, files };
  }

  // List cwd contents
  try {
    const cwdFiles = fs.readdirSync(process.cwd());
    results.dirListing.cwd = cwdFiles;
  } catch (e) {
    results.dirListing.cwd = { error: e.message };
  }

  // Initialize fontconfig and check
  initFontconfig();
  results.fontconfig = {
    FONTCONFIG_FILE: process.env.FONTCONFIG_FILE,
    configExists: process.env.FONTCONFIG_FILE ? fs.existsSync(process.env.FONTCONFIG_FILE) : false,
  };

  // Sharp text rendering diagnostic
  try {
    const sharp = (await import('sharp')).default;
    const notoPath = getFontPath('NotoSansTC.ttf');

    // Test 1: Render CJK with fontfile
    const cjkTestOpts = {
      text: '<span foreground="black">凱蒂貓</span>',
      font: 'Noto Sans TC 40',
      rgba: true,
      dpi: 72,
    };
    if (fs.existsSync(notoPath)) {
      cjkTestOpts.fontfile = notoPath;
    }

    const cjkBuf = await sharp({ text: cjkTestOpts }).png().toBuffer();
    const cjkMeta = await sharp(cjkBuf).metadata();

    // Test 2: Render Latin with fontfile (control)
    const latinTestOpts = {
      text: '<span foreground="black">ABC</span>',
      font: 'Noto Sans TC 40',
      rgba: true,
      dpi: 72,
    };
    if (fs.existsSync(notoPath)) {
      latinTestOpts.fontfile = notoPath;
    }

    const latinBuf = await sharp({ text: latinTestOpts }).png().toBuffer();
    const latinMeta = await sharp(latinBuf).metadata();

    // Test 3: CJK without fontfile (fontconfig only)
    const cjkFcOpts = {
      text: '<span foreground="black">凱蒂貓</span>',
      font: 'Noto Sans TC 40',
      rgba: true,
      dpi: 72,
    };
    const cjkFcBuf = await sharp({ text: cjkFcOpts }).png().toBuffer();
    const cjkFcMeta = await sharp(cjkFcBuf).metadata();

    results.sharpTextTest = {
      cjkWithFontfile: {
        width: cjkMeta.width,
        height: cjkMeta.height,
        bytes: cjkBuf.length,
      },
      latinWithFontfile: {
        width: latinMeta.width,
        height: latinMeta.height,
        bytes: latinBuf.length,
      },
      cjkWithFontconfigOnly: {
        width: cjkFcMeta.width,
        height: cjkFcMeta.height,
        bytes: cjkFcBuf.length,
      },
      // Return CJK test image as base64 for visual inspection
      cjkImageBase64: cjkBuf.toString('base64').substring(0, 500) + '...',
      cjkFcImageBase64: cjkFcBuf.toString('base64').substring(0, 500) + '...',
    };
  } catch (e) {
    results.sharpTextTest = { error: e.message };
  }

  return res.status(200).json(results);
}
