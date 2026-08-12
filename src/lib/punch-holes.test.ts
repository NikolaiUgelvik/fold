import assert from "node:assert/strict"
import test from "node:test"
import { getPageBindingEdge, getPunchHoles, type HoleGroup } from "./punch-holes.ts"

const fourHoles: HoleGroup[] = [{ holes: 4, weight: 1 }]

test("places four evenly spaced punch holes along the binding edge", () => {
  assert.deepEqual(getPunchHoles({ width: 210, height: 297 }, "left", 1, 12, 15, fourHoles), [
    { x: 12, y: 15 },
    { x: 12, y: 104 },
    { x: 12, y: 193 },
    { x: 12, y: 282 },
  ])
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "left", 2, 12, 15, fourHoles)[0].x, 198)
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "right", 1, 12, 15, fourHoles)[0].x, 198)
})

test("supports weighted hole groups and empty spacer groups", () => {
  assert.deepEqual(
    getPunchHoles(
      { width: 100, height: 130 },
      "left",
      1,
      10,
      15,
      [
        { holes: 3, weight: 20 },
        { holes: 0, weight: 60 },
        { holes: 3, weight: 20 },
      ],
    ).map(({ y }) => y),
    [15, 25, 35, 95, 105, 115],
  )
})

test("keeps folded bindings on the center fold", () => {
  assert.equal(getPageBindingEdge("right", 1, true), "left")
  assert.equal(getPageBindingEdge("right", 2, true), "right")
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "right", 1, 12, 15, fourHoles, true)[0].x, 0)
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "right", 2, 12, 15, fourHoles, true)[0].x, 210)
})
