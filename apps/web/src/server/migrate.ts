import * as Migrator from "effect/sql/Migrator"
import ownersAndAccounts from "./migrations/0001_owners_and_accounts.ts"
import transactions from "./migrations/0002_transactions.ts"

const applyMigrations = Migrator.make({})

/** Applies any pending migrations, in order. */
export const migrate = applyMigrations({
  loader: Migrator.fromRecord({
    "0001_owners_and_accounts": ownersAndAccounts,
    "0002_transactions": transactions,
  }),
  table: "schema_migration",
})
