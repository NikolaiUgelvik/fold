import assert from "node:assert/strict"
import test from "node:test"

import { type Binding, createImposition } from "./imposition.ts"
import {
  createPhysicalPreviewModel,
  getReaderPose,
  type MaterialPresetId,
  type PhysicalPreviewModel,
  resolveOpeningDegrees,
  stepReaderPose,
} from "./physical-preview.ts"

function assertPreview(
  preview: PhysicalPreviewModel,
  expected: Pick<
    PhysicalPreviewModel,
    "construction" | "selectedSurface" | "activeUnitIndex" | "restingCounts"
  > & { unitCount?: number; readerPose?: PhysicalPreviewModel["readerPose"] },
) {
  assert.equal(preview.construction, expected.construction)
  if (expected.unitCount !== undefined) assert.equal(preview.units.length, expected.unitCount)
  assert.deepEqual(preview.selectedSurface, expected.selectedSurface)
  assert.equal(preview.activeUnitIndex, expected.activeUnitIndex)
  assert.deepEqual(preview.restingCounts, expected.restingCounts)
  if (expected.readerPose !== undefined) assert.deepEqual(preview.readerPose, expected.readerPose)
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
    readerPose: { kind: "spread", anchor: 2, pages: [2, 3] },
  })
})

test("keeps page five's imposed source while presenting its reader spread", () => {
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
    readerPose: { kind: "spread", anchor: 4, pages: [4, 5] },
  })
})

test("steps reader poses by their anchors", () => {
  assert.deepEqual(getReaderPose(1, 16), { kind: "front", anchor: 1, pages: [1] })
  assert.deepEqual(getReaderPose(16, 16), { kind: "back", anchor: 16, pages: [16] })
  assert.equal(stepReaderPose(1, 16, 1), 2)
  assert.equal(stepReaderPose(3, 16, -1), 1)
  assert.equal(stepReaderPose(3, 16, 1), 4)
  assert.equal(stepReaderPose(15, 16, 1), 16)
  assert.equal(stepReaderPose(16, 16, -1), 14)
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
