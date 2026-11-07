import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Imports. An Import is one bank export ingested into one Account, and each
 * imported Transaction records the Import that created it, so an Import can
 * later be undone (#10).
 *
 * `description_key` is the description's normalised form (ADR 0006), which
 * dedup and Categorisation Rules match on. Manual Transactions entered
 * before this migration have none until they are next edited.
 *
 * `fingerprint` identifies an imported movement on its Account (date,
 * amount, normalised description and, for identical lines, which occurrence
 * it is within the file), so the same bank line can never be imported twice.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    CREATE TABLE import (
      owner_id uuid NOT NULL REFERENCES owner (id),
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      account_id uuid NOT NULL,
      file_name text NOT NULL CHECK (length(btrim(file_name)) BETWEEN 1 AND 255),
      format text NOT NULL CHECK (format IN ('santander')),
      line_count integer NOT NULL CHECK (line_count > 0),
      imported_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id),
      UNIQUE (owner_id, id),
      FOREIGN KEY (owner_id, account_id) REFERENCES account (owner_id, id)
    )
  `)
  yield* sql.unsafe(`
    CREATE INDEX import_by_account ON import (owner_id, account_id, imported_at DESC)
  `)
  yield* sql.unsafe(`
    ALTER TABLE transaction
      ADD COLUMN import_id uuid,
      ADD COLUMN description_key text,
      ADD COLUMN fingerprint text,
      ADD CONSTRAINT transaction_import FOREIGN KEY (owner_id, import_id)
        REFERENCES import (owner_id, id),
      ADD CONSTRAINT transaction_import_when_imported
        CHECK ((source = 'import') = (import_id IS NOT NULL)),
      ADD CONSTRAINT transaction_fingerprint_when_imported
        CHECK ((source = 'import') = (fingerprint IS NOT NULL)),
      ADD CONSTRAINT transaction_imported_with_key
        CHECK (source <> 'import' OR description_key IS NOT NULL)
  `)
  yield* sql.unsafe(`
    CREATE UNIQUE INDEX transaction_fingerprint ON transaction (owner_id, account_id, fingerprint)
      WHERE fingerprint IS NOT NULL
  `)
  yield* sql.unsafe(`
    CREATE INDEX transaction_by_import ON transaction (owner_id, import_id)
      WHERE import_id IS NOT NULL
  `)
})
