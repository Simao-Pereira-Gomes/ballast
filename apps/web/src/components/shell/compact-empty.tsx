import type { ReactNode } from "react"

/**
 * A small empty state for a section that shares the page with others, so
 * several empty sections don't stack up as big centred blocks.
 */
export function CompactEmpty({
  icon,
  title,
  body,
}: Readonly<{ icon: ReactNode; title: string; body: string }>) {
  return (
    <div className="flex items-start gap-4 rounded-3xl border border-dashed border-border p-5">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
