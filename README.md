# Favs

Save places and show them on a map. Live site: [favs.bixbyapps.com](https://favs.bixbyapps.com).

**Version:** 0.18.0

## Tech stack

From `package.json` and `backend/Cargo.toml`:

- React 19.2, Vite 8.2, Tailwind CSS 4.3, TypeScript 7, Node 24
- `@stevederico/skateboard-ui` 5.1.0, skateboard 5.6.0
- Leaflet 1.9, `lucide-react` 0.546, React Router 7.18
- Zero-crate Rust backend. `rust-version` is 1.95 (minimum). `backend/rust-toolchain.toml` is `stable`, and the Docker image is `rust:bookworm`, so the compiler is current stable, not 1.95.
- Local database: SQLite through system `libsqlite3` (`./databases/BXFav.db`)
- Production database: libSQL. `DB_TYPE=libsql` plus `LIBSQL_URL`. HTTP goes through system `libcurl`. Namespace stays `BXFav`

No Postgres, no MongoDB, no Hono, no Deno. Checkout, portal, and the payment webhook are not registered.

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
