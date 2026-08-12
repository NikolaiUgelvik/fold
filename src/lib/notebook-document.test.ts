import assert from "node:assert/strict"
import test from "node:test"
import { createNotebookDocument, type NotebookDocumentSettings } from "./notebook-document.ts"

const base: NotebookDocumentSettings = {
  binding: "coptic",
  paper: "a4",
  yotsumeOrientation: "portrait",
  yotsumeTwoUp: false,
  signatures: 2,
  sheets: 2,
  punchHolePlacement: "signature-front",
  punchHoleSets: [
    { offset: 12, groups: [{ holes: 4, weight: 1 }] },
    { offset: 20, groups: [{ holes: 2, weight: 1 }] },
  ],
  pattern: "dots",
  borderWidth: 1,
  numberVisibility: "both",
  customPages: {},
}

test("creates folded notebook geometry and punch pages", () => {
  const document = createNotebookDocument(base)

  assert.equal(document.totalPages, 16)
  assert.equal(document.signatureCount, 2)
  assert.equal(document.pageName, "A5")
  assert.equal(document.punchHoleSets.length, 1)
  assert.deepEqual([...document.punchHolePages], [8, 1, 16, 9])
})

test("creates full-sheet and two-up yotsume documents", () => {
  const full = createNotebookDocument({ ...base, binding: "yotsume", signatures: 9 })
  const twoUp = createNotebookDocument({
    ...base,
    binding: "yotsume",
    signatures: 9,
    yotsumeTwoUp: true,
  })

  assert.equal(full.pageName, "A4")
  assert.equal(full.pageLayout.layout, "full")
  assert.equal(full.totalPages, 4)
  assert.equal(full.punchHoleSets.length, 2)
  assert.equal(twoUp.pageName, "A5")
  assert.equal(twoUp.pageLayout.layout, "side-by-side")
  assert.equal(twoUp.totalPages, 8)
})
