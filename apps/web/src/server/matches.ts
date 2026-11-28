import { MatchNotFound, TransactionId, mergeMatch, suggestMatches } from "@ballast/core"
import type { OwnerId, Transaction } from "@ballast/core"
import { Effect, Option, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"
import { CurrentOwner } from "./owners.ts"
import { columns, decodeRows } from "./transactions.ts"

const PairRow = Schema.Struct({ manualId: TransactionId, importedId: TransactionId })

/** A suggested Match, with both Transactions in full for the Review Queue. */
export interface MatchSuggestionView {
  readonly manual: Transaction
  readonly imported: Transaction
  readonly daysApart: number
}

/**
 * The Matches suggested to the Owner right now. They are never stored: the
 * Pairing Engine runs over the Transactions on the Owner's active Accounts,
 * leaving out imported Transactions already merged with a manual one and
 * pairs the Owner rejected.
 */
export const listMatchSuggestions = (ownerId: OwnerId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const transactions = yield* decodeRows(
      yield* sql`
        SELECT ${sql.literal(columns)}
        FROM transaction
        WHERE owner_id = ${ownerId}
          AND account_id IN (
            SELECT id FROM account WHERE owner_id = ${ownerId} AND archived_at IS NULL
          )
          AND NOT EXISTS (SELECT 1 FROM confirmed_match WHERE imported_id = transaction.id)
      `,
    )
    const rejected = yield* Schema.decodeUnknownEffect(Schema.Array(PairRow))(
      yield* sql`
        SELECT manual_id AS "manualId", imported_id AS "importedId"
        FROM rejected_match WHERE owner_id = ${ownerId}
      `,
    ).pipe(Effect.orDie)

    const byId = new Map(transactions.map((t) => [t.id, t]))
    return suggestMatches(transactions, rejected).flatMap((suggestion): MatchSuggestionView[] => {
      const manual = byId.get(suggestion.manualId)
      const imported = byId.get(suggestion.importedId)
      return manual && imported ? [{ manual, imported, daysApart: suggestion.daysApart }] : []
    })
  })

/**
 * Decides one suggested Match. Inside one database transaction it locks both
 * Transactions, then checks the pair is still suggested to the Owner, so two
 * decisions made at once (a double click, two tabs) can't both act on it: the
 * later one finds the pair gone and fails with `MatchNotFound`.
 */
const decide = <A, E, R>(
  ownerId: OwnerId,
  manualId: string,
  importedId: string,
  act: (suggestion: MatchSuggestionView) => Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const gone = new MatchNotFound({ manualId, importedId })
    const ids = Schema.decodeUnknownOption(Schema.Tuple([TransactionId, TransactionId]))([
      manualId,
      importedId,
    ])
    if (Option.isNone(ids)) return yield* gone
    const [manual, imported] = ids.value
    return yield* sql
      .withTransaction(
        Effect.gen(function* () {
          const locked = yield* sql`
            SELECT id FROM transaction
            WHERE owner_id = ${ownerId} AND id IN (${manual}, ${imported})
            ORDER BY id
            FOR UPDATE
          `
          if (locked.length !== 2) return yield* gone
          const suggestions = yield* listMatchSuggestions(ownerId)
          const found = suggestions.find(
            (s) => s.manual.id === manual && s.imported.id === imported,
          )
          return found === undefined ? yield* gone : yield* act(found)
        }),
      )
      .pipe(Effect.catchTag("SqlError", Effect.die))
  })

/**
 * Confirms a suggested Match: the imported Transaction keeps the bank's date,
 * amount and description and gains the manual description as a note, the
 * manual Transaction is deleted, and what it held is kept so undoing the
 * Import can restore it. Fails with `MatchNotFound` unless the pair is
 * currently suggested to the Owner.
 */
export const confirmMatch = (ownerId: OwnerId, manualId: string, importedId: string) =>
  decide(ownerId, manualId, importedId, ({ manual, imported }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient
      const { merged, snapshot } = mergeMatch(manual, imported)
      yield* sql`
        UPDATE transaction SET notes = ${merged.notes}, updated_at = now()
        WHERE owner_id = ${ownerId} AND id = ${imported.id}
      `
      yield* sql`
        INSERT INTO confirmed_match
          (owner_id, imported_id, manual_date, manual_amount_cents, manual_description, manual_notes)
        VALUES (${ownerId}, ${imported.id}, ${snapshot.date.toString()},
                ${snapshot.amount.cents.toString()}, ${snapshot.description}, ${snapshot.notes})
      `
      yield* sql`DELETE FROM transaction WHERE owner_id = ${ownerId} AND id = ${manual.id}`
    }),
  )

/** Rejects a suggested Match: both Transactions stay, and the pair is not suggested again. */
export const rejectMatch = (ownerId: OwnerId, manualId: string, importedId: string) =>
  decide(ownerId, manualId, importedId, ({ manual, imported }) =>
    Effect.gen(function* () {
      const sql = yield* SqlClient
      yield* sql`
        INSERT INTO rejected_match (owner_id, manual_id, imported_id)
        VALUES (${ownerId}, ${manual.id}, ${imported.id})
      `
    }),
  )

export const listMatchSuggestionsForCurrentOwner = Effect.gen(function* () {
  const owner = yield* CurrentOwner
  return yield* listMatchSuggestions(owner.id)
})

export const confirmMatchForCurrentOwner = (manualId: string, importedId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* confirmMatch(owner.id, manualId, importedId)
  })

export const rejectMatchForCurrentOwner = (manualId: string, importedId: string) =>
  Effect.gen(function* () {
    const owner = yield* CurrentOwner
    yield* rejectMatch(owner.id, manualId, importedId)
  })
