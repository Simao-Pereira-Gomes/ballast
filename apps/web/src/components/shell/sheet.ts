import { cn } from "@/lib/utils.ts"

/**
 * Dialog content that is a bottom sheet on phones, clear of the home
 * indicator, and a centred dialog on larger screens.
 */
export const sheetContentClassName = cn(
  "max-h-[92dvh] gap-5 overflow-y-auto rounded-3xl border-0 bg-card p-6",
  "max-w-none sm:max-w-none md:max-w-lg max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
  "max-md:data-[state=closed]:slide-out-to-bottom max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=open]:zoom-in-100",
)

/** The grab handle drawn at the top of a sheet on phones. */
export const sheetHandleClassName = "mx-auto -mt-2 h-1.5 w-12 rounded-full bg-input md:hidden"
