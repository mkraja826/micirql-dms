# CapDent Clinic Portal

This portal is copied from `mkraja826/dms-clinic-app` and is built into the CapDent marketing deployment at `/portal/`.

## Current status

- Responsive React/Vite owner dashboard
- Fictional demonstration data only
- Supabase/backend authentication is not connected yet
- Search engines are blocked from indexing the portal

## Local development

```bash
npm run dev:portal
```

## Production build

```bash
npm run build
```

The marketing site is written to `dist/` first, then the portal is built to `dist/portal/`.
