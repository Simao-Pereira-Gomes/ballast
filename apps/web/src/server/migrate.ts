import * as Migrator from "effect/sql/Migrator"
import ownersAndAccounts from "./migrations/0001_owners_and_accounts.ts"

const applyMigrations = Migrator.make({})

/** Applies any pending migrations, in order. */
export const migrate = applyMigrations({
  loader: Migrator.fromRecord({
    "0001_owners_and_accounts": ownersAndAccounts,
  }),
  table: "schema_migration",
})
