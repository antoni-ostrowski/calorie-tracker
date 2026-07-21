import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "~/components/ui/sonner";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  redirect,
  useRouteContext,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { BottomNav } from "~/components/bottom-nav";
import { getSession } from "~/lib/auth-functions";

import appCss from "~/styles.css?url";

export interface MyRouterContext {
  queryClient: QueryClient;
  user?: { id: string; name?: string | null; email?: string | null };
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { name: "theme-color", content: "#10b981" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "Calorie Tracker" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
      },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    const pathname = (location as { pathname?: string }).pathname ?? "/";
    if (!session && pathname !== "/login") {
      throw redirect({ to: "/login" });
    }
    if (session && pathname === "/login") {
      throw redirect({ to: "/" });
    }
    return { user: session?.user };
  },
  pendingComponent: () => (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient, user } = useRouteContext({ from: "__root__" });
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <QueryClientProvider client={queryClient}>
          <Toaster position="top-center" />
          <Outlet />
          {user && (
            <>
              <div className="mx-auto h-20 max-w-md" />
              <BottomNav />
            </>
          )}
          <Scripts />
        </QueryClientProvider>
      </body>
    </html>
  );
}
