import { X } from "lucide-react"
import { type ReactNode, useId, useLayoutEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

export function WorkspaceDialog({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const element = dialog.current
    const opener = document.activeElement
    element?.showModal()
    return () => {
      element?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={`workspace-dialog ${className}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background px-5 py-3">
        <h2 id={titleId} className="font-serif text-heading">
          {title}
        </h2>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-11"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
