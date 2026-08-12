import type * as React from "react"

import { cn } from "@/lib/utils"

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "default" | "outline"
  size?: "default" | "icon-sm"
}) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        base,
        variant === "outline"
          ? "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        size === "icon-sm" ? "size-8" : "h-9 px-4 py-2 has-[>svg]:px-3",
        className,
      )}
      {...props}
    />
  )
}

export { Button }
