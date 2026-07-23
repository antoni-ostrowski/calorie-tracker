# Web Calorie Tracker

> (built with opencode with my guidance)

Personal calorie tracking web app. PWA-ready, mobile-first. Intended for self-hosting. The main focus of the app is the AI estimation feature built to take advantage of OpenCode Go subscription.

> currently hard coded to use "minimax-m3" model to balance out costs with quality

## Features

My main goal with this app was to have the simplest possible way to track calories and not have any ads and features that I don't use.

- Adding entries:
  - AI estimation - attach photo of meal, type in additional context and get estimated macros
  - Barcode scanner - scan any product to quicky add it, type in exactly how many grams you ate
  - Search - using [`FoodData Central API`](https://fdc.nal.usda.gov/api-guide) to add any food by name
- History tab
- Settings tab to change default daily calorie intake
- No login or any bloat

## Tech

- React + TypeScript
- TanStack Start + TanStack Query
- Drizzle ORM + SQLite
- shadcn/ui + Tailwind CSS
- Open Food Facts API (barcode)
- USDA FoodData Central API (generic foods)
- OpenCode API (AI photo estimation)

## AI estimation

The fastest way to log food is to take a photo. The app sends the image to the OpenCode API (using the `minimax-m3` model), asks it to guess what the food is and estimate macros, then fills in calories, protein, carbs, fat and a weight for you. You can still edit the grams afterwards and the other numbers rescale automatically. Before you submit photo you can type in details to help model estimate better. (you can also describe food in context without attaching photo)

It's not going to be perfectly accurate, especially for home-cooked or mixed meals, but it's good enough for me and removes almost all friction from logging.

## Run locally

```bash
bun install
bun run db:migrate
bun run dev
```

## Self-hosting

If you want to run this on your own server, the easiest path is Docker Compose. The only thing you really need to set is your OpenCode API key; everything else has sensible defaults.

## Example Docker Compose setup

```bash
services:
  web:
    image: antost360/calorie-tracker:latest
    ports:
      - "80:3000"
    volumes:
      - ./data-new:/app/data
    environment:
      - OPENCODE_API_KEY=${OPENCODE_API_KEY}
    restart: unless-stopped

```

### Environment variables

Create a `.env` file (or pass them in your docker compose setup):

> Without `OPENCODE_API_KEY`, the app still works for barcode and manual search, but the photo estimation button will fail.

```bash
# Required for AI estimation. (OpenCode Go sub api key)
OPENCODE_API_KEY=your_key_here

# I dont recommend changing these, they dont really matter
# SQLite database location. Inside the container this is already set to ./data/app.db.
DATABASE_URL=./data/app.db
# Depens on the model, for minimax-m3 thats correct.
OPENCODE_API_URL=https://opencode.ai/zen/go/v1
```

### Directories

- `data/` — this is where the SQLite database (`app.db`) lives and photos in `/data/photos`. If you back up one folder, back up this one.

### Building without Docker

```bash
bun install
bun run db:migrate
bun run build
bun run preview
```

Then put it behind a reverse proxy like Caddy or nginx and you're good to go!

## Media

<img width="260" alt="image" src="https://github.com/user-attachments/assets/b4ae0037-598f-4296-b12a-921121288035" /> <img width="260" alt="image" src="https://github.com/user-attachments/assets/29ba2ab9-a2a1-43ef-aebc-82d1572120a1" />
<img width="260" alt="image" src="https://github.com/user-attachments/assets/8bc5d3a1-ed63-46a1-bab4-fe74a6750625" />
