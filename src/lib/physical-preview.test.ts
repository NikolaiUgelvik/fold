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
  const sides = createImposition({ binding, signatures, sheetsPerSignature: sheets, twoUp })
  return createPhysicalPreviewModel({
    binding,
    bindingEdge,
    sides,
    totalPages: new Set(sides.flatMap((side) => side.pages)).size,
    pageSize: { width: 148.5, height: 210 },
    logicalPage,
    materialPreset,
    opening: 65,
  })
}

function createFoldedPreview(logicalPage: number) {
  return createPreview({
    binding: "coptic",
    bindingEdge: "left",
    signatures: 4,
    sheets: 4,
    logicalPage,
    materialPreset: "everyday",
  })
}

function getFoldedStack(preview: PhysicalPreviewModel, side: "left" | "right") {
  return preview.foldedLeaves
    .filter((leaf) => leaf.stackSide === side)
    .sort((left, right) => left.stackIndex - right.stackIndex)
}

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
    restingCounts: { left: 1, right: 29 },
    readerPose: { kind: "spread", anchor: 4, pages: [4, 5] },
  })
})

test("opens the first spread by moving only the first physical leaf", () => {
  const preview = createFoldedPreview(2)
  const left = getFoldedStack(preview, "left")
  const right = getFoldedStack(preview, "right")

  assert.deepEqual(
    left.map((leaf) => leaf.pages),
    [[1, 2]],
  )
  assert.equal(right.length, 31)
  assert.deepEqual(right[0].pages, [3, 4])
  assert.deepEqual(right.at(-1)?.pages, [63, 64])
  assert.deepEqual(preview.restingCounts, { left: 0, right: 30 })
})

test("moves a leaf across a Signature boundary without moving either Signature as a unit", () => {
  for (const { logicalPage, faces, offsets } of [
    {
      logicalPage: 16,
      faces: [
        [15, 16],
        [17, 18],
      ],
      offsets: [Array(8).fill(0), [...Array(8).fill(0), ...Array(8).fill(1), ...Array(8).fill(2)]],
    },
    {
      logicalPage: 18,
      faces: [
        [17, 18],
        [19, 20],
      ],
      offsets: [
        [0, ...Array(8).fill(1)],
        [...Array(7).fill(0), ...Array(8).fill(1), ...Array(8).fill(2)],
      ],
    },
  ]) {
    const preview = createFoldedPreview(logicalPage)
    for (const [index, side] of (["left", "right"] as const).entries()) {
      const stack = getFoldedStack(preview, side)
      assert.deepEqual(
        { face: stack[0].pages, signatureOffsets: stack.map((leaf) => leaf.signatureOffset) },
        { face: faces[index], signatureOffsets: offsets[index] },
      )
    }
  }
})

test("closes both endpoints with every leaf behind the exposed face", () => {
  const signatureOffsets = Array.from({ length: 32 }, (_, index) => Math.floor(index / 8))
  const oddPages = Array.from({ length: 32 }, (_, index) => index * 2 + 1)
  for (const { logicalPage, occupiedSide, emptySide, expectedPages, restingCounts } of [
    {
      logicalPage: 1,
      occupiedSide: "right",
      emptySide: "left",
      expectedPages: oddPages,
      restingCounts: { left: 0, right: 31 },
    },
    {
      logicalPage: 64,
      occupiedSide: "left",
      emptySide: "right",
      expectedPages: oddPages.toReversed(),
      restingCounts: { left: 31, right: 0 },
    },
  ] as const) {
    const preview = createFoldedPreview(logicalPage)
    const stack = getFoldedStack(preview, occupiedSide)
    assert.deepEqual(getFoldedStack(preview, emptySide), [])
    assert.deepEqual(
      stack.map((leaf) => leaf.pages[0]),
      expectedPages,
    )
    assert.deepEqual(
      stack.map((leaf) => leaf.signatureOffset),
      signatureOffsets,
    )
    assert.deepEqual(preview.restingCounts, restingCounts)
  }
})

test("conserves the imposed leaves while turning through every Reader Pose", () => {
  const sides = createImposition({ binding: "coptic", signatures: 4, sheetsPerSignature: 4 })
  const front = createFoldedPreview(1)
  const ownership = front.foldedLeaves.map(({ signature, sheet, pages }) => ({
    signature,
    sheet,
    pages,
  }))
  assert.deepEqual(
    front.foldedLeaves.flatMap((leaf) => leaf.pages),
    Array.from({ length: 64 }, (_, index) => index + 1),
  )
  for (const leaf of front.foldedLeaves) {
    const sourceSides = sides.filter(
      (side) => side.signature === leaf.signature && side.sheet === leaf.sheet,
    )
    const oddSide = sourceSides.find((side) => side.pages.includes(leaf.pages[0]))
    const evenSide = sourceSides.find((side) => side.pages.includes(leaf.pages[1]))
    assert.ok(oddSide && evenSide)
    assert.notEqual(oddSide.side, evenSide.side)
    assert.equal(oddSide.pages.indexOf(leaf.pages[0]) + evenSide.pages.indexOf(leaf.pages[1]), 1)
  }

  let previous = front
  for (let logicalPage = 2; logicalPage <= 64; logicalPage += 2) {
    const preview = createFoldedPreview(logicalPage)
    assert.deepEqual(
      preview.foldedLeaves.map(({ signature, sheet, pages }) => ({ signature, sheet, pages })),
      ownership,
    )
    const moved = preview.foldedLeaves.filter(
      (leaf, index) => leaf.stackSide !== previous.foldedLeaves[index].stackSide,
    )
    assert.deepEqual(
      moved.map((leaf) => leaf.pages),
      [[logicalPage - 1, logicalPage]],
    )
    for (const side of ["left", "right"] as const) {
      const stack = getFoldedStack(preview, side)
      const expectedCount = side === "left" ? logicalPage / 2 : 32 - logicalPage / 2
      assert.equal(stack.length, expectedCount)
      assert.deepEqual(
        stack.map((leaf) => leaf.stackIndex),
        Array.from({ length: expectedCount }, (_, index) => index),
      )
      assert.equal(preview.restingCounts[side], Math.max(0, expectedCount - 1))
    }
    previous = preview
  }
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
  assert.deepEqual(preview.foldedLeaves, [])
})

test("maps the normalized opening into each Material Preset's valid range", () => {
  assert.equal(resolveOpeningDegrees("coptic", "everyday", 65), 111.25)
  assert.equal(resolveOpeningDegrees("yotsume", "everyday", 65), 12.75)
  assert.equal(resolveOpeningDegrees("coptic", "heavy-stock", 200), 145)
})
