import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { extname } from "path";
import { db } from "~/db";
import { meals } from "~/db/schema";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export const Route = createFileRoute("/api/meal-img/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        if (!Number.isFinite(id)) {
          return new Response("Invalid image id", { status: 400 });
        }

        const meal = await db.query.meals.findFirst({
          where: eq(meals.id, id),
        });

        if (!meal?.filePath) {
          return new Response("Image not found", { status: 404 });
        }

        let buffer: Buffer;
        try {
          buffer = await readFile(meal.filePath);
        } catch {
          return new Response("Image not found", { status: 404 });
        }

        const ext = extname(meal.filePath).toLowerCase();
        const contentType = mimeTypes[ext] ?? "application/octet-stream";

        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
