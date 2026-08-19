import { useId } from "react"

import { createPageSurface, getPageNumberAlignment, type PageMetrics } from "@/lib/page-surface"
import type { HoleSet } from "@/lib/punch-holes"
import type { ResolvedPageAppearance, Settings } from "@/lib/settings"

function BasePattern({
  settings,
  metrics,
  patternId,
}: {
  settings: Settings
  metrics: PageMetrics
  patternId: string
}) {
  const { pageSize, spacing, pageMargins, patternStartX, patternStartY } = metrics
  return (
    <pattern
      id={patternId}
      patternUnits="userSpaceOnUse"
      x={settings.pattern === "lines" ? pageMargins.left : patternStartX - spacing / 2}
      y={patternStartY - spacing / 2}
      width={settings.pattern === "lines" ? pageSize.width : spacing}
      height={spacing}
    >
      {settings.pattern === "dots" ? (
        <circle
          cx={spacing / 2}
          cy={spacing / 2}
          r={settings.dotSize / 2}
          fill={settings.dotColor}
        />
      ) : (
        <>
          <line
            x2={
              settings.pattern === "grid" || settings.pattern === "graph" ? spacing : pageSize.width
            }
            y1={spacing / 2}
            y2={spacing / 2}
            stroke={settings.lineColor}
            strokeWidth={settings.lineWidth}
          />
          {(settings.pattern === "grid" || settings.pattern === "graph") && (
            <line
              x1={spacing / 2}
              x2={spacing / 2}
              y2={spacing}
              stroke={settings.lineColor}
              strokeWidth={settings.lineWidth}
            />
          )}
        </>
      )}
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

function PagePattern({
  settings,
  metrics,
  patternId,
  majorPatternId,
}: {
  settings: Settings
  metrics: PageMetrics
  patternId: string
  majorPatternId: string
}) {
  const { customPage, patternBounds, majorBounds } = metrics
  return (
    <>
      {!customPage && settings.pattern !== "blank" && (
        <>
          <defs>
            <BasePattern settings={settings} metrics={metrics} patternId={patternId} />
            <MajorPatterns settings={settings} metrics={metrics} majorPatternId={majorPatternId} />
          </defs>
          <rect {...patternBounds} fill={`url(#${patternId})`} />
          {settings.pattern === "dots" && settings.dotMajorEvery > 0 && (
            <rect {...majorBounds} fill={`url(#${majorPatternId})`} />
          )}
          {settings.pattern === "graph" && (
            <rect {...patternBounds} fill={`url(#${majorPatternId})`} />
          )}
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

function CustomPageLayer({ metrics }: { metrics: PageMetrics }) {
  const { pageSize, customPage, indexEntries, pageMargins, contentWidth, contentCenterX } = metrics
  return (
    <>
      {customPage?.type === "title" && (
        <g fill="#30302c" fontFamily="Georgia, serif" textAnchor="middle">
          <text
            x={contentCenterX}
            y={pageSize.height * 0.44}
            fontSize={customPage.title.length > 24 ? 6 : 9}
            fontWeight="bold"
          >
            {customPage.title}
          </text>
          <text x={contentCenterX} y={pageSize.height * 0.52} fontSize="4">
            {customPage.subtitle}
          </text>
        </g>
      )}
      {customPage?.type === "index" && (
        <g fill="#30302c" fontFamily="Georgia, serif">
          <text x={pageMargins.left} y="22" fontSize="7" fontWeight="bold">
            {customPage.title}
          </text>
          {indexEntries.map((entry, index) => {
            const y = 38 + index * 9
            return (
              <g key={`${entry.label}-${entry.page}`}>
                <text x={pageMargins.left} y={y} fontSize="3.8">
                  {entry.label}
                </text>
                {entry.page && (
                  <>
                    <line
                      x1={pageMargins.left + contentWidth * 0.58}
                      x2={pageSize.width - pageMargins.right - 10}
                      y1={y - 1}
                      y2={y - 1}
                      stroke="#908b82"
                      strokeWidth="0.25"
                      strokeDasharray="1 1.5"
                    />
                    <text
                      x={pageSize.width - pageMargins.right}
                      y={y}
                      fontSize="3.8"
                      textAnchor="end"
                    >
                      {entry.page}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </g>
      )}
    </>
  )
}

function PageNumber({
  settings,
  metrics,
}: {
  settings: Settings & Pick<ResolvedPageAppearance, "numberVisible" | "pageNumberText">
  metrics: PageMetrics
}) {
  const { pageSize } = metrics
  const { x, anchor } = getPageNumberAlignment(settings, metrics)
  return (
    <>
      {settings.numberVisible && (
        <text
          x={x}
          y={pageSize.height - 7}
          fill={settings.numberColor}
          fontFamily={settings.numberFont}
          fontSize={(settings.numberFontSize * 25.4) / 72}
          fontStyle={settings.numberItalic ? "italic" : "normal"}
          fontWeight={settings.numberBold ? 700 : 400}
          textAnchor={anchor}
        >
          {settings.pageNumberText}
        </text>
      )}
    </>
  )
}

export function PageSvg({
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
      />
      <PageBorder settings={pageSettings} metrics={metrics} />
      <CustomPageLayer metrics={metrics} />
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
      <PageNumber settings={pageSettings} metrics={metrics} />
    </svg>
  )
}
