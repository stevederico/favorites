# BXFav

Favorites and places tracking with interactive maps.

**Version:** 0.14.0 | **Domain:** [favs.bixbyapps.com](https://favs.bixbyapps.com)

## Tech Stack

- React 19.2, Vite 8.2, skateboard-ui 5.1.0
- Leaflet 1.9.4 for interactive maps
- Zero-crate Rust backend, SQLite database
- Tailwind CSS v4

## Setup

```bash
npm install
npm run start          # Frontend :5173
cd backend && cargo run   # Backend :8000
```

## Scripts

- `npm run start` — Frontend only (Vite on :5173)
- `npm run build` — Production frontend build
- `cd backend && cargo run` — Rust API on :8000
- `cd backend && cargo test --locked` — Backend tests

## Routes

**Public:** `/`, `/terms`, `/privacy`, `/subs`, `/eula`
**Protected:** `/app/*` (authentication required)

## Deploy

Production is the Docker image in `Dockerfile`.

---

<div align="center">
  Made with <a href="https://github.com/stevederico/skateboard">Skateboard</a> — a React boilerplate with auth and payments
</div>
