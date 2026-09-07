import { getPrintSides, type PrintPass } from "./imposition.ts"
import type { NotebookDocument } from "./notebook-document.ts"
import type { Settings } from "./settings.ts"

export interface PrintSheet {
  signature?: number
  sheet?: number
  side: "front" | "back" | "punch-guide"
  pages: number[]
  settings: Settings
  punchHolePages: Set<number>
}

export function createPrintPlan(
  document: NotebookDocument,
  settings: Settings,
  pass: PrintPass,
  includeGuide: boolean,
): PrintSheet[] {
  const sheets: PrintSheet[] = getPrintSides(document.sides, pass).map((side) => ({
    ...side,
    settings,
    punchHolePages: document.punchHolePages,
  }))
  if (document.guide && (pass === "guide" || includeGuide)) {
    sheets.push({
      side: "punch-guide",
      pages: document.guide.pages,
      settings: document.guide.settings,
      punchHolePages: new Set(document.guide.pages),
    })
  }
  return sheets
}
