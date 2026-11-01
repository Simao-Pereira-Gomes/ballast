import type { LucideIcon } from "lucide-react"
import { useId } from "react"
import { cn } from "@/lib/utils.ts"

export interface Choice<Value extends string> {
  readonly value: Value
  readonly label: string
  readonly icon?: LucideIcon
  /** The label's language, when it differs from the page's (e.g. a language named in itself). */
  readonly lang?: string
}

/**
 * One choice out of a few, as a segmented control of radio buttons with a
 * visible legend and a one-line explanation.
 */
export function SegmentedChoice<Value extends string>({
  legend,
  description,
  choices,
  value,
  onChoose,
}: Readonly<{
  legend: string
  description: string
  choices: readonly Choice<Value>[]
  value: Value
  onChoose: (value: Value) => void
}>) {
  const name = useId()
  const descriptionId = `${name}-description`

  return (
    <fieldset aria-describedby={descriptionId} className="min-w-0">
      <legend className="text-lg font-semibold">{legend}</legend>
      <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 flex rounded-2xl bg-secondary p-1">
        {choices.map((choice) => (
          <label
            key={choice.value}
            lang={choice.lang}
            className={cn(
              "relative flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
              "has-checked:bg-card has-checked:font-semibold has-checked:text-foreground has-checked:shadow-sm",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => {
                onChoose(choice.value)
              }}
              className="absolute inset-0 cursor-pointer appearance-none rounded-xl opacity-0"
            />
            {choice.icon && <choice.icon className="size-4 shrink-0 max-sm:hidden" aria-hidden />}
            <span className="truncate">{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
