import type { Workspace } from "./editor-history.ts"
import { normalizeStoredSettings, PROJECT_NAME_MAX, type ProjectResult } from "./project-storage.ts"

export const WORKSPACE_STORAGE_KEY = "fold.workspace.v1"

export function readWorkspace(storage: Storage): ProjectResult<Workspace | null> {
  try {
    const raw = storage.getItem(WORKSPACE_STORAGE_KEY)
    if (raw === null) return { ok: true, value: null }
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("name" in parsed) ||
      typeof parsed.name !== "string" ||
      parsed.name.length > PROJECT_NAME_MAX ||
      !("settings" in parsed)
    ) {
      return {
        ok: false,
        error:
          "The local draft could not be recovered. Saved copies are still available in Projects.",
      }
    }
    const settings = normalizeStoredSettings(parsed.settings)
    return settings
      ? { ok: true, value: { name: parsed.name, settings } }
      : { ok: false, error: "The local draft contains invalid notebook settings." }
  } catch {
    return {
      ok: false,
      error:
        "Local draft recovery is unavailable. Keep this tab open until you have saved your work.",
    }
  }
}

export function writeWorkspace(workspace: Workspace, storage: Storage): ProjectResult<null> {
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, ...workspace }))
    return { ok: true, value: null }
  } catch {
    return {
      ok: false,
      error:
        "Not saved: browser storage is full or unavailable. Keep this tab open; closing it may lose changes.",
    }
  }
}
