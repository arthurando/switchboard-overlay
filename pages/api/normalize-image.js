/**
 * Switchboard Image Normalization API
 *
 * Converts a remote image to JPEG and re-uploads to R2. Used by the social
 * publisher when IG preflight rejects PNG/webp — Instagram's container endpoint
 * only accepts JPEG.
 *
 * POST /api/normalize-image
 * Body: { url: string, format?: 'jpeg' }   // 'jpeg' is the only supported format today
 * Returns: { url, key, bytes, contentType }
 */

import { uploadToR2 } from '../../lib/r2Storage';

const MAX_SOURCE_BYTES = 16 * 1024 * 1024;   // 16 MB cap on source download
const FETCH_TIMEOUT_MS = 15_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Next.js Pages Router auto-parses JSON when Content-Type: application/json
    // and bodyParser is not disabled. Trust req.body.
    const { url, format = 'jpeg' } = req.body ?? {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid field: url (string required)' });
    }
    if (format !== 'jpeg') {
      return res.status(400).json({ error: `Unsupported format '${format}'. Only 'jpeg' is supported.` });
    }

    // HEAD probe first — refuse oversized sources before paying for the body.
    const headResp = await fetchWithTimeout(url, { method: 'HEAD', redirect: 'follow' });
    if (!headResp.ok) {
      return res.status(502).json({ error: `Source HEAD ${headResp.status}` });
    }
    const declaredBytes = parseInt(headResp.headers.get('content-length') || '0', 10);
    if (declaredBytes > MAX_SOURCE_BYTES) {
      return res.status(413).json({ error: `Source ${declaredBytes} bytes exceeds ${MAX_SOURCE_BYTES} cap` });
    }

    const getResp = await fetchWithTimeout(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'Accept': 'image/*' },
    });
    if (!getResp.ok) {
      return res.status(502).json({ error: `Source GET ${getResp.status}` });
    }
    const sourceBuffer = Buffer.from(await getResp.arrayBuffer());
    if (sourceBuffer.length > MAX_SOURCE_BYTES) {
      return res.status(413).json({ error: `Source ${sourceBuffer.length} bytes exceeds ${MAX_SOURCE_BYTES} cap (post-fetch)` });
    }

    const sharp = (await import('sharp')).default;
    // Flatten over white because PNG alpha turns black on naive JPEG conversion.
    const jpegBuffer = await sharp(sourceBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();

    const { url: outUrl, key } = await uploadToR2(jpegBuffer, 'image/jpeg');

    return res.status(200).json({
      url: outUrl,
      key,
      bytes: jpegBuffer.length,
      contentType: 'image/jpeg',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[normalize-image] failed:', msg);
    return res.status(500).json({ error: msg });
  }
}

async function fetchWithTimeout(url, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
