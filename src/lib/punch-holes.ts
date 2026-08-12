export type BindingEdge = "left" | "right"
export interface HoleGroup { holes: number; weight: number }
export interface HoleSet { offset: number; groups: HoleGroup[] }

export function getActivePunchHoleSets(sets: HoleSet[], folded: boolean) {
  return folded ? sets.slice(0, 1) : sets
}

export function getPageBindingEdge(bindingEdge: BindingEdge, logicalPage: number, folded = false): BindingEdge {
  const edge = folded ? "left" : bindingEdge
  return logicalPage % 2 === 1 ? edge : edge === "left" ? "right" : "left"
}

export function getPunchHoles(
  page: { width: number; height: number },
  bindingEdge: BindingEdge,
  logicalPage: number,
  endInset: number,
  activeSets: HoleSet[],
  folded = false,
) {
  const pageEdge = getPageBindingEdge(bindingEdge, logicalPage, folded)
  const availableHeight = Math.max(0, page.height - endInset * 2)

  return activeSets.flatMap((set) => {
    const inset = folded ? 0 : set.offset
    const x = pageEdge === "left" ? inset : page.width - inset
    const totalWeight = set.groups.reduce((total, group) => total + Math.max(0, group.weight), 0)
    if (totalWeight === 0) return []

    let y = endInset
    return set.groups.flatMap((group) => {
      const height = availableHeight * Math.max(0, group.weight) / totalWeight
      const holes = Math.max(0, Math.round(group.holes))
      const points = Array.from({ length: holes }, (_, index) => ({
        x,
        y: holes === 1 ? y + height / 2 : y + height * index / (holes - 1),
      }))
      y += height
      return points
    })
  })
}
