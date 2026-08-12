export type PageNumberVisibility = "both" | "right" | "left" | "none"

export function showsPageNumber(visibility: PageNumberVisibility, logicalPage: number) {
  return visibility === "both" || visibility === (logicalPage % 2 === 1 ? "right" : "left")
}
