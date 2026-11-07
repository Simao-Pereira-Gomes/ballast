import { createServerFn } from "@tanstack/react-start"
import { importStatementForCurrentOwner } from "../imports.ts"
import { runAction } from "../runtime.ts"

export type { ImportProblem } from "@ballast/core"
export type { ImportSummary } from "../imports.ts"

/** The upload form: the Account to import into and the bank export file. */
const readUpload = (data: FormData) => {
  const accountId = data.get("accountId")
  const file = data.get("file")
  if (typeof accountId !== "string" || !(file instanceof File)) {
    throw new TypeError("An Import needs an accountId and a file")
  }
  return { accountId, file }
}

export const importStatement = createServerFn({ method: "POST" })
  .validator(readUpload)
  .handler(async ({ data: { accountId, file } }) =>
    runAction(
      importStatementForCurrentOwner(accountId, {
        name: file.name,
        bytes: new Uint8Array(await file.arrayBuffer()),
      }),
    ),
  )
