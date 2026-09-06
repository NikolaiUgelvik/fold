import { createImposition, type ImpositionSide, isFoldedBinding } from "./imposition.ts"
import { getPageLayout } from "./page-layout.ts"
import { getPaperSize } from "./paper.ts"
import { getActivePunchHoleSets, showsPunchHoles, usesSeparatePunchGuide } from "./punch-holes.ts"
import type { Settings } from "./settings.ts"

function createPunchGuide(settings: Settings, sides: ImpositionSide[]) {
  const guideSettings: Settings = {
    ...settings,
    pattern: "blank",
    overlayPattern: "none",
    borderWidth: 0,
    numberVisibility: "none",
    customPages: {},
    pageAppearanceOverrides: {},
  }
  return { settings: guideSettings, pages: sides[0]?.pages ?? [] }
}

export type NotebookDocumentConstructionSettings = Pick<
  Settings,
  "binding" | "paper" | "yotsumeOrientation" | "yotsumeTwoUp" | "signatures" | "sheets"
>

export function createNotebookDocumentKernel(settings: NotebookDocumentConstructionSettings) {
  const pageLayout = getPageLayout(
    settings.paper,
    settings.binding,
    settings.yotsumeOrientation,
    settings.yotsumeTwoUp,
  )
  const sides = createImposition({
    binding: settings.binding,
    signatures: settings.signatures,
    sheetsPerSignature: settings.sheets,
    twoUp: settings.yotsumeTwoUp,
  })
  const paper = getPaperSize(settings.paper)
  const pages = new Set<number>()
  const signatures = new Set<number>()
  for (const side of sides) {
    signatures.add(side.signature)
    for (const page of side.pages) pages.add(page)
  }

  return {
    pageLayout,
    pageSize: pageLayout.page,
    sides,
    totalPages: pages.size,
    signatureCount: signatures.size,
    pageName:
      settings.binding === "yotsume" && !settings.yotsumeTwoUp ? paper.sheetName : paper.pageName,
  }
}

export function createNotebookDocument(
  settings: Settings,
  kernel = createNotebookDocumentKernel(settings),
) {
  const separateGuide = usesSeparatePunchGuide(settings.punchHolePlacement)
  const punchHolePages = new Set<number>()
  kernel.sides.forEach((side) => {
    if (!showsPunchHoles(settings.punchHolePlacement, side, settings.sheets)) return
    side.pages.forEach((page) => {
      punchHolePages.add(page)
    })
  })

  return {
    ...kernel,
    punchHoleSets: getActivePunchHoleSets(
      settings.punchHoleSets,
      isFoldedBinding(settings.binding),
    ),
    punchHolePages,
    guide: separateGuide ? createPunchGuide(settings, kernel.sides) : null,
    guideSides: separateGuide ? 1 : 0,
  }
}

export function createPunchGuideViewModel(
  document: ReturnType<typeof createNotebookDocument>,
  shown: boolean,
) {
  const showGuide = Boolean(document.guide && shown)
  return {
    guide: document.guide,
    sideCount: document.guideSides,
    shown: showGuide,
    toggleLabel: showGuide ? "View pages" : "View guide",
    ariaLabel: showGuide ? "Punch guide preview" : undefined,
  }
}

export function createPrintPageViewModel(logicalPage: number, showPunchHoles: boolean) {
  return { logicalPage, showPunchHoles, paperColor: "none" as const }
}
