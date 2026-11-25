import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Import history (#10): an Import also records how many of its file's lines
 * the Account already held, so the history can show new and skipped counts.
 * Earlier Imports have no record of it and read as zero.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    ALTER TABLE import
      ADD COLUMN skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0)
  `)
})
