import { FolderOpen, Printer, Redo2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PROJECT_NAME_MAX } from "@/lib/project-storage"

export function WorkspaceHeader({
  name,
  onNameChange,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onProjects,
  onPrint,
}: {
  name: string
  onNameChange: (name: string) => void
  saveStatus: string
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onProjects: () => void
  onPrint: () => void
}) {
  return (
    <header className="workspace-header border-b bg-background">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="shrink-0 font-serif text-display">Fold</h1>
        <div className="min-w-0 flex-1 border-l pl-3">
          <label htmlFor="workspace-name" className="sr-only">
            Project name
          </label>
          <Input
            id="workspace-name"
            value={name}
            maxLength={PROJECT_NAME_MAX}
            className="h-8 w-full border-transparent bg-transparent px-1 font-semibold shadow-none hover:border-input focus:border-input"
            onChange={(event) => onNameChange(event.target.value)}
          />
          <p className="px-1 text-xs text-muted-foreground" role="status">
            {saveStatus}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          className="size-11"
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-11"
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 />
        </Button>
        <Button variant="outline" onClick={onProjects}>
          <FolderOpen />
          Projects
        </Button>
        <Button onClick={onPrint}>
          <Printer />
          Print / PDF
        </Button>
      </div>
    </header>
  )
}
