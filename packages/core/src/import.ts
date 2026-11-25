import { Data, Schema } from "effect"
import type { AccountId } from "./account.ts"
import type { OwnerId } from "./owner.ts"

export const ImportId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("ImportId"))
export type ImportId = typeof ImportId.Type

/** One ingestion of a bank export into one of the Owner's Accounts. */
export interface Import {
  readonly id: ImportId
  readonly ownerId: OwnerId
  readonly accountId: AccountId
  readonly fileName: string
  /** Which Statement Parser format read the file. */
  readonly format: string
  /** Lines that became Transactions. */
  readonly lineCount: number
  /** Lines in the file the Account already held, left out. */
  readonly skippedCount: number
  /** When the Import ran: a technical timestamp, not a calendar date. */
  readonly importedAt: Temporal.Instant
}

/** No Import with this id belongs to the Owner, e.g. it was already undone. */
export class ImportNotFound extends Data.TaggedError("ImportNotFound")<{
  readonly importId: string
}> {}
