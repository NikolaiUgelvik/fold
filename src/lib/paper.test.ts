import assert from "node:assert/strict"
import test from "node:test"
import { getCenteredPatternBounds, getFoldedPageSize, getPaperSize } from "./paper.ts"

test("folds sheet width in half while preserving height", () => {
  assert.deepEqual(getFoldedPageSize("a3"), { width: 210, height: 297 })
  assert.deepEqual(getFoldedPageSize("letter"), { width: 139.7, height: 215.9 })
})

test("provides US tabloid sheets for letter-size pages", () => {
  assert.deepEqual(getPaperSize("tabloid"), {
    id: "tabloid",
    label: "US Tabloid → Letter",
    width: 431.8,
    height: 279.4,
  })
})

test("centers complete pattern intervals", () => {
  const radius = 0.1
  const bounds = getCenteredPatternBounds({ width: 148.5, height: 210 }, 10, 6.5, radius)

  assert.ok(Math.abs(bounds.x - (148.5 - bounds.x - bounds.width)) < 1e-10)
  assert.ok(Math.abs(bounds.y - (210 - bounds.y - bounds.height)) < 1e-10)
  assert.equal((bounds.width - radius * 2) / 6.5, 19)
  assert.equal((bounds.height - radius * 2) / 6.5, 29)
})
