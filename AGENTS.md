# Calorie Tracker

Personal calorie tracking web app. PWA-ready, mobile-first, zero friction.

## Tech Stack

- React + TypeScript
- TanStack Start + TanStack Query
- Drizzle ORM + SQLite (better-sqlite3)
- shadcn/ui + Tailwind CSS v4
- Open Food Facts API (barcode lookup)
- USDA FoodData Central API (generic food search)
- OpenCode API (AI photo + text calorie estimation)

## Project Structure

```
src/
  db/           - Drizzle schema and database connection
  lib/          - Utils, server API functions
  components/   - React components
    ui/         - shadcn/ui components
  routes/       - TanStack Start file-based routes
```

## Commands

```bash
# Dev server
bun run dev

# Typecheck + lint + format
bun run check

# DB migrate
bun run db:migrate

# DB studio
bun run db:studio
```

## Env Vars

```
DATABASE_URL=./data/app.db
OPENCODE_API_KEY=your_key_here
OPENCODE_API_URL=https://opencode.ai/zen/go/v1
```

## Docker

```bash
docker compose up --build
```
