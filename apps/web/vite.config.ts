import { paraglideVitePlugin } from "@inlang/paraglide-js"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"

export default defineConfig({
  // Ballast is reachable from this machine only (ADR 0001).
  server: { host: "127.0.0.1", port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    // Options live in project.inlang/paraglide.config.ts, shared with `pnpm messages`.
    paraglideVitePlugin({ project: "./project.inlang" }),
    tailwindcss(),
    tanstackStart(),
    nitro({ plugins: ["./src/server/startup.ts"] }),
    viteReact(),
  ],
})
