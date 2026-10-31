import { Schema } from "effect"

/** Identifies the Owner every financial record belongs to. */
export const OwnerId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("OwnerId"))
export type OwnerId = typeof OwnerId.Type
