import assert from "node:assert/strict"
import test from "node:test"
import { initialSettings } from "./settings.ts"
import { readWorkspace, WORKSPACE_STORAGE_KEY, writeWorkspace } from "./workspace-storage.ts"

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test("draft recovery preserves the named notebook and its page customizations", () => {
  const storage = memoryStorage()
  const draft = {
    name: "Recovered journal",
    settings: { ...initialSettings, pageAppearanceOverrides: { 3: { lineSpacing: 7 } } },
  }
  assert.equal(writeWorkspace(draft, storage).ok, true)
  assert.deepEqual(readWorkspace(storage), { ok: true, value: draft })
  storage.setItem(WORKSPACE_STORAGE_KEY, "{broken")
  assert.equal(readWorkspace(storage).ok, false)
  assert.equal(storage.getItem(WORKSPACE_STORAGE_KEY), "{broken")
})

test("failed persistence reports failure without replacing the last recoverable draft", () => {
  const storage = memoryStorage()
  const original = { name: "Saved draft", settings: initialSettings }
  writeWorkspace(original, storage)
  storage.setItem = () => {
    throw new Error("Quota exceeded")
  }
  assert.equal(writeWorkspace({ ...original, name: "Unsaved change" }, storage).ok, false)
  assert.deepEqual(readWorkspace(storage), { ok: true, value: original })
})
