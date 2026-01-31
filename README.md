# BXFav

Favorites and places tracking with interactive maps.

**Version:** 0.3.3 | **Domain:** [favs.bixbyapps.com](https://favs.bixbyapps.com) | **Railway Service:** `bxfav`

## Tech Stack

- React 19.2, Vite 7.1, skateboard-ui 1.2.20
- Leaflet 1.9.4 for interactive maps
- Hono backend, SQLite database
- Tailwind CSS v4

## Setup

```bash
deno install
deno run start    # Frontend :5173 + Backend :8000
```

## Scripts

- `deno run start` — Development (frontend + backend)
- `deno run build` — Production build
- `deno run prod` — Deploy to Railway

## Routes

**Public:** `/`, `/terms`, `/privacy`, `/subs`, `/eula`
**Protected:** `/app/*` (authentication required)

## Deploy

```bash
railway link -p bixby -e production -s bxfav
railway up
```
