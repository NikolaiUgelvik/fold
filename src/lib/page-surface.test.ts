import assert from "node:assert/strict"
import test from "node:test"

import { createPageSurface } from "./page-surface.ts"
import { initialSettings, type Settings } from "./settings.ts"

function makeSettings(settings: Partial<Settings> = {}): Settings {
  return { ...initialSettings, pageAppearanceOverrides: {}, customPages: {}, ...settings }
}

test("four-line and slant patterns span the full content width with line metrics", () => {
  for (const pattern of ["fourLine", "slant"] as const) {
    const surface = createPageSurface(makeSettings({ pattern }), 1, [], false)
    const { patternBounds, pageMargins, contentWidth, spacing, patternRadius } = surface.metrics
    assert.equal(spacing, 5)
    assert.equal(patternRadius, 0.1)
    assert.equal(patternBounds.x, pageMargins.left)
    assert.equal(patternBounds.width, contentWidth)
  }
})

test("slant overlay bounds are full width without changing the base pattern bounds", () => {
  for (const pattern of ["lines", "fourLine", "dots"] as const) {
    const withOverlay = createPageSurface(
      makeSettings({ pattern, overlayPattern: "slant" }),
      1,
      [],
      false,
    )
    const without = createPageSurface(makeSettings({ pattern }), 1, [], false)
    assert.deepEqual(withOverlay.metrics.patternBounds, without.metrics.patternBounds)
    assert.equal(withOverlay.metrics.slantOverlayBounds?.x, without.metrics.pageMargins.left)
    assert.equal(withOverlay.metrics.slantOverlayBounds?.width, without.metrics.contentWidth)
    assert.equal(
      withOverlay.metrics.slantOverlayBounds?.height,
      without.metrics.centeredPatternBounds.height,
    )
  }
})

test("derives the shared physical and SVG page art from resolved page settings", () => {
  const surface = createPageSurface(
    makeSettings({
      pattern: "graph",
      graphCompleteBlocks: true,
      borderWidth: 1,
      customPages: {
        2: {
          type: "index",
          title: "Contents",
          entries: "Introduction | 1\nLoose notes\nConclusion | 12",
        },
      },
      pageAppearanceOverrides: { 2: { pageNumberText: "ii", numberBold: true } },
    }),
    2,
    [{ offset: 12, groups: [{ holes: 4, weight: 1 }] }],
    true,
  )

  assert.equal(surface.metrics.bindingEdge, "right")
  assert.equal(surface.appearance.pageNumberText, "ii")
  assert.equal(surface.metrics.boundsSpacing, surface.metrics.majorSpacing)
  assert.equal(surface.punchHoles.length, 4)
  assert.deepEqual(surface.indexLineYs, [37, 55])
  assert.deepEqual(
    surface.textRuns.map((run) => [run.id, run.text]),
    [
      ["index-title", "Contents"],
      ["index-label-0", "Introduction"],
      ["index-page-0", "1"],
      ["index-label-1", "Loose notes"],
      ["index-label-2", "Conclusion"],
      ["index-page-2", "12"],
      ["page-number", "ii"],
    ],
  )
})
