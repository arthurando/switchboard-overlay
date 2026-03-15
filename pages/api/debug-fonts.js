/**
 * Debug endpoint to check font file availability on Vercel
 * GET /api/debug-fonts
 * GET /api/debug-fonts?render=cjk&text=凱蒂貓  — render CJK text as PNG
 */

import fs from 'fs';
import path from 'path';
import { getFontsDir, getFontPath, initFontconfig } from '../../lib/fontLoader';

// Explicit references for Vercel's file tracer
const _fontTraceRefs = [
  path.join(process.cwd(), 'fonts', 'elle-bold.ttf'),
  path.join(process.cwd(), 'fonts', 'NotoSansTC.ttf'),
  path.join(process.cwd(), 'fonts', 'MElle-HK-Xbold.ttf'),
];

export default async function handler(req, res) {
  // ?render=cjk — render text as PNG using fontfile
  if (req.query.render === 'cjk') {
    try {
      const sharp = (await import('sharp')).default;
      const notoPath = getFontPath('NotoSansTC.ttf');
      const text = req.query.text || '凱蒂貓 Test 測試';
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const opts = {
        text: `<span foreground="black">${escaped}</span>`,
        font: 'Noto Sans TC 60',
        rgba: true,
        dpi: 72,
      };
      if (fs.existsSync(notoPath)) {
        opts.fontfile = notoPath;
      }

      const buf = await sharp({ text: opts })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();

      res.setHeader('Content-Type', 'image/png');
      return res.send(buf);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ?render=melle — render CJK text using MElle HK Xbold (no width constraint)
  // ?render=melle-width — same but WITH width+wrap (mimics v3TextOverlay)
  // ?render=melle-nofile — fontconfig only, no fontfile (with width+wrap)
  if (req.query.render?.startsWith('melle')) {
    try {
      const sharp = (await import('sharp')).default;
      initFontconfig();
      const melleFontPath = getFontPath('MElle-HK-Xbold.ttf');
      const text = req.query.text || '韓國 AKIII Classic 凱蒂貓【SM660A】';
      const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const opts = {
        text: `<span foreground="black" font_desc="MElle HK Xbold Bold 60">${escaped}</span>`,
        font: 'MElle HK Xbold 60',
        rgba: true,
        dpi: 72,
      };

      // Add width+wrap constraints (same as v3TextOverlay)
      if (req.query.render === 'melle-width' || req.query.render === 'melle-nofile') {
        opts.width = 1000;
        opts.align = 'center';
        opts.wrap = 'word-char';
      }

      // Add fontfile (unless nofile mode)
      if (req.query.render !== 'melle-nofile' && fs.existsSync(melleFontPath)) {
        opts.fontfile = melleFontPath;
      }

      const buf = await sharp({ text: opts })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Render-Mode', req.query.render);
      res.setHeader('X-Font-File', opts.fontfile || 'fontconfig-only');
      res.setHeader('X-Width', opts.width || 'unconstrained');
      return res.send(buf);
    } catch (e) {
      return res.status(500).json({ error: e.message, render: req.query.render });
    }
  }

  // Default: return font status as JSON
  initFontconfig();

  const ellePath = getFontPath('elle-bold.ttf');
  const notoPath = getFontPath('NotoSansTC.ttf');

  const mellePath = getFontPath('MElle-HK-Xbold.ttf');

  return res.status(200).json({
    fontsDir: getFontsDir(),
    fonts: {
      elleBold: {
        path: ellePath,
        exists: fs.existsSync(ellePath),
        size: fs.existsSync(ellePath) ? fs.statSync(ellePath).size : 0,
      },
      notoSansTC: {
        path: notoPath,
        exists: fs.existsSync(notoPath),
        size: fs.existsSync(notoPath) ? fs.statSync(notoPath).size : 0,
      },
      melleHK: {
        path: mellePath,
        exists: fs.existsSync(mellePath),
        size: fs.existsSync(mellePath) ? fs.statSync(mellePath).size : 0,
      },
    },
    fontconfig: {
      FONTCONFIG_FILE: process.env.FONTCONFIG_FILE || 'not set',
      configExists: process.env.FONTCONFIG_FILE ? fs.existsSync(process.env.FONTCONFIG_FILE) : false,
    },
  });
}
