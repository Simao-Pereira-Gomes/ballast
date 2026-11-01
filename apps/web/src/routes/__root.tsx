import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { AppShell } from "../components/shell/app-shell.tsx"
import { registerLanguageStrategies } from "../i18n.ts"
import { getLocale } from "../paraglide/runtime.js"
import appCss from "../styles.css?url"
import { themeBootScript } from "../ui/theme.ts"

registerLanguageStrategies()

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Ballast" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    // Before the first paint, so a remembered theme never flashes the other one.
    scripts: [{ children: themeBootScript }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <AppShell>
        <Outlet />
      </AppShell>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The boot script sets the theme class before React hydrates.
    <html lang={getLocale()} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
