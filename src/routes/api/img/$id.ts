import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { extname } from "path";
import { db } from "~/db";
import { entries } from "~/db/schema";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export const Route = createFileRoute("/api/img/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        if (!Number.isFinite(id)) {
          return new Response("Invalid image id", { status: 400 });
        }

        const entry = await db.query.entries.findFirst({
          where: eq(entries.id, id),
        });

        if (!entry?.filePath) {
          return new Response("Image not found", { status: 404 });
        }

        let buffer: Buffer;
        try {
          buffer = await readFile(entry.filePath);
        } catch {
          return new Response("Image not found", { status: 404 });
        }

        const ext = extname(entry.filePath).toLowerCase();
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
