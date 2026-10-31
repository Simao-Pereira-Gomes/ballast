import { Anchor, Plus } from "lucide-react"
import type { Ref } from "react"
import { Button } from "@/components/ui/button.tsx"

/** What the Accounts page shows before the Owner has opened any Account. */
export function EmptyAccounts({
  onOpenAccount,
  buttonRef,
}: Readonly<{ onOpenAccount: () => void; buttonRef?: Ref<HTMLButtonElement> }>) {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
        <Anchor className="size-9" aria-hidden />
      </div>
      <h2 className="mt-5 text-2xl font-bold">Start with your current account</h2>
      <p className="mt-2 text-muted-foreground">
        Ballast needs to know where your money lives. Add each Account and say what it&apos;s for.
      </p>
      <Button
        ref={buttonRef}
        className="mt-6 h-12 rounded-2xl px-6 text-base font-semibold"
        onClick={onOpenAccount}
      >
        <Plus aria-hidden />
        Open your first Account
      </Button>
    </div>
  )
}
