# Calorie Tracker

Personal calorie tracking web app. PWA-ready, mobile-first.

## Tech

- React + TypeScript
- TanStack Start + TanStack Query
- Drizzle ORM + SQLite
- shadcn/ui + Tailwind CSS
- Open Food Facts API (barcode)
- USDA FoodData Central API (generic foods)
- OpenCode API (AI photo estimation)

## Run locally

```bash
bun install
bun run db:migrate
bun run dev
```

## Docker

```bash
docker compose up --build
```
