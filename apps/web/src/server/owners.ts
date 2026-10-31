import { OwnerId } from "@ballast/core"
import { Context, Effect, Schema } from "effect"
import { SqlClient } from "effect/sql/SqlClient"

/** The Owner whose data the current request works on. */
export class CurrentOwner extends Context.Service<CurrentOwner, { readonly id: OwnerId }>()(
  "CurrentOwner",
) {}

const decodeOwnerRow = Schema.decodeUnknownEffect(Schema.Tuple([Schema.Struct({ id: OwnerId })]))

/**
 * Returns the default Owner, creating it on first start. Safe to call
 * repeatedly and concurrently: there is only ever one default Owner.
 */
export const ensureDefaultOwner = Effect.gen(function* () {
  const sql = yield* SqlClient
  yield* sql`
    INSERT INTO owner (is_default) VALUES (true)
    ON CONFLICT (is_default) WHERE is_default DO NOTHING
  `
  const [owner] = yield* decodeOwnerRow(yield* sql`SELECT id FROM owner WHERE is_default`).pipe(
    Effect.orDie,
  )
  return owner.id
})

/** Creates an additional, non-default Owner. */
export const createOwner = Effect.gen(function* () {
  const sql = yield* SqlClient
  const [owner] = yield* decodeOwnerRow(
    yield* sql`INSERT INTO owner DEFAULT VALUES RETURNING id`,
  ).pipe(Effect.orDie)
  return owner.id
})
