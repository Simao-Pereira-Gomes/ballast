import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * The Account lifecycle. A Liability may carry an annual interest rate in
 * basis points. An Investment may carry an asset-class mix in whole
 * percentages: all five set and adding up to 100, or none. Neither is
 * allowed on any other Role. `archived_at` marks a closed Account, which
 * keeps its Transactions.
 */
export default Effect.gen(function* () {
  const sql = yield* SqlClient

  yield* sql.unsafe(`
    ALTER TABLE account
      ADD COLUMN interest_rate_bp integer CHECK (interest_rate_bp BETWEEN 0 AND 10000),
      ADD COLUMN equity_percent smallint CHECK (equity_percent BETWEEN 0 AND 100),
      ADD COLUMN bonds_percent smallint CHECK (bonds_percent BETWEEN 0 AND 100),
      ADD COLUMN cash_percent smallint CHECK (cash_percent BETWEEN 0 AND 100),
      ADD COLUMN crypto_percent smallint CHECK (crypto_percent BETWEEN 0 AND 100),
      ADD COLUMN other_percent smallint CHECK (other_percent BETWEEN 0 AND 100),
      ADD COLUMN archived_at timestamptz,
      ADD CONSTRAINT account_interest_rate_on_liability
        CHECK (interest_rate_bp IS NULL OR role = 'liability'),
      ADD CONSTRAINT account_asset_mix_on_investment CHECK (
        num_nonnulls(equity_percent, bonds_percent, cash_percent, crypto_percent, other_percent) = 0
        OR (role = 'investment'
          AND num_nonnulls(equity_percent, bonds_percent, cash_percent, crypto_percent,
                           other_percent) = 5
          AND equity_percent + bonds_percent + cash_percent + crypto_percent + other_percent = 100)
      )
  `)
})
