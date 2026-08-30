import assert from "node:assert/strict"
import test from "node:test"
import { createNotebookDocument, createNotebookDocumentKernel } from "./notebook-document.ts"
import { initialSettings, type Settings } from "./settings.ts"

const base: Settings = {
  ...initialSettings,
  signatures: 2,
  sheets: 2,
  punchHolePlacement: "signature-front",
  punchHoleDiameter: 4,
  punchHoleSets: [
    { id: "set-1", offset: 12, groups: [{ id: "group-1", holes: 4, weight: 1 }] },
    { id: "set-2", offset: 20, groups: [{ id: "group-2", holes: 2, weight: 1 }] },
  ],
  borderWidth: 1,
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
      punchHoleSets: [
        { id: "punch-set", offset: 30, groups: [{ id: "punch-group", holes: 3, weight: 1 }] },
      ],
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
