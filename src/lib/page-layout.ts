import type { Binding } from "./imposition.ts"
import {
  getFoldedPageSize,
  getHalfSheetPageSize,
  getOrientedPaperSize,
  type Orientation,
  type PaperId,
} from "./paper.ts"

export function getPageLayout(
  paperId: PaperId,
  binding: Binding,
  orientation: Orientation,
  twoUp: boolean,
) {
  if (binding !== "yotsume") {
    return {
      paper: getOrientedPaperSize(paperId, "landscape"),
      page: getFoldedPageSize(paperId),
      layout: "side-by-side" as const,
    }
  }

  const paperOrientation = twoUp
    ? orientation === "portrait"
      ? "landscape"
      : "portrait"
    : orientation

  return {
    paper: getOrientedPaperSize(paperId, paperOrientation),
    page: twoUp
      ? getHalfSheetPageSize(paperId, orientation)
      : getOrientedPaperSize(paperId, orientation),
    layout: twoUp
      ? orientation === "landscape"
        ? ("stacked" as const)
        : ("side-by-side" as const)
      : ("full" as const),
  }
}
