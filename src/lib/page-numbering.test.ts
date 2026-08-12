import assert from "node:assert/strict"
import test from "node:test"
import { getOuterPageNumberEdge, showsPageNumber, type PageNumberVisibility } from "./page-numbering.ts"

test("places displayed even numbers at the left outer corner", () => {
  assert.equal(getOuterPageNumberEdge(2), "left")
  assert.equal(getOuterPageNumberEdge(3), "right")
})

test("shows numbers on the selected page sides", () => {
  const expected: Record<PageNumberVisibility, [boolean, boolean]> = {
    both: [true, true],
    right: [true, false],
    left: [false, true],
    none: [false, false],
  }

  for (const [visibility, pages] of Object.entries(expected)) {
    assert.deepEqual([showsPageNumber(visibility as PageNumberVisibility, 1), showsPageNumber(visibility as PageNumberVisibility, 2)], pages)
  }
})
