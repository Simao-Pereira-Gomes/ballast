import * as Migrator from "effect/sql/Migrator"
import ownersAndAccounts from "./migrations/0001_owners_and_accounts.ts"
import transactions from "./migrations/0002_transactions.ts"
import accountLifecycle from "./migrations/0003_account_lifecycle.ts"
import holdings from "./migrations/0004_holdings.ts"
import imports from "./migrations/0005_imports.ts"
import balanceCheckpoints from "./migrations/0006_balance_checkpoints.ts"

const applyMigrations = Migrator.make({})

/** Applies any pending migrations, in order. */
export const migrate = applyMigrations({
  loader: Migrator.fromRecord({
    "0001_owners_and_accounts": ownersAndAccounts,
    "0002_transactions": transactions,
    "0003_account_lifecycle": accountLifecycle,
    "0004_holdings": holdings,
    "0005_imports": imports,
    "0006_balance_checkpoints": balanceCheckpoints,
  }),
  table: "schema_migration",
})
