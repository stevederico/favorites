# Favs

Save places and show them on a map. Live site: [favs.bixbyapps.com](https://favs.bixbyapps.com).

**Version:** 0.17.0

## Tech stack

- React 19.2.8, Vite 8.2.2, TypeScript 7, Tailwind 4.3.3, Node 24
- skateboard-ui 5.1.0, skateboard 5.6.0
- Leaflet 1.9.4
- Rust 1.95 backend, zero crates, system `libsqlite3` and `libcurl`

## Setup

```bash
npm install
npm run start             # Frontend :5173
cd backend && cargo run   # Backend :8000
```

## Scripts

- `npm run start` — Vite on :5173
- `npm run build` — Typecheck and production frontend build
- `cd backend && cargo run` — API on :8000
- `cd backend && cargo test --locked` — Backend tests

## Routes

**Public:** `/`, `/signin`, `/signup`, `/terms`, `/privacy`, `/eula`, `/subs`

**Login required:** `/app/home`, `/app/map`, `/app/:username`, `/app/map/:username`

`/app/payment` is a skateboard page. This app does not register checkout, portal, or payment webhook routes.

## Deploy

Production is the Docker image in `Dockerfile`. One `skateboard-backend` process serves `/api` and `dist/` on port 8000.

Local database is SQLite at `backend/databases/BXFav.db`. Set `DB_TYPE=libsql` and `LIBSQL_URL` to use libSQL instead. The namespace is `BXFav`. Boot requires `JWT_SECRET` (32+ characters in production). Stripe keys are not required.

Leaflet marker images are built as files (`?no-inline`). The Content Security Policy allows `img-src 'self' https:` and blocks `data:` URLs.

---

<div align="center">
  Made with <a href="https://github.com/stevederico/skateboard">Skateboard</a>
</div>
