import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import { createEditorHistory, editorHistoryReducer, type Workspace } from "./editor-history"
import { initialSettings, type SettingsUpdate } from "./settings"
import { readWorkspace, writeWorkspace } from "./workspace-storage"

function recoverWorkspace() {
  try {
    const result = readWorkspace(globalThis.localStorage)
    if (result.ok)
      return {
        workspace: result.value ?? { name: "Untitled notebook", settings: initialSettings },
        recovered: result.value !== null,
        error: "",
      }
    return {
      workspace: { name: "Untitled notebook", settings: initialSettings },
      recovered: false,
      error: result.error,
    }
  } catch {
    return {
      workspace: { name: "Untitled notebook", settings: initialSettings },
      recovered: false,
      error: "Browser storage is unavailable. Changes cannot be recovered after closing this tab.",
    }
  }
}

function persistWorkspace(workspace: Workspace) {
  try {
    const result = writeWorkspace(workspace, globalThis.localStorage)
    return result.ok ? "" : result.error
  } catch {
    return "Not saved: browser storage is unavailable. Keep this tab open to avoid losing changes."
  }
}

function useDraftPersistence(workspace: Workspace, initialError: string, skipInitial: boolean) {
  const [storageError, setStorageError] = useState(initialError)
  const current = useRef(workspace)
  current.current = workspace
  const preserveUnrecoveredDraft = useRef(skipInitial)
  preserveUnrecoveredDraft.current = skipInitial
  useEffect(() => {
    if (!skipInitial) setStorageError(persistWorkspace(workspace))
  }, [workspace, skipInitial])
  useEffect(() => {
    const saveOnExit = () =>
      preserveUnrecoveredDraft.current ? initialError : persistWorkspace(current.current)
    const guardExit = (event: BeforeUnloadEvent) => {
      if (saveOnExit()) event.preventDefault()
    }
    window.addEventListener("pagehide", saveOnExit)
    window.addEventListener("beforeunload", guardExit)
    return () => {
      window.removeEventListener("pagehide", saveOnExit)
      window.removeEventListener("beforeunload", guardExit)
    }
  }, [initialError])
  return storageError
}

function useEditorHistory(initial: Workspace) {
  const [history, dispatch] = useReducer(editorHistoryReducer, initial, createEditorHistory)
  const group = useRef<string | null>(null)
  const groupSequence = useRef(0)
  const beginEdit = useCallback(() => {
    group.current = String(++groupSequence.current)
  }, [])
  const endEdit = useCallback(() => {
    group.current = null
  }, [])
  const updateSettings: SettingsUpdate = useCallback((key, value) => {
    dispatch({ type: "setting", key, value, group: group.current })
  }, [])
  const updateName = useCallback(
    (name: string) => dispatch({ type: "name", name, group: group.current }),
    [],
  )
  const undo = useCallback(() => {
    group.current = null
    dispatch({ type: "undo" })
  }, [])
  const redo = useCallback(() => {
    group.current = null
    dispatch({ type: "redo" })
  }, [])
  const replace = useCallback((workspace: Workspace) => {
    group.current = null
    dispatch({ type: "replace", workspace })
  }, [])
  return { history, beginEdit, endEdit, updateSettings, updateName, undo, redo, replace }
}

export function useWorkspace() {
  const [initial] = useState(recoverWorkspace)
  const editor = useEditorHistory(initial.workspace)
  const { present } = editor.history
  const [checkpoint, setCheckpoint] = useState<Workspace | null>(
    initial.recovered ? null : initial.workspace,
  )
  const storageError = useDraftPersistence(
    present,
    initial.error,
    Boolean(initial.error) && present === initial.workspace,
  )

  function open(workspace: Workspace) {
    editor.replace(workspace)
    setCheckpoint(workspace)
  }
  function markSaved(name: string) {
    setCheckpoint({ name, settings: present.settings })
    editor.updateName(name)
  }

  return {
    ...present,
    updateSettings: editor.updateSettings,
    updateName: editor.updateName,
    undo: editor.undo,
    redo: editor.redo,
    beginEdit: editor.beginEdit,
    endEdit: editor.endEdit,
    open,
    markSaved,
    canUndo: editor.history.past.length > 0,
    canRedo: editor.history.future.length > 0,
    hasChanges: checkpoint?.name !== present.name || checkpoint?.settings !== present.settings,
    storageError,
    saveStatus: storageError ? "Not saved" : "Saved in this browser",
    recoveryNotice: initial.recovered
      ? "Your previous draft was recovered from this browser."
      : initial.error,
  }
}
