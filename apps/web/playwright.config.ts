import { defineConfig, devices } from "@playwright/test"

export const smokePort = 3200

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${smokePort}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
