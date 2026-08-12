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
  const page = getFoldedPageSize(id)
  return orientation === "portrait"
    ? page
    : { width: page.height, height: page.width }
}

export function formatMillimeters(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

export function getCenteredPatternBounds(
  page: { width: number; height: number },
  margin: number | { top: number; right: number; bottom: number; left: number },
  spacing: number,
  radius: number,
) {
  const margins = typeof margin === "number"
    ? { top: margin, right: margin, bottom: margin, left: margin }
    : margin
  const availableWidth = Math.max(0, page.width - margins.left - margins.right)
  const availableHeight = Math.max(0, page.height - margins.top - margins.bottom)
  const width = Math.floor(availableWidth / spacing) * spacing
  const height = Math.floor(availableHeight / spacing) * spacing

  return {
    x: margins.left + (availableWidth - width) / 2 - radius,
    y: margins.top + (availableHeight - height) / 2 - radius,
    width: width + radius * 2,
    height: height + radius * 2,
  }
}
