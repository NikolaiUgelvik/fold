export type BindingEdge = "left" | "right"
export interface HoleGroup { holes: number; weight: number }

export function getPageBindingEdge(bindingEdge: BindingEdge, logicalPage: number, folded = false): BindingEdge {
  const edge = folded ? "left" : bindingEdge
  return logicalPage % 2 === 1 ? edge : edge === "left" ? "right" : "left"
}

export function getPunchHoles(
  page: { width: number; height: number },
  bindingEdge: BindingEdge,
  logicalPage: number,
  edgeInset: number,
  endInset: number,
  groups: HoleGroup[],
  folded = false,
) {
  const inset = folded ? 0 : edgeInset
  const x = getPageBindingEdge(bindingEdge, logicalPage, folded) === "left" ? inset : page.width - inset
  const availableHeight = Math.max(0, page.height - endInset * 2)
  const totalWeight = groups.reduce((total, group) => total + Math.max(0, group.weight), 0)
  if (totalWeight === 0) return []

  let y = endInset
  return groups.flatMap((group) => {
    const height = availableHeight * Math.max(0, group.weight) / totalWeight
    const holes = Math.max(0, Math.round(group.holes))
    const points = Array.from({ length: holes }, (_, index) => ({
      x,
      y: holes === 1 ? y + height / 2 : y + height * index / (holes - 1),
    }))
    y += height
    return points
  })
}
