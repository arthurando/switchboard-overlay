# Switchboard — Image Overlay Service
Stack: Next.js 15 (Pages Router) | Sharp | AWS SDK v3 | Cloudflare R2
Deploy: `switchboard` | VPS `37.27.93.188` | branch: master | context: .

## Rules
1. **VPS only** — never deploy to Vercel; service moved 2026-03-15
2. **`charset=utf-8` always** — required when calling `/api/overlay`; CJK breaks without it
3. **MElle HK Xbold** — CJK font for text overlays; do not substitute
4. **R2 storage only** — generated images always upload to R2; never serve from local disk
5. **Overlay runs on VPS as background job** — skip at preview stage; apply only at scheduling time
6. **No Zod installed** — input validation in overlay.js is manual; install Zod before adding new routes
7. **`/api/debug-fonts` is dev-only** — gated by `NODE_ENV === 'production'`; returns 404 in prod

## Anti-Patterns
- Serving generated images from local disk (use R2 public URLs)
- Running overlay during pipeline preview (schedule-time only)
- Substituting fonts for CJK text rendering

## Database
No Supabase tables — stateless image processing service.

## Key Files
- `spec.md` — architecture, API contract, template system, env vars
- `pages/api/overlay.js` — main composite image endpoint
- `lib/v3TextOverlay.js` — V3 text overlay with MElle HK Xbold
- `lib/r2Storage.js` — Cloudflare R2 upload
- `lib/imageProcessor.js` — legacy overlay compositing
- `plans/` — task plans

## Overrides
None — inherits all global rules from `~/.claude/CLAUDE.md`.
