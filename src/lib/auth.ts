import { betterAuth } from "better-auth";
import type { Auth } from "better-auth";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import Database from "better-sqlite3";
import { env } from "~/env";

const dbPath = env.DATABASE_URL;

export const auth = betterAuth({
  database: new Database(dbPath),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 3 },
  plugins: [username(), tanstackStartCookies()],
  trustedOrigins: [env.BETTER_AUTH_URL],
}) as unknown as Auth;
