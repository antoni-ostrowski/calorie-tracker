import { betterAuth } from "better-auth";
import type { Auth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { db } from "~/db";
import { env } from "~/env";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "sqlite" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true, minPasswordLength: 3 },
  plugins: [username(), tanstackStartCookies()],
  trustedOrigins: [env.BETTER_AUTH_URL],
}) as unknown as Auth;
