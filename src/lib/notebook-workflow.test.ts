import assert from "node:assert/strict"
import test from "node:test"
import { createEditorHistory, editorHistoryReducer } from "./editor-history.ts"
import { createNotebookDocument } from "./notebook-document.ts"
import {
  changeSelectedTemplate,
  updateSelectedAppearance,
  updateSelectedContent,
} from "./page-editing.ts"
import { parsePageSelection } from "./page-selection.ts"
import { createPrintPlan } from "./print-plan.ts"
import { initialSettings, resolvePageAppearance, type Settings } from "./settings.ts"

test("bulk edits change only the selected property and reset restores inheritance", () => {
  const settings: Settings = {
    ...initialSettings,
    pageAppearanceOverrides: {
      2: { dotSpacing: 6, dotColor: "#123456" },
      3: { dotSpacing: 9, margin: 20 },
      4: { dotSpacing: 11 },
    },
  }
  const selected = {
    ...settings,
    pageAppearanceOverrides: updateSelectedAppearance(
      settings.pageAppearanceOverrides,
      [2, 3],
      "dotSpacing",
      5,
    ),
  }
  const changedDefaults = { ...selected, dotSpacing: 8 }
  assert.deepEqual(
    [1, 2, 3, 4].map((page) => resolvePageAppearance(changedDefaults, page).dotSpacing),
    [8, 5, 5, 11],
  )
  assert.equal(resolvePageAppearance(changedDefaults, 2).dotColor, "#123456")
  assert.equal(resolvePageAppearance(changedDefaults, 3).margin, 20)
  const reset = {
    ...changedDefaults,
    pageAppearanceOverrides: updateSelectedAppearance(
      changedDefaults.pageAppearanceOverrides,
      [2, 3],
      "dotSpacing",
      undefined,
    ),
  }
  assert.deepEqual(
    [2, 3].map((page) => resolvePageAppearance(reset, page).dotSpacing),
    [8, 8],
  )
  assert.equal(resolvePageAppearance(reset, 2).dotColor, "#123456")
})

test("batch template choice retains existing titles and field edits preserve per-page subtitles", () => {
  const content: Settings["customPages"] = {
    1: { type: "title", title: "First", subtitle: "Private subtitle" },
    3: { type: "index", title: "Contents", entries: "Notes | 4" },
  }
  const titles = changeSelectedTemplate(content, [1, 2], "title")
  assert.deepEqual(titles[1], content[1])
  const updated = updateSelectedContent(titles, [1, 2], (page) =>
    page?.type === "title" ? { ...page, title: "Shared" } : page,
  )
  assert.deepEqual(updated[1], { type: "title", title: "Shared", subtitle: "Private subtitle" })
  assert.deepEqual(updated[2], { type: "title", title: "Shared", subtitle: "" })
  assert.deepEqual(updated[3], content[3])
})

test("one undo restores a continuous bulk edit and a new edit discards its redo branch", () => {
  const initial = createEditorHistory({ name: "Notebook", settings: initialSettings })
  const first = editorHistoryReducer(initial, {
    type: "setting",
    key: "margin",
    value: 11,
    group: "margin-focus",
  })
  const last = editorHistoryReducer(first, {
    type: "setting",
    key: "margin",
    value: 18,
    group: "margin-focus",
  })
  const undone = editorHistoryReducer(last, { type: "undo" })
  assert.equal(resolvePageAppearance(undone.present.settings, 1).margin, initialSettings.margin)
  const redone = editorHistoryReducer(undone, { type: "redo" })
  assert.equal(resolvePageAppearance(redone.present.settings, 1).margin, 18)
  const branch = editorHistoryReducer(undone, {
    type: "setting",
    key: "pattern",
    value: "lines",
    group: null,
  })
  assert.equal(editorHistoryReducer(branch, { type: "redo" }).present.settings.pattern, "lines")
  assert.equal(resolvePageAppearance(branch.present.settings, 1).margin, initialSettings.margin)
})

test("range selection is sorted, deduplicated and rejects invalid input atomically", () => {
  assert.deepEqual(parsePageSelection("3–5, 1, 4-6", 8), { pages: [1, 3, 4, 5, 6], error: null })
  assert.deepEqual(parsePageSelection("even", 7), { pages: [2, 4, 6], error: null })
  for (const input of ["1,9", "0-2", "5-3", "1,garbage", "1,,2"]) {
    assert.equal(parsePageSelection(input, 8).pages, null, input)
  }
})

test("print plan includes all Signatures, preserves reversed backs and appends guides only on request", () => {
  const settings: Settings = { ...initialSettings, punchHolePlacement: "separate" }
  const document = createNotebookDocument(settings)
  const all = createPrintPlan(document, settings, "all", false)
  assert.deepEqual([...new Set(all.map((side) => side.signature))], [1, 2, 3, 4])
  const backs = createPrintPlan(document, settings, "backs", false)
  const reversed = createPrintPlan(document, settings, "backs-reversed", false)
  assert.deepEqual(
    reversed.map((side) => side.pages),
    backs.map((side) => side.pages).reverse(),
  )
  const withGuide = createPrintPlan(document, settings, "all", true)
  assert.equal(withGuide.at(-1)?.side, "punch-guide")
  assert.deepEqual(withGuide.slice(0, -1), all)
  assert.deepEqual(
    createPrintPlan(document, settings, "guide", false).map((side) => side.side),
    ["punch-guide"],
  )
})
