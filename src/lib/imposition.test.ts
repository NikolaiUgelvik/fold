import assert from "node:assert/strict"
import test from "node:test"
import { createImposition } from "./imposition.ts"

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

test("saddle stitch always uses one signature", () => {
  assert.equal(createImposition({ binding: "saddle", signatures: 9, sheetsPerSignature: 3 }).length, 6)
})
