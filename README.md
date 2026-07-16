# CapDent Website

Standalone product website for CapDent dental clinic management software.

## Cloudflare Pages deployment

Use these exact settings:

- Production branch: `main`
- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: leave empty
- Intended custom domain: `capdent.micirql.com`

The build script copies the static CapDent site into `dist/` so Cloudflare Pages always has a clear output directory.

The main Micirql company website remains in `mkraja826/micirql-website`.

Deployment trigger: 2026-07-16
Deployment retry: 2026-07-16 attempt 2
