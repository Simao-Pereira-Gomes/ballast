import { PgClient } from "@effect/sql-pg"
import { Config } from "effect"

export const DatabaseLive = PgClient.layerConfig({ url: Config.Redacted("DATABASE_URL") })
