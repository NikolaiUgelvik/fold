import assert from "node:assert/strict"
import test from "node:test"
import { createNotebookDocument, createPunchGuideViewModel } from "./notebook-document.ts"
import { initialSettings, type Settings } from "./settings.ts"

const settings: Settings = {
  ...initialSettings,
  signatures: 1,
  sheets: 2,
  punchHolePlacement: "separate",
  punchHoleSets: [{ id: "set-1", offset: 12, groups: [{ id: "group-1", holes: 4, weight: 1 }] }],
  overlayPattern: "slant",
  borderWidth: 1,
  customPages: { 1: { type: "title", title: "Title", subtitle: "Subtitle" } },
  pageAppearanceOverrides: {
    1: { pattern: "graph", borderWidth: 2, numberVisible: true, pageNumberText: "LEAK" },
  },
}

test("models the separate punch guide preview", () => {
  const document = createNotebookDocument(settings)
  const hidden = createPunchGuideViewModel(document, false)
  const shown = createPunchGuideViewModel(document, true)

  assert.equal(hidden.sideCount, 1)
  assert.equal(hidden.toggleLabel, "View guide")
  assert.equal(shown.toggleLabel, "View pages")
  assert.equal(shown.ariaLabel, "Punch guide preview")
  assert.deepEqual(shown.guide?.pages, [8, 1])
  assert.equal(shown.guide?.settings.pattern, "blank")
  assert.equal(shown.guide?.settings.overlayPattern, "none")
  assert.equal(shown.guide?.settings.borderWidth, 0)
  assert.equal(shown.guide?.settings.numberVisibility, "none")
  assert.deepEqual(shown.guide?.settings.customPages, {})
  assert.deepEqual(shown.guide?.settings.pageAppearanceOverrides, {})
})

test("omits a guide for embedded punch indicators", () => {
  const document = createNotebookDocument({ ...settings, punchHolePlacement: "every" })

  assert.equal(document.guide, null)
  assert.equal(createPunchGuideViewModel(document, true).sideCount, 0)
})
