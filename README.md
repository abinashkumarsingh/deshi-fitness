# Deshi Fitness

Personal, mobile-first fitness logger — glanceable workout screens, Hinglish "Desi mode", Indian food DB, rules + Gemini suggestions. Self-hosted on Coolify.

```
frontend/   React + Vite + Tailwind + Zustand + Recharts (PWA, served by nginx)
backend/    Express + TypeScript + Drizzle ORM + PostgreSQL + JWT + Zod
```

## Local dev

```bash
docker compose up --build        # db :5432, api :4000, app :3000
```

Or without Docker: run Postgres, then
```bash
cd backend && cp .env.example .env && npm i && npm run dev
cd frontend && npm i && npm run dev
```
Migrations run automatically when the API boots. After changing `backend/src/db/schema.ts`, run `npm run db:generate` in `backend/` and commit the new file in `backend/drizzle/`.

## Deploy on Coolify (3 resources, 1 project)

1. **deshi-db** — New Resource → Database → PostgreSQL 16. Copy the *internal* connection URL.
2. **deshi-backend** — Application from this repo · Build pack **Dockerfile** · Base dir `/backend` · Port **4000** · Health check path `/health`.
   Env:
   ```
   DATABASE_URL=<internal postgres url>
   JWT_SECRET=<long random string>
   GEMINI_API_KEY=<Google AI Studio key, optional>
   GEMINI_MODEL=gemini-2.5-flash
   CORS_ORIGIN=*            # or the frontend URL
   ALLOW_REGISTRATION=true  # set false after creating your account
   ```
3. **deshi-frontend** — Application from this repo · Dockerfile · Base dir `/frontend` · Port **80**.
   Env: `API_URL=<public URL of deshi-backend>` — read at container start, so changing it only needs a restart, not a rebuild.

Enable Auto Deploy on both apps. Add custom domains any time (e.g. `app.` / `api.`), then update `API_URL` and `CORS_ORIGIN`.

## Notes vs. original spec
- **Drizzle instead of Prisma** — no engine binaries to download at build time; typed schema in `backend/src/db/schema.ts`, SQL migrations in `backend/drizzle/`.
- **Gemini model** defaults to `gemini-2.5-flash` (1.5-flash is retired). Without a key the app falls back to the rules engine.
- **Runtime frontend config** (`/config.js`) instead of build-time `VITE_API_URL`, so one image works for any domain.
- Registration is open until you set `ALLOW_REGISTRATION=false`.

## API
`/auth/{register,login,refresh,status}` · `/workouts` (+ `/last`, `/exercise/:id/last`) · `/routines` (+ `/:id/duplicate`, `/:id/schedule`) · `/exercises` · `/foods` · `/warmups/templates` · `/warmups/ramp-up?weight=` · `/cooldowns/templates` · `/mobility/routines` · `/prs` · `/goals` · `/suggestions/today` · `/ai/suggest` · `/body` · `/sleep` · `/nutrition` · `/metrics/{weight,sleep,volume,macros}` · `/timer-presets` · `/settings` · `/export?format=csv|json` · `/health`
