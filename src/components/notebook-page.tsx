import { memo, useId } from "react"

import { createPageSurface, type PageMetrics, type PageSurface } from "@/lib/page-surface"
import type { HoleSet } from "@/lib/punch-holes"
import type { Settings } from "@/lib/settings"
import { SUDOKU_BOX_WIDTH, SUDOKU_LINE_WIDTH } from "@/lib/sudoku-layout"

type PatternBounds = {
  x: number
  y: number
  width: number
  height: number
}

function patternTile(settings: Settings, metrics: PageMetrics, pattern: Settings["pattern"]) {
  const { pageSize, spacing, pageMargins, patternStartX, patternStartY } = metrics
  const fullWidth = pattern === "lines" || pattern === "fourLine"
  const slantHeight = spacing / Math.tan((settings.slantAngle * Math.PI) / 180)
  if (pattern === "slant") {
    return { x: patternStartX, y: patternStartY, width: spacing, height: slantHeight }
  }
  return {
    x: fullWidth ? pageMargins.left : patternStartX - spacing / 2,
    y: patternStartY - spacing / 2,
    width: fullWidth ? pageSize.width : spacing,
    height: pattern === "fourLine" ? spacing * 4 + settings.fourLineGap : spacing,
  }
}

function PatternContent({
  settings,
  metrics,
  pattern,
  tile,
}: {
  settings: Settings
  metrics: PageMetrics
  pattern: Settings["pattern"]
  tile: PatternBounds
}) {
  const { spacing, pageSize } = metrics
  if (pattern === "dots") {
    return (
      <circle cx={spacing / 2} cy={spacing / 2} r={settings.dotSize / 2} fill={settings.dotColor} />
    )
  }
  if (pattern === "cross") {
    const center = spacing / 2
    return (
      <path
        d={`M${center - settings.crossHorizontalLength / 2} ${center}h${settings.crossHorizontalLength}M${center} ${center - settings.crossVerticalLength / 2}v${settings.crossVerticalLength}`}
        fill="none"
        stroke={settings.crossColor}
        strokeWidth={settings.crossLineWidth}
        strokeLinecap="butt"
      />
    )
  }
  if (pattern === "slant") {
    return (
      <line
        x1={0}
        y1={tile.height}
        x2={spacing}
        y2={0}
        stroke={settings.lineColor}
        strokeWidth={settings.lineWidth}
      />
    )
  }
  const rows = pattern === "fourLine" ? [0, 1, 2, 3] : [0]
  const crossLine = pattern === "grid" || pattern === "graph"
  return (
    <>
      {rows.map((row) => (
        <line
          key={row}
          x2={crossLine ? spacing : pageSize.width}
          y1={spacing / 2 + row * spacing}
          y2={spacing / 2 + row * spacing}
          stroke={settings.lineColor}
          strokeWidth={settings.lineWidth}
        />
      ))}
      {crossLine && (
        <line
          x1={spacing / 2}
          x2={spacing / 2}
          y2={spacing}
          stroke={settings.lineColor}
          strokeWidth={settings.lineWidth}
        />
      )}
    </>
  )
}

function BasePattern({
  settings,
  metrics,
  patternId,
  pattern,
}: {
  settings: Settings
  metrics: PageMetrics
  patternId: string
  pattern: Settings["pattern"]
}) {
  const tile = patternTile(settings, metrics, pattern)
  return (
    <pattern
      id={patternId}
      patternUnits="userSpaceOnUse"
      x={tile.x}
      y={tile.y}
      width={tile.width}
      height={tile.height}
    >
      <PatternContent settings={settings} metrics={metrics} pattern={pattern} tile={tile} />
    </pattern>
  )
}

function MajorPatterns({
  settings,
  metrics,
  majorPatternId,
}: {
  settings: Settings
  metrics: PageMetrics
  majorPatternId: string
}) {
  const { majorSpacing, patternStartX, patternStartY } = metrics
  return (
    <>
      {settings.pattern === "dots" && settings.dotMajorEvery > 0 && (
        <pattern
          id={majorPatternId}
          patternUnits="userSpaceOnUse"
          x={patternStartX - majorSpacing / 2}
          y={patternStartY - majorSpacing / 2}
          width={majorSpacing}
          height={majorSpacing}
        >
          <circle
            cx={majorSpacing / 2}
            cy={majorSpacing / 2}
            r={settings.dotMajorSize / 2}
            fill={settings.dotColor}
          />
        </pattern>
      )}
      {settings.pattern === "graph" && (
        <pattern
          id={majorPatternId}
          patternUnits="userSpaceOnUse"
          x={patternStartX - majorSpacing / 2}
          y={patternStartY - majorSpacing / 2}
          width={majorSpacing}
          height={majorSpacing}
        >
          <path
            d={`M ${majorSpacing / 2} 0V${majorSpacing}M0 ${majorSpacing / 2}H${majorSpacing}`}
            fill="none"
            stroke={settings.graphMajorColor}
            strokeWidth={settings.graphMajorLineWidth}
          />
        </pattern>
      )}
    </>
  )
}

function PatternOverlayRects({
  settings,
  hasBase,
  patternBounds,
  majorBounds,
  slantOverlayBounds,
  patternId,
  majorPatternId,
  slantOverlayId,
}: {
  settings: Settings
  hasBase: boolean
  patternBounds: PageMetrics["patternBounds"]
  majorBounds: PageMetrics["majorBounds"]
  slantOverlayBounds: PageMetrics["slantOverlayBounds"]
  patternId: string
  majorPatternId: string
  slantOverlayId: string
}) {
  return (
    <>
      {hasBase && <rect {...patternBounds} fill={`url(#${patternId})`} />}
      {settings.overlayPattern === "slant" && slantOverlayBounds && (
        <rect {...slantOverlayBounds} fill={`url(#${slantOverlayId})`} />
      )}
      {settings.pattern === "dots" && settings.dotMajorEvery > 0 && (
        <rect {...majorBounds} fill={`url(#${majorPatternId})`} />
      )}
      {settings.pattern === "graph" && <rect {...patternBounds} fill={`url(#${majorPatternId})`} />}
    </>
  )
}

function PagePattern({
  settings,
  metrics,
  patternId,
  majorPatternId,
  slantOverlayId,
}: {
  settings: Settings
  metrics: PageMetrics
  patternId: string
  majorPatternId: string
  slantOverlayId: string
}) {
  const { customPage, patternBounds, majorBounds, slantOverlayBounds } = metrics
  const hasBase = settings.pattern !== "blank"
  const hasSlantOverlay = settings.overlayPattern === "slant"
  return (
    <>
      {!customPage && (hasBase || hasSlantOverlay) && (
        <>
          <defs>
            {hasBase && (
              <BasePattern
                settings={settings}
                metrics={metrics}
                patternId={patternId}
                pattern={settings.pattern}
              />
            )}
            {hasSlantOverlay && (
              <BasePattern
                settings={settings}
                metrics={metrics}
                patternId={slantOverlayId}
                pattern="slant"
              />
            )}
            <MajorPatterns settings={settings} metrics={metrics} majorPatternId={majorPatternId} />
          </defs>
          <PatternOverlayRects
            settings={settings}
            hasBase={hasBase}
            patternBounds={patternBounds}
            majorBounds={majorBounds}
            slantOverlayBounds={slantOverlayBounds}
            patternId={patternId}
            majorPatternId={majorPatternId}
            slantOverlayId={slantOverlayId}
          />
        </>
      )}
    </>
  )
}

function PageBorder({ settings, metrics }: { settings: Settings; metrics: PageMetrics }) {
  const { pageSize, customPage, pageMargins, contentWidth, borderX, borderY } = metrics
  return (
    <>
      {!customPage && settings.borderWidth > 0 && (
        <rect
          x={borderX}
          y={borderY}
          width={Math.max(0, contentWidth - settings.borderWidth)}
          height={Math.max(
            0,
            pageSize.height - pageMargins.top - pageMargins.bottom - settings.borderWidth,
          )}
          fill="none"
          stroke={settings.borderColor}
          strokeWidth={settings.borderWidth}
        />
      )}
    </>
  )
}

const sudokuGridLines = Array.from({ length: 10 }, (_, index) => index)

function SudokuGrids({ boards }: { boards: PageSurface["sudokuBoards"] }) {
  return boards.map((board) => (
    <g
      key={`${board.x}-${board.y}`}
      data-sudoku-board=""
      transform={`translate(${board.x} ${board.y})`}
      stroke="#30302c"
    >
      {sudokuGridLines.map((index) => {
        const offset = (index * board.size) / 9
        return (
          <g key={index} strokeWidth={index % 3 === 0 ? SUDOKU_BOX_WIDTH : SUDOKU_LINE_WIDTH}>
            <line x1={offset} x2={offset} y1={0} y2={board.size} />
            <line x1={0} x2={board.size} y1={offset} y2={offset} />
          </g>
        )
      })}
    </g>
  ))
}

function PageText({ runs }: { runs: PageSurface["textRuns"] }) {
  return runs.map((run) => (
    <text
      key={run.id}
      x={run.x}
      y={run.y}
      fill={run.color}
      fontFamily={run.fontFamily}
      fontSize={run.fontSize}
      fontWeight={run.fontWeight}
      fontStyle={run.fontStyle}
      textAnchor={run.anchor}
    >
      {run.text}
    </text>
  ))
}

export const PageSvg = memo(function PageSvg({
  settings,
  punchHoleSets,
  logicalPage,
  paperColor,
  showPunchHoles,
  className,
  ariaLabel,
}: {
  settings: Settings
  punchHoleSets: HoleSet[]
  logicalPage: number
  paperColor: string
  showPunchHoles: boolean
  className?: string
  ariaLabel?: string
}) {
  const surface = createPageSurface(settings, logicalPage, punchHoleSets, showPunchHoles)
  const { appearance: pageSettings, metrics, punchHoles } = surface
  const patternId = useId()
  const majorPatternId = useId()
  const slantOverlayId = useId()

  return (
    <svg
      className={className}
      viewBox={`0 0 ${metrics.pageSize.width} ${metrics.pageSize.height}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <rect width={metrics.pageSize.width} height={metrics.pageSize.height} fill={paperColor} />
      <PagePattern
        settings={pageSettings}
        metrics={metrics}
        patternId={patternId}
        majorPatternId={majorPatternId}
        slantOverlayId={slantOverlayId}
      />
      <PageBorder settings={pageSettings} metrics={metrics} />
      {surface.indexLineYs.map((y) => (
        <line
          key={y}
          x1={metrics.pageMargins.left + metrics.contentWidth * 0.58}
          x2={metrics.pageSize.width - metrics.pageMargins.right - 10}
          y1={y}
          y2={y}
          stroke="#908b82"
          strokeWidth="0.25"
          strokeDasharray="1 1.5"
        />
      ))}
      <SudokuGrids boards={surface.sudokuBoards} />
      {punchHoles.length > 0 && (
        <g fill="none" stroke="#30302c" strokeWidth="0.25">
          {punchHoles.map((hole) => (
            <circle
              key={`${hole.x}-${hole.y}`}
              cx={hole.x}
              cy={hole.y}
              r={settings.punchHoleDiameter / 2}
            />
          ))}
        </g>
      )}
      <PageText runs={surface.textRuns} />
    </svg>
  )
})
