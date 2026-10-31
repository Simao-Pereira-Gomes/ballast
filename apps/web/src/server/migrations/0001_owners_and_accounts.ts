import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Owners and Accounts. Every Owner-scoped table carries `owner_id`, and
 * `account` exposes `(owner_id, id)` so later tables can reference an
 * Account together with its Owner (ADR 0003).
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    CREATE TABLE owner (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  yield* sql.unsafe(`
    CREATE UNIQUE INDEX owner_single_default ON owner (is_default) WHERE is_default
  `)
  yield* sql.unsafe(`
    CREATE TABLE account (
      owner_id uuid NOT NULL REFERENCES owner (id),
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
      role text NOT NULL CHECK (role IN ('operating_cash', 'reserve', 'investment', 'liability')),
      currency text NOT NULL CHECK (currency = 'EUR'),
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id),
      UNIQUE (owner_id, id)
    )
  `)
})
