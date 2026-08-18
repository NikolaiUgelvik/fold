import assert from "node:assert/strict"
import test from "node:test"

import { createImposition } from "./imposition.ts"
import { createPhysicalPreviewModel, resolveOpeningDegrees } from "./physical-preview.ts"

test("resolves a coptic logical page through its imposed Folded Sheet", () => {
  const preview = createPhysicalPreviewModel({
    binding: "coptic",
    bindingEdge: "left",
    sides: createImposition({ binding: "coptic", signatures: 2, sheetsPerSignature: 2 }),
    pageSize: { width: 148.5, height: 210 },
    logicalPage: 3,
    materialPreset: "everyday",
    opening: 65,
  })

  assert.equal(preview.construction, "page-block")
  assert.deepEqual(preview.selectedSurface, {
    logicalPage: 3,
    signature: 1,
    sheet: 2,
    side: "front",
    position: 1,
    facingLogicalPage: 6,
  })
  assert.equal(preview.activeUnitIndex, 1)
  assert.deepEqual(preview.restingCounts, { left: 1, right: 2 })
})

test("derives yotsume cut leaves from the imposed sides", () => {
  const preview = createPhysicalPreviewModel({
    binding: "yotsume",
    bindingEdge: "right",
    sides: createImposition({
      binding: "yotsume",
      signatures: 1,
      sheetsPerSignature: 2,
      twoUp: true,
    }),
    pageSize: { width: 148.5, height: 210 },
    logicalPage: 2,
    materialPreset: "light-writing",
    opening: 65,
  })

  assert.equal(preview.construction, "leaf-stack")
  assert.equal(preview.units.length, 4)
  assert.deepEqual(preview.selectedSurface, {
    logicalPage: 2,
    signature: 1,
    sheet: 1,
    side: "back",
    position: 1,
    facingLogicalPage: 1,
  })
  assert.equal(preview.activeUnitIndex, 0)
  assert.deepEqual(preview.restingCounts, { left: 0, right: 3 })
})

test("maps the normalized opening into each Material Preset's valid range", () => {
  assert.equal(resolveOpeningDegrees("coptic", "everyday", 65), 111.25)
  assert.equal(resolveOpeningDegrees("yotsume", "everyday", 65), 12.75)
  assert.equal(resolveOpeningDegrees("coptic", "heavy-stock", 200), 145)
})
