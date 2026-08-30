import { Trash2 } from "lucide-react"
import { useId, useState } from "react"

import { Field } from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  deleteProject,
  listProjects,
  loadProject,
  PROJECT_NAME_MAX,
  type StoredProject,
  saveProject,
} from "@/lib/project-storage"
import { initialSettings, type Settings } from "@/lib/settings"
import { cn } from "@/lib/utils"

const savedAtFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

const formatSavedAt = (savedAt: number) => {
  const date = new Date(savedAt)
  return Number.isNaN(date.getTime()) ? "unknown date" : savedAtFormat.format(date)
}

export type ProjectsPanelProps = {
  settings: Settings
  onLoad: (settings: Settings) => void
}

type PanelStatus = {
  text: string
  error: boolean
}

export function ProjectsPanel({ settings, onLoad }: ProjectsPanelProps) {
  const inputId = useId()
  const [name, setName] = useState("")
  const [projects, setProjects] = useState(() => listProjects())
  const [status, setStatus] = useState<PanelStatus | null>(null)

  function handleSave() {
    const trimmed = name.trim()
    const existed = projects.some((project) => project.name.toLowerCase() === trimmed.toLowerCase())
    const result = saveProject(trimmed, settings)
    if (result.ok) {
      setProjects(listProjects())
      setStatus({
        text: existed ? `Replaced "${result.value.name}"` : `Saved "${result.value.name}"`,
        error: false,
      })
    } else {
      setStatus({ text: result.error, error: true })
    }
  }

  function handleLoad(project: StoredProject) {
    const result = loadProject(project.name)
    if (result.ok) {
      onLoad(result.value)
      setStatus({ text: `Loaded "${project.name}"`, error: false })
    } else {
      setStatus({ text: result.error, error: true })
    }
  }

  function handleDelete(project: StoredProject) {
    deleteProject(project.name)
    setProjects(listProjects())
    setStatus({ text: `Deleted "${project.name}"`, error: false })
  }

  function handleNew() {
    onLoad(initialSettings)
    setName("")
    setStatus({ text: "Started a new project.", error: false })
  }

  return (
    <section className="border-b p-5">
      {status && (
        <p
          role={status.error ? "alert" : "status"}
          className={cn(
            "mb-3 text-right text-2xs",
            status.error ? "text-red-700" : "text-muted-foreground",
          )}
        >
          {status.text}
        </p>
      )}

      <div className="grid gap-3">
        <Field label="Project name" htmlFor={inputId} hint="Saved in this browser only.">
          <Input
            id={inputId}
            type="text"
            value={name}
            maxLength={PROJECT_NAME_MAX}
            placeholder="e.g. Summer journal"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <div className="flex gap-2">
          <Button className="flex-1" onClick={handleSave}>
            Save
          </Button>
          <Button className="flex-1" variant="outline" onClick={handleNew}>
            New
          </Button>
        </div>

        {projects.length === 0 ? (
          <p className="text-label text-muted-foreground">No saved projects yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {projects.map((project) => (
              <li key={project.name} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="text-2xs text-muted-foreground">{formatSavedAt(project.savedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" onClick={() => handleLoad(project)}>
                    Load
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Delete ${project.name}`}
                    onClick={() => handleDelete(project)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
