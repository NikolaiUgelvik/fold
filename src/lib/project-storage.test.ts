import assert from "node:assert/strict"
import test from "node:test"
import {
  deleteProject,
  listProjects,
  loadProject,
  normalizeStoredSettings,
  PROJECT_NAME_MAX,
  PROJECT_STORAGE_KEY,
  saveProject,
} from "./project-storage.ts"
import { initialSettings, type Settings } from "./settings.ts"

class FakeStorage {
  private map = new Map<string, string>()

  quota = false

  get length() {
    return this.map.size
  }

  clear() {
    this.map.clear()
  }

  getItem(key: string) {
    return this.map.get(key) ?? null
  }

  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.map.delete(key)
  }

  setItem(key: string, value: string) {
    if (this.quota) throw new Error("QuotaExceededError")
    this.map.set(key, value)
  }
}

class BrokenStorage extends FakeStorage {
  getItem(key: string): string | null {
    throw new Error(`SecurityError (${key})`)
  }

  setItem(key: string, value: string): void {
    throw new Error(`SecurityError (${key}, ${value.length} chars)`)
  }
}

function assertProjectNames(storage: FakeStorage, names: string[]) {
  assert.deepEqual(
    listProjects(storage).map((project) => project.name),
    names,
  )
}

function assertLoaded(storage: FakeStorage, name: string, expected: Settings) {
  const loaded = loadProject(name, storage)
  assert.equal(loaded.ok, true)
  if (!loaded.ok) return
  assert.deepEqual(loaded.value, expected)
}

test("save and load round-trips a modified notebook document", () => {
  const storage = new FakeStorage()
  const settings: Settings = {
    ...structuredClone(initialSettings),
    binding: "yotsume",
    signatures: 6,
    customPages: { 1: { type: "title", title: "Summer", subtitle: "Notes" } },
    pageAppearanceOverrides: { 3: { margin: 5, numberVisible: false } },
    punchHoleSets: [
      { id: "set-a", offset: 10, groups: [{ id: "group-a", holes: 3, weight: 1 }] },
      { id: "set-b", offset: 20, groups: [{ id: "group-b", holes: 2, weight: 2 }] },
    ],
  }

  const saved = saveProject("Summer book", settings, storage)
  assert.equal(saved.ok, true)
  if (!saved.ok) return
  assert.deepEqual(listProjects(storage), [saved.value])

  assertLoaded(storage, "summer book", settings)
})

test("listProjects sorts newest first", () => {
  const storage = new FakeStorage()
  storage.setItem(
    PROJECT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      projects: [
        { name: "old", savedAt: 100, settings: initialSettings },
        { name: "new", savedAt: 200, settings: initialSettings },
      ],
    }),
  )

  assertProjectNames(storage, ["new", "old"])
})

test("saveProject rejects empty or oversized names", () => {
  const storage = new FakeStorage()
  for (const name of ["", "   ", "a".repeat(PROJECT_NAME_MAX + 1)]) {
    const result = saveProject(name, initialSettings, storage)
    assert.equal(result.ok, false)
  }
  assert.deepEqual(listProjects(storage), [])

  const exact = "a".repeat(PROJECT_NAME_MAX)
  assert.equal(saveProject(exact, initialSettings, storage).ok, true)
})

test("saveProject replaces an existing project case-insensitively", () => {
  const storage = new FakeStorage()
  saveProject("My Book", initialSettings, storage)
  const changed: Settings = { ...initialSettings, binding: "saddle" }
  const result = saveProject("my book", changed, storage)

  assert.equal(result.ok, true)
  const projects = listProjects(storage)
  assert.equal(projects.length, 1)
  assert.equal(projects[0].name, "my book")

  assertLoaded(storage, "My Book", changed)
})

test("deleteProject removes a match case-insensitively", () => {
  const storage = new FakeStorage()
  saveProject("Keep", initialSettings, storage)
  saveProject("Drop", initialSettings, storage)

  assert.equal(deleteProject("DROP", storage), true)
  assertProjectNames(storage, ["Keep"])
  assert.equal(deleteProject("Drop", storage), false)
})

test("listProjects ignores corrupt store documents", () => {
  for (const content of ["not json", "[1,2]", JSON.stringify({ version: 2, projects: [] })]) {
    const storage = new FakeStorage()
    storage.setItem(PROJECT_STORAGE_KEY, content)
    assert.deepEqual(listProjects(storage), [])
  }
})

test("normalizeStoredSettings rejects non-object values", () => {
  assert.equal(normalizeStoredSettings(null), null)
  assert.equal(normalizeStoredSettings("settings"), null)
  assert.equal(normalizeStoredSettings([1, 2]), null)
  assert.equal(normalizeStoredSettings(42), null)
})

test("normalizeStoredSettings falls back field by field", () => {
  const normalized = normalizeStoredSettings({
    binding: "coptic",
    pattern: "waffles",
    margin: "10",
    signatures: null,
    numberBold: "yes",
    paper: "a99",
    punchHoleDiameter: 2,
  })
  assert.ok(normalized)
  assert.equal(normalized.pattern, initialSettings.pattern)
  assert.equal(normalized.margin, initialSettings.margin)
  assert.equal(normalized.signatures, initialSettings.signatures)
  assert.equal(normalized.numberBold, initialSettings.numberBold)
  assert.equal(normalized.paper, initialSettings.paper)
  assert.equal(normalized.binding, "coptic")
  assert.equal(normalized.punchHoleDiameter, 2)
})

test("normalizeStoredSettings drops invalid custom pages", () => {
  const normalized = normalizeStoredSettings({
    customPages: {
      1: { type: "title", title: "Keep", subtitle: "Me" },
      2: { type: "index", title: "x", entries: 5 },
      3: { type: "mystery" },
    },
  })
  assert.ok(normalized)
  assert.deepEqual(normalized.customPages, {
    1: { type: "title", title: "Keep", subtitle: "Me" },
  })
})

test("normalizeStoredSettings keeps only valid override keys", () => {
  const normalized = normalizeStoredSettings({
    pageAppearanceOverrides: {
      1: { margin: 5, numberVisible: true, bogus: 1, pageNumberText: "v" },
      2: "garbage",
    },
  })
  assert.ok(normalized)
  assert.deepEqual(normalized.pageAppearanceOverrides, {
    1: { margin: 5, numberVisible: true, pageNumberText: "v" },
  })
})

test("normalizeStoredSettings keeps only valid punch hole sets", () => {
  const valid = { id: "ok", offset: 8, groups: [{ id: "g", holes: 2, weight: 1 }] }
  const normalized = normalizeStoredSettings({
    punchHoleSets: [valid, { id: "", groups: [] }, "junk"],
  })
  assert.ok(normalized)
  assert.deepEqual(normalized.punchHoleSets, [valid])

  assert.deepEqual(
    normalizeStoredSettings({ punchHoleSets: [] })?.punchHoleSets,
    initialSettings.punchHoleSets,
  )

  const duplicated = normalizeStoredSettings({
    punchHoleSets: [
      { id: "same", offset: 1, groups: [] },
      { id: "same", offset: 2, groups: [] },
    ],
  })
  assert.ok(duplicated)
  const ids = duplicated.punchHoleSets.map((set) => set.id)
  assert.equal(new Set(ids).size, 2)
})

test("loadProject fails when stored settings are not an object and keeps the entry", () => {
  const storage = new FakeStorage()
  storage.setItem(
    PROJECT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      projects: [{ name: "Broken", savedAt: 1, settings: "garbage" }],
    }),
  )

  const loaded = loadProject("Broken", storage)
  assert.equal(loaded.ok, false)
  if (loaded.ok) return
  assert.equal(loaded.error, "Project data is invalid and could not be loaded.")
  assertProjectNames(storage, ["Broken"])
})

test("loadProject salvages field-level corruption with fallbacks", () => {
  const storage = new FakeStorage()
  storage.setItem(
    PROJECT_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      projects: [
        {
          name: "Salvage",
          savedAt: 1,
          settings: { binding: "wormhole", pattern: null, punchHoleSets: [{ id: "", groups: [] }] },
        },
      ],
    }),
  )

  const loaded = loadProject("Salvage", storage)
  assert.equal(loaded.ok, true)
  if (!loaded.ok) return
  assert.equal(loaded.value.binding, initialSettings.binding)
  assert.equal(loaded.value.pattern, initialSettings.pattern)
  assert.deepEqual(loaded.value.punchHoleSets, initialSettings.punchHoleSets)
})

test("saveProject reports quota failures and keeps existing projects", () => {
  const storage = new FakeStorage()
  saveProject("First", initialSettings, storage)
  storage.quota = true

  const result = saveProject("Second", initialSettings, storage)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.match(result.error, /Local storage/)
  assertProjectNames(storage, ["First"])
})

test("storage operations degrade when storage is unavailable", () => {
  const storage = new BrokenStorage()

  assert.deepEqual(listProjects(storage), [])
  const saved = saveProject("Ghost", initialSettings, storage)
  assert.equal(saved.ok, false)
  assert.equal(loadProject("Ghost", storage).ok, false)
  assert.equal(deleteProject("Ghost", storage), false)
})
