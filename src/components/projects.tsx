import { Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { Field } from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Workspace } from "@/lib/editor-history"
import {
  deleteProject,
  listProjects,
  loadProject,
  PROJECT_NAME_MAX,
  type StoredProject,
  saveProject,
} from "@/lib/project-storage"
import { initialSettings, type Settings } from "@/lib/settings"

const savedAtFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })
const formatSavedAt = (savedAt: number) => {
  const date = new Date(savedAt)
  return Number.isNaN(date.getTime()) ? "Unknown date" : savedAtFormat.format(date)
}

function useProjectCopies({
  settings,
  name,
  hasChanges,
  onOpen,
  onSaved,
}: Parameters<typeof ProjectsPanel>[0]) {
  const [copyName, setCopyName] = useState(`${name.slice(0, PROJECT_NAME_MAX - 5)} copy`)
  const [projects, setProjects] = useState<StoredProject[]>(() => {
    try {
      return listProjects()
    } catch {
      return []
    }
  })
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null)
  const [pending, setPending] = useState<Workspace | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const needsProtection =
    hasChanges ||
    (!(settings === initialSettings && name === "Untitled notebook") &&
      !projects.some(
        (project) =>
          project.name === name && JSON.stringify(project.settings) === JSON.stringify(settings),
      ))

  function handleSaveCopy() {
    try {
      const trimmed = copyName.trim()
      if (listProjects().some((project) => project.name.toLowerCase() === trimmed.toLowerCase())) {
        setStatus({
          text: "A saved copy already has this name. Choose a new name; existing copies will not be overwritten.",
          error: true,
        })
        return
      }
      const result = saveProject(trimmed, settings)
      if (!result.ok) {
        setStatus({ text: result.error, error: true })
        return
      }
      setProjects(listProjects())
      onSaved(result.value.name)
      setCopyName(`${result.value.name.slice(0, PROJECT_NAME_MAX - 5)} copy`)
      setStatus({ text: `Saved a copy named “${result.value.name}”.`, error: false })
    } catch {
      setStatus({ text: "Browser storage is unavailable. Your copy was not saved.", error: true })
    }
  }

  function requestOpen(workspace: Workspace) {
    if (needsProtection) setPending(workspace)
    else onOpen(workspace)
  }

  function handleLoad(project: StoredProject) {
    try {
      const result = loadProject(project.name)
      if (!result.ok) {
        setStatus({ text: result.error, error: true })
        return
      }
      requestOpen({ name: project.name, settings: result.value })
    } catch {
      setStatus({
        text: "Browser storage is unavailable. The saved copy could not be opened.",
        error: true,
      })
    }
  }

  function handleDelete(name: string) {
    try {
      if (!deleteProject(name)) throw new Error("Delete failed")
      setProjects(listProjects())
      setDeleting(null)
      setStatus({
        text: `Deleted saved copy “${name}”. The current draft is unchanged.`,
        error: false,
      })
    } catch {
      setStatus({ text: "The saved copy could not be deleted.", error: true })
    }
  }

  return {
    copyName,
    setCopyName,
    projects,
    status,
    pending,
    setPending,
    deleting,
    setDeleting,
    needsProtection,
    handleSaveCopy,
    requestOpen,
    handleLoad,
    handleDelete,
  }
}

export function ProjectsPanel(props: {
  settings: Settings
  name: string
  hasChanges: boolean
  onOpen: (workspace: Workspace) => void
  onSaved: (name: string) => void
}) {
  const inputId = useId()
  const {
    copyName,
    setCopyName,
    projects,
    status,
    pending,
    setPending,
    deleting,
    setDeleting,
    needsProtection,
    handleSaveCopy,
    requestOpen,
    handleLoad,
    handleDelete,
  } = useProjectCopies(props)

  return (
    <section className="grid gap-5 p-5">
      <p className="text-sm text-muted-foreground">
        Your current draft recovers automatically in this browser. Saved copies are snapshots you
        can return to. Nothing is uploaded or synced.
      </p>
      <Field label="Save a copy as" htmlFor={inputId}>
        <Input
          id={inputId}
          value={copyName}
          maxLength={PROJECT_NAME_MAX}
          onChange={(event) => setCopyName(event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSaveCopy}>Save a copy</Button>
        <Button
          variant="outline"
          onClick={() => requestOpen({ name: "Untitled notebook", settings: initialSettings })}
        >
          New notebook
        </Button>
      </div>
      {status && (
        <p
          role={status.error ? "alert" : "status"}
          className={`text-sm ${status.error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {status.text}
        </p>
      )}
      {pending && (
        <div className="grid gap-3 rounded-md border border-ring bg-accent p-4" role="alert">
          <p className="text-sm">
            {needsProtection
              ? "This replaces the current draft. Save a copy above to keep your changes, or discard them to continue."
              : "Your copy is saved. You can now switch notebooks."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button onClick={() => props.onOpen(pending)}>
              {needsProtection ? "Discard draft and continue" : "Open notebook"}
            </Button>
          </div>
        </div>
      )}
      <h3 className="font-semibold">Saved copies</h3>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved copies yet.</p>
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => (
            <li key={project.name} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSavedAt(project.savedAt)}</p>
                </div>
                <Button variant="outline" onClick={() => handleLoad(project)}>
                  Open
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="size-11"
                  aria-label={`Delete ${project.name}`}
                  onClick={() => setDeleting(project.name)}
                >
                  <Trash2 />
                </Button>
              </div>
              {deleting === project.name && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <span className="text-sm">Permanently delete this saved copy?</span>
                  <Button variant="outline" onClick={() => setDeleting(null)}>
                    Cancel
                  </Button>
                  <Button className="bg-destructive" onClick={() => handleDelete(project.name)}>
                    Delete copy
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
