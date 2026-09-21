# Favs

Favorites and shared maps. Live site: [favs.bixbyapps.com](https://favs.bixbyapps.com). Package name is `favorites`. The SQLite namespace stays `BXFav`.

Skateboard 5.6. React and Vite on `:5173` (`npm run start`). Zero-crate Rust backend on `:8000` (`cd backend && cargo run`). Production is one `skateboard-backend` process serving `/api` and `dist/`.

`src/main.tsx` routes: `home`, `map`, `:username`, `map/:username`. Login is required (`noLogin` is false). There is no billing and no user directory.

Maps use Leaflet. Calculators do not apply. Places are rows in SQLite, not a bundled Google export.

## Database

Default is a SQLite file, through system `libsqlite3`. Path in `backend/config.json`: `./databases/BXFav.db`. Postgres and MongoDB are not supported.

`DB_TYPE=libsql` or `turso` overrides that file. `LIBSQL_URL` is required. `LIBSQL_ADMIN_URL`, when set, ensures the namespace named in `database.db` (`BXFav`).

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

Skateboard routes: `POST /api/signup`, `POST /api/signin`, `POST /api/signout`, `GET /api/me`, `PUT /api/me`, `POST /api/usage`, `GET /api/health`.

`GET /api/me` does not include `isSubscriber`. That field is on `POST /api/usage`.

Favorites:

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/favorites?uid=` or `?username=` | no | List non-deleted favorites. Unknown username returns `[]` |
| POST | `/api/favorites` | cookie + CSRF | Body needs `title` and `coordinates` (`lat`, `lon`). Optional `address`, `notes`, `placeID`, `details` |
| PUT | `/api/favorites` | cookie + CSRF | Body needs `_id`. Optional `notes`, `placeID`, `coordinates`, `title`, `address`, `details`. Caller must own the row |
| DELETE | `/api/favorites` | cookie + CSRF | Body needs `_id`. Soft-delete (`deleted = 1`) |

`GET /api/favorites` is public when the caller knows a user id or username. There is no endpoint that lists users.

Leaflet marker PNGs are imported with `?no-inline` in `src/components/MapView.tsx`. Vite would otherwise inline them as `data:` URLs, and the production Content Security Policy (`img-src 'self' https:`) would refuse to paint them.

## Deploy

`Dockerfile` builds the frontend with Node 24, the backend with Rust, and runs `skateboard-backend` on port 8000. Health check: `GET /api/health`.

Do not put a `.env` file in the image. Set variables on the host.

Boot requires `JWT_SECRET` (32+ characters in production). `FRONTEND_URL` is optional. `FREE_USAGE_LIMIT` defaults to 20 per 30-day window, not a calendar month. `PORT` defaults to 8000.

No checkout, billing portal, or payment webhook. `stripeProducts` in `src/constants.json` is empty. `/app/payment` is still a skateboard page; the API returns 404.

A local SQLite file needs a persistent path. Production that sets `DB_TYPE=libsql` does not use `./databases/BXFav.db`. Do not rename the namespace.

## Upgrades

Skateboard upgrades: [docs/UPGRADE.md](UPGRADE.md) and the checklist in [AGENTS.md](../AGENTS.md#migrating-4x-50-exact-checklist). After an updater run, re-apply `BXFAV_SCHEMA` in `backend/src/db.rs`. The updater rewrites that file and will drop the favorites table definition.
