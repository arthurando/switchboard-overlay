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

  return res.status(200).json(results);
}
