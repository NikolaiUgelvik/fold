import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Download,
  Hash,
  Info,
  Minus,
  Plus,
  Trash2,
} from "lucide-react"
import { type ReactNode, useEffect, useId, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TabBar, TabBarTrigger, Tabs, TabsContent } from "@/components/ui/tabs"
import { type CustomPage, parseIndexEntries } from "@/lib/custom-pages"
import { ensureFontLoaded } from "@/lib/font-loading"
import {
  type Binding,
  createImposition,
  getPrintSides,
  type ImpositionSide,
  type PrintPass,
} from "@/lib/imposition"
import { getPageLayout } from "@/lib/page-layout"
import {
  getOuterPageNumberEdge,
  type PageNumberVisibility,
  showsPageNumber,
} from "@/lib/page-numbering"
import {
  formatMillimeters,
  getCenteredPatternBounds,
  getPaperSize,
  type Orientation,
  type PaperId,
  paperSizes,
} from "@/lib/paper"
import {
  type BindingEdge,
  getActivePunchHoleSets,
  getPageBindingEdge,
  getPunchHoles,
  type HoleGroup,
  type HoleSet,
  type PunchHolePlacement,
  showsPunchHoles,
} from "@/lib/punch-holes"
import { tropheeColors } from "@/lib/trophee-colors"

const numberFonts = `Georgia|Georgia, serif
DM Serif Display|"DM Serif Display", serif
Inter|Inter, sans-serif
IBM Plex Mono|"IBM Plex Mono", monospace
Playfair Display|"Playfair Display", serif
Lora|Lora, serif
Merriweather|Merriweather, serif
Libre Baskerville|"Libre Baskerville", serif
Caveat|Caveat, cursive
Dancing Script|"Dancing Script", cursive
Great Vibes|"Great Vibes", cursive
Pinyon Script|"Pinyon Script", cursive
Cinzel Decorative|"Cinzel Decorative", serif`
  .split("\n")
  .map((font) => {
    const [label, value] = font.split("|")
    return { label, value }
  })

type NumberFont = string

type IdentifiedHoleGroup = HoleGroup & { id: string }
type IdentifiedHoleSet = Omit<HoleSet, "groups"> & {
  id: string
  groups: IdentifiedHoleGroup[]
}

interface Settings {
  binding: Binding
  yotsumeOrientation: Orientation
  yotsumeTwoUp: boolean
  punchHolePlacement: PunchHolePlacement
  bindingEdge: BindingEdge
  punchHoleEndInset: number
  punchHoleDiameter: number
  punchHoleSets: IdentifiedHoleSet[]
  paper: PaperId
  previewPaperColor: string
  signatures: number
  sheets: number
  pattern: "dots" | "lines" | "grid" | "graph" | "blank"
  dotSize: number
  dotSpacing: number
  dotMajorEvery: number
  dotMajorSize: number
  dotColor: string
  lineWidth: number
  lineSpacing: number
  lineColor: string
  graphMajorEvery: number
  graphMajorLineWidth: number
  graphMajorColor: string
  graphCompleteBlocks: boolean
  margin: number
  gutterMargin: number
  borderWidth: number
  borderColor: string
  numberVisibility: PageNumberVisibility
  numberPosition: "outer" | "center"
  numberFont: NumberFont
  numberFontSize: number
  numberColor: string
  numberBold: boolean
  numberItalic: boolean
  firstPage: number
  customPages: Record<number, CustomPage>
}

type NumberSettingKey = {
  [Key in keyof Settings]: Settings[Key] extends number ? Key : never
}[keyof Settings]

const initialSettings: Settings = {
  binding: "coptic",
  yotsumeOrientation: "portrait",
  yotsumeTwoUp: false,
  punchHolePlacement: "none",
  bindingEdge: "left",
  punchHoleEndInset: 15,
  punchHoleDiameter: 2,
  punchHoleSets: [
    { id: "initial-set", offset: 12, groups: [{ id: "initial-group", holes: 4, weight: 1 }] },
  ],
  paper: "a4",
  previewPaperColor: "#fffef9",
  signatures: 4,
  sheets: 4,
  pattern: "dots",
  dotSize: 0.35,
  dotSpacing: 5,
  dotMajorEvery: 0,
  dotMajorSize: 0.7,
  dotColor: "#aeb4b6",
  lineWidth: 0.2,
  lineSpacing: 7,
  lineColor: "#aeb9c4",
  graphMajorEvery: 5,
  graphMajorLineWidth: 0.4,
  graphMajorColor: "#8295a8",
  graphCompleteBlocks: false,
  margin: 10,
  gutterMargin: 10,
  borderWidth: 0,
  borderColor: "#c8c3b8",
  numberVisibility: "both",
  numberPosition: "outer",
  numberFont: "Georgia, serif",
  numberFontSize: 9,
  numberColor: "#30302c",
  numberBold: false,
  numberItalic: false,
  firstPage: 1,
  customPages: {},
}

function displayedPage(settings: Settings, logicalPage: number) {
  return settings.firstPage + logicalPage - 1
}

function moveItem<T>(items: T[], from: number, to: number) {
  const moved = [...items]
  moved.splice(to, 0, moved.splice(from, 1)[0])
  return moved
}

function getPunchGuide(settings: Settings, sides: ImpositionSide[]) {
  return {
    settings: {
      ...settings,
      pattern: "blank" as const,
      borderWidth: 0,
      numberVisibility: "none" as const,
      customPages: {},
    },
    pages: sides[0].pages,
  }
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  disabled?: boolean
}) {
  const id = useId()

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const value = event.target.valueAsNumber
          if (Number.isFinite(value))
            onChange(Math.min(max, Math.max(min, step === 1 ? Math.round(value) : value)))
        }}
      />
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="h-9 cursor-pointer p-1"
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function getPatternBasics(settings: Settings) {
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

function getPageMargins(settings: Settings, bindingEdge: BindingEdge) {
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
  if (settings.dotMajorEvery <= 0) return patternBounds
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
  const page = displayedPage(settings, logicalPage)
  const pageSize = getPageLayout(
    settings.paper,
    settings.binding,
    settings.yotsumeOrientation,
    settings.yotsumeTwoUp,
  ).page
  const numberEdge = getOuterPageNumberEdge(page)
  const customPage = settings.customPages[logicalPage]
  const indexEntries =
    customPage?.type === "index"
      ? parseIndexEntries(customPage.entries).slice(0, Math.floor((pageSize.height - 50) / 9))
      : []
  const { spacing, majorSpacing, patternRadius, boundsSpacing } = getPatternBasics(settings)
  const folded = settings.binding !== "yotsume"
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
  const patternBounds =
    settings.pattern === "lines"
      ? { ...centeredPatternBounds, x: pageMargins.left, width: contentWidth }
      : centeredPatternBounds
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
    page,
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
    majorRadius,
    majorBounds,
    borderX,
    borderY,
  }
}

type PageMetrics = ReturnType<typeof getPageMetrics>

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

function getPageNumberAlignment(settings: Settings, metrics: PageMetrics) {
  if (settings.numberPosition === "center")
    return { x: metrics.pageSize.width / 2, anchor: "middle" as const }
  if (metrics.numberEdge === "right")
    return { x: metrics.pageSize.width - 9, anchor: "end" as const }
  return { x: 9, anchor: "start" as const }
}

function PageNumber({
  settings,
  metrics,
  logicalPage,
}: {
  settings: Settings
  metrics: PageMetrics
  logicalPage: number
}) {
  const { page, pageSize, customPage } = metrics
  const { x, anchor } = getPageNumberAlignment(settings, metrics)
  return (
    <>
      {customPage?.type !== "title" && showsPageNumber(settings.numberVisibility, logicalPage) && (
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
          {page}
        </text>
      )}
    </>
  )
}

function PageSvg({
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
  const metrics = getPageMetrics(settings, logicalPage)
  const patternId = useId()
  const majorPatternId = useId()
  const punchHoles = getPunchHoles(
    metrics.pageSize,
    settings.bindingEdge,
    logicalPage,
    settings.punchHoleEndInset,
    punchHoleSets,
    metrics.folded,
  )

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
        settings={settings}
        metrics={metrics}
        patternId={patternId}
        majorPatternId={majorPatternId}
      />
      <PageBorder settings={settings} metrics={metrics} />
      <CustomPageLayer metrics={metrics} />
      {showPunchHoles && (
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
      <PageNumber settings={settings} metrics={metrics} logicalPage={logicalPage} />
    </svg>
  )
}

function PageThumbnail({
  settings,
  punchHoleSets,
  pageSize,
  logicalPage,
  showPunchHoles,
  selected,
  onClick,
}: {
  settings: Settings
  punchHoleSets: HoleSet[]
  pageSize: { width: number; height: number }
  logicalPage: number
  showPunchHoles: boolean
  selected: boolean
  onClick: () => void
}) {
  const page = displayedPage(settings, logicalPage)

  return (
    <button
      type="button"
      className={`h-18 shrink-0 overflow-hidden rounded-sm border focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-ring ring-1 ring-ring" : ""}`}
      style={{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }}
      aria-label={`Page ${page}`}
      onClick={onClick}
    >
      <PageSvg
        settings={settings}
        punchHoleSets={punchHoleSets}
        logicalPage={logicalPage}
        paperColor={settings.previewPaperColor}
        showPunchHoles={showPunchHoles}
        className="block h-full w-full"
      />
    </button>
  )
}

function PrintPage({
  settings,
  punchHoleSets,
  logicalPage,
  showPunchHoles,
}: {
  settings: Settings
  punchHoleSets: HoleSet[]
  logicalPage: number
  showPunchHoles: boolean
}) {
  return (
    <div className="paper-page">
      <PageSvg
        settings={settings}
        punchHoleSets={punchHoleSets}
        logicalPage={logicalPage}
        paperColor="none"
        showPunchHoles={showPunchHoles}
        className="block h-full w-full"
      />
    </div>
  )
}

function PrintDocument({ settings, pass }: { settings: Settings; pass: PrintPass }) {
  const punchHoleSets = getActivePunchHoleSets(
    settings.punchHoleSets,
    settings.binding !== "yotsume",
  )
  const { paper, layout } = getPageLayout(
    settings.paper,
    settings.binding,
    settings.yotsumeOrientation,
    settings.yotsumeTwoUp,
  )
  const allSides = createImposition({
    binding: settings.binding,
    signatures: settings.signatures,
    sheetsPerSignature: settings.sheets,
    twoUp: settings.yotsumeTwoUp,
  })
  const sides = getPrintSides(allSides, pass)
  const punchGuide =
    pass === "guide" || (pass === "all" && settings.punchHolePlacement === "separate")
      ? getPunchGuide(settings, allSides)
      : null

  return (
    <div className="print-root" aria-hidden="true">
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      {sides.map((side) => (
        <section
          className="print-side"
          key={`${side.signature}-${side.sheet}-${side.side}`}
          data-layout={layout}
          data-signature={side.signature}
          data-sheet={side.sheet}
          data-side={side.side}
          style={{ width: `${paper.width}mm`, height: `${paper.height}mm` }}
        >
          {side.pages.map((page) => (
            <PrintPage
              settings={settings}
              punchHoleSets={punchHoleSets}
              logicalPage={page}
              showPunchHoles={showsPunchHoles(settings.punchHolePlacement, side, settings.sheets)}
              key={page}
            />
          ))}
        </section>
      ))}
      {punchGuide && (
        <section
          className="print-side"
          data-layout={layout}
          data-side="punch-guide"
          style={{ width: `${paper.width}mm`, height: `${paper.height}mm` }}
        >
          {punchGuide.pages.map((page) => (
            <PrintPage
              settings={punchGuide.settings}
              punchHoleSets={punchHoleSets}
              logicalPage={page}
              showPunchHoles
              key={page}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-label font-bold uppercase tracking-section text-muted-foreground">
      {children}
    </h2>
  )
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

function NumberFieldPair({ first, second }: { first: ReactNode; second: ReactNode }) {
  return (
    <FieldRow>
      {first}
      {second}
    </FieldRow>
  )
}

function SelectControl({
  value,
  onChange,
  options,
  ariaLabel,
  triggerClassName = "w-full bg-card",
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  options: Record<string, string>
  ariaLabel?: string
  triggerClassName?: string
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(options).map(([optionValue, label]) => (
          <SelectItem value={optionValue} key={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CheckboxField({
  checked,
  onChange,
  title,
  description,
  className = "",
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  description: string
  className?: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-md border bg-card p-3 text-xs text-card-foreground ${className}`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-ring"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong className="block">{title}</strong>
        <span className="mt-0.5 block text-2xs leading-4 text-muted-foreground">{description}</span>
      </span>
    </label>
  )
}

function useSettings(currentPage: number) {
  const [settings, setSettings] = useState(initialSettings)
  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }
  function updateHoleSet(setIndex: number, change: Partial<IdentifiedHoleSet>) {
    update(
      "punchHoleSets",
      settings.punchHoleSets.map((set, index) =>
        index === setIndex ? { ...set, ...change } : set,
      ),
    )
  }
  function updateHoleGroup(
    setIndex: number,
    groupIndex: number,
    key: keyof HoleGroup,
    value: number,
  ) {
    updateHoleSet(setIndex, {
      groups: settings.punchHoleSets[setIndex].groups.map((group, index) =>
        index === groupIndex ? { ...group, [key]: value } : group,
      ),
    })
  }
  function setCustomPage(page: CustomPage | null) {
    setSettings((current) => {
      const customPages = { ...current.customPages }
      if (page) customPages[currentPage] = page
      else delete customPages[currentPage]
      return { ...current, customPages }
    })
  }
  return { settings, setSettings, update, updateHoleSet, updateHoleGroup, setCustomPage }
}

function usePrintDialog(
  printSettings: { settings: Settings; pass: PrintPass } | null,
  setPrintSettings: (value: null) => void,
) {
  useEffect(() => {
    if (!printSettings) return
    const clear = () => setPrintSettings(null)
    const frame = requestAnimationFrame(() => window.print())
    window.addEventListener("afterprint", clear, { once: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("afterprint", clear)
    }
  }, [printSettings, setPrintSettings])
}

function useFontPreload(setFontError: (value: string) => void) {
  useEffect(() => {
    let active = true
    Promise.all(
      numberFonts.map((font) => document.fonts.load(`16px ${font.value}`, `${font.label} 1 2 3`)),
    ).catch(() => {
      if (active) setFontError("Some page-number fonts could not be loaded.")
    })
    return () => {
      active = false
    }
  }, [setFontError])
}

const documentNames: Record<Settings["pattern"], string> = {
  dots: "Dot-grid notebook",
  lines: "Ruled notebook",
  grid: "Square-grid notebook",
  graph: "Graph-paper notebook",
  blank: "Blank notebook",
}

function getDerivedModel(
  settings: Settings,
  sides: ImpositionSide[],
  currentPage: number,
  previewPunchGuide: boolean,
) {
  const totalPages = new Set(sides.flatMap((side) => side.pages)).size
  const signatureCount = new Set(sides.map((side) => side.signature)).size
  const paper = getPaperSize(settings.paper)
  const pageLayout = getPageLayout(
    settings.paper,
    settings.binding,
    settings.yotsumeOrientation,
    settings.yotsumeTwoUp,
  )
  const pageSize = pageLayout.page
  const showPunchGuide = settings.punchHolePlacement === "separate" && previewPunchGuide
  const punchGuide = getPunchGuide(settings, sides)
  const guideSides = settings.punchHolePlacement === "separate" ? 1 : 0
  const pageNameIndex = settings.binding === "yotsume" && !settings.yotsumeTwoUp ? 0 : 1
  const pageName = paper.label.split(" → ")[pageNameIndex]
  const firstSignature = sides.filter((side) => side.signature === 1)
  const visiblePages = Array.from({ length: Math.min(totalPages, 10) }, (_, index) => index + 1)
  const documentName = documentNames[settings.pattern]
  const selectedNumberFont =
    numberFonts.find((font) => font.value === settings.numberFont) ?? numberFonts[0]
  const customPage = settings.customPages[currentPage]
  return {
    totalPages,
    signatureCount,
    paper,
    pageLayout,
    pageSize,
    showPunchGuide,
    punchGuide,
    guideSides,
    pageName,
    firstSignature,
    visiblePages,
    documentName,
    selectedNumberFont,
    customPage,
  }
}

function createPdfExporter(
  settings: Settings,
  printPass: PrintPass,
  selectedNumberFont: (typeof numberFonts)[number],
  setFontError: (value: string | null) => void,
  setPrintSettings: (value: { settings: Settings; pass: PrintPass }) => void,
) {
  return async () => {
    try {
      const font = `${settings.numberItalic ? "italic" : "normal"} ${settings.numberBold ? 700 : 400} 16px ${settings.numberFont}`
      await ensureFontLoaded(document.fonts, font, "1 2 3")
      setFontError(null)
      setPrintSettings({ settings, pass: printPass })
    } catch {
      setFontError(`Could not load ${selectedNumberFont.label}. Export was cancelled.`)
    }
  }
}

function useAppModel() {
  const [currentPage, setCurrentPage] = useState(1)
  const { settings, setSettings, update, updateHoleSet, updateHoleGroup, setCustomPage } =
    useSettings(currentPage)
  const [zoom, setZoom] = useState(100)
  const [printSettings, setPrintSettings] = useState<{
    settings: Settings
    pass: PrintPass
  } | null>(null)
  const [printPass, setPrintPass] = useState<PrintPass>("all")
  const [fontError, setFontError] = useState<string | null>(null)
  const [showPlan, setShowPlan] = useState(false)
  const [previewPunchGuide, setPreviewPunchGuide] = useState(false)
  const punchHoleSets = useMemo(
    () => getActivePunchHoleSets(settings.punchHoleSets, settings.binding !== "yotsume"),
    [settings.binding, settings.punchHoleSets],
  )
  const sides = useMemo(
    () =>
      createImposition({
        binding: settings.binding,
        signatures: settings.signatures,
        sheetsPerSignature: settings.sheets,
        twoUp: settings.yotsumeTwoUp,
      }),
    [settings.binding, settings.signatures, settings.sheets, settings.yotsumeTwoUp],
  )
  const punchHolePages = useMemo(
    () =>
      new Set(
        sides
          .filter((side) => showsPunchHoles(settings.punchHolePlacement, side, settings.sheets))
          .flatMap((side) => side.pages),
      ),
    [settings.punchHolePlacement, settings.sheets, sides],
  )
  const derived = getDerivedModel(settings, sides, currentPage, previewPunchGuide)
  useEffect(
    () => setCurrentPage((page) => Math.min(page, derived.totalPages)),
    [derived.totalPages],
  )
  useFontPreload(setFontError)
  usePrintDialog(printSettings, setPrintSettings)
  const exportPdf = createPdfExporter(
    settings,
    printPass,
    derived.selectedNumberFont,
    setFontError,
    setPrintSettings,
  )
  return {
    settings,
    setSettings,
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    printSettings,
    setPrintSettings,
    printPass,
    setPrintPass,
    fontError,
    setFontError,
    showPlan,
    setShowPlan,
    previewPunchGuide,
    setPreviewPunchGuide,
    punchHoleSets,
    sides,
    punchHolePages,
    ...derived,
    update,
    updateHoleSet,
    updateHoleGroup,
    setCustomPage,
    exportPdf,
  }
}

type AppModel = ReturnType<typeof useAppModel>

function AppHeader({ model }: { model: AppModel }) {
  const { settings, printPass, setPrintPass, fontError, documentName, exportPdf } = model
  return (
    <header className="sticky top-0 z-40 flex h-18 items-center justify-between border-b bg-background px-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-4 sm:gap-5">
        <span
          className="h-8.5 w-7 shrink-0 rounded-book border-2 border-foreground bg-card shadow-book"
          aria-hidden="true"
        />
        <h1 className="font-serif text-display leading-none">Fold</h1>
        <span aria-hidden="true" className="hidden h-7.5 w-px shrink-0 bg-border sm:block" />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold">{documentName}</p>
          <p className="text-label text-muted-foreground">Runs entirely in your browser</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {fontError && (
          <p className="max-w-48 text-right text-caption text-red-700" role="alert">
            {fontError}
          </p>
        )}
        <SelectControl
          value={printPass}
          onChange={(value) => setPrintPass(value as PrintPass)}
          options={{
            all: "All sides",
            fronts: "Fronts only",
            backs: "Backs only",
            "backs-reversed": "Backs reversed",
            ...(settings.punchHolePlacement === "separate" && { guide: "Punch guide only" }),
          }}
          triggerClassName="w-32 bg-card"
          ariaLabel="Print pass"
        />
        <Button
          className="bg-primary px-3 hover:bg-primary-hover"
          aria-label="Export PDF"
          onClick={exportPdf}
        >
          <Download /> <span className="hidden sm:inline">Export PDF</span>
        </Button>
      </div>
    </header>
  )
}

function PaperTab({ model }: { model: AppModel }) {
  const { settings, pageSize, pageName, update } = model
  return (
    <TabsContent value="paper" className="mt-0">
      <section className="border-b p-5">
        <div className="mb-3 flex items-center justify-between">
          <Label>Paper sheet</Label>
          <span className="text-caption text-muted-foreground">{paperSizes.length} presets</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {paperSizes.map((paperSize) => {
            const selected = settings.paper === paperSize.id
            const sheetSize = getPageLayout(
              paperSize.id,
              settings.binding,
              settings.yotsumeOrientation,
              settings.yotsumeTwoUp,
            ).paper
            return (
              <button
                type="button"
                key={paperSize.id}
                className={`rounded-lg border px-2 py-3 text-left transition-colors ${selected ? "border-ring bg-accent ring-1 ring-ring" : "bg-card hover:border-border-strong"}`}
                onClick={() => update("paper", paperSize.id)}
              >
                <strong
                  className={`block text-xs ${selected ? "text-accent-strong" : "text-foreground"}`}
                >
                  {paperSize.id === "tabloid" ? "Tabloid" : paperSize.id.toUpperCase()}
                </strong>
                <span className="mt-1 block text-2xs text-muted-foreground">
                  {formatMillimeters(sheetSize.width)} × {formatMillimeters(sheetSize.height)} mm
                </span>
                <span className="mt-0.5 block text-2xs text-muted-foreground">
                  {settings.binding !== "yotsume"
                    ? `folds to ${paperSize.label.split(" → ")[1]}`
                    : settings.yotsumeTwoUp
                      ? `cuts to ${paperSize.label.split(" → ")[1]}`
                      : `full-size ${paperSize.label.split(" → ")[0]}`}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 rounded-lg bg-muted p-3">
          <p className="text-caption font-bold uppercase tracking-label-tight text-muted-foreground">
            Finished page
          </p>
          <p className="mt-1 text-xs font-semibold">
            {pageName} · {formatMillimeters(pageSize.width)} × {formatMillimeters(pageSize.height)}{" "}
            mm
          </p>
        </div>
      </section>
    </TabsContent>
  )
}

function BindingTab({ model }: { model: AppModel }) {
  const { settings, signatureCount, update } = model
  return (
    <TabsContent value="binding" className="mt-0">
      <section className="border-b p-5">
        <div className="mb-3 flex items-center justify-between">
          <Label>Binding</Label>
          <BookOpen className="size-4 text-ring" />
        </div>
        <SelectControl
          value={settings.binding}
          onChange={(value) => update("binding", value as Binding)}
          options={{
            coptic: "Coptic / multi-signature",
            saddle: "Saddle stitch",
            yotsume: "Japanese stab / yotsume toji",
          }}
        />
        {settings.binding === "yotsume" && (
          <>
            <div className="mt-3 grid gap-1.5">
              <Label>Binding edge</Label>
              <SelectControl
                value={settings.bindingEdge}
                onChange={(value) => update("bindingEdge", value as BindingEdge)}
                options={{ left: "Left", right: "Right" }}
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              <Label>Page orientation</Label>
              <SelectControl
                value={settings.yotsumeOrientation}
                onChange={(value) => update("yotsumeOrientation", value as Orientation)}
                options={{ portrait: "Portrait", landscape: "Landscape" }}
              />
            </div>
            <CheckboxField
              className="mt-3"
              checked={settings.yotsumeTwoUp}
              onChange={(checked) => update("yotsumeTwoUp", checked)}
              title="Two-up, cut in half"
              description="Print two leaves per sheet instead of using the full sheet."
            />
          </>
        )}
        <div
          className={`mt-3 grid gap-2 ${settings.binding === "yotsume" ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {settings.binding !== "yotsume" && (
            <NumberField
              label="Signatures"
              value={signatureCount}
              min={1}
              max={12}
              disabled={settings.binding === "saddle"}
              onChange={(value) => update("signatures", value)}
            />
          )}
          <NumberField
            label={settings.binding === "yotsume" ? "Sheets" : "Sheets each"}
            value={settings.sheets}
            min={1}
            max={12}
            onChange={(value) => update("sheets", value)}
          />
        </div>
        <p className="mt-3 text-caption leading-4 text-muted-foreground">
          {settings.binding === "saddle"
            ? "All sheets nest into one signature. Best for smaller books."
            : settings.binding === "yotsume"
              ? settings.yotsumeTwoUp
                ? "Prints two sequential leaves per sheet. Cut in half, stack in page order, then sew with four-hole stab binding."
                : "Prints one leaf per sheet. Stack in page order, then sew with four-hole stab binding."
              : "Each signature is folded separately, then sewn together."}
        </p>
      </section>
    </TabsContent>
  )
}

function HolesTab({ model }: { model: AppModel }) {
  const {
    settings,
    printPass,
    setPrintPass,
    setPreviewPunchGuide,
    punchHoleSets,
    pageSize,
    update,
    updateHoleSet,
    updateHoleGroup,
  } = model
  return (
    <TabsContent value="holes" className="mt-0">
      <section className="border-b p-5">
        <div className="grid gap-1.5">
          <Label>Punch indicators</Label>
          <SelectControl
            value={settings.punchHolePlacement}
            onChange={(value) => {
              const placement = value as PunchHolePlacement
              update("punchHolePlacement", placement)
              if (placement !== "separate" && printPass === "guide") setPrintPass("all")
              setPreviewPunchGuide(placement === "separate")
            }}
            options={{
              every: "Every page",
              "signature-front": "Each signature · sheet 1 front",
              "signature-back": "Each signature · last sheet back",
              separate: "Separate guide sheet",
              none: "None",
            }}
          />
          <p className="text-2xs leading-4 text-muted-foreground">
            A separate guide is appended after the notebook without changing its pagination.
          </p>
        </div>
        <fieldset
          className={`mt-3 grid gap-3 ${settings.punchHolePlacement === "none" ? "opacity-45" : ""}`}
          disabled={settings.punchHolePlacement === "none"}
        >
          <NumberFieldPair
            first={
              <NumberField
                label="End inset (mm)"
                value={settings.punchHoleEndInset}
                min={5}
                max={Math.max(5, pageSize.height / 2 - 1)}
                step={0.5}
                onChange={(value) => update("punchHoleEndInset", value)}
              />
            }
            second={
              <NumberField
                label="Hole diameter (mm)"
                value={settings.punchHoleDiameter}
                min={0.5}
                max={10}
                step={0.5}
                onChange={(value) => update("punchHoleDiameter", value)}
              />
            }
          />
          <div className="grid gap-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <Label>{settings.binding === "yotsume" ? "Horizontal sets" : "Pattern groups"}</Label>
              <span className="text-2xs text-muted-foreground">
                {punchHoleSets.reduce(
                  (total, set) =>
                    total + set.groups.reduce((setTotal, group) => setTotal + group.holes, 0),
                  0,
                )}{" "}
                holes
              </span>
            </div>
            {punchHoleSets.map((set, setIndex) => (
              <div className="rounded-md border bg-card p-2" key={set.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-label-tight text-muted-foreground">
                    {settings.binding === "yotsume" ? `Set ${setIndex + 1}` : "Center fold"}
                  </span>
                  {settings.binding === "yotsume" && settings.punchHoleSets.length > 1 && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Move hole set ${setIndex + 1} up`}
                        disabled={setIndex === 0}
                        onClick={() =>
                          update(
                            "punchHoleSets",
                            moveItem(settings.punchHoleSets, setIndex, setIndex - 1),
                          )
                        }
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Move hole set ${setIndex + 1} down`}
                        disabled={setIndex === settings.punchHoleSets.length - 1}
                        onClick={() =>
                          update(
                            "punchHoleSets",
                            moveItem(settings.punchHoleSets, setIndex, setIndex + 1),
                          )
                        }
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Remove hole set ${setIndex + 1}`}
                        onClick={() =>
                          update(
                            "punchHoleSets",
                            settings.punchHoleSets.filter((_, index) => index !== setIndex),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                {settings.binding === "yotsume" && (
                  <NumberField
                    label="Edge offset (mm)"
                    value={set.offset}
                    min={2}
                    max={Math.max(2, pageSize.width / 2)}
                    step={0.5}
                    onChange={(value) => updateHoleSet(setIndex, { offset: value })}
                  />
                )}
                <div className="mt-2 grid gap-2 border-t pt-2">
                  {set.groups.map((group, groupIndex) => (
                    <div className="grid grid-cols-2 items-end gap-2" key={group.id}>
                      <NumberField
                        label="Holes"
                        value={group.holes}
                        min={0}
                        max={20}
                        onChange={(value) => updateHoleGroup(setIndex, groupIndex, "holes", value)}
                      />
                      <NumberField
                        label="Weight"
                        value={group.weight}
                        min={1}
                        max={1000}
                        onChange={(value) => updateHoleGroup(setIndex, groupIndex, "weight", value)}
                      />
                      <div className="col-span-2 flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Move group ${groupIndex + 1} up in set ${setIndex + 1}`}
                          disabled={groupIndex === 0}
                          onClick={() =>
                            updateHoleSet(setIndex, {
                              groups: moveItem(set.groups, groupIndex, groupIndex - 1),
                            })
                          }
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Move group ${groupIndex + 1} down in set ${setIndex + 1}`}
                          disabled={groupIndex === set.groups.length - 1}
                          onClick={() =>
                            updateHoleSet(setIndex, {
                              groups: moveItem(set.groups, groupIndex, groupIndex + 1),
                            })
                          }
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Remove group ${groupIndex + 1} from set ${setIndex + 1}`}
                          onClick={() =>
                            updateHoleSet(setIndex, {
                              groups: set.groups.filter((_, index) => index !== groupIndex),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateHoleSet(setIndex, {
                        groups: [...set.groups, { id: crypto.randomUUID(), holes: 1, weight: 1 }],
                      })
                    }
                  >
                    <Plus /> Add group
                  </Button>
                </div>
              </div>
            ))}
            {settings.binding === "yotsume" && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  update("punchHoleSets", [
                    ...settings.punchHoleSets,
                    {
                      id: crypto.randomUUID(),
                      offset: 18,
                      groups: [{ id: crypto.randomUUID(), holes: 1, weight: 1 }],
                    },
                  ])
                }
              >
                <Plus /> Add horizontal set
              </Button>
            )}
          </div>
        </fieldset>
        <p className="mt-3 text-2xs leading-4 text-muted-foreground">
          Weights divide the area between the end insets. Add a zero-hole group as a spacer—for
          example, 3 / 0 / 3 holes.
          {settings.binding === "yotsume"
            ? " Each horizontal set has its own edge offset and groups."
            : " Folded bindings use one set on the center fold."}
        </p>
      </section>
    </TabsContent>
  )
}

function BookSetup({ model }: { model: AppModel }) {
  const { sides, totalPages, guideSides } = model
  return (
    <aside className="border-b bg-background lg:border-r lg:border-b-0 xl:h-full xl:overflow-y-auto">
      <div className="px-5 pt-5 pb-2">
        <h2 className="font-serif text-heading">Book setup</h2>
        <p className="mt-1 text-label leading-4 text-muted-foreground">
          Choose a binding, then tune the construction.
        </p>
      </div>

      <Tabs defaultValue="binding" className="gap-0">
        <TabBar>
          <TabBarTrigger value="binding">BINDING</TabBarTrigger>
          <TabBarTrigger value="paper">PAPER</TabBarTrigger>
          <TabBarTrigger value="holes">HOLES</TabBarTrigger>
        </TabBar>

        <PaperTab model={model} />

        <BindingTab model={model} />

        <HolesTab model={model} />
      </Tabs>

      <div className="grid grid-cols-3 divide-x border-b bg-border" aria-live="polite">
        {[
          [totalPages, "pages"],
          [sides.length / 2 + guideSides, "sheets"],
          [sides.length + guideSides, "sides"],
        ].map(([value, label]) => (
          <div className="bg-background py-3 text-center" key={label}>
            <strong className="block font-serif text-xl font-normal">{value}</strong>
            <span className="text-3xs font-bold uppercase tracking-label text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-5 py-4 text-caption leading-4 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
        <p>Changing paper keeps your page style and recalculates the imposition.</p>
      </div>
    </aside>
  )
}

function PreviewToolbar({ model }: { model: AppModel }) {
  const {
    settings,
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    setPreviewPunchGuide,
    totalPages,
    pageLayout,
    pageSize,
    showPunchGuide,
    pageName,
  } = model
  return (
    <div className="flex h-15 shrink-0 items-center justify-between border-b bg-secondary px-5 text-secondary-foreground">
      <div>
        <p className="text-xs font-semibold">{showPunchGuide ? "Punch guide" : "Live preview"}</p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {showPunchGuide ? "Separate sheet" : pageName} ·{" "}
          {formatMillimeters(showPunchGuide ? pageLayout.paper.width : pageSize.width)} ×{" "}
          {formatMillimeters(showPunchGuide ? pageLayout.paper.height : pageSize.height)} mm
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom === 50}
            onClick={() => setZoom((value) => Math.max(50, value - 10))}
          >
            <Minus />
          </Button>
          <span className="w-10 text-center text-caption text-muted-foreground" aria-live="polite">
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom === 200}
            onClick={() => setZoom((value) => Math.min(200, value + 10))}
          >
            <Plus />
          </Button>
        </div>
        {settings.punchHolePlacement === "separate" && (
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => setPreviewPunchGuide((shown) => !shown)}
          >
            {showPunchGuide ? "View pages" : "View guide"}
          </Button>
        )}
        {!showPunchGuide && (
          <>
            <span className="mr-1 hidden text-label text-muted-foreground sm:inline">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => page - 1)}
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              <ArrowRight />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

const PreviewPage = ({ model }: { model: AppModel }) => {
  const {
    settings,
    currentPage,
    zoom,
    punchHoleSets,
    punchHolePages,
    pageLayout,
    pageSize,
    showPunchGuide,
    punchGuide,
  } = model
  return (
    <div className="flex min-h-135 flex-1 overflow-auto p-4 lg:p-6">
      <div
        className="relative m-auto shrink-0"
        style={{
          aspectRatio: showPunchGuide
            ? `${pageLayout.paper.width} / ${pageLayout.paper.height}`
            : `${pageSize.width} / ${pageSize.height}`,
          height: `min(${zoom * 0.7}vh, ${zoom * 7.4}px)`,
        }}
      >
        {showPunchGuide ? (
          <div
            role="img"
            aria-label="Punch guide preview"
            className={`grid h-full w-full overflow-hidden bg-paper shadow-paper ${pageLayout.layout === "stacked" ? "grid-rows-2 divide-y" : pageLayout.layout === "side-by-side" ? "grid-cols-2 divide-x" : "grid-cols-1"}`}
          >
            {punchGuide.pages.map((page) => (
              <div className="min-h-0 min-w-0 overflow-hidden" key={page}>
                <PageSvg
                  settings={punchGuide.settings}
                  punchHoleSets={punchHoleSets}
                  logicalPage={page}
                  paperColor={settings.previewPaperColor}
                  showPunchHoles
                  className="block h-full w-full"
                />
              </div>
            ))}
          </div>
        ) : (
          <PageSvg
            settings={settings}
            punchHoleSets={punchHoleSets}
            logicalPage={currentPage}
            paperColor={settings.previewPaperColor}
            showPunchHoles={punchHolePages.has(currentPage)}
            className="block h-full w-full shadow-paper"
            ariaLabel="Notebook page preview"
          />
        )}
      </div>
    </div>
  )
}

function PreviewStrip({ model }: { model: AppModel }) {
  const {
    settings,
    currentPage,
    setCurrentPage,
    showPlan,
    setShowPlan,
    punchHoleSets,
    punchHolePages,
    pageSize,
    firstSignature,
    visiblePages,
  } = model
  return (
    <section className="shrink-0 border-t bg-secondary px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-caption font-bold uppercase tracking-label-wide text-muted-foreground">
          {showPlan
            ? settings.binding === "yotsume"
              ? settings.yotsumeTwoUp
                ? "Imposition · cut sheets"
                : "Imposition · full sheets"
              : "Imposition · first signature"
            : "Pages"}
        </h3>
        <button
          type="button"
          className="flex items-center gap-1 text-caption font-semibold text-info"
          onClick={() => setShowPlan((shown) => !shown)}
        >
          {showPlan ? "View pages" : "View imposition plan"}
          <ArrowUpRight className="size-3" />
        </button>
      </div>
      <div className="flex h-19 gap-2 overflow-x-auto px-0.5 py-0.5">
        {showPlan
          ? firstSignature.map((side: ImpositionSide) => (
              <div
                className="min-w-36 rounded border bg-card p-2"
                key={`${side.sheet}-${side.side}`}
              >
                <span className="block text-3xs uppercase tracking-wider text-muted-foreground">
                  Sheet {side.sheet} · {side.side}
                </span>
                <div
                  className={`mt-1 grid border text-center font-serif text-xs ${side.pages.length > 1 ? "grid-cols-2 divide-x" : ""}`}
                >
                  {side.pages.map((page) => (
                    <span className="py-2" key={page}>
                      {displayedPage(settings, page)}
                    </span>
                  ))}
                </div>
              </div>
            ))
          : visiblePages.map((page) => (
              <PageThumbnail
                settings={settings}
                punchHoleSets={punchHoleSets}
                pageSize={pageSize}
                logicalPage={page}
                showPunchHoles={punchHolePages.has(page)}
                selected={currentPage === page}
                onClick={() => setCurrentPage(page)}
                key={page}
              />
            ))}
      </div>
    </section>
  )
}

function Preview({ model }: { model: AppModel }) {
  return (
    <main className="flex min-h-175 min-w-0 flex-col bg-canvas xl:h-full xl:min-h-0">
      <PreviewToolbar model={model} />

      <PreviewPage model={model} />

      <PreviewStrip model={model} />
    </main>
  )
}

function StyleTab({ model }: { model: AppModel }) {
  const { settings, update } = model
  function settingNumberField(
    setting: NumberSettingKey,
    label: string,
    min: number,
    max: number,
    step?: number,
  ) {
    return (
      <NumberField
        label={label}
        value={settings[setting]}
        min={min}
        max={max}
        step={step}
        onChange={(value) => update(setting, value)}
      />
    )
  }
  return (
    <TabsContent value="style" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Preview paper color</SectionTitle>
        <Select
          value={settings.previewPaperColor}
          onValueChange={(value) => update("previewPaperColor", value)}
        >
          <SelectTrigger className="w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="#fffef9">
              <span className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full border"
                  style={{ backgroundColor: "#fffef9" }}
                />
                White (default)
              </span>
            </SelectItem>
            {tropheeColors.map((color) => (
              <SelectItem value={color.hex} key={color.hex}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-2xs leading-4 text-muted-foreground">
          Clairefontaine Trophée screen swatches. Preview only; PDF pages stay white.
        </p>
      </section>

      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Page pattern</SectionTitle>
        <SelectControl
          value={settings.pattern}
          onChange={(value) => update("pattern", value as Settings["pattern"])}
          options={{
            dots: "Dot grid",
            lines: "Ruled lines",
            grid: "Square grid",
            graph: "Graph paper",
            blank: "Blank",
          }}
        />
        {settings.pattern === "dots" && (
          <>
            <NumberFieldPair
              first={settingNumberField("dotSize", "Dot size (mm)", 0.05, 2, 0.05)}
              second={settingNumberField("dotSpacing", "Spacing (mm)", 2, 20, 0.5)}
            />
            <NumberFieldPair
              first={settingNumberField("dotMajorEvery", "Major interval", 0, 20)}
              second={settingNumberField("dotMajorSize", "Major size (mm)", 0.05, 4, 0.05)}
            />
            <p className="text-2xs leading-4 text-muted-foreground">
              Set the interval to 0 to disable major dots.
            </p>
            <ColorField
              label="Dot color"
              value={settings.dotColor}
              onChange={(value) => update("dotColor", value)}
            />
          </>
        )}
        {(settings.pattern === "lines" ||
          settings.pattern === "grid" ||
          settings.pattern === "graph") && (
          <>
            <NumberFieldPair
              first={settingNumberField(
                "lineWidth",
                settings.pattern === "graph" ? "Thin width (mm)" : "Line width (mm)",
                0.05,
                1,
                0.05,
              )}
              second={settingNumberField(
                "lineSpacing",
                settings.pattern === "graph" ? "Cell size (mm)" : "Spacing (mm)",
                3,
                20,
                0.5,
              )}
            />
            <ColorField
              label={settings.pattern === "graph" ? "Thin line color" : "Line color"}
              value={settings.lineColor}
              onChange={(value) => update("lineColor", value)}
            />
          </>
        )}
        {settings.pattern === "graph" && (
          <>
            <NumberFieldPair
              first={settingNumberField("graphMajorEvery", "Cells per block", 2, 20)}
              second={settingNumberField("graphMajorLineWidth", "Thick width (mm)", 0.05, 2, 0.05)}
            />
            <ColorField
              label="Thick line color"
              value={settings.graphMajorColor}
              onChange={(value) => update("graphMajorColor", value)}
            />
            <CheckboxField
              checked={settings.graphCompleteBlocks}
              onChange={(checked) => update("graphCompleteBlocks", checked)}
              title="Complete blocks only"
              description="Remove partial cell groups and center the grid."
            />
          </>
        )}
      </section>
    </TabsContent>
  )
}

function LayoutTab({ model }: { model: AppModel }) {
  const { settings, pageSize, selectedNumberFont, update } = model
  return (
    <TabsContent value="layout" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Margins & border</SectionTitle>
        <NumberFieldPair
          first={
            <NumberField
              label="Margin (mm)"
              value={settings.margin}
              min={0}
              max={30}
              onChange={(value) => update("margin", value)}
            />
          }
          second={
            <NumberField
              label="Gutter (mm)"
              value={settings.gutterMargin}
              min={0}
              max={Math.max(0, pageSize.width - settings.margin * 2 - 10)}
              step={0.5}
              onChange={(value) => update("gutterMargin", value)}
            />
          }
        />
        <p className="text-2xs leading-4 text-muted-foreground">
          The gutter is added to the binding-side margin.
        </p>
        <FieldRow>
          <NumberField
            label="Border (mm)"
            value={settings.borderWidth}
            min={0}
            max={2}
            step={0.1}
            onChange={(value) => update("borderWidth", value)}
          />
          <ColorField
            label="Border color"
            value={settings.borderColor}
            onChange={(value) => update("borderColor", value)}
          />
        </FieldRow>
      </section>

      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Numbering</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label>Pages</Label>
            <SelectControl
              value={settings.numberVisibility}
              onChange={(value) => update("numberVisibility", value as PageNumberVisibility)}
              options={{
                both: "Left & right",
                right: "Right only",
                left: "Left only",
                none: "Hidden",
              }}
              ariaLabel="Numbered pages"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Position</Label>
            <SelectControl
              disabled={settings.numberVisibility === "none"}
              value={settings.numberPosition}
              onChange={(value) => update("numberPosition", value as Settings["numberPosition"])}
              options={{ outer: "Outer corners", center: "Centered" }}
              ariaLabel="Page number position"
            />
          </div>
        </div>
        <fieldset disabled={settings.numberVisibility === "none"} className="grid gap-3">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Font</Label>
              <Select
                value={settings.numberFont}
                onValueChange={(value) => update("numberFont", value as NumberFont)}
              >
                <SelectTrigger className="w-full bg-card" aria-label="Page number font">
                  <SelectValue>
                    <span className="text-base" style={{ fontFamily: selectedNumberFont.value }}>
                      {selectedNumberFont.label} (1 2 3)
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {numberFonts.map((font) => (
                    <SelectItem
                      value={font.value}
                      textValue={`${font.label} (1 2 3)`}
                      key={font.value}
                    >
                      <span className="text-base" style={{ fontFamily: font.value }}>
                        {font.label} (1 2 3)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberField
              label="Size (pt)"
              value={settings.numberFontSize}
              min={4}
              max={72}
              step={0.5}
              onChange={(value) => update("numberFontSize", value)}
            />
          </div>
          <ColorField
            label="Number color"
            value={settings.numberColor}
            onChange={(value) => update("numberColor", value)}
          />
          <div className="grid gap-1.5">
            <Label>Style</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                aria-pressed={settings.numberBold}
                className={settings.numberBold ? "border-ring bg-accent text-accent-strong" : ""}
                onClick={() => update("numberBold", !settings.numberBold)}
              >
                <strong>B</strong> Bold
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={settings.numberItalic}
                className={settings.numberItalic ? "border-ring bg-accent text-accent-strong" : ""}
                onClick={() => update("numberItalic", !settings.numberItalic)}
              >
                <em>I</em> Italic
              </Button>
            </div>
          </div>
          <NumberField
            label="Start at"
            value={settings.firstPage}
            min={1}
            max={9999}
            onChange={(value) => update("firstPage", value)}
          />
        </fieldset>
      </section>
    </TabsContent>
  )
}

function PageTab({ model }: { model: AppModel }) {
  const { settings, currentPage, customPage, setCustomPage } = model
  return (
    <TabsContent value="page" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>{`Page ${displayedPage(settings, currentPage)}`}</SectionTitle>
        <div className="grid gap-1.5">
          <Label>Template</Label>
          <Select
            value={customPage?.type ?? "default"}
            onValueChange={(value) => {
              if (value === "title") setCustomPage({ type: "title", title: "", subtitle: "" })
              else if (value === "index")
                setCustomPage({ type: "index", title: "Index", entries: "" })
              else setCustomPage(null)
            }}
          >
            <SelectTrigger className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default page</SelectItem>
              <SelectItem value="title">Title page</SelectItem>
              <SelectItem value="index">Index page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {customPage?.type === "title" && (
          <>
            <div className="grid gap-1.5">
              <Label>Title</Label>
              <Input
                value={customPage.title}
                maxLength={40}
                placeholder="My Notebook"
                onChange={(event) => setCustomPage({ ...customPage, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Subtitle</Label>
              <Input
                value={customPage.subtitle}
                maxLength={60}
                placeholder="Name or date"
                onChange={(event) => setCustomPage({ ...customPage, subtitle: event.target.value })}
              />
            </div>
          </>
        )}
        {customPage?.type === "index" && (
          <>
            <div className="grid gap-1.5">
              <Label>Heading</Label>
              <Input
                value={customPage.title}
                maxLength={40}
                onChange={(event) => setCustomPage({ ...customPage, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Entries</Label>
              <textarea
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full resize-y rounded-md border bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3"
                value={customPage.entries}
                placeholder={"Projects | 4\nNotes | 12"}
                onChange={(event) => setCustomPage({ ...customPage, entries: event.target.value })}
              />
              <p className="text-2xs leading-4 text-muted-foreground">
                Use one entry per line. Put a | before its page number.
              </p>
            </div>
          </>
        )}
        <p className="text-2xs leading-4 text-muted-foreground">
          A custom template replaces the pattern and border on this page. Title pages also hide the
          page number.
        </p>
      </section>
    </TabsContent>
  )
}

function getPrintInstructions(settings: Settings, printPass: PrintPass) {
  if (printPass === "all") {
    const edge =
      settings.binding === "yotsume" &&
      !settings.yotsumeTwoUp &&
      settings.yotsumeOrientation === "portrait"
        ? "long"
        : "short"
    return (
      <>
        In the print dialog, choose Save as PDF, actual size, double-sided, and flip on the {edge}{" "}
        edge.
      </>
    )
  }
  if (printPass === "fronts")
    return "Print at actual size, then reload the stack without reordering it and export the backs."
  if (printPass === "guide") return "Print the separate punch guide at actual size."
  return "Use reversed backs when the last front sheet is on top of the printed stack. Use same-order backs when the first is on top."
}

function needsSeparateGuideNote(printPass: PrintPass) {
  return printPass === "fronts" || printPass === "backs" || printPass === "backs-reversed"
}

function PrintInstructions({ model }: { model: AppModel }) {
  const { settings, printPass, exportPdf } = model
  return (
    <div className="p-4.5">
      <Button className="w-full bg-primary hover:bg-primary-hover xl:hidden" onClick={exportPdf}>
        <Download /> Export PDF
      </Button>
      <p className="mt-3 text-caption leading-4 text-muted-foreground">
        {getPrintInstructions(settings, printPass)}
        {needsSeparateGuideNote(printPass) &&
          settings.punchHolePlacement === "separate" &&
          " Export the punch guide separately when needed."}
      </p>
    </div>
  )
}

function Properties({ model }: { model: AppModel }) {
  return (
    <aside className="border-t bg-background lg:col-span-2 xl:col-span-1 xl:h-full xl:overflow-y-auto xl:border-t-0 xl:border-l">
      <div className="px-4.5 pt-4.5 pb-2">
        <h2 className="font-serif text-heading">Properties</h2>
      </div>

      <Tabs defaultValue="style" className="gap-0">
        <TabBar className="px-4.5">
          <TabBarTrigger value="style">STYLE</TabBarTrigger>
          <TabBarTrigger value="layout">LAYOUT</TabBarTrigger>
          <TabBarTrigger value="page">PAGE</TabBarTrigger>
        </TabBar>

        <div className="flex items-center gap-3 border-b bg-muted px-4.5 py-3.5">
          <span className="grid size-8.5 place-items-center rounded-md border bg-background">
            <Hash className="size-4 text-ring" />
          </span>
          <div>
            <p className="text-xs font-semibold">Page style</p>
            <p className="text-2xs text-muted-foreground">Pattern · margins · numbering</p>
          </div>
        </div>

        <StyleTab model={model} />

        <LayoutTab model={model} />

        <PageTab model={model} />
      </Tabs>

      <PrintInstructions model={model} />
    </aside>
  )
}

function App() {
  const model = useAppModel()
  return (
    <>
      <div className="screen-app min-h-svh bg-canvas">
        <AppHeader model={model} />
        <div className="app-grid grid">
          <BookSetup model={model} />
          <Preview model={model} />
          <Properties model={model} />
        </div>
      </div>
      {model.printSettings && (
        <PrintDocument settings={model.printSettings.settings} pass={model.printSettings.pass} />
      )}
    </>
  )
}

export default App
