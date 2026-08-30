import assert from "node:assert/strict"
import test from "node:test"
import {
  createNotebookDocument,
  createNotebookDocumentKernel,
  type NotebookDocumentSettings,
} from "./notebook-document.ts"

type TestSettings = NotebookDocumentSettings & {
  bindingEdge: "left" | "right"
  punchHoleEndInset: number
  punchHoleDiameter: number
}

const base: TestSettings = {
  binding: "coptic",
  paper: "a4",
  yotsumeOrientation: "portrait",
  yotsumeTwoUp: false,
  signatures: 2,
  sheets: 2,
  punchHolePlacement: "signature-front",
  bindingEdge: "left",
  punchHoleEndInset: 15,
  punchHoleDiameter: 4,
  punchHoleSets: [
    { offset: 12, groups: [{ holes: 4, weight: 1 }] },
    { offset: 20, groups: [{ holes: 2, weight: 1 }] },
  ],
  pattern: "dots",
  overlayPattern: "none",
  borderWidth: 1,
  numberVisibility: "both",
  customPages: {},
  pageAppearanceOverrides: {},
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

test("reuses construction identities while deriving current punch and guide settings", () => {
  const kernel = createNotebookDocumentKernel(base)
  const original = createNotebookDocument(base, kernel)
  const appearance = createNotebookDocument({ ...base, pattern: "blank" as const }, kernel)
  const punch = createNotebookDocument(
    {
      ...base,
      punchHolePlacement: "separate" as const,
      bindingEdge: "right" as const,
      punchHoleEndInset: 24,
      punchHoleDiameter: 6,
      punchHoleSets: [{ offset: 30, groups: [{ holes: 3, weight: 1 }] }],
    },
    kernel,
  )

  for (const derived of [appearance, punch]) {
    assert.strictEqual(derived.pageLayout, original.pageLayout)
    assert.strictEqual(derived.pageSize, original.pageSize)
    assert.strictEqual(derived.sides, original.sides)
  }
  assert.equal(punch.punchHoleSets[0].offset, 30)
  assert.deepEqual([...punch.punchHolePages], [])
  assert.deepEqual(
    {
      bindingEdge: punch.guide?.settings.bindingEdge,
      punchHoleEndInset: punch.guide?.settings.punchHoleEndInset,
      punchHoleDiameter: punch.guide?.settings.punchHoleDiameter,
      pattern: punch.guide?.settings.pattern,
      borderWidth: punch.guide?.settings.borderWidth,
      numberVisibility: punch.guide?.settings.numberVisibility,
      customPages: punch.guide?.settings.customPages,
      pageAppearanceOverrides: punch.guide?.settings.pageAppearanceOverrides,
    },
    {
      bindingEdge: "right",
      punchHoleEndInset: 24,
      punchHoleDiameter: 6,
      pattern: "blank",
      borderWidth: 0,
      numberVisibility: "none",
      customPages: {},
      pageAppearanceOverrides: {},
    },
  )
})

test("rebuilds construction values for a structural key change", () => {
  const original = createNotebookDocumentKernel(base)
  const changed = createNotebookDocumentKernel({ ...base, paper: "letter" })

  assert.notStrictEqual(changed.pageLayout, original.pageLayout)
  assert.notStrictEqual(changed.pageSize, original.pageSize)
  assert.notDeepEqual(changed.pageSize, original.pageSize)
})
