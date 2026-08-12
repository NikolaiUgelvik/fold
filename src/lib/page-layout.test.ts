import assert from "node:assert/strict"
import test from "node:test"
import { getPageLayout } from "./page-layout.ts"

test("keeps yotsume print and finished-page orientations together", () => {
  assert.deepEqual(getPageLayout("a4", "yotsume", "portrait", false), {
    paper: { width: 210, height: 297 },
    page: { width: 210, height: 297 },
    layout: "full",
  })
  assert.deepEqual(getPageLayout("a4", "yotsume", "portrait", true), {
    paper: { width: 297, height: 210 },
    page: { width: 148.5, height: 210 },
    layout: "side-by-side",
  })
  assert.deepEqual(getPageLayout("a4", "yotsume", "landscape", true), {
    paper: { width: 210, height: 297 },
    page: { width: 210, height: 148.5 },
    layout: "stacked",
  })
})

test("lays out folded bindings side by side", () => {
  assert.deepEqual(getPageLayout("a4", "coptic", "portrait", true), {
    paper: { width: 297, height: 210 },
    page: { width: 148.5, height: 210 },
    layout: "side-by-side",
  })
})
