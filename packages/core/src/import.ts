import { Schema } from "effect"
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
  readonly lineCount: number
  readonly importedAt: Date
}
