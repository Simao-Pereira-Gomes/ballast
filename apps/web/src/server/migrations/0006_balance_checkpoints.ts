import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Balance Checkpoints (ADR 0002): the balance a bank export states for an
 * Account at the end of a date. One per Account and date; a later export
 * stating the same date replaces it. `import_id` is the Import that stated
 * it, or null when the export's lines were all already imported.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    CREATE TABLE balance_checkpoint (
      owner_id uuid NOT NULL REFERENCES owner (id),
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      account_id uuid NOT NULL,
      import_id uuid,
      date date NOT NULL,
      balance_cents bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id),
      UNIQUE (owner_id, account_id, date),
      FOREIGN KEY (owner_id, account_id) REFERENCES account (owner_id, id),
      FOREIGN KEY (owner_id, import_id) REFERENCES import (owner_id, id)
    )
  `)
})
