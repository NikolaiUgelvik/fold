export const paperSizes = [
  { id: "a2", label: "A2 → A3", width: 594, height: 420 },
  { id: "a3", label: "A3 → A4", width: 420, height: 297 },
  { id: "a4", label: "A4 → A5", width: 297, height: 210 },
  { id: "a5", label: "A5 → A6", width: 210, height: 148 },
  { id: "tabloid", label: "US Tabloid → Letter", width: 431.8, height: 279.4 },
  { id: "legal", label: "US Legal → Half Legal", width: 355.6, height: 215.9 },
  { id: "letter", label: "US Letter → Half Letter", width: 279.4, height: 215.9 },
] as const

export type PaperId = (typeof paperSizes)[number]["id"]
export type Orientation = "portrait" | "landscape"

export function getPaperSize(id: PaperId) {
  return paperSizes.find((paper) => paper.id === id) ?? paperSizes[2]
}

export function getFoldedPageSize(id: PaperId) {
  const paper = getPaperSize(id)
  return { width: paper.width / 2, height: paper.height }
}

export function getOrientedPaperSize(id: PaperId, orientation: Orientation) {
  const paper = getPaperSize(id)
  return orientation === "portrait"
    ? { width: paper.height, height: paper.width }
    : { width: paper.width, height: paper.height }
}

export function getHalfSheetPageSize(id: PaperId, orientation: Orientation) {
  const paper = getPaperSize(id)
  return orientation === "portrait"
    ? { width: paper.width / 2, height: paper.height }
    : { width: paper.height, height: paper.width / 2 }
}

export function formatMillimeters(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

export function getCenteredPatternBounds(page: { width: number; height: number }, margin: number, spacing: number, radius: number) {
  const width = Math.floor((page.width - margin * 2) / spacing) * spacing
  const height = Math.floor((page.height - margin * 2) / spacing) * spacing

  return {
    x: (page.width - width) / 2 - radius,
    y: (page.height - height) / 2 - radius,
    width: width + radius * 2,
    height: height + radius * 2,
  }
}
