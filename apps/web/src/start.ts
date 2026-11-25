import { createSerializationAdapter } from "@tanstack/react-router"
import { createStart } from "@tanstack/react-start"

/** Calendar dates cross between server and browser as ISO text, e.g. "2026-10-31". */
const plainDate = createSerializationAdapter({
  key: "Temporal.PlainDate",
  test: (value): value is Temporal.PlainDate => value instanceof Temporal.PlainDate,
  toSerializable: (date) => date.toString(),
  fromSerializable: (text: string) => Temporal.PlainDate.from(text),
})

/** Moments, such as when an Import ran, cross as ISO text, e.g. "2026-11-25T20:15:05.013Z". */
const instant = createSerializationAdapter({
  key: "Temporal.Instant",
  test: (value): value is Temporal.Instant => value instanceof Temporal.Instant,
  toSerializable: (moment) => moment.toString(),
  fromSerializable: (text: string) => Temporal.Instant.from(text),
})

export const startInstance = createStart(() => ({
  serializationAdapters: [plainDate, instant],
}))
