import { getPageBindingEdge } from "./punch-holes.ts"

export type PageNumberVisibility = "both" | "right" | "left" | "none"

export function displayedPage(settings: { firstPage: number }, logicalPage: number) {
  return settings.firstPage + logicalPage - 1
}

export function showsPageNumber(visibility: PageNumberVisibility, logicalPage: number) {
  return visibility === "both" || visibility === (logicalPage % 2 === 1 ? "right" : "left")
}

export function getOuterPageNumberEdge(displayedPage: number) {
  return getPageBindingEdge("right", displayedPage)
}
