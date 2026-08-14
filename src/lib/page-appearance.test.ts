import assert from "node:assert/strict"
import test from "node:test"
import {
  countPageAppearanceOverrides,
  initialSettings,
  isPageAppearanceKey,
  type PageAppearanceOverride,
  resetPageAppearanceOverride,
  resolvePageAppearance,
  type Settings,
  setPageAppearanceOverride,
  setPageAppearanceSettingOverride,
} from "./settings.ts"

function makeSettings(settings: Partial<Settings> = {}): Settings {
  return { ...initialSettings, pageAppearanceOverrides: {}, customPages: {}, ...settings }
}

test("resolves every printable page appearance override", () => {
  const override: PageAppearanceOverride = {
    pattern: "graph",
    dotSize: 0.5,
    dotSpacing: 6,
    dotMajorEvery: 4,
    dotMajorSize: 1,
    dotColor: "#111111",
    lineWidth: 0.3,
    lineSpacing: 8,
    lineColor: "#222222",
    graphMajorEvery: 6,
    graphMajorLineWidth: 0.6,
    graphMajorColor: "#333333",
    graphCompleteBlocks: true,
    margin: 12,
    gutterMargin: 14,
    borderWidth: 0.8,
    borderColor: "#444444",
    numberPosition: "center",
    numberFont: "Inter, sans-serif",
    numberFontSize: 11,
    numberColor: "#555555",
    numberBold: true,
    numberItalic: true,
    numberVisible: false,
    pageNumberText: "iv",
  }
  const resolved = resolvePageAppearance(
    makeSettings({ pageAppearanceOverrides: { 2: override } }),
    2,
  )

  for (const [key, value] of Object.entries(override)) {
    assert.deepEqual((resolved as unknown as Record<string, unknown>)[key], value)
  }
})

test("counts sparse appearance overrides for a logical page", () => {
  const overrides = { 2: { margin: 18, pageNumberText: "iv" } }

  assert.equal(countPageAppearanceOverrides(overrides, 2), 2)
  assert.equal(countPageAppearanceOverrides(overrides, 3), 0)
})

test("stores only the changed field and merges updates without mutation", () => {
  const original = { 3: { pattern: "lines" as const } }
  const withMargin = setPageAppearanceOverride(original, 2, "margin", 15)
  const withColor = setPageAppearanceOverride(withMargin, 2, "lineColor", "#123456")

  assert.equal(original[3].pattern, "lines")
  assert.equal(Object.hasOwn(original, 2), false)
  assert.deepEqual(withColor, {
    2: { margin: 15, lineColor: "#123456" },
    3: { pattern: "lines" },
  })
})

test("routes only appearance settings to sparse page overrides", () => {
  const settings = makeSettings({
    margin: 10,
    numberVisibility: "both",
    pageAppearanceOverrides: { 2: { lineColor: "#123456" } },
  })
  const withMargin = setPageAppearanceSettingOverride(settings, 2, "margin", 18)
  const hidden = setPageAppearanceSettingOverride(
    { ...settings, pageAppearanceOverrides: withMargin },
    2,
    "numberVisibility",
    "none",
  )
  const resetMargin = setPageAppearanceSettingOverride(
    { ...settings, pageAppearanceOverrides: hidden },
    2,
    "margin",
    settings.margin,
  )

  assert.deepEqual(withMargin[2], { lineColor: "#123456", margin: 18 })
  assert.deepEqual(hidden[2], { lineColor: "#123456", margin: 18, numberVisible: false })
  assert.deepEqual(resetMargin[2], { lineColor: "#123456", numberVisible: false })
  assert.deepEqual(
    setPageAppearanceSettingOverride(
      { ...settings, pageAppearanceOverrides: { 2: { margin: 18 } } },
      2,
      "margin",
      settings.margin,
    ),
    {},
  )
  assert.equal(isPageAppearanceKey("pattern"), true)
  for (const key of [
    "binding",
    "paper",
    "sheets",
    "signatures",
    "punchHolePlacement",
    "previewPaperColor",
    "firstPage",
    "customPages",
  ] as const) {
    assert.equal(isPageAppearanceKey(key), false)
  }
})

test("inherits later book changes per property", () => {
  const settings = makeSettings({
    pattern: "graph",
    lineColor: "#abcdef",
    borderWidth: 1,
    pageAppearanceOverrides: { 2: { margin: 18 } },
  })

  const page = resolvePageAppearance(settings, 2)
  assert.equal(page.margin, 18)
  assert.equal(page.pattern, "graph")
  assert.equal(page.lineColor, "#abcdef")
  assert.equal(page.borderWidth, 1)
  assert.equal(resolvePageAppearance(settings, 3).margin, settings.margin)
})

test("reset removes only the selected page override", () => {
  const overrides = {
    2: { margin: 18, pageNumberText: "iv" },
    3: { pattern: "blank" as const },
  }
  const reset = resetPageAppearanceOverride(overrides, 2)

  assert.deepEqual(reset, { 3: { pattern: "blank" } })
  assert.equal(overrides[2].margin, 18)
  assert.equal(overrides[2].pageNumberText, "iv")
  assert.equal(overrides[3].pattern, "blank")
})

test("custom number text and direct visibility affect only their logical page", () => {
  const settings = makeSettings({
    firstPage: 10,
    numberVisibility: "right",
    pageAppearanceOverrides: { 2: { pageNumberText: "iv", numberVisible: true } },
  })

  assert.equal(resolvePageAppearance(settings, 2).pageNumberText, "iv")
  assert.equal(resolvePageAppearance(settings, 2).numberVisible, true)
  assert.equal(resolvePageAppearance(settings, 3).pageNumberText, "12")
  assert.equal(resolvePageAppearance(settings, 3).numberVisible, true)
})

test("title pages hide numbers by default but allow an explicit page override", () => {
  const title = { type: "title" as const, title: "Notebook", subtitle: "" }
  const hidden = makeSettings({ customPages: { 1: title } })
  const shown = makeSettings({
    customPages: { 1: title },
    pageAppearanceOverrides: { 1: { numberVisible: true, pageNumberText: "Cover" } },
  })

  assert.equal(resolvePageAppearance(hidden, 1).numberVisible, false)
  assert.equal(resolvePageAppearance(shown, 1).numberVisible, true)
  assert.equal(resolvePageAppearance(shown, 1).pageNumberText, "Cover")
})

test("stores visibility against the page's actual inherited default", () => {
  const title = makeSettings({
    numberVisibility: "both",
    customPages: { 1: { type: "title", title: "Notebook", subtitle: "" } },
  })
  const shownTitle = setPageAppearanceSettingOverride(title, 1, "numberVisibility", "both")
  const hiddenTitle = setPageAppearanceSettingOverride(
    { ...title, pageAppearanceOverrides: shownTitle },
    1,
    "numberVisibility",
    "none",
  )
  const rightOnly = makeSettings({ numberVisibility: "right" })

  assert.deepEqual(shownTitle, { 1: { numberVisible: true } })
  assert.deepEqual(hiddenTitle, {})
  assert.deepEqual(setPageAppearanceSettingOverride(rightOnly, 2, "numberVisibility", "right"), {})
  assert.deepEqual(setPageAppearanceSettingOverride(rightOnly, 2, "numberVisibility", "both"), {
    2: { numberVisible: true },
  })
})
