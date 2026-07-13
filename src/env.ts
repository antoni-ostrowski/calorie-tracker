import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().default("./data/app.db"),
  OPENCODE_API_KEY: z.string().min(1),
  OPENCODE_API_URL: z.string().url().default("https://opencode.ai/zen/go/v1"),
});

export const env = envSchema.parse(process.env);
