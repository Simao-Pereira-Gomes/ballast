import * as Migrator from "effect/sql/Migrator"
import ownersAndAccounts from "./migrations/0001_owners_and_accounts.ts"
import transactions from "./migrations/0002_transactions.ts"
import accountLifecycle from "./migrations/0003_account_lifecycle.ts"

const applyMigrations = Migrator.make({})

/** Applies any pending migrations, in order. */
export const migrate = applyMigrations({
  loader: Migrator.fromRecord({
    "0001_owners_and_accounts": ownersAndAccounts,
    "0002_transactions": transactions,
    "0003_account_lifecycle": accountLifecycle,
  }),
  table: "schema_migration",
})
