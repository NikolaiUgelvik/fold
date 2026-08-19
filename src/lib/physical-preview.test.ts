import assert from "node:assert/strict"
import test from "node:test"

import { type Binding, createImposition } from "./imposition.ts"
import {
  createPhysicalPreviewModel,
  type MaterialPresetId,
  type PhysicalPreviewModel,
  resolveOpeningDegrees,
} from "./physical-preview.ts"

function assertPreview(
  preview: PhysicalPreviewModel,
  expected: Pick<
    PhysicalPreviewModel,
    "construction" | "selectedSurface" | "activeUnitIndex" | "restingCounts"
  > & { unitCount?: number },
) {
  assert.equal(preview.construction, expected.construction)
  if (expected.unitCount !== undefined) assert.equal(preview.units.length, expected.unitCount)
  assert.deepEqual(preview.selectedSurface, expected.selectedSurface)
  assert.equal(preview.activeUnitIndex, expected.activeUnitIndex)
  assert.deepEqual(preview.restingCounts, expected.restingCounts)
}

function createPreview({
  binding,
  bindingEdge,
  signatures,
  logicalPage,
  materialPreset,
  sheets = 2,
  twoUp = false,
}: {
  binding: Binding
  bindingEdge: "left" | "right"
  signatures: number
  logicalPage: number
  materialPreset: MaterialPresetId
  sheets?: number
  twoUp?: boolean
}) {
  return createPhysicalPreviewModel({
    binding,
    bindingEdge,
    sides: createImposition({ binding, signatures, sheetsPerSignature: sheets, twoUp }),
    pageSize: { width: 148.5, height: 210 },
    logicalPage,
    materialPreset,
    opening: 65,
  })
}

test("resolves a coptic logical page through its imposed Folded Sheet", () => {
  const preview = createPreview({
    binding: "coptic",
    bindingEdge: "left",
    signatures: 2,
    logicalPage: 3,
    materialPreset: "everyday",
  })

  assertPreview(preview, {
    construction: "page-block",
    selectedSurface: {
      logicalPage: 3,
      signature: 1,
      sheet: 2,
      side: "front",
      position: 1,
      facingLogicalPage: 6,
    },
    activeUnitIndex: 1,
    restingCounts: { left: 1, right: 2 },
  })
})

test("keeps page five beside its imposed facing page", () => {
  const preview = createPreview({
    binding: "coptic",
    bindingEdge: "left",
    signatures: 4,
    sheets: 4,
    logicalPage: 5,
    materialPreset: "everyday",
  })

  assertPreview(preview, {
    construction: "page-block",
    selectedSurface: {
      logicalPage: 5,
      signature: 1,
      sheet: 3,
      side: "front",
      position: 1,
      facingLogicalPage: 12,
    },
    activeUnitIndex: 2,
    restingCounts: { left: 2, right: 13 },
  })
})

test("derives yotsume cut leaves from the imposed sides", () => {
  const preview = createPreview({
    binding: "yotsume",
    bindingEdge: "right",
    signatures: 1,
    logicalPage: 2,
    materialPreset: "light-writing",
    twoUp: true,
  })

  assertPreview(preview, {
    construction: "leaf-stack",
    unitCount: 4,
    selectedSurface: {
      logicalPage: 2,
      signature: 1,
      sheet: 1,
      side: "back",
      position: 1,
      facingLogicalPage: 1,
    },
    activeUnitIndex: 0,
    restingCounts: { left: 0, right: 3 },
  })
})

test("maps the normalized opening into each Material Preset's valid range", () => {
  assert.equal(resolveOpeningDegrees("coptic", "everyday", 65), 111.25)
  assert.equal(resolveOpeningDegrees("yotsume", "everyday", 65), 12.75)
  assert.equal(resolveOpeningDegrees("coptic", "heavy-stock", 200), 145)
})
