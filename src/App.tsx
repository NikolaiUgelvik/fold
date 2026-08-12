import { useEffect, useId, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Download, Hash, Info, Minus, Plus, Trash2 } from "lucide-react"

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
import { parseIndexEntries, type CustomPage } from "@/lib/custom-pages"
import { ensureFontLoaded } from "@/lib/font-loading"
import { createImposition, type Binding, type ImpositionSide } from "@/lib/imposition"
import { getPageLayout } from "@/lib/page-layout"
import { getOuterPageNumberEdge, showsPageNumber, type PageNumberVisibility } from "@/lib/page-numbering"
import { formatMillimeters, getCenteredPatternBounds, getPaperSize, paperSizes, type Orientation, type PaperId } from "@/lib/paper"
import { getActivePunchHoleSets, getPageBindingEdge, getPunchHoles, type BindingEdge, type HoleGroup, type HoleSet } from "@/lib/punch-holes"
import { tropheeColors } from "@/lib/trophee-colors"

const numberFonts = [
  { label: "Georgia", value: "Georgia, serif" },
  { label: "DM Serif Display", value: '"DM Serif Display", serif' },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "IBM Plex Mono", value: '"IBM Plex Mono", monospace' },
  { label: "Playfair Display", value: '"Playfair Display", serif' },
  { label: "Lora", value: "Lora, serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Libre Baskerville", value: '"Libre Baskerville", serif' },
  { label: "Caveat", value: "Caveat, cursive" },
  { label: "Dancing Script", value: '"Dancing Script", cursive' },
  { label: "Great Vibes", value: '"Great Vibes", cursive' },
  { label: "Pinyon Script", value: '"Pinyon Script", cursive' },
  { label: "Cinzel Decorative", value: '"Cinzel Decorative", serif' },
] as const

type NumberFont = (typeof numberFonts)[number]["value"]

interface Settings {
  binding: Binding
  yotsumeOrientation: Orientation
  yotsumeTwoUp: boolean
  punchHoleIndicators: boolean
  bindingEdge: BindingEdge
  punchHoleEndInset: number
  punchHoleDiameter: number
  punchHoleSets: HoleSet[]
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

const initialSettings: Settings = {
  binding: "coptic",
  yotsumeOrientation: "portrait",
  yotsumeTwoUp: false,
  punchHoleIndicators: false,
  bindingEdge: "left",
  punchHoleEndInset: 15,
  punchHoleDiameter: 2,
  punchHoleSets: [{ offset: 12, groups: [{ holes: 4, weight: 1 }] }],
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
          if (Number.isFinite(value)) onChange(Math.min(max, Math.max(min, step === 1 ? Math.round(value) : value)))
        }}
      />
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId()

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="h-9 cursor-pointer p-1" type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function PageSvg({
  settings,
  punchHoleSets,
  logicalPage,
  paperColor,
  className,
  ariaLabel,
}: {
  settings: Settings
  punchHoleSets: HoleSet[]
  logicalPage: number
  paperColor: string
  className?: string
  ariaLabel?: string
}) {
  const page = displayedPage(settings, logicalPage)
  const pageSize = getPageLayout(settings.paper, settings.binding, settings.yotsumeOrientation, settings.yotsumeTwoUp).page
  const numberEdge = getOuterPageNumberEdge(page)
  const customPage = settings.customPages[logicalPage]
  const indexEntries = customPage?.type === "index"
    ? parseIndexEntries(customPage.entries).slice(0, Math.floor((pageSize.height - 50) / 9))
    : []
  const spacing = settings.pattern === "dots" ? settings.dotSpacing : settings.lineSpacing
  const patternId = useId()
  const majorPatternId = useId()
  const majorSpacing = spacing * (settings.pattern === "graph" ? settings.graphMajorEvery : settings.dotMajorEvery)
  const patternRadius = settings.pattern === "dots"
    ? settings.dotSize / 2
    : Math.max(settings.lineWidth, settings.pattern === "graph" ? settings.graphMajorLineWidth : 0) / 2
  const boundsSpacing = settings.pattern === "graph" && settings.graphCompleteBlocks ? majorSpacing : spacing
  const folded = settings.binding !== "yotsume"
  const bindingEdge = getPageBindingEdge(settings.bindingEdge, logicalPage, folded)
  const pageMargins = {
    top: settings.margin,
    right: settings.margin + (bindingEdge === "right" ? settings.gutterMargin : 0),
    bottom: settings.margin,
    left: settings.margin + (bindingEdge === "left" ? settings.gutterMargin : 0),
  }
  const contentWidth = Math.max(0, pageSize.width - pageMargins.left - pageMargins.right)
  const contentCenterX = pageMargins.left + contentWidth / 2
  const centeredPatternBounds = getCenteredPatternBounds(pageSize, pageMargins, boundsSpacing, patternRadius)
  const patternStartX = centeredPatternBounds.x + patternRadius
  const patternStartY = centeredPatternBounds.y + patternRadius
  const patternBounds = settings.pattern === "lines"
    ? { ...centeredPatternBounds, x: pageMargins.left, width: contentWidth }
    : centeredPatternBounds
  const majorRadius = settings.dotMajorSize / 2
  const majorBounds = settings.dotMajorEvery > 0
    ? {
        x: patternStartX - majorRadius,
        y: patternStartY - majorRadius,
        width: Math.floor((centeredPatternBounds.width - patternRadius * 2) / majorSpacing) * majorSpacing + majorRadius * 2,
        height: Math.floor((centeredPatternBounds.height - patternRadius * 2) / majorSpacing) * majorSpacing + majorRadius * 2,
      }
    : patternBounds
  const borderX = pageMargins.left + settings.borderWidth / 2
  const borderY = pageMargins.top + settings.borderWidth / 2
  const punchHoles = getPunchHoles(
    pageSize,
    settings.bindingEdge,
    logicalPage,
    settings.punchHoleEndInset,
    punchHoleSets,
    folded,
  )

  return (
    <svg
      className={className}
      viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <rect width={pageSize.width} height={pageSize.height} fill={paperColor} />
      {!customPage && settings.pattern !== "blank" && (
        <>
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              x={settings.pattern === "lines" ? pageMargins.left : patternStartX - spacing / 2}
              y={patternStartY - spacing / 2}
              width={settings.pattern === "lines" ? pageSize.width : spacing}
              height={spacing}
            >
              {settings.pattern === "dots" ? (
                <circle cx={spacing / 2} cy={spacing / 2} r={settings.dotSize / 2} fill={settings.dotColor} />
              ) : (
                <>
                  <line
                    x2={settings.pattern === "grid" || settings.pattern === "graph" ? spacing : pageSize.width}
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
            {settings.pattern === "dots" && settings.dotMajorEvery > 0 && (
              <pattern
                id={majorPatternId}
                patternUnits="userSpaceOnUse"
                x={patternStartX - majorSpacing / 2}
                y={patternStartY - majorSpacing / 2}
                width={majorSpacing}
                height={majorSpacing}
              >
                <circle cx={majorSpacing / 2} cy={majorSpacing / 2} r={settings.dotMajorSize / 2} fill={settings.dotColor} />
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
          </defs>
          <rect {...patternBounds} fill={`url(#${patternId})`} />
          {settings.pattern === "dots" && settings.dotMajorEvery > 0 && (
            <rect {...majorBounds} fill={`url(#${majorPatternId})`} />
          )}
          {settings.pattern === "graph" && <rect {...patternBounds} fill={`url(#${majorPatternId})`} />}
        </>
      )}
      {!customPage && settings.borderWidth > 0 && (
        <rect
          x={borderX}
          y={borderY}
          width={Math.max(0, contentWidth - settings.borderWidth)}
          height={Math.max(0, pageSize.height - pageMargins.top - pageMargins.bottom - settings.borderWidth)}
          fill="none"
          stroke={settings.borderColor}
          strokeWidth={settings.borderWidth}
        />
      )}
      {customPage?.type === "title" && (
        <g fill="#30302c" fontFamily="Georgia, serif" textAnchor="middle">
          <text x={contentCenterX} y={pageSize.height * 0.44} fontSize={customPage.title.length > 24 ? 6 : 9} fontWeight="bold">
            {customPage.title}
          </text>
          <text x={contentCenterX} y={pageSize.height * 0.52} fontSize="4">
            {customPage.subtitle}
          </text>
        </g>
      )}
      {customPage?.type === "index" && (
        <g fill="#30302c" fontFamily="Georgia, serif">
          <text x={pageMargins.left} y="22" fontSize="7" fontWeight="bold">{customPage.title}</text>
          {indexEntries.map((entry, index) => {
            const y = 38 + index * 9
            return (
              <g key={`${entry.label}-${index}`}>
                <text x={pageMargins.left} y={y} fontSize="3.8">{entry.label}</text>
                {entry.page && (
                  <>
                    <line x1={pageMargins.left + contentWidth * 0.58} x2={pageSize.width - pageMargins.right - 10} y1={y - 1} y2={y - 1} stroke="#908b82" strokeWidth="0.25" strokeDasharray="1 1.5" />
                    <text x={pageSize.width - pageMargins.right} y={y} fontSize="3.8" textAnchor="end">{entry.page}</text>
                  </>
                )}
              </g>
            )
          })}
        </g>
      )}
      {settings.punchHoleIndicators && (
        <g fill="none" stroke="#30302c" strokeWidth="0.25">
          {punchHoles.map((hole, index) => (
            <circle key={index} cx={hole.x} cy={hole.y} r={settings.punchHoleDiameter / 2} />
          ))}
        </g>
      )}
      {customPage?.type !== "title" && showsPageNumber(settings.numberVisibility, logicalPage) && (
        <text
          x={settings.numberPosition === "center" ? pageSize.width / 2 : numberEdge === "right" ? pageSize.width - 9 : 9}
          y={pageSize.height - 7}
          fill={settings.numberColor}
          fontFamily={settings.numberFont}
          fontSize={settings.numberFontSize * 25.4 / 72}
          fontStyle={settings.numberItalic ? "italic" : "normal"}
          fontWeight={settings.numberBold ? 700 : 400}
          textAnchor={settings.numberPosition === "center" ? "middle" : numberEdge === "right" ? "end" : "start"}
        >
          {page}
        </text>
      )}
    </svg>
  )
}

function PageThumbnail({
  settings,
  punchHoleSets,
  pageSize,
  logicalPage,
  selected,
  onClick,
}: {
  settings: Settings
  punchHoleSets: HoleSet[]
  pageSize: { width: number; height: number }
  logicalPage: number
  selected: boolean
  onClick: () => void
}) {
  const page = displayedPage(settings, logicalPage)

  return (
    <button
      type="button"
      className={`h-[72px] shrink-0 overflow-hidden rounded-sm border focus-visible:outline-2 focus-visible:outline-[#c9823b] ${selected ? "border-[#c9823b] ring-1 ring-[#c9823b]" : ""}`}
      style={{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }}
      aria-label={`Page ${page}`}
      onClick={onClick}
    >
      <PageSvg
        settings={settings}
        punchHoleSets={punchHoleSets}
        logicalPage={logicalPage}
        paperColor={settings.previewPaperColor}
        className="block h-full w-full"
      />
    </button>
  )
}

function PrintPage({ settings, punchHoleSets, logicalPage }: { settings: Settings; punchHoleSets: HoleSet[]; logicalPage: number }) {
  return (
    <div className="paper-page">
      <PageSvg settings={settings} punchHoleSets={punchHoleSets} logicalPage={logicalPage} paperColor="none" className="block h-full w-full" />
    </div>
  )
}

function PrintDocument({ settings }: { settings: Settings }) {
  const punchHoleSets = getActivePunchHoleSets(settings.punchHoleSets, settings.binding !== "yotsume")
  const { paper, layout } = getPageLayout(settings.paper, settings.binding, settings.yotsumeOrientation, settings.yotsumeTwoUp)
  const sides = createImposition({
    binding: settings.binding,
    signatures: settings.signatures,
    sheetsPerSignature: settings.sheets,
    twoUp: settings.yotsumeTwoUp,
  })

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
          {side.pages.map((page) => <PrintPage settings={settings} punchHoleSets={punchHoleSets} logicalPage={page} key={page} />)}
        </section>
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{children}</h2>
}

function App() {
  const [settings, setSettings] = useState(initialSettings)
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [printSettings, setPrintSettings] = useState<Settings | null>(null)
  const [fontError, setFontError] = useState<string | null>(null)
  const [showPlan, setShowPlan] = useState(false)

  const punchHoleSets = useMemo(
    () => getActivePunchHoleSets(settings.punchHoleSets, settings.binding !== "yotsume"),
    [settings.binding, settings.punchHoleSets],
  )
  const sides = useMemo(
    () => createImposition({
      binding: settings.binding,
      signatures: settings.signatures,
      sheetsPerSignature: settings.sheets,
      twoUp: settings.yotsumeTwoUp,
    }),
    [settings.binding, settings.signatures, settings.sheets, settings.yotsumeTwoUp],
  )
  const totalPages = new Set(sides.flatMap((side) => side.pages)).size
  const signatureCount = new Set(sides.map((side) => side.signature)).size
  const paper = getPaperSize(settings.paper)
  const pageSize = getPageLayout(settings.paper, settings.binding, settings.yotsumeOrientation, settings.yotsumeTwoUp).page
  const pageName = paper.label.split(" → ")[settings.binding === "yotsume" && !settings.yotsumeTwoUp ? 0 : 1]
  const firstSignature = sides.filter((side) => side.signature === 1)
  const visiblePages = Array.from({ length: Math.min(totalPages, 10) }, (_, index) => index + 1)
  const documentName = settings.pattern === "dots"
    ? "Dot-grid notebook"
    : settings.pattern === "lines"
      ? "Ruled notebook"
      : settings.pattern === "grid"
        ? "Square-grid notebook"
        : settings.pattern === "graph"
          ? "Graph-paper notebook"
          : "Blank notebook"
  const selectedNumberFont = numberFonts.find((font) => font.value === settings.numberFont) ?? numberFonts[0]
  const customPage = settings.customPages[currentPage]

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function updateHoleSet(setIndex: number, change: Partial<HoleSet>) {
    update("punchHoleSets", settings.punchHoleSets.map((set, index) => index === setIndex ? { ...set, ...change } : set))
  }

  function updateHoleGroup(setIndex: number, groupIndex: number, key: keyof HoleGroup, value: number) {
    updateHoleSet(setIndex, {
      groups: settings.punchHoleSets[setIndex].groups.map((group, index) => (
        index === groupIndex ? { ...group, [key]: value } : group
      )),
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

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  useEffect(() => {
    let active = true
    Promise.all(numberFonts.map((font) => document.fonts.load(`16px ${font.value}`, `${font.label} 1 2 3`)))
      .catch(() => {
        if (active) setFontError("Some page-number fonts could not be loaded.")
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!printSettings) return
    const clear = () => setPrintSettings(null)
    const frame = requestAnimationFrame(() => window.print())
    window.addEventListener("afterprint", clear, { once: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("afterprint", clear)
    }
  }, [printSettings])

  async function exportPdf() {
    try {
      const font = `${settings.numberItalic ? "italic" : "normal"} ${settings.numberBold ? 700 : 400} 16px ${settings.numberFont}`
      await ensureFontLoaded(document.fonts, font, "1 2 3")
      setFontError(null)
      setPrintSettings(settings)
    } catch {
      setFontError(`Could not load ${selectedNumberFont.label}. Export was cancelled.`)
    }
  }

  return (
    <>
      <div className="screen-app min-h-svh bg-[#edeae1]">
        <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b bg-[#fbfaf6] px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span className="h-[34px] w-7 shrink-0 rounded-[2px_8px_8px_2px] border-2 border-foreground bg-[#fffdf7] shadow-[inset_5px_0_#e7c895]" aria-hidden="true" />
            <h1 className="font-serif text-[28px] leading-none">Fold</h1>
            <span aria-hidden="true" className="hidden h-[30px] w-px shrink-0 bg-border sm:block" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold">{documentName}</p>
              <p className="text-[11px] text-muted-foreground">Runs entirely in your browser</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {fontError && <p className="max-w-48 text-right text-[10px] text-red-700" role="alert">{fontError}</p>}
            <Button className="bg-[#25231f] px-4 hover:bg-[#3c3933]" onClick={exportPdf}>
              <Download /> Export PDF
            </Button>
          </div>
        </header>

        <div className="grid xl:h-[calc(100svh-72px)] lg:grid-cols-[292px_minmax(0,1fr)] xl:grid-cols-[292px_minmax(440px,1fr)_312px]">
          <aside className="border-b bg-[#fbfaf6] lg:border-r lg:border-b-0 xl:h-full xl:overflow-y-auto">
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-serif text-[22px]">Book setup</h2>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Choose a binding, then tune the construction.</p>
            </div>

            <Tabs defaultValue="binding" className="gap-0">
              <TabBar>
                <TabBarTrigger value="binding">BINDING</TabBarTrigger>
                <TabBarTrigger value="paper">PAPER</TabBarTrigger>
                <TabBarTrigger value="holes">HOLES</TabBarTrigger>
              </TabBar>

              <TabsContent value="paper" className="mt-0">
                <section className="border-b p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Label>Paper sheet</Label>
                    <span className="text-[10px] text-muted-foreground">{paperSizes.length} presets</span>
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
                          className={`rounded-lg border px-2 py-3 text-left transition-colors ${selected ? "border-[#c9823b] bg-[#f3e4d1] ring-1 ring-[#c9823b]" : "bg-[#fffdf7] hover:border-[#aaa398]"}`}
                          onClick={() => update("paper", paperSize.id)}
                        >
                          <strong className={`block text-xs ${selected ? "text-[#a96528]" : "text-foreground"}`}>{paperSize.id === "tabloid" ? "Tabloid" : paperSize.id.toUpperCase()}</strong>
                          <span className="mt-1 block text-[9px] text-muted-foreground">{formatMillimeters(sheetSize.width)} × {formatMillimeters(sheetSize.height)} mm</span>
                          <span className="mt-0.5 block text-[9px] text-muted-foreground">
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
                  <div className="mt-4 rounded-lg bg-[#f5f2ea] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Finished page</p>
                    <p className="mt-1 text-xs font-semibold">{pageName} · {formatMillimeters(pageSize.width)} × {formatMillimeters(pageSize.height)} mm</p>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="binding" className="mt-0">
                <section className="border-b p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Label>Binding</Label>
                    <BookOpen className="size-4 text-[#c9823b]" />
                  </div>
                  <Select value={settings.binding} onValueChange={(value) => update("binding", value as Binding)}>
                    <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coptic">Coptic / multi-signature</SelectItem>
                      <SelectItem value="saddle">Saddle stitch</SelectItem>
                      <SelectItem value="yotsume">Japanese stab / yotsume toji</SelectItem>
                    </SelectContent>
                  </Select>
                  {settings.binding === "yotsume" && (
                    <>
                      <div className="mt-3 grid gap-1.5">
                        <Label>Binding edge</Label>
                        <Select value={settings.bindingEdge} onValueChange={(value) => update("bindingEdge", value as BindingEdge)}>
                          <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-3 grid gap-1.5">
                        <Label>Page orientation</Label>
                        <Select value={settings.yotsumeOrientation} onValueChange={(value) => update("yotsumeOrientation", value as Orientation)}>
                          <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">Portrait</SelectItem>
                            <SelectItem value="landscape">Landscape</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border bg-[#fffdf7] p-3 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[#c9823b]"
                          checked={settings.yotsumeTwoUp}
                          onChange={(event) => update("yotsumeTwoUp", event.target.checked)}
                        />
                        <span>
                          <strong className="block">Two-up, cut in half</strong>
                          <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">Print two leaves per sheet instead of using the full sheet.</span>
                        </span>
                      </label>
                    </>
                  )}
                  <div className={`mt-3 grid gap-2 ${settings.binding === "yotsume" ? "grid-cols-1" : "grid-cols-2"}`}>
                    {settings.binding !== "yotsume" && (
                      <NumberField label="Signatures" value={signatureCount} min={1} max={12} disabled={settings.binding === "saddle"} onChange={(value) => update("signatures", value)} />
                    )}
                    <NumberField label={settings.binding === "yotsume" ? "Sheets" : "Sheets each"} value={settings.sheets} min={1} max={12} onChange={(value) => update("sheets", value)} />
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
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

              <TabsContent value="holes" className="mt-0">
                <section className="border-b p-5">
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-[#fffdf7] p-3 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-[#c9823b]"
                      checked={settings.punchHoleIndicators}
                      onChange={(event) => update("punchHoleIndicators", event.target.checked)}
                    />
                    <span>
                      <strong className="block">Print punch indicators</strong>
                      <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">Add a custom punch pattern to every page.</span>
                    </span>
                  </label>
                  <fieldset className={`mt-3 grid gap-3 ${settings.punchHoleIndicators ? "" : "opacity-45"}`} disabled={!settings.punchHoleIndicators}>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberField label="End inset (mm)" value={settings.punchHoleEndInset} min={5} max={Math.max(5, pageSize.height / 2 - 1)} step={0.5} onChange={(value) => update("punchHoleEndInset", value)} />
                      <NumberField label="Hole diameter (mm)" value={settings.punchHoleDiameter} min={0.5} max={10} step={0.5} onChange={(value) => update("punchHoleDiameter", value)} />
                    </div>
                    <div className="grid gap-3 border-t pt-3">
                      <div className="flex items-center justify-between">
                        <Label>{settings.binding === "yotsume" ? "Horizontal sets" : "Pattern groups"}</Label>
                        <span className="text-[9px] text-muted-foreground">{punchHoleSets.reduce((total, set) => total + set.groups.reduce((setTotal, group) => setTotal + group.holes, 0), 0)} holes</span>
                      </div>
                      {punchHoleSets.map((set, setIndex) => (
                        <div className="rounded-md border bg-[#fffdf7] p-2" key={setIndex}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{settings.binding === "yotsume" ? `Set ${setIndex + 1}` : "Center fold"}</span>
                            {settings.binding === "yotsume" && settings.punchHoleSets.length > 1 && (
                              <Button type="button" variant="outline" size="icon-sm" aria-label={`Remove hole set ${setIndex + 1}`} onClick={() => update("punchHoleSets", settings.punchHoleSets.filter((_, index) => index !== setIndex))}>
                                <Trash2 />
                              </Button>
                            )}
                          </div>
                          {settings.binding === "yotsume" && (
                            <NumberField label="Edge offset (mm)" value={set.offset} min={2} max={Math.max(2, pageSize.width / 2)} step={0.5} onChange={(value) => updateHoleSet(setIndex, { offset: value })} />
                          )}
                          <div className="mt-2 grid gap-2 border-t pt-2">
                            {set.groups.map((group, groupIndex) => (
                              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2" key={groupIndex}>
                                <NumberField label="Holes" value={group.holes} min={0} max={20} onChange={(value) => updateHoleGroup(setIndex, groupIndex, "holes", value)} />
                                <NumberField label="Weight" value={group.weight} min={1} max={1000} onChange={(value) => updateHoleGroup(setIndex, groupIndex, "weight", value)} />
                                <Button type="button" variant="outline" size="icon-sm" aria-label={`Remove group ${groupIndex + 1} from set ${setIndex + 1}`} onClick={() => updateHoleSet(setIndex, { groups: set.groups.filter((_, index) => index !== groupIndex) })}>
                                  <Trash2 />
                                </Button>
                              </div>
                            ))}
                            <Button type="button" variant="outline" onClick={() => updateHoleSet(setIndex, { groups: [...set.groups, { holes: 1, weight: 1 }] })}>
                              <Plus /> Add group
                            </Button>
                          </div>
                        </div>
                      ))}
                      {settings.binding === "yotsume" && (
                        <Button type="button" variant="outline" onClick={() => update("punchHoleSets", [...settings.punchHoleSets, { offset: 18, groups: [{ holes: 1, weight: 1 }] }])}>
                          <Plus /> Add horizontal set
                        </Button>
                      )}
                    </div>
                  </fieldset>
                  <p className="mt-3 text-[9px] leading-4 text-muted-foreground">
                    Weights divide the area between the end insets. Add a zero-hole group as a spacer—for example, 3 / 0 / 3 holes.
                    {settings.binding === "yotsume" ? " Each horizontal set has its own edge offset and groups." : " Folded bindings use one set on the center fold."}
                  </p>
                </section>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-3 divide-x border-b bg-[#d8d3c8]" aria-live="polite">
              {[
                [totalPages, "pages"],
                [sides.length / 2, "sheets"],
                [sides.length, "sides"],
              ].map(([value, label]) => (
                <div className="bg-[#fbfaf6] py-3 text-center" key={label}>
                  <strong className="block font-serif text-xl font-normal">{value}</strong>
                  <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 px-5 py-4 text-[10px] leading-4 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-[#446a72]" />
              <p>Changing paper keeps your page style and recalculates the imposition.</p>
            </div>
          </aside>

          <main className="flex min-h-[700px] min-w-0 flex-col bg-[#edeae1] xl:h-full xl:min-h-0">
            <div className="flex h-[60px] shrink-0 items-center justify-between border-b bg-[#f3f0e8] px-5">
              <div>
                <p className="text-xs font-semibold">Live preview</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{pageName} · {formatMillimeters(pageSize.width)} × {formatMillimeters(pageSize.height)} mm</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon-sm" aria-label="Zoom out" disabled={zoom === 50} onClick={() => setZoom((value) => Math.max(50, value - 10))}>
                    <Minus />
                  </Button>
                  <span className="w-10 text-center text-[10px] text-muted-foreground" aria-live="polite">{zoom}%</span>
                  <Button variant="outline" size="icon-sm" aria-label="Zoom in" disabled={zoom === 200} onClick={() => setZoom((value) => Math.min(200, value + 10))}>
                    <Plus />
                  </Button>
                </div>
                <span className="mr-1 hidden text-[11px] text-muted-foreground sm:inline">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)}>
                  <ArrowLeft />
                </Button>
                <Button variant="outline" size="icon-sm" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => page + 1)}>
                  <ArrowRight />
                </Button>
              </div>
            </div>

            <div className="flex min-h-[540px] flex-1 overflow-auto p-4 lg:p-6">
              <div
                className="relative m-auto shrink-0"
                style={{
                  aspectRatio: `${pageSize.width} / ${pageSize.height}`,
                  height: `min(${zoom * 0.7}vh, ${zoom * 7.4}px)`,
                }}
              >
                <PageSvg
                  settings={settings}
                  punchHoleSets={punchHoleSets}
                  logicalPage={currentPage}
                  paperColor={settings.previewPaperColor}
                  className="block h-full w-full shadow-[0_18px_34px_rgba(55,49,35,.14)]"
                  ariaLabel="Notebook page preview"
                />
              </div>
            </div>

            <section className="shrink-0 border-t bg-[#f3f0e8] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
                  {showPlan
                    ? settings.binding === "yotsume"
                      ? settings.yotsumeTwoUp ? "Imposition · cut sheets" : "Imposition · full sheets"
                      : "Imposition · first signature"
                    : "Pages"}
                </h3>
                <button type="button" className="flex items-center gap-1 text-[10px] font-semibold text-[#446a72]" onClick={() => setShowPlan((shown) => !shown)}>
                  {showPlan ? "View pages" : "View imposition plan"}<ArrowUpRight className="size-3" />
                </button>
              </div>
              <div className="flex h-[76px] gap-2 overflow-x-auto px-0.5 py-0.5">
                {showPlan ? firstSignature.map((side: ImpositionSide) => (
                  <div className="min-w-36 rounded border bg-[#fffdf7] p-2" key={`${side.sheet}-${side.side}`}>
                    <span className="block text-[8px] uppercase tracking-wider text-muted-foreground">Sheet {side.sheet} · {side.side}</span>
                    <div className={`mt-1 grid border text-center font-serif text-xs ${side.pages.length > 1 ? "grid-cols-2 divide-x" : ""}`}>
                      {side.pages.map((page) => <span className="py-2" key={page}>{displayedPage(settings, page)}</span>)}
                    </div>
                  </div>
                )) : visiblePages.map((page) => (
                  <PageThumbnail
                    settings={settings}
                    punchHoleSets={punchHoleSets}
                    pageSize={pageSize}
                    logicalPage={page}
                    selected={currentPage === page}
                    onClick={() => setCurrentPage(page)}
                    key={page}
                  />
                ))}
              </div>
            </section>
          </main>

          <aside className="border-t bg-[#fbfaf6] lg:col-span-2 xl:col-span-1 xl:h-full xl:overflow-y-auto xl:border-t-0 xl:border-l">
            <div className="px-[18px] pt-[18px] pb-2">
              <h2 className="font-serif text-[22px]">Properties</h2>
            </div>

            <Tabs defaultValue="style" className="gap-0">
              <TabBar className="px-[18px]">
                <TabBarTrigger value="style">STYLE</TabBarTrigger>
                <TabBarTrigger value="layout">LAYOUT</TabBarTrigger>
                <TabBarTrigger value="page">PAGE</TabBarTrigger>
              </TabBar>

              <div className="flex items-center gap-3 border-b bg-[#f5f2ea] px-[18px] py-3.5">
                <span className="grid size-[34px] place-items-center rounded-md border bg-[#fbfaf6]"><Hash className="size-4 text-[#c9823b]" /></span>
                <div>
                  <p className="text-xs font-semibold">Page style</p>
                  <p className="text-[9px] text-muted-foreground">Pattern · margins · numbering</p>
                </div>
              </div>

              <TabsContent value="style" className="mt-0">
                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>Preview paper color</SectionTitle>
                  <Select value={settings.previewPaperColor} onValueChange={(value) => update("previewPaperColor", value)}>
                    <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#fffef9">
                        <span className="flex items-center gap-2"><span className="size-3 rounded-full border" style={{ backgroundColor: "#fffef9" }} />White (default)</span>
                      </SelectItem>
                      {tropheeColors.map((color) => (
                        <SelectItem value={color.hex} key={color.hex}>
                          <span className="flex items-center gap-2"><span className="size-3 rounded-full border" style={{ backgroundColor: color.hex }} />{color.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[9px] leading-4 text-muted-foreground">Clairefontaine Trophée screen swatches. Preview only; PDF pages stay white.</p>
                </section>

                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>Page pattern</SectionTitle>
                  <Select value={settings.pattern} onValueChange={(value) => update("pattern", value as Settings["pattern"])}>
                    <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dots">Dot grid</SelectItem>
                      <SelectItem value="lines">Ruled lines</SelectItem>
                      <SelectItem value="grid">Square grid</SelectItem>
                      <SelectItem value="graph">Graph paper</SelectItem>
                      <SelectItem value="blank">Blank</SelectItem>
                    </SelectContent>
                  </Select>
                  {settings.pattern === "dots" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField label="Dot size (mm)" value={settings.dotSize} min={0.05} max={2} step={0.05} onChange={(value) => update("dotSize", value)} />
                        <NumberField label="Spacing (mm)" value={settings.dotSpacing} min={2} max={20} step={0.5} onChange={(value) => update("dotSpacing", value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField label="Major interval" value={settings.dotMajorEvery} min={0} max={20} onChange={(value) => update("dotMajorEvery", value)} />
                        <NumberField label="Major size (mm)" value={settings.dotMajorSize} min={0.05} max={4} step={0.05} onChange={(value) => update("dotMajorSize", value)} />
                      </div>
                      <p className="text-[9px] leading-4 text-muted-foreground">Set the interval to 0 to disable major dots.</p>
                      <ColorField label="Dot color" value={settings.dotColor} onChange={(value) => update("dotColor", value)} />
                    </>
                  )}
                  {(settings.pattern === "lines" || settings.pattern === "grid" || settings.pattern === "graph") && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField label={settings.pattern === "graph" ? "Thin width (mm)" : "Line width (mm)"} value={settings.lineWidth} min={0.05} max={1} step={0.05} onChange={(value) => update("lineWidth", value)} />
                        <NumberField label={settings.pattern === "graph" ? "Cell size (mm)" : "Spacing (mm)"} value={settings.lineSpacing} min={3} max={20} step={0.5} onChange={(value) => update("lineSpacing", value)} />
                      </div>
                      <ColorField label={settings.pattern === "graph" ? "Thin line color" : "Line color"} value={settings.lineColor} onChange={(value) => update("lineColor", value)} />
                    </>
                  )}
                  {settings.pattern === "graph" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField label="Cells per block" value={settings.graphMajorEvery} min={2} max={20} onChange={(value) => update("graphMajorEvery", value)} />
                        <NumberField label="Thick width (mm)" value={settings.graphMajorLineWidth} min={0.05} max={2} step={0.05} onChange={(value) => update("graphMajorLineWidth", value)} />
                      </div>
                      <ColorField label="Thick line color" value={settings.graphMajorColor} onChange={(value) => update("graphMajorColor", value)} />
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border bg-[#fffdf7] p-3 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 accent-[#c9823b]"
                          checked={settings.graphCompleteBlocks}
                          onChange={(event) => update("graphCompleteBlocks", event.target.checked)}
                        />
                        <span>
                          <strong className="block">Complete blocks only</strong>
                          <span className="mt-0.5 block text-[9px] leading-4 text-muted-foreground">Remove partial cell groups and center the grid.</span>
                        </span>
                      </label>
                    </>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="layout" className="mt-0">
                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>Margins & border</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Margin (mm)" value={settings.margin} min={0} max={30} onChange={(value) => update("margin", value)} />
                    <NumberField label="Gutter (mm)" value={settings.gutterMargin} min={0} max={Math.max(0, pageSize.width - settings.margin * 2 - 10)} step={0.5} onChange={(value) => update("gutterMargin", value)} />
                  </div>
                  <p className="text-[9px] leading-4 text-muted-foreground">The gutter is added to the binding-side margin.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Border (mm)" value={settings.borderWidth} min={0} max={2} step={0.1} onChange={(value) => update("borderWidth", value)} />
                    <ColorField label="Border color" value={settings.borderColor} onChange={(value) => update("borderColor", value)} />
                  </div>
                </section>

                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>Numbering</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1.5">
                      <Label>Pages</Label>
                      <Select value={settings.numberVisibility} onValueChange={(value) => update("numberVisibility", value as PageNumberVisibility)}>
                        <SelectTrigger className="w-full bg-[#fffdf7]" aria-label="Numbered pages"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="both">Left & right</SelectItem>
                          <SelectItem value="right">Right only</SelectItem>
                          <SelectItem value="left">Left only</SelectItem>
                          <SelectItem value="none">Hidden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Position</Label>
                      <Select disabled={settings.numberVisibility === "none"} value={settings.numberPosition} onValueChange={(value) => update("numberPosition", value as Settings["numberPosition"])}>
                        <SelectTrigger className="w-full bg-[#fffdf7]" aria-label="Page number position"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outer">Outer corners</SelectItem>
                          <SelectItem value="center">Centered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <fieldset disabled={settings.numberVisibility === "none"} className="grid gap-3">
                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <Label>Font</Label>
                        <Select value={settings.numberFont} onValueChange={(value) => update("numberFont", value as NumberFont)}>
                          <SelectTrigger className="w-full bg-[#fffdf7]" aria-label="Page number font">
                            <SelectValue>
                              <span className="text-base" style={{ fontFamily: selectedNumberFont.value }}>{selectedNumberFont.label} (1 2 3)</span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {numberFonts.map((font) => (
                              <SelectItem value={font.value} textValue={`${font.label} (1 2 3)`} key={font.value}>
                                <span className="text-base" style={{ fontFamily: font.value }}>{font.label} (1 2 3)</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <NumberField label="Size (pt)" value={settings.numberFontSize} min={4} max={72} step={0.5} onChange={(value) => update("numberFontSize", value)} />
                    </div>
                    <ColorField label="Number color" value={settings.numberColor} onChange={(value) => update("numberColor", value)} />
                    <div className="grid gap-1.5">
                      <Label>Style</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          aria-pressed={settings.numberBold}
                          className={settings.numberBold ? "border-[#c9823b] bg-[#f3e4d1] text-[#a96528]" : ""}
                          onClick={() => update("numberBold", !settings.numberBold)}
                        >
                          <strong>B</strong> Bold
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          aria-pressed={settings.numberItalic}
                          className={settings.numberItalic ? "border-[#c9823b] bg-[#f3e4d1] text-[#a96528]" : ""}
                          onClick={() => update("numberItalic", !settings.numberItalic)}
                        >
                          <em>I</em> Italic
                        </Button>
                      </div>
                    </div>
                    <NumberField label="Start at" value={settings.firstPage} min={1} max={9999} onChange={(value) => update("firstPage", value)} />
                  </fieldset>
                </section>
              </TabsContent>

              <TabsContent value="page" className="mt-0">
                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>{`Page ${displayedPage(settings, currentPage)}`}</SectionTitle>
                  <div className="grid gap-1.5">
                    <Label>Template</Label>
                    <Select
                      value={customPage?.type ?? "default"}
                      onValueChange={(value) => {
                        if (value === "title") setCustomPage({ type: "title", title: "", subtitle: "" })
                        else if (value === "index") setCustomPage({ type: "index", title: "Index", entries: "" })
                        else setCustomPage(null)
                      }}
                    >
                      <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
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
                        <Input value={customPage.title} maxLength={40} placeholder="My Notebook" onChange={(event) => setCustomPage({ ...customPage, title: event.target.value })} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Subtitle</Label>
                        <Input value={customPage.subtitle} maxLength={60} placeholder="Name or date" onChange={(event) => setCustomPage({ ...customPage, subtitle: event.target.value })} />
                      </div>
                    </>
                  )}
                  {customPage?.type === "index" && (
                    <>
                      <div className="grid gap-1.5">
                        <Label>Heading</Label>
                        <Input value={customPage.title} maxLength={40} onChange={(event) => setCustomPage({ ...customPage, title: event.target.value })} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Entries</Label>
                        <textarea
                          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full resize-y rounded-md border bg-[#fffdf7] px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                          value={customPage.entries}
                          placeholder={"Projects | 4\nNotes | 12"}
                          onChange={(event) => setCustomPage({ ...customPage, entries: event.target.value })}
                        />
                        <p className="text-[9px] leading-4 text-muted-foreground">Use one entry per line. Put a | before its page number.</p>
                      </div>
                    </>
                  )}
                  <p className="text-[9px] leading-4 text-muted-foreground">A custom template replaces the pattern and border on this page. Title pages also hide the page number.</p>
                </section>
              </TabsContent>
            </Tabs>

            <div className="p-[18px]">
              <Button className="w-full bg-[#25231f] hover:bg-[#3c3933] xl:hidden" onClick={exportPdf}>
                <Download /> Export PDF
              </Button>
              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">In the print dialog, choose Save as PDF, actual size, double-sided, and flip on the {settings.binding === "yotsume" && !settings.yotsumeTwoUp && settings.yotsumeOrientation === "portrait" ? "long" : "short"} edge.</p>
            </div>
          </aside>
        </div>
      </div>
      {printSettings && <PrintDocument settings={printSettings} />}
    </>
  )
}

export default App
