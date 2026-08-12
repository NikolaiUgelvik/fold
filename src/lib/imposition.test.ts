import assert from "node:assert/strict"
import test from "node:test"
import { createImposition, getPrintSides } from "./imposition.ts"

test("imposes folded sheets in signature order", () => {
  assert.deepEqual(
    createImposition({ binding: "coptic", signatures: 2, sheetsPerSignature: 2 }),
    [
      { signature: 1, sheet: 1, side: "front", pages: [8, 1] },
      { signature: 1, sheet: 1, side: "back", pages: [2, 7] },
      { signature: 1, sheet: 2, side: "front", pages: [6, 3] },
      { signature: 1, sheet: 2, side: "back", pages: [4, 5] },
      { signature: 2, sheet: 1, side: "front", pages: [16, 9] },
      { signature: 2, sheet: 1, side: "back", pages: [10, 15] },
      { signature: 2, sheet: 2, side: "front", pages: [14, 11] },
      { signature: 2, sheet: 2, side: "back", pages: [12, 13] },
    ],
  )
})

test("selects manual duplex passes", () => {
  const sides = createImposition({ binding: "coptic", signatures: 1, sheetsPerSignature: 2 })

  assert.deepEqual(getPrintSides(sides, "fronts").map((side) => side.pages), [[8, 1], [6, 3]])
  assert.deepEqual(getPrintSides(sides, "backs").map((side) => side.pages), [[2, 7], [4, 5]])
  assert.deepEqual(getPrintSides(sides, "backs-reversed").map((side) => side.pages), [[4, 5], [2, 7]])
  assert.deepEqual(getPrintSides(sides, "guide"), [])
})

test("saddle stitch always uses one signature", () => {
  assert.equal(createImposition({ binding: "saddle", signatures: 9, sheetsPerSignature: 3 }).length, 6)
})

test("imposes Japanese stab binding as full-sheet leaves", () => {
  assert.deepEqual(
    createImposition({ binding: "yotsume", signatures: 9, sheetsPerSignature: 2 }),
    [
      { signature: 1, sheet: 1, side: "front", pages: [1] },
      { signature: 1, sheet: 1, side: "back", pages: [2] },
      { signature: 1, sheet: 2, side: "front", pages: [3] },
      { signature: 1, sheet: 2, side: "back", pages: [4] },
    ],
  )
})

test("optionally imposes Japanese stab binding as two-up cut leaves", () => {
  assert.deepEqual(
    createImposition({ binding: "yotsume", signatures: 9, sheetsPerSignature: 2, twoUp: true }),
    JSON.parse('[{"signature":1,"sheet":1,"side":"front","pages":[1,3]},{"signature":1,"sheet":1,"side":"back","pages":[4,2]},{"signature":1,"sheet":2,"side":"front","pages":[5,7]},{"signature":1,"sheet":2,"side":"back","pages":[8,6]}]'),
  )
})
