import { definePlugin } from "nitro"
import { prepare } from "./runtime.ts"

export default definePlugin(() => {
  prepare().catch((error: unknown) => {
    console.error("Ballast could not prepare its database:", error)
    process.exit(1)
  })
})
