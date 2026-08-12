import assert from "node:assert/strict"
import test from "node:test"
import { createPrintPageViewModel } from "./notebook-document.ts"

test("does not paint a background in exported pages", () => {
  assert.equal(createPrintPageViewModel(7, true).paperColor, "none")
})
