import { normaliseDescription } from "@ballast/core"
import type { ImportId, OwnerId } from "@ballast/core"
import { Effect } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/**
 * Puts back the manual Transactions that confirmed Matches merged into an
 * Import's lines, as the Owner typed them, ready for undoing that Import to
 * delete the lines. Run inside the undo's database transaction.
 */
export const restoreMergedManualEntries = (ownerId: OwnerId, importId: ImportId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const merged = yield* sql<{
      accountId: string
      date: string
      amountCents: string
      description: string
      notes: string | null
    }>`
      SELECT t.account_id AS "accountId", c.manual_date::text AS date,
             c.manual_amount_cents::text AS "amountCents",
             c.manual_description AS description, c.manual_notes AS notes
      FROM confirmed_match c
      JOIN transaction t ON t.owner_id = c.owner_id AND t.id = c.imported_id
      WHERE c.owner_id = ${ownerId} AND t.import_id = ${importId}
    `
    for (const entry of merged) {
      yield* sql`
        INSERT INTO transaction
          (owner_id, account_id, date, amount_cents, description, description_key, source, notes)
        VALUES (${ownerId}, ${entry.accountId}, ${entry.date}, ${entry.amountCents},
                ${entry.description}, ${normaliseDescription(entry.description)}, 'manual',
                ${entry.notes})
      `
    }
  })
