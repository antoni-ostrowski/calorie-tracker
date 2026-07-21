import { createAuthClient } from "better-auth/client";
import { usernameClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [usernameClient()],
}) as any;

export { authClient };

export async function signInUsername(username: string, password: string) {
  return authClient.signIn.username({ username, password }) as Promise<{
    data?: { user?: { id: string; name?: string } };
    error?: { message?: string };
  }>;
}

export async function signUpEmail(username: string, password: string) {
  const email = `${username}@local.app`;
  return authClient.signUp.email({
    email,
    name: username,
    username,
    password,
  }) as Promise<{
    data?: { user?: { id: string; name?: string } };
    error?: { message?: string };
  }>;
}

export async function signOut() {
  return authClient.signOut() as Promise<{ error?: { message?: string } }>;
}
