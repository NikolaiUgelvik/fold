import assert from "node:assert/strict"
import test from "node:test"
import { getCenteredPatternBounds, getFoldedPageSize, getHalfSheetPageSize, getOrientedPaperSize, getPaperSize } from "./paper.ts"

function assertCentered(bounds: { x: number; y: number; width: number; height: number }, radius: number, spacing: number, horizontalIntervals: number, verticalIntervals: number) {
  assert.ok(Math.abs(bounds.x - (148.5 - bounds.x - bounds.width)) < 1e-10)
  assert.ok(Math.abs(bounds.y - (210 - bounds.y - bounds.height)) < 1e-10)
  assert.equal((bounds.width - radius * 2) / spacing, horizontalIntervals)
  assert.equal((bounds.height - radius * 2) / spacing, verticalIntervals)
}

test("folds sheet width in half while preserving height", () => {
  assert.deepEqual(getFoldedPageSize("a3"), { width: 210, height: 297 })
  assert.deepEqual(getFoldedPageSize("letter"), { width: 139.7, height: 215.9 })
})

test("orients full and half sheets", () => {
  assert.deepEqual(getOrientedPaperSize("a4", "portrait"), { width: 210, height: 297 })
  assert.deepEqual(getOrientedPaperSize("a4", "landscape"), { width: 297, height: 210 })
  assert.deepEqual(getHalfSheetPageSize("a4", "portrait"), { width: 148.5, height: 210 })
  assert.deepEqual(getHalfSheetPageSize("a4", "landscape"), { width: 210, height: 148.5 })
})

test("provides US tabloid sheets for letter-size pages", () => {
  assert.deepEqual(getPaperSize("tabloid"), {
    id: "tabloid",
    label: "US Tabloid → Letter",
    width: 431.8,
    height: 279.4,
  })
})

test("centers complete pattern intervals within asymmetric margins", () => {
  const bounds = getCenteredPatternBounds(
    { width: 210, height: 297 },
    { top: 10, right: 10, bottom: 10, left: 30 },
    10,
    0,
  )

  assert.deepEqual(bounds, { x: 30, y: 13.5, width: 170, height: 270 })
})

test("centers complete pattern intervals", () => {
  const radius = 0.1
  const bounds = getCenteredPatternBounds({ width: 148.5, height: 210 }, 10, 6.5, radius)

  assertCentered(bounds, radius, 6.5, 19, 29)
})

test("centers graph paper with only complete major blocks", () => {
  const radius = 0.2
  const cellSize = 7
  const bounds = getCenteredPatternBounds({ width: 148.5, height: 210 }, 10, cellSize * 5, radius)

  assertCentered(bounds, radius, cellSize, 15, 25)
})
