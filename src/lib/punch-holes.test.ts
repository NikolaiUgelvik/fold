import assert from "node:assert/strict"
import test from "node:test"
import { getActivePunchHoleSets, getPageBindingEdge, getPunchHoles, type HoleSet } from "./punch-holes.ts"

const fourHoles: HoleSet[] = [{ offset: 12, groups: [{ holes: 4, weight: 1 }] }]

test("folded bindings activate only the center-fold set", () => {
  const sets = [...fourHoles, { offset: 20, groups: [{ holes: 2, weight: 1 }] }]

  assert.equal(getActivePunchHoleSets(sets, false), sets)
  assert.deepEqual(getActivePunchHoleSets(sets, true), fourHoles)
})

test("places four evenly spaced punch holes along the binding edge", () => {
  assert.deepEqual(getPunchHoles({ width: 210, height: 297 }, "left", 1, 15, fourHoles), [
    { x: 12, y: 15 },
    { x: 12, y: 104 },
    { x: 12, y: 193 },
    { x: 12, y: 282 },
  ])
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "left", 2, 15, fourHoles)[0].x, 198)
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "right", 1, 15, fourHoles)[0].x, 198)
})

test("supports weighted hole groups and empty spacer groups", () => {
  assert.deepEqual(
    getPunchHoles(
      { width: 100, height: 130 },
      "left",
      1,
      15,
      [{
        offset: 10,
        groups: [
          { holes: 3, weight: 20 },
          { holes: 0, weight: 60 },
          { holes: 3, weight: 20 },
        ],
      }],
    ).map(({ y }) => y),
    [15, 25, 35, 95, 105, 115],
  )
})

test("supports independent horizontal sets", () => {
  assert.deepEqual(
    getPunchHoles(
      { width: 100, height: 100 },
      "left",
      1,
      10,
      [
        { offset: 5, groups: [{ holes: 1, weight: 1 }] },
        { offset: 10, groups: [{ holes: 2, weight: 1 }] },
      ],
    ),
    [
      { x: 5, y: 50 },
      { x: 10, y: 10 },
      { x: 10, y: 90 },
    ],
  )
})

test("keeps folded bindings on the center fold", () => {
  assert.equal(getPageBindingEdge("right", 1, true), "left")
  assert.equal(getPageBindingEdge("right", 2, true), "right")
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "right", 1, 15, fourHoles, true)[0].x, 0)
  assert.equal(getPunchHoles({ width: 210, height: 297 }, "right", 2, 15, fourHoles, true)[0].x, 210)
  assert.equal(getPunchHoles(
    { width: 210, height: 297 },
    "left",
    1,
    15,
    getActivePunchHoleSets([...fourHoles, { offset: 20, groups: [{ holes: 4, weight: 1 }] }], true),
    true,
  ).length, 4)
})
