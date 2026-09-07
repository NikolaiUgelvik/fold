import type { Settings } from "./settings.ts"

export type Workspace = { name: string; settings: Settings }
export type EditorHistory = {
  past: Workspace[]
  present: Workspace
  future: Workspace[]
  group: string | null
}

export type EditorAction =
  | { type: "setting"; key: keyof Settings; value: Settings[keyof Settings]; group: string | null }
  | { type: "name"; name: string; group: string | null }
  | { type: "replace"; workspace: Workspace }
  | { type: "undo" | "redo" }

export function createEditorHistory(present: Workspace): EditorHistory {
  return { past: [], present, future: [], group: null }
}

function record(history: EditorHistory, present: Workspace, group: string | null): EditorHistory {
  return {
    past:
      group !== null && group === history.group
        ? history.past
        : [...history.past.slice(-99), history.present],
    present,
    future: [],
    group,
  }
}

export function editorHistoryReducer(history: EditorHistory, action: EditorAction): EditorHistory {
  switch (action.type) {
    case "replace":
      return createEditorHistory(action.workspace)
    case "setting": {
      if (Object.is(history.present.settings[action.key], action.value)) return history
      const settings = { ...history.present.settings, [action.key]: action.value }
      return record(history, { ...history.present, settings }, action.group)
    }
    case "name":
      return action.name === history.present.name
        ? history
        : record(history, { ...history.present, name: action.name }, action.group)
    case "undo": {
      const present = history.past.at(-1)
      return present
        ? {
            past: history.past.slice(0, -1),
            present,
            future: [history.present, ...history.future],
            group: null,
          }
        : history
    }
    case "redo": {
      const present = history.future[0]
      return present
        ? {
            past: [...history.past, history.present],
            present,
            future: history.future.slice(1),
            group: null,
          }
        : history
    }
  }
}
