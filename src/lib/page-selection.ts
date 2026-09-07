export type PageSelectionResult = { pages: number[]; error: null } | { pages: null; error: string }

export function pageRange(first: number, last: number) {
  const start = Math.min(first, last)
  return Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => start + index)
}

function parsePageRange(part: string, totalPages: number): [number, number] | string {
  const value = part.trim()
  const match = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(value)
  if (!match) {
    return `“${value || "empty item"}” is not a page or range. Use 3–16,21–24.`
  }
  const first = Number(match[1])
  const last = Number(match[2] ?? match[1])
  if (
    first < 1 ||
    last < 1 ||
    Math.max(first, last) > Math.min(totalPages, Number.MAX_SAFE_INTEGER)
  ) {
    return `Pages must be between 1 and ${totalPages}; check “${value}”.`
  }
  if (last < first) {
    return `“${value}” runs backwards. Put the smaller page first.`
  }
  return [first, last]
}

export function parsePageSelection(input: string, totalPages: number): PageSelectionResult {
  const value = input.trim().toLowerCase()
  if (value === "all" || value === "odd" || value === "even") {
    const pages = pageRange(1, totalPages).filter(
      (page) => value === "all" || page % 2 === (value === "odd" ? 1 : 0),
    )
    return pages.length > 0
      ? { pages, error: null }
      : { pages: null, error: "This notebook has no even pages." }
  }
  if (!value) {
    return { pages: null, error: "Enter page numbers, ranges, all, odd, or even." }
  }
  const pages = new Set<number>()
  for (const part of value.split(",")) {
    const range = parsePageRange(part, totalPages)
    if (typeof range === "string") return { pages: null, error: range }
    const [first, last] = range
    for (let page = first; page <= last; page += 1) pages.add(page)
  }
  return { pages: [...pages].sort((left, right) => left - right), error: null }
}
