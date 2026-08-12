import type { ImpositionSide } from "./imposition.ts"

export type BindingEdge = "left" | "right"
export type PunchHolePlacement =
  | "none"
  | "every"
  | "signature-front"
  | "signature-back"
  | "separate"
export interface HoleGroup {
  holes: number
  weight: number
}
export interface HoleSet {
  offset: number
  groups: HoleGroup[]
}

export function showsPunchHoles(
  placement: PunchHolePlacement,
  side: ImpositionSide,
  lastSheet: number,
) {
  return (
    placement === "every" ||
    (placement === "signature-front" && side.sheet === 1 && side.side === "front") ||
    (placement === "signature-back" && side.sheet === lastSheet && side.side === "back")
  )
}

export function getActivePunchHoleSets<T extends HoleSet>(sets: T[], folded: boolean) {
  return folded ? sets.slice(0, 1) : sets
}

export function getPageBindingEdge(
  bindingEdge: BindingEdge,
  logicalPage: number,
  folded = false,
): BindingEdge {
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
    return set.groups.flatMap((group, groupIndex) => {
      const height = (availableHeight * Math.max(0, group.weight)) / totalWeight
      const holes = Math.max(0, Math.round(group.holes))
      const previousHoles =
        groupIndex === 0 ? 0 : Math.max(0, Math.round(set.groups[groupIndex - 1].holes))
      const points = Array.from({ length: holes }, (_, index) => ({
        x,
        y:
          holes === 1
            ? y + height / 2
            : y +
              (height * (previousHoles > 1 ? index + 1 : index)) /
                (previousHoles > 1 ? holes : holes - 1),
      }))
      y += height
      return points
    })
  })
}
