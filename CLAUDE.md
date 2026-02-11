# Switchboard - Image Overlay Service

Self-hosted image overlay API replacing Switchboard.ai. Processes product images with custom overlays and stores them in Cloudflare R2.

## Overview

| Property | Value |
|----------|-------|
| GitHub | `arthurando/switchboard-overlay` (private) |
| Stack | Next.js 15 + Sharp + AWS SDK + Cloudflare R2 |
| Deployment | Vercel (`switchboard-rust.vercel.app`) |
| Storage | Cloudflare R2 (S3-compatible) |

## Features

- Fast image processing with Sharp library
- Auto-resize and composite overlay images
- Cloudflare R2 storage with public URLs
- Drop-in replacement for Switchboard.ai API
- CORS enabled for Google Apps Script integration

## API Endpoint

**POST** `/api/overlay`

```json
{
  "template": "product-cover",
  "sizes": [{ "width": 1080, "height": 1080 }],
  "elements": {
    "product-image": { "url": "https://example.com/product.jpg" },
    "stt-cover": { "url": "https://example.com/overlay.png" }
  }
}
```

Returns public R2 URL for generated composite image.

## Environment Variables

Required in Vercel:
- `R2_ACCOUNT_ID` - Cloudflare account ID
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_DEV_SUBDOMAIN` - R2 public subdomain (pub-xxxxx.r2.dev)
- `R2_ACCESS_KEY_ID` - R2 API access key
- `R2_SECRET_ACCESS_KEY` - R2 API secret key

## Project Files

| File | Purpose |
|------|---------|
| `spec.md` | Requirements, features, architecture, tech stack, API endpoints |
| `STATUS.md` | Current status, progress tracking, next steps |

## Cost Savings

Replaces $29-99/month Switchboard.ai subscription with free Vercel + Cloudflare R2 tiers.

**Annual savings:** $348 - $1,188

Inherits global rules from `~/.claude/CLAUDE.md`.
