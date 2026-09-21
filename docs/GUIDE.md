# BXFav

Favorites and shared maps. Live site: [favs.bixbyapps.com](https://favs.bixbyapps.com).

Skateboard 5.6. React and Vite on `:5173` (`npm run start`). Zero-crate Rust backend on `:8000` (`cd backend && cargo run`). Production is one `skateboard-backend` process serving `/api` and `dist/`.

`src/main.tsx` routes: `home`, `map`, `:username`, `map/:username`. Login is required (`noLogin` is false). Stripe lookup key is `favs_monthly`.

Maps use Leaflet. Calculators do not apply. Places are rows in SQLite, not a bundled Google export.

## Database

SQLite only, through system `libsqlite3`. Path in `backend/config.json`: `./databases/BXFav.db`. Postgres and MongoDB are not supported.

App table, from `BXFAV_SCHEMA` in `backend/src/db.rs`:

```sql
CREATE TABLE IF NOT EXISTS favorites (
  _id TEXT PRIMARY KEY,
  userID TEXT NOT NULL,
  title TEXT,
  address TEXT,
  notes TEXT,
  coordinates TEXT,
  placeID TEXT,
  details TEXT,
  created_at INTEGER,
  deleted INTEGER DEFAULT 0
);
```

`created_at` is unix milliseconds. `coordinates` is a JSON string with `lat` and `lon`. Users and Auths are the skateboard tables in the same file.

## API

Dispatch is the `match` in `backend/src/routes.rs`. State-changing routes need the auth cookie and `X-CSRF-Token`, including `POST /api/signout`.

Skateboard routes: `POST /api/signup`, `POST /api/signin`, `POST /api/signout`, `GET /api/me`, `PUT /api/me`, `POST /api/usage`, `POST /api/checkout`, `POST /api/portal`, `POST /api/payment`, `GET /api/health`.

`GET /api/me` does not include `isSubscriber`. That field is on `POST /api/usage`.

Favorites:

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/favorites?uid=` or `?username=` | no | List non-deleted favorites. Unknown username returns `[]` |
| POST | `/api/favorites` | cookie + CSRF | Body needs `title` and `coordinates` (`lat`, `lon`). Optional `address`, `notes`, `placeID`, `details` |
| PUT | `/api/favorites` | cookie + CSRF | Update one favorite owned by the caller |
| DELETE | `/api/favorites` | cookie + CSRF | Soft-delete (`deleted = 1`) |
| GET | `/api/profiles` | no | `{ _id, name }` for every user |

`GET /api/favorites` is public. Profiles and favorite lists are readable without a cookie.

## Deploy

`Dockerfile` builds the frontend with Node 24, the backend with Rust, and runs `skateboard-backend` on port 8000. Health check: `GET /api/health`.

Do not put a `.env` file in the image. Set variables on the host.

Boot requires `JWT_SECRET` (32+ characters in production), `STRIPE_KEY`, and `STRIPE_ENDPOINT_SECRET`. `FRONTEND_URL` is optional. `FREE_USAGE_LIMIT` defaults to 20 per 30-day window, not a calendar month. `PORT` defaults to 8000.

Webhook: `POST /api/payment` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

Keep the SQLite file on a persistent volume. The filename stays `BXFav.db`.

## Upgrades

Skateboard upgrades: [docs/UPGRADE.md](UPGRADE.md) and the checklist in [AGENTS.md](../AGENTS.md#migrating-4x-50-exact-checklist). After an updater run, re-apply `BXFAV_SCHEMA` in `backend/src/db.rs`. The updater rewrites that file and will drop the favorites table definition.
