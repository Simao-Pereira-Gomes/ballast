import { spawn } from "node:child_process"
import { mkdirSync, openSync } from "node:fs"
import { setTimeout as sleep } from "node:timers/promises"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { smokePort } from "../playwright.config.ts"

const waitUntilUp = async (url: string, attemptsLeft: number): Promise<void> => {
  const up = await fetch(url).then(
    (response) => response.ok,
    () => false,
  )
  if (up) return
  if (attemptsLeft === 0) throw new Error(`Ballast did not start on ${url}`)
  await sleep(500)
  return waitUntilUp(url, attemptsLeft - 1)
}

export default async function globalSetup() {
  const database = await new PostgreSqlContainer("postgres:18-alpine").start()
  mkdirSync("test-results", { recursive: true })
  const log = openSync("test-results/smoke-server.log", "w")
  const server = spawn("node", [".output/server/index.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: database.getConnectionUri(),
      HOST: "127.0.0.1",
      PORT: String(smokePort),
    },
    stdio: ["ignore", log, log],
  })
  const stop = () => server.kill()
  process.once("exit", stop)

  await waitUntilUp(`http://127.0.0.1:${smokePort}/`, 60)
  return async () => {
    stop()
    await database.stop()
  }
}
