import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Transactions. Each belongs to one Account of the same Owner, through the
 * composite `(owner_id, account_id)` key. `amount_cents` is signed (positive
 * for an inflow) and never zero. `source` tells manual entries from imported
 * ones, so manual Transactions can later be Matched.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    CREATE TABLE transaction (
      owner_id uuid NOT NULL REFERENCES owner (id),
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      account_id uuid NOT NULL,
      date date NOT NULL,
      amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
      description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 200),
      source text NOT NULL CHECK (source IN ('manual', 'import')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id),
      UNIQUE (owner_id, id),
      FOREIGN KEY (owner_id, account_id) REFERENCES account (owner_id, id)
    )
  `)
  yield* sql.unsafe(`
    CREATE INDEX transaction_by_account ON transaction (owner_id, account_id, date DESC)
  `)
})
