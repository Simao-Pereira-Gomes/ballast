import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Holdings replace the typed asset-class mix (ADR 0007). The percentages
 * from 0003 are dropped without conversion: they can't become amounts.
 *
 * A Holding belongs to one Investment Account of the same Owner. The
 * foreign key includes the Account's Role, pinned to 'investment', so only
 * Investments take Holdings and an Account with Holdings can't change Role.
 * An index fund names its Index, and its own name is optional; every other
 * Holding has a name. A stock is always equity. `units` and
 * `ticker` are kept for a later market data feed.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    ALTER TABLE account
      DROP CONSTRAINT account_asset_mix_on_investment,
      DROP COLUMN equity_percent,
      DROP COLUMN bonds_percent,
      DROP COLUMN cash_percent,
      DROP COLUMN crypto_percent,
      DROP COLUMN other_percent,
      ADD CONSTRAINT account_owner_id_role UNIQUE (owner_id, id, role)
  `)
  yield* sql.unsafe(`
    CREATE TABLE holding (
      owner_id uuid NOT NULL REFERENCES owner (id),
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      account_id uuid NOT NULL,
      account_role text NOT NULL DEFAULT 'investment' CHECK (account_role = 'investment'),
      kind text NOT NULL CHECK (kind IN ('index_fund', 'stock', 'other')),
      name text CHECK (length(btrim(name)) BETWEEN 1 AND 100),
      ticker text CHECK (ticker ~ '^[A-Z0-9][A-Z0-9.:-]{0,19}$'),
      index_name text CHECK (length(btrim(index_name)) BETWEEN 1 AND 100),
      asset_class text NOT NULL
        CHECK (asset_class IN ('equity', 'bonds', 'cash', 'crypto', 'other')),
      units numeric(28, 8) CHECK (units > 0),
      value_cents bigint NOT NULL CHECK (value_cents >= 0),
      valued_on date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (id),
      UNIQUE (owner_id, id),
      FOREIGN KEY (owner_id, account_id, account_role)
        REFERENCES account (owner_id, id, role),
      CONSTRAINT holding_named CHECK (name IS NOT NULL OR kind = 'index_fund'),
      CONSTRAINT holding_index_on_index_fund CHECK ((kind = 'index_fund') = (index_name IS NOT NULL)),
      CONSTRAINT holding_stock_is_equity CHECK (kind <> 'stock' OR asset_class = 'equity')
    )
  `)
  yield* sql.unsafe(`
    CREATE INDEX holding_by_account ON holding (owner_id, account_id)
  `)
})
