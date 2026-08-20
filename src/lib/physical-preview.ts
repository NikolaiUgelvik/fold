import { type Binding, type ImpositionSide, isFoldedBinding } from "./imposition.ts"
import type { BindingEdge } from "./punch-holes.ts"

export const materialPresets = {
  "light-writing": {
    label: "Light writing",
    thickness: 0.08,
    stiffness: 0.3,
    creaseSet: 0.3,
    translucency: 0.55,
    signatureGap: 0.25,
    profile: 0.2,
    pageBlockOpening: [25, 165],
    leafStackOpening: [4, 24],
  },
  everyday: {
    label: "Everyday",
    thickness: 0.12,
    stiffness: 0.5,
    creaseSet: 0.5,
    translucency: 0.25,
    signatureGap: 0.5,
    profile: 0.4,
    pageBlockOpening: [30, 155],
    leafStackOpening: [3, 18],
  },
  "heavy-stock": {
    label: "Heavy stock",
    thickness: 0.2,
    stiffness: 0.75,
    creaseSet: 0.75,
    translucency: 0.08,
    signatureGap: 0.75,
    profile: 0.65,
    pageBlockOpening: [40, 145],
    leafStackOpening: [2, 12],
  },
} as const

export type MaterialPresetId = keyof typeof materialPresets

export type PhysicalPageSurface = {
  logicalPage: number
  signature: number
  sheet: number
  side: ImpositionSide["side"]
  position: number
}

export type PhysicalPreviewUnit = {
  signature: number
  sheet: number
  surfaces: PhysicalPageSurface[]
}

export type ReaderPose =
  | { kind: "front" | "back"; anchor: number; pages: [number] }
  | { kind: "spread"; anchor: number; pages: [number, number] }

export type PhysicalPreviewModel = {
  construction: "page-block" | "leaf-stack"
  bindingEdge: BindingEdge
  pageSize: { width: number; height: number }
  materialPreset: (typeof materialPresets)[MaterialPresetId]
  openingDegrees: number
  units: PhysicalPreviewUnit[]
  activeUnitIndex: number
  selectedSurface: PhysicalPageSurface & { facingLogicalPage: number }
  readerPose?: ReaderPose
  restingCounts: { left: number; right: number }
}

function groupSidesBySheet(sides: ImpositionSide[]) {
  const sheets = new Map<
    number,
    Map<number, Partial<Record<ImpositionSide["side"], ImpositionSide>>>
  >()
  for (const side of sides) {
    const signature = sheets.get(side.signature) ?? new Map()
    sheets.set(side.signature, signature)
    const sheet = signature.get(side.sheet) ?? {}
    signature.set(side.sheet, { ...sheet, [side.side]: side })
  }
  return sheets
}

function createFoldedUnits(sides: ImpositionSide[]) {
  const units: PhysicalPreviewUnit[] = []
  for (const [signature, sheets] of groupSidesBySheet(sides)) {
    for (const [sheet, sidesBySheet] of sheets) {
      const surfaces = Object.values(sidesBySheet).flatMap((side) =>
        (side?.pages ?? []).map((logicalPage, position) => ({
          logicalPage,
          signature,
          sheet,
          side: side.side,
          position,
        })),
      )
      units.push({ signature, sheet, surfaces })
    }
  }
  return units
}

function createLeafUnits(sides: ImpositionSide[]) {
  const units: PhysicalPreviewUnit[] = []
  for (const [signature, sheets] of groupSidesBySheet(sides)) {
    for (const [sheet, sidesBySheet] of sheets) {
      const front = sidesBySheet.front
      const back = sidesBySheet.back
      if (!front || !back) throw new RangeError(`Sheet ${sheet} is missing a printed side`)

      for (const [position, logicalPage] of front.pages.entries()) {
        const backPosition = back.pages.length - position - 1
        const backPage = back.pages[backPosition]
        if (backPage === undefined) throw new RangeError(`Sheet ${sheet} has mismatched sides`)
        units.push({
          signature,
          sheet,
          surfaces: [
            { logicalPage, signature, sheet, side: "front", position },
            { logicalPage: backPage, signature, sheet, side: "back", position: backPosition },
          ],
        })
      }
    }
  }
  return units
}

export function getReaderPose(logicalPage: number, totalPages: number): ReaderPose {
  if (logicalPage === 1) return { kind: "front", anchor: 1, pages: [1] }
  if (logicalPage === totalPages) return { kind: "back", anchor: totalPages, pages: [totalPages] }
  const anchor = logicalPage % 2 === 0 ? logicalPage : logicalPage - 1
  return { kind: "spread", anchor, pages: [anchor, anchor + 1] }
}

export function stepReaderPose(logicalPage: number, totalPages: number, direction: -1 | 1) {
  const { anchor } = getReaderPose(logicalPage, totalPages)
  if (direction === -1) return anchor === 1 ? 1 : Math.max(1, anchor - 2)
  return anchor === 1 ? Math.min(2, totalPages) : Math.min(totalPages, anchor + 2)
}

export function resolveOpeningDegrees(
  binding: Binding,
  materialPreset: MaterialPresetId,
  opening: number,
) {
  const preset = materialPresets[materialPreset]
  const [minimum, maximum] = isFoldedBinding(binding)
    ? preset.pageBlockOpening
    : preset.leafStackOpening
  const normalized = Number.isFinite(opening) ? Math.min(100, Math.max(0, opening)) / 100 : 0.65
  return minimum + (maximum - minimum) * normalized
}

export function createPhysicalPreviewModel({
  binding,
  bindingEdge,
  sides,
  pageSize,
  logicalPage,
  materialPreset,
  opening,
}: {
  binding: Binding
  bindingEdge: BindingEdge
  sides: ImpositionSide[]
  pageSize: { width: number; height: number }
  logicalPage: number
  materialPreset: MaterialPresetId
  opening: number
}): PhysicalPreviewModel {
  const folded = isFoldedBinding(binding)
  const units = folded ? createFoldedUnits(sides) : createLeafUnits(sides)
  const activeUnitIndex = units.findIndex((unit) =>
    unit.surfaces.some((surface) => surface.logicalPage === logicalPage),
  )
  if (activeUnitIndex < 0) throw new RangeError(`Logical page ${logicalPage} is not imposed`)

  const activeUnit = units[activeUnitIndex]
  const selected = activeUnit.surfaces.find((surface) => surface.logicalPage === logicalPage)
  if (!selected) throw new RangeError(`Logical page ${logicalPage} is not on its active sheet`)
  const facing =
    activeUnit.surfaces.find(
      (surface) => surface.side === selected.side && surface.position !== selected.position,
    ) ?? activeUnit.surfaces.find((surface) => surface.side !== selected.side)
  if (!facing) throw new RangeError(`Logical page ${logicalPage} has no facing surface`)

  return {
    construction: folded ? "page-block" : "leaf-stack",
    bindingEdge,
    pageSize,
    materialPreset: materialPresets[materialPreset],
    openingDegrees: resolveOpeningDegrees(binding, materialPreset, opening),
    units,
    activeUnitIndex,
    selectedSurface: { ...selected, facingLogicalPage: facing.logicalPage },
    readerPose: folded
      ? getReaderPose(logicalPage, new Set(sides.flatMap((side) => side.pages)).size)
      : undefined,
    restingCounts: { left: activeUnitIndex, right: units.length - activeUnitIndex - 1 },
  }
}
