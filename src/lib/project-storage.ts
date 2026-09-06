import type { CustomPage } from "./custom-pages.ts"
import type { Binding } from "./imposition.ts"
import { type Orientation, type PaperId, paperSizes } from "./paper.ts"
import type { BindingEdge, HoleGroup, PunchHolePlacement } from "./punch-holes.ts"
import {
  type IdentifiedHoleSet,
  initialSettings,
  isPageAppearanceKey,
  type PageAppearance,
  type PageAppearanceOverride,
  type Settings,
} from "./settings.ts"

export const PROJECT_STORAGE_KEY = "fold.projects.v1"
export const PROJECT_NAME_MAX = 60

export interface StoredProject {
  name: string
  savedAt: number
  settings: Settings
}

export type ProjectResult<T> = { ok: true; value: T } | { ok: false; error: string }

interface ProjectStore {
  version: 1
  projects: StoredProject[]
}

const bindingValues: readonly Binding[] = ["coptic", "saddle", "yotsume"]
const orientationValues: readonly string[] = ["portrait", "landscape"]
const punchHolePlacementValues: readonly PunchHolePlacement[] = [
  "none",
  "every",
  "signature-front",
  "signature-back",
  "separate",
]
const bindingEdgeValues: readonly BindingEdge[] = ["left", "right"]
const patternValues: readonly PageAppearance["pattern"][] = [
  "dots",
  "cross",
  "lines",
  "grid",
  "graph",
  "fourLine",
  "slant",
  "blank",
]
const numberVisibilityValues: readonly PageAppearance["numberVisibility"][] = [
  "both",
  "right",
  "left",
  "none",
]
const numberPositionValues: readonly PageAppearance["numberPosition"][] = ["outer", "center"]
const overlayPatternValues: readonly PageAppearance["overlayPattern"][] = ["none", "slant"]
const paperValues: readonly PaperId[] = paperSizes.map((size) => size.id)

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function strictNumber(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined
}

function strictBoolean(raw: unknown): boolean | undefined {
  return typeof raw === "boolean" ? raw : undefined
}

function strictHexColor(raw: unknown): string | undefined {
  return typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : undefined
}

function strictEnum<T extends string>(raw: unknown, allowed: readonly string[]): T | undefined {
  return typeof raw === "string" && allowed.includes(raw) ? (raw as T) : undefined
}

// One strict validator per PageAppearance key: base settings apply the
// initialSettings fallback, page overrides keep only valid keys.
const appearanceValueValidators: {
  [Key in keyof PageAppearance]: (raw: unknown) => PageAppearance[Key] | undefined
} = {
  pattern: (raw) => strictEnum(raw, patternValues),
  overlayPattern: (raw) => strictEnum(raw, overlayPatternValues),
  numberVisibility: (raw) => strictEnum(raw, numberVisibilityValues),
  numberPosition: (raw) => strictEnum(raw, numberPositionValues),
  dotColor: strictHexColor,
  crossColor: strictHexColor,
  lineColor: strictHexColor,
  graphMajorColor: strictHexColor,
  borderColor: strictHexColor,
  numberColor: strictHexColor,
  graphCompleteBlocks: strictBoolean,
  numberBold: strictBoolean,
  numberItalic: strictBoolean,
  numberFont: (raw) => (typeof raw === "string" && raw.trim() !== "" ? raw : undefined),
  dotSize: strictNumber,
  dotSpacing: strictNumber,
  dotMajorEvery: strictNumber,
  dotMajorSize: strictNumber,
  crossHorizontalLength: strictNumber,
  crossVerticalLength: strictNumber,
  crossSpacing: strictNumber,
  crossLineWidth: strictNumber,
  lineWidth: strictNumber,
  lineSpacing: strictNumber,
  fourLineGap: strictNumber,
  slantAngle: strictNumber,
  graphMajorEvery: strictNumber,
  graphMajorLineWidth: strictNumber,
  margin: strictNumber,
  gutterMargin: strictNumber,
  borderWidth: strictNumber,
  numberFontSize: strictNumber,
}

function normalizeAppearanceValue(
  key: keyof PageAppearance,
  raw: unknown,
): PageAppearance[keyof PageAppearance] | undefined {
  if (!(key in appearanceValueValidators)) throw new Error(`Unhandled page appearance key: ${key}`)
  return appearanceValueValidators[key](raw)
}

function normalizePageAppearance(raw: Record<string, unknown>): PageAppearance {
  const result: Partial<Record<keyof PageAppearance, unknown>> = {}
  for (const key of Object.keys(initialSettings) as Array<keyof Settings>) {
    if (!isPageAppearanceKey(key)) continue
    result[key] = normalizeAppearanceValue(key, raw[key]) ?? initialSettings[key]
  }
  return result as PageAppearance
}

function numericPageEntries(raw: unknown): Array<[number, unknown]> {
  if (!isPlainObject(raw)) return []
  const entries: Array<[number, unknown]> = []
  for (const [key, value] of Object.entries(raw)) {
    const page = Number(key)
    if (Number.isInteger(page) && page > 0) entries.push([page, value])
  }
  return entries
}

function normalizeCustomPages(raw: unknown): Record<number, CustomPage> {
  const result: Record<number, CustomPage> = {}
  for (const [page, value] of numericPageEntries(raw)) {
    if (!isPlainObject(value)) continue
    const { type, title, subtitle, entries } = value
    if (type === "title" && typeof title === "string" && typeof subtitle === "string") {
      result[page] = { type: "title", title, subtitle }
    } else if (type === "index" && typeof title === "string" && typeof entries === "string") {
      result[page] = { type: "index", title, entries }
    }
  }
  return result
}

const overrideExtraValidators = {
  numberVisible: (raw: unknown) => strictBoolean(raw),
  pageNumberText: (raw: unknown) => (typeof raw === "string" ? raw : undefined),
}

function normalizeAppearanceOverride(raw: unknown): PageAppearanceOverride {
  if (!isPlainObject(raw)) return {}
  const override: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    if (key === "numberVisible" || key === "pageNumberText") {
      const normalized = overrideExtraValidators[key](raw[key])
      if (normalized !== undefined) override[key] = normalized
      continue
    }
    const appearanceKey = key as keyof Settings
    if (!isPageAppearanceKey(appearanceKey)) continue
    const normalized = normalizeAppearanceValue(appearanceKey, raw[key])
    if (normalized !== undefined) override[key] = normalized
  }
  return override as PageAppearanceOverride
}

function normalizePageAppearanceOverrides(raw: unknown): Settings["pageAppearanceOverrides"] {
  const result: Record<number, PageAppearanceOverride> = {}
  for (const [page, value] of numericPageEntries(raw)) {
    const override = normalizeAppearanceOverride(value)
    if (Object.keys(override).length > 0) result[page] = override
  }
  return result
}

function normalizeHoleGroup(raw: unknown): (HoleGroup & { id: string }) | null {
  if (!isPlainObject(raw)) return null
  const { id, holes, weight } = raw
  if (typeof id !== "string" || id === "") return null
  if (typeof holes !== "number" || !Number.isFinite(holes)) return null
  if (typeof weight !== "number" || !Number.isFinite(weight)) return null
  return { id, holes, weight }
}

function normalizePunchHoleSets(raw: unknown): IdentifiedHoleSet[] {
  if (!Array.isArray(raw)) return initialSettings.punchHoleSets
  const sets: IdentifiedHoleSet[] = []
  raw.forEach((entry) => {
    if (!isPlainObject(entry)) return
    const { id, offset, groups } = entry
    if (typeof id !== "string" || id === "") return
    if (typeof offset !== "number" || !Number.isFinite(offset)) return
    if (!Array.isArray(groups)) return
    const normalizedGroups = groups
      .map((group) => normalizeHoleGroup(group))
      .filter((group): group is HoleGroup & { id: string } => group !== null)
    sets.push({ id, offset, groups: normalizedGroups })
  })
  if (sets.length === 0) return initialSettings.punchHoleSets

  const seenSetIds = new Set<string>()
  return sets.map((set, setIndex) => {
    const id = seenSetIds.has(set.id) ? `saved-set-${setIndex}` : set.id
    seenSetIds.add(id)
    const seenGroupIds = new Set<string>()
    const groups = set.groups.map((group, groupIndex) => {
      const groupId = seenGroupIds.has(group.id) ? `saved-group-${groupIndex}` : group.id
      seenGroupIds.add(groupId)
      return groupId === group.id ? group : { ...group, id: groupId }
    })
    return { ...set, id, groups }
  })
}

export function normalizeStoredSettings(raw: unknown): Settings | null {
  if (!isPlainObject(raw)) return null
  return {
    ...normalizePageAppearance(raw),
    binding: strictEnum<Binding>(raw.binding, bindingValues) ?? initialSettings.binding,
    yotsumeOrientation:
      strictEnum<Orientation>(raw.yotsumeOrientation, orientationValues) ??
      initialSettings.yotsumeOrientation,
    yotsumeTwoUp: strictBoolean(raw.yotsumeTwoUp) ?? initialSettings.yotsumeTwoUp,
    pageDivider: strictBoolean(raw.pageDivider) ?? initialSettings.pageDivider,
    punchHolePlacement:
      strictEnum<PunchHolePlacement>(raw.punchHolePlacement, punchHolePlacementValues) ??
      initialSettings.punchHolePlacement,
    bindingEdge:
      strictEnum<BindingEdge>(raw.bindingEdge, bindingEdgeValues) ?? initialSettings.bindingEdge,
    punchHoleEndInset: strictNumber(raw.punchHoleEndInset) ?? initialSettings.punchHoleEndInset,
    punchHoleDiameter: strictNumber(raw.punchHoleDiameter) ?? initialSettings.punchHoleDiameter,
    punchHoleSets: normalizePunchHoleSets(raw.punchHoleSets),
    paper: strictEnum<PaperId>(raw.paper, paperValues) ?? initialSettings.paper,
    previewPaperColor: strictHexColor(raw.previewPaperColor) ?? initialSettings.previewPaperColor,
    signatures: strictNumber(raw.signatures) ?? initialSettings.signatures,
    sheets: strictNumber(raw.sheets) ?? initialSettings.sheets,
    firstPage: strictNumber(raw.firstPage) ?? initialSettings.firstPage,
    customPages: normalizeCustomPages(raw.customPages),
    pageAppearanceOverrides: normalizePageAppearanceOverrides(raw.pageAppearanceOverrides),
  }
}

function isStoredProject(value: unknown): value is StoredProject {
  if (!isPlainObject(value)) return false
  return (
    typeof value.name === "string" &&
    typeof value.savedAt === "number" &&
    Number.isFinite(value.savedAt)
  )
}

function readStore(storage: Storage): ProjectStore {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PROJECT_STORAGE_KEY) ?? "")
    if (!isPlainObject(parsed) || parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      return { version: 1, projects: [] }
    }
    return { version: 1, projects: parsed.projects.filter(isStoredProject) }
  } catch {
    return { version: 1, projects: [] }
  }
}
function writeStore(storage: Storage, store: ProjectStore): boolean {
  try {
    storage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

export function listProjects(storage: Storage = globalThis.localStorage): StoredProject[] {
  const { projects } = readStore(storage)
  return [...projects].sort((a, b) => b.savedAt - a.savedAt)
}

export function saveProject(
  name: string,
  settings: Settings,
  storage: Storage = globalThis.localStorage,
): ProjectResult<StoredProject> {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > PROJECT_NAME_MAX) {
    return { ok: false, error: "Project names need 1–60 characters." }
  }

  const entry: StoredProject = {
    name: trimmed,
    savedAt: Date.now(),
    settings: structuredClone(settings),
  }
  const store = readStore(storage)
  const existingIndex = store.projects.findIndex(
    (project) => project.name.toLowerCase() === trimmed.toLowerCase(),
  )
  if (existingIndex >= 0) store.projects[existingIndex] = entry
  else store.projects.push(entry)

  if (!writeStore(storage, store)) {
    return {
      ok: false,
      error: "Local storage is full or unavailable. Delete old projects and try again.",
    }
  }
  return { ok: true, value: entry }
}

export function loadProject(
  name: string,
  storage: Storage = globalThis.localStorage,
): ProjectResult<Settings> {
  const project = readStore(storage).projects.find(
    (candidate) => candidate.name.toLowerCase() === name.trim().toLowerCase(),
  )
  if (!project) return { ok: false, error: "Project not found." }

  const settings = normalizeStoredSettings(project.settings)
  if (!settings) {
    return { ok: false, error: "Project data is invalid and could not be loaded." }
  }
  return { ok: true, value: settings }
}

export function deleteProject(name: string, storage: Storage = globalThis.localStorage): boolean {
  const store = readStore(storage)
  const index = store.projects.findIndex(
    (candidate) => candidate.name.toLowerCase() === name.trim().toLowerCase(),
  )
  if (index < 0) return false
  store.projects.splice(index, 1)
  return writeStore(storage, store)
}
