import assert from "node:assert/strict"
import test from "node:test"
import {
  ensureFontLoaded,
  ensurePageNumberFontsLoaded,
  isPageNumberTextSupported,
} from "./font-loading.ts"
import { initialSettings } from "./settings.ts"

test("rejects a font load that would use fallback text", async () => {
  await assert.rejects(
    ensureFontLoaded(
      {
        load: async () => [],
        check: () => false,
      },
      "16px MissingFont, serif",
      "1 2 3",
    ),
  )
})

test("accepts a font after it is available", async () => {
  await ensureFontLoaded(
    {
      load: async () => [],
      check: () => true,
    },
    "16px LoadedFont, serif",
    "1 2 3",
  )
})

test("accepts printable page-number text and rejects unsupported glyphs", () => {
  assert.equal(isPageNumberTextSupported("A-1 (iv)"), true)
  assert.equal(isPageNumberTextSupported("page\n2"), false)
  assert.equal(isPageNumberTextSupported("café"), false)
})

test("checks each effective page-number font variant once before export", async () => {
  const calls: Array<[string, string]> = []
  await ensurePageNumberFontsLoaded(
    {
      load: async (font, text = "") => {
        calls.push([font, text])
        return []
      },
      check: () => true,
    },
    {
      ...initialSettings,
      customPages: { 2: { type: "title", title: "Notebook", subtitle: "" } },
      pageAppearanceOverrides: {
        2: {
          numberFont: "Inter, sans-serif",
          numberBold: true,
          numberItalic: true,
          numberVisible: true,
          pageNumberText: "iv",
        },
      },
    },
    [1, 2, 2, 3],
  )

  assert.deepEqual(calls, [
    ["normal 400 16px Georgia, serif", "13"],
    ["italic 700 16px Inter, sans-serif", "iv"],
  ])
})
