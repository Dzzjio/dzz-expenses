import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="arcade-panel scanline-panel max-w-md p-8 text-center">
        <h1 className="font-pixel text-5xl text-neon-magenta neon-text sm:text-6xl">404</h1>
        <h2 className="mt-6 font-pixel text-sm uppercase text-neon-cyan neon-text-soft">
          Page not found
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-7">
          <Link
            to="/"
            className="pixel-press inline-flex items-center justify-center border-2 border-arcade-ink bg-primary px-4 py-2.5 font-pixel text-[10px] uppercase tracking-wider text-primary-foreground [--pixel-glow:var(--neon-lime)]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="arcade-panel scanline-panel max-w-md p-8 text-center">
        <div className="hud-label text-neon-yellow animate-blink">! ! !</div>
        <h1 className="mt-4 font-pixel text-base uppercase leading-relaxed text-destructive neon-text">
          This page didn't load
        </h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="pixel-press inline-flex cursor-pointer items-center justify-center border-2 border-arcade-ink bg-primary px-4 py-2.5 font-pixel text-[10px] uppercase tracking-wider text-primary-foreground [--pixel-glow:var(--neon-lime)]"
          >
            Try again
          </button>
          <a
            href="/"
            className="pixel-press arcade-field inline-flex items-center justify-center border-2 border-border px-4 py-2.5 font-pixel text-[10px] uppercase tracking-wider text-neon-cyan [--pixel-glow:var(--neon-cyan)]"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Chakra+Petch:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
    // Apply the saved theme before first paint so there's no flash of the default skin
    scripts: [{ children: THEME_INIT_SCRIPT }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
