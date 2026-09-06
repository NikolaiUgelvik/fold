import { parseIndexEntries } from "./custom-pages.ts"
import { isFoldedBinding } from "./imposition.ts"
import { getPageLayout } from "./page-layout.ts"
import { displayedPage, getOuterPageNumberEdge } from "./page-numbering.ts"
import { getCenteredPatternBounds } from "./paper.ts"
import { getPageBindingEdge, getPunchHoles, type HoleSet } from "./punch-holes.ts"
import { resolvePageAppearance, type Settings } from "./settings.ts"

function getPatternBasics(settings: Settings) {
  if (settings.pattern === "cross") {
    return {
      spacing: settings.crossSpacing,
      majorSpacing: 0,
      patternRadius:
        Math.max(
          settings.crossHorizontalLength,
          settings.crossVerticalLength,
          settings.crossLineWidth,
        ) / 2,
      boundsSpacing: settings.crossSpacing,
    }
  }
  const spacing = settings.pattern === "dots" ? settings.dotSpacing : settings.lineSpacing
  const majorEvery =
    settings.pattern === "graph" ? settings.graphMajorEvery : settings.dotMajorEvery
  const majorSpacing = spacing * majorEvery
  const majorLineWidth = settings.pattern === "graph" ? settings.graphMajorLineWidth : 0
  const patternRadius =
    settings.pattern === "dots"
      ? settings.dotSize / 2
      : Math.max(settings.lineWidth, majorLineWidth) / 2
  const boundsSpacing =
    settings.pattern === "graph" && settings.graphCompleteBlocks ? majorSpacing : spacing
  return { spacing, majorSpacing, patternRadius, boundsSpacing }
}

function getPageMargins(settings: Settings, bindingEdge: "left" | "right") {
  return {
    top: settings.margin,
    right: settings.margin + (bindingEdge === "right" ? settings.gutterMargin : 0),
    bottom: settings.margin,
    left: settings.margin + (bindingEdge === "left" ? settings.gutterMargin : 0),
  }
}

function getMajorBounds(
  settings: Settings,
  patternStartX: number,
  patternStartY: number,
  centeredPatternBounds: ReturnType<typeof getCenteredPatternBounds>,
  patternRadius: number,
  majorSpacing: number,
  patternBounds: ReturnType<typeof getCenteredPatternBounds>,
) {
  if (settings.pattern !== "dots" || settings.dotMajorEvery <= 0) return patternBounds
  const majorRadius = settings.dotMajorSize / 2
  return {
    x: patternStartX - majorRadius,
    y: patternStartY - majorRadius,
    width:
      Math.floor((centeredPatternBounds.width - patternRadius * 2) / majorSpacing) * majorSpacing +
      majorRadius * 2,
    height:
      Math.floor((centeredPatternBounds.height - patternRadius * 2) / majorSpacing) * majorSpacing +
      majorRadius * 2,
  }
}

function getPageMetrics(settings: Settings, logicalPage: number) {
  const pageSize = getPageLayout(
    settings.paper,
    settings.binding,
    settings.yotsumeOrientation,
    settings.yotsumeTwoUp,
  ).page
  const numberEdge = getOuterPageNumberEdge(displayedPage(settings, logicalPage))
  const customPage = settings.customPages[logicalPage]
  const indexEntries =
    customPage?.type === "index"
      ? parseIndexEntries(customPage.entries).slice(0, Math.floor((pageSize.height - 50) / 9))
      : []
  const { spacing, majorSpacing, patternRadius, boundsSpacing } = getPatternBasics(settings)
  const folded = isFoldedBinding(settings.binding)
  const bindingEdge = getPageBindingEdge(settings.bindingEdge, logicalPage, folded)
  const pageMargins = getPageMargins(settings, bindingEdge)
  const contentWidth = Math.max(0, pageSize.width - pageMargins.left - pageMargins.right)
  const contentCenterX = pageMargins.left + contentWidth / 2
  const centeredPatternBounds = getCenteredPatternBounds(
    pageSize,
    pageMargins,
    boundsSpacing,
    patternRadius,
  )
  const patternStartX = centeredPatternBounds.x + patternRadius
  const patternStartY = centeredPatternBounds.y + patternRadius
  const fullContentBounds = {
    ...centeredPatternBounds,
    x: pageMargins.left,
    width: contentWidth,
  }
  const patternBounds =
    settings.pattern === "lines" || settings.pattern === "fourLine" || settings.pattern === "slant"
      ? fullContentBounds
      : centeredPatternBounds
  const slantOverlayBounds = settings.overlayPattern === "slant" ? fullContentBounds : null
  const majorRadius = settings.dotMajorSize / 2
  const majorBounds = getMajorBounds(
    settings,
    patternStartX,
    patternStartY,
    centeredPatternBounds,
    patternRadius,
    majorSpacing,
    patternBounds,
  )
  const borderX = pageMargins.left + settings.borderWidth / 2
  const borderY = pageMargins.top + settings.borderWidth / 2
  return {
    pageSize,
    numberEdge,
    customPage,
    indexEntries,
    spacing,
    majorSpacing,
    patternRadius,
    boundsSpacing,
    folded,
    bindingEdge,
    pageMargins,
    contentWidth,
    contentCenterX,
    centeredPatternBounds,
    patternStartX,
    patternStartY,
    patternBounds,
    slantOverlayBounds,
    majorRadius,
    majorBounds,
    borderX,
    borderY,
  }
}

export type PageMetrics = ReturnType<typeof getPageMetrics>

export type PageTextRun = {
  id: string
  text: string
  x: number
  y: number
  fontFamily: string
  fontSize: number
  fontWeight: 400 | 700
  fontStyle: "normal" | "italic"
  color: string
  anchor: "start" | "middle" | "end"
}

export function getPageNumberAlignment(settings: Settings, metrics: PageMetrics) {
  if (settings.numberPosition === "center")
    return { x: metrics.pageSize.width / 2, anchor: "middle" as const }
  if (metrics.numberEdge === "right")
    return { x: metrics.pageSize.width - 9, anchor: "end" as const }
  return { x: 9, anchor: "start" as const }
}

function createTitleRuns(metrics: PageMetrics): PageTextRun[] {
  const customPage = metrics.customPage
  if (customPage?.type !== "title") return []
  const runs: (PageTextRun | null)[] = [
    customPage.title
      ? {
          id: "title",
          text: customPage.title,
          x: metrics.contentCenterX,
          y: metrics.pageSize.height * 0.44,
          fontFamily: "Georgia, serif",
          fontSize: customPage.title.length > 24 ? 6 : 9,
          fontWeight: 700,
          fontStyle: "normal",
          color: "#30302c",
          anchor: "middle",
        }
      : null,
    customPage.subtitle
      ? {
          id: "subtitle",
          text: customPage.subtitle,
          x: metrics.contentCenterX,
          y: metrics.pageSize.height * 0.52,
          fontFamily: "Georgia, serif",
          fontSize: 4,
          fontWeight: 400,
          fontStyle: "normal",
          color: "#30302c",
          anchor: "middle",
        }
      : null,
  ]
  return runs.filter((run): run is PageTextRun => run !== null)
}

function createIndexRuns(metrics: PageMetrics): PageTextRun[] {
  const customPage = metrics.customPage
  if (customPage?.type !== "index") return []
  const runs: PageTextRun[] = []
  if (customPage.title) {
    runs.push({
      id: "index-title",
      text: customPage.title,
      x: metrics.pageMargins.left,
      y: 22,
      fontFamily: "Georgia, serif",
      fontSize: 7,
      fontWeight: 700,
      fontStyle: "normal",
      color: "#30302c",
      anchor: "start",
    })
  }
  for (const [index, entry] of metrics.indexEntries.entries()) {
    const y = 38 + index * 9
    runs.push({
      id: `index-label-${index}`,
      text: entry.label,
      x: metrics.pageMargins.left,
      y,
      fontFamily: "Georgia, serif",
      fontSize: 3.8,
      fontWeight: 400,
      fontStyle: "normal",
      color: "#30302c",
      anchor: "start",
    })
    if (entry.page) {
      runs.push({
        id: `index-page-${index}`,
        text: entry.page,
        x: metrics.pageSize.width - metrics.pageMargins.right,
        y,
        fontFamily: "Georgia, serif",
        fontSize: 3.8,
        fontWeight: 400,
        fontStyle: "normal",
        color: "#30302c",
        anchor: "end",
      })
    }
  }
  return runs
}

function createPageNumberRun(
  settings: ReturnType<typeof resolvePageAppearance>,
  metrics: PageMetrics,
): PageTextRun[] {
  if (!settings.numberVisible) return []
  const { x, anchor } = getPageNumberAlignment(settings, metrics)
  return [
    {
      id: "page-number",
      text: settings.pageNumberText,
      x,
      y: metrics.pageSize.height - 7,
      fontFamily: settings.numberFont,
      fontSize: (settings.numberFontSize * 25.4) / 72,
      fontWeight: settings.numberBold ? 700 : 400,
      fontStyle: settings.numberItalic ? "italic" : "normal",
      color: settings.numberColor,
      anchor,
    },
  ]
}

function createTextRuns(
  settings: ReturnType<typeof resolvePageAppearance>,
  metrics: PageMetrics,
): PageTextRun[] {
  return [
    ...createTitleRuns(metrics),
    ...createIndexRuns(metrics),
    ...createPageNumberRun(settings, metrics),
  ]
}

export type PageSurface = {
  logicalPage: number
  appearance: ReturnType<typeof resolvePageAppearance>
  metrics: PageMetrics
  punchHoles: ReturnType<typeof getPunchHoles>
  indexLineYs: number[]
  textRuns: PageTextRun[]
}

export function createPageSurface(
  settings: Settings,
  logicalPage: number,
  punchHoleSets: HoleSet[],
  showPunchHoles: boolean,
): PageSurface {
  const appearance = resolvePageAppearance(settings, logicalPage)
  const metrics = getPageMetrics(appearance, logicalPage)
  const punchHoles = showPunchHoles
    ? getPunchHoles(
        metrics.pageSize,
        settings.bindingEdge,
        logicalPage,
        settings.punchHoleEndInset,
        punchHoleSets,
        metrics.folded,
      )
    : []
  return {
    logicalPage,
    appearance,
    metrics,
    punchHoles,
    indexLineYs: metrics.indexEntries.flatMap((entry, index) =>
      entry.page ? [37 + index * 9] : [],
    ),
    textRuns: createTextRuns(appearance, metrics),
  }
}
