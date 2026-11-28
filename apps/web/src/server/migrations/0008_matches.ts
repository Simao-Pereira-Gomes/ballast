import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Matches (#11). A Transaction gains the Owner's `notes`. Confirming a Match
 * keeps the imported Transaction and deletes the manual one, so
 * `confirmed_match` snapshots what the manual entry held, for undoing the
 * Import to restore it; it goes with the imported Transaction. `rejected_match`
 * records pairs the Owner said are not the same movement, and goes with
 * either Transaction.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    ALTER TABLE transaction
      ADD COLUMN notes text CHECK (notes IS NULL OR length(btrim(notes)) > 0)
  `)
  yield* sql.unsafe(`
    CREATE TABLE confirmed_match (
      owner_id uuid NOT NULL REFERENCES owner (id),
      imported_id uuid NOT NULL,
      manual_date date NOT NULL,
      manual_amount_cents bigint NOT NULL CHECK (manual_amount_cents <> 0),
      manual_description text NOT NULL,
      manual_notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (imported_id),
      FOREIGN KEY (owner_id, imported_id) REFERENCES transaction (owner_id, id) ON DELETE CASCADE
    )
  `)
  yield* sql.unsafe(`
    CREATE TABLE rejected_match (
      owner_id uuid NOT NULL REFERENCES owner (id),
      manual_id uuid NOT NULL,
      imported_id uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (manual_id, imported_id),
      FOREIGN KEY (owner_id, manual_id) REFERENCES transaction (owner_id, id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id, imported_id) REFERENCES transaction (owner_id, id) ON DELETE CASCADE
    )
  `)
})
