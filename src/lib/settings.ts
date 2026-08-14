import type { CustomPage } from "./custom-pages.ts"
import type { Binding } from "./imposition.ts"
import { displayedPage, type PageNumberVisibility, showsPageNumber } from "./page-numbering.ts"
import type { Orientation, PaperId } from "./paper.ts"
import type { BindingEdge, HoleGroup, HoleSet, PunchHolePlacement } from "./punch-holes.ts"

type IdentifiedHoleGroup = HoleGroup & { id: string }
type IdentifiedHoleSet = Omit<HoleSet, "groups"> & {
  id: string
  groups: IdentifiedHoleGroup[]
}

export interface PageAppearance {
  pattern: "dots" | "lines" | "grid" | "graph" | "blank"
  dotSize: number
  dotSpacing: number
  dotMajorEvery: number
  dotMajorSize: number
  dotColor: string
  lineWidth: number
  lineSpacing: number
  lineColor: string
  graphMajorEvery: number
  graphMajorLineWidth: number
  graphMajorColor: string
  graphCompleteBlocks: boolean
  margin: number
  gutterMargin: number
  borderWidth: number
  borderColor: string
  numberVisibility: PageNumberVisibility
  numberPosition: "outer" | "center"
  numberFont: string
  numberFontSize: number
  numberColor: string
  numberBold: boolean
  numberItalic: boolean
}

export type PageAppearanceOverride = Partial<Omit<PageAppearance, "numberVisibility">> & {
  numberVisible?: boolean
  pageNumberText?: string
}

export type PageAppearanceOverrideKey = keyof PageAppearanceOverride

export type ResolvedPageAppearance = PageAppearance & {
  numberVisible: boolean
  pageNumberText: string
}

const pageAppearanceKeyMap = {
  pattern: true,
  dotSize: true,
  dotSpacing: true,
  dotMajorEvery: true,
  dotMajorSize: true,
  dotColor: true,
  lineWidth: true,
  lineSpacing: true,
  lineColor: true,
  graphMajorEvery: true,
  graphMajorLineWidth: true,
  graphMajorColor: true,
  graphCompleteBlocks: true,
  margin: true,
  gutterMargin: true,
  borderWidth: true,
  borderColor: true,
  numberVisibility: true,
  numberPosition: true,
  numberFont: true,
  numberFontSize: true,
  numberColor: true,
  numberBold: true,
  numberItalic: true,
} satisfies Record<keyof PageAppearance, true>

export interface Settings extends PageAppearance {
  binding: Binding
  yotsumeOrientation: Orientation
  yotsumeTwoUp: boolean
  punchHolePlacement: PunchHolePlacement
  bindingEdge: BindingEdge
  punchHoleEndInset: number
  punchHoleDiameter: number
  // fallow-ignore-next-line private-type-leak -- Identified hole types are implementation details.
  punchHoleSets: IdentifiedHoleSet[]
  paper: PaperId
  previewPaperColor: string
  signatures: number
  sheets: number
  firstPage: number
  customPages: Record<number, CustomPage>
  pageAppearanceOverrides: Record<number, PageAppearanceOverride>
}

export type SettingsUpdate = <Key extends keyof Settings>(key: Key, value: Settings[Key]) => void

export function isPageAppearanceKey(key: keyof Settings): key is keyof PageAppearance {
  return Object.hasOwn(pageAppearanceKeyMap, key)
}

function inheritedPageNumberVisible(settings: Settings, logicalPage: number) {
  return (
    settings.customPages[logicalPage]?.type !== "title" &&
    showsPageNumber(settings.numberVisibility, logicalPage)
  )
}

export function resolvePageAppearance(
  settings: Settings,
  logicalPage: number,
): Settings & ResolvedPageAppearance {
  const override = settings.pageAppearanceOverrides[logicalPage]
  return {
    ...settings,
    ...override,
    numberVisible: override?.numberVisible ?? inheritedPageNumberVisible(settings, logicalPage),
    pageNumberText: override?.pageNumberText ?? String(displayedPage(settings, logicalPage)),
  }
}

export function countPageAppearanceOverrides(
  overrides: Settings["pageAppearanceOverrides"],
  logicalPage: number,
) {
  return Object.keys(overrides[logicalPage] ?? {}).length
}

export function setPageAppearanceOverride<Key extends PageAppearanceOverrideKey>(
  overrides: Settings["pageAppearanceOverrides"],
  logicalPage: number,
  key: Key,
  value: PageAppearanceOverride[Key] | undefined,
) {
  const pageOverride = { ...overrides[logicalPage] }
  if (value === undefined) delete pageOverride[key]
  else Object.assign(pageOverride, { [key]: value })

  const next = { ...overrides }
  if (Object.keys(pageOverride).length > 0) next[logicalPage] = pageOverride
  else delete next[logicalPage]
  return next
}

export function setPageAppearanceSettingOverride<Key extends keyof PageAppearance>(
  settings: Settings,
  logicalPage: number,
  key: Key,
  value: PageAppearance[Key],
) {
  if (key === "numberVisibility") {
    const visible = showsPageNumber(value as PageNumberVisibility, logicalPage)
    return setPageAppearanceOverride(
      settings.pageAppearanceOverrides,
      logicalPage,
      "numberVisible",
      visible === inheritedPageNumberVisible(settings, logicalPage) ? undefined : visible,
    )
  }

  type DirectKey = Exclude<keyof PageAppearance, "numberVisibility">
  const directKey = key as DirectKey
  const directValue = value as PageAppearanceOverride[DirectKey]
  return setPageAppearanceOverride(
    settings.pageAppearanceOverrides,
    logicalPage,
    directKey,
    Object.is(value, settings[key]) ? undefined : directValue,
  )
}

export function resetPageAppearanceOverride(
  overrides: Settings["pageAppearanceOverrides"],
  logicalPage: number,
) {
  if (!overrides[logicalPage]) return overrides
  const next = { ...overrides }
  delete next[logicalPage]
  return next
}

export const initialSettings: Settings = {
  binding: "coptic",
  yotsumeOrientation: "portrait",
  yotsumeTwoUp: false,
  punchHolePlacement: "none",
  bindingEdge: "left",
  punchHoleEndInset: 15,
  punchHoleDiameter: 2,
  punchHoleSets: [
    {
      id: "initial-set",
      offset: 12,
      groups: [{ id: "initial-group", holes: 4, weight: 1 }],
    },
  ],
  paper: "a4",
  previewPaperColor: "#fffef9",
  signatures: 4,
  sheets: 4,
  pattern: "dots",
  dotSize: 0.35,
  dotSpacing: 5,
  dotMajorEvery: 0,
  dotMajorSize: 0.7,
  dotColor: "#aeb4b6",
  lineWidth: 0.2,
  lineSpacing: 7,
  lineColor: "#aeb9c4",
  graphMajorEvery: 5,
  graphMajorLineWidth: 0.4,
  graphMajorColor: "#8295a8",
  graphCompleteBlocks: false,
  margin: 10,
  gutterMargin: 10,
  borderWidth: 0,
  borderColor: "#c8c3b8",
  numberVisibility: "both",
  numberPosition: "outer",
  numberFont: "Georgia, serif",
  numberFontSize: 9,
  numberColor: "#30302c",
  numberBold: false,
  numberItalic: false,
  firstPage: 1,
  customPages: {},
  pageAppearanceOverrides: {},
}
