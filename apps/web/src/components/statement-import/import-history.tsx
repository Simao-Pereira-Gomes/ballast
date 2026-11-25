import type { Import } from "@ballast/core"
import { ChevronDown, History } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button.tsx"
import { m } from "@/paraglide/messages.js"
import { formatDay } from "@/ui/format.ts"

/** What undoing an Import can come back with: it worked, or it had already been undone. */
export type UndoOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: "gone" }

const subscribeToNothing = () => () => undefined
const browserTimeZone = () => Temporal.Now.timeZoneId()
const serverTimeZone = () => "UTC"

/**
 * The day an Import happened. The server and the first browser render both
 * use UTC, so they agree; once mounted, the browser's own time zone applies.
 */
const importedOn = (imported: Import, timeZone: string) =>
  formatDay(imported.importedAt.toZonedDateTimeISO(timeZone).toPlainDate())

/**
 * The Account's Imports, newest first, each with a two-step undo that
 * removes exactly what that Import created.
 */
export function ImportHistory({
  imports,
  onUndo,
}: Readonly<{ imports: readonly Import[]; onUndo: (imported: Import) => Promise<UndoOutcome> }>) {
  const [confirming, setConfirming] = useState<string | undefined>()
  const [undoing, setUndoing] = useState<string | undefined>()
  const [alreadyUndone, setAlreadyUndone] = useState(false)
  const timeZone = useSyncExternalStore(subscribeToNothing, browserTimeZone, serverTimeZone)

  async function undo(imported: Import) {
    setUndoing(imported.id)
    setAlreadyUndone(false)
    try {
      const outcome = await onUndo(imported)
      if (!outcome.ok) setAlreadyUndone(true)
    } finally {
      setUndoing(undefined)
      setConfirming(undefined)
    }
  }

  const notice = alreadyUndone && (
    <p
      role="alert"
      className="mt-6 rounded-2xl bg-secondary px-5 py-3 text-sm text-secondary-foreground"
    >
      {m.import_already_undone()}
    </p>
  )

  if (imports.length === 0) return notice

  return (
    <>
      {notice}
      <details className="group mt-6 rounded-3xl bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-3xl px-5 py-4 text-base font-semibold outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
          <History className="size-5 text-muted-foreground" aria-hidden />
          <span className="flex-1">{m.import_history_heading({ count: imports.length })}</span>
          <ChevronDown
            className="size-5 text-muted-foreground transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <ul className="divide-y divide-border border-t border-border">
          {imports.map((imported) => (
            <li key={imported.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-semibold">{imported.fileName}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {m.import_history_counts({
                    date: importedOn(imported, timeZone),
                    newCount: imported.lineCount,
                    skippedCount: imported.skippedCount,
                  })}
                </p>
              </div>
              {confirming === imported.id ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={undoing === imported.id}
                    className="h-10 rounded-xl"
                    onClick={() => {
                      setConfirming(undefined)
                    }}
                  >
                    {m.cancel()}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={undoing === imported.id}
                    className="h-10 rounded-xl"
                    onClick={() => void undo(imported)}
                  >
                    {undoing === imported.id
                      ? m.undoing_import()
                      : m.confirm_undo_import({ count: imported.lineCount })}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  aria-label={m.undo_import_named({ fileName: imported.fileName })}
                  className="h-10 rounded-xl"
                  onClick={() => {
                    setConfirming(imported.id)
                  }}
                >
                  {m.undo_import()}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}
