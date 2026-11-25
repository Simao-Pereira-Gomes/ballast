import { AccountId, Money, OwnerId } from "@ballast/core"
import type { BalanceCheckpoint, ImportId } from "@ballast/core"
import { Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

const CheckpointRow = Schema.Struct({
  date: Schema.String,
  balanceCents: Schema.BigIntFromString,
})

/**
 * Records the balance a bank export states for an Account at the end of a
 * date. A Checkpoint already there for that date is replaced by the newer
 * statement, keeping the Import that first stated it when this one has none.
 */
export const recordCheckpoint = (
  ownerId: OwnerId,
  accountId: AccountId,
  importId: ImportId | null,
  checkpoint: BalanceCheckpoint,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    yield* sql`
      INSERT INTO balance_checkpoint (owner_id, account_id, import_id, date, balance_cents)
      VALUES (${ownerId}, ${accountId}, ${importId}, ${checkpoint.date.toString()},
              ${checkpoint.balance.cents.toString()})
      ON CONFLICT (owner_id, account_id, date) DO UPDATE
        SET balance_cents = EXCLUDED.balance_cents,
            import_id = COALESCE(EXCLUDED.import_id, balance_checkpoint.import_id)
    `
  })

/** The Balance Checkpoints on one of the Owner's Accounts, oldest first. */
export const listCheckpoints = (ownerId: OwnerId, accountId: AccountId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const rows = yield* Schema.decodeUnknownEffect(Schema.Array(CheckpointRow))(
      yield* sql`
        SELECT date::text AS date, balance_cents::text AS "balanceCents"
        FROM balance_checkpoint
        WHERE owner_id = ${ownerId} AND account_id = ${accountId}
        ORDER BY date
      `,
    ).pipe(Effect.orDie)
    const checkpoints: readonly BalanceCheckpoint[] = rows.map((row) => ({
      date: Temporal.PlainDate.from(row.date),
      balance: Money.eur(row.balanceCents),
    }))
    return checkpoints
  })
