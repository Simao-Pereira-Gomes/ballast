import { createSerializationAdapter } from "@tanstack/react-router"
import { createStart } from "@tanstack/react-start"

/** Calendar dates cross between server and browser as ISO text, e.g. "2026-10-31". */
const plainDate = createSerializationAdapter({
  key: "Temporal.PlainDate",
  test: (value): value is Temporal.PlainDate => value instanceof Temporal.PlainDate,
  toSerializable: (date) => date.toString(),
  fromSerializable: (text: string) => Temporal.PlainDate.from(text),
})

export const startInstance = createStart(() => ({ serializationAdapters: [plainDate] }))
