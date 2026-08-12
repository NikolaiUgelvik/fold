import { useEffect, useId, useMemo, useState } from "react"
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Download, Hash, Info, Minus, Plus } from "lucide-react"

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createImposition, type Binding, type ImpositionSide } from "@/lib/imposition"
import { formatMillimeters, getCenteredPatternBounds, getFoldedPageSize, getPaperSize, paperSizes, type PaperId } from "@/lib/paper"
import { tropheeColors } from "@/lib/trophee-colors"

interface Settings {
  binding: Binding
  paper: PaperId
  previewPaperColor: string
  signatures: number
  sheets: number
  pattern: "dots" | "lines" | "grid" | "blank"
  dotSize: number
  dotSpacing: number
  dotMajorEvery: number
  dotMajorSize: number
  dotColor: string
  lineWidth: number
  lineSpacing: number
  lineColor: string
  margin: number
  borderWidth: number
  borderColor: string
  numberPosition: "outer" | "center" | "none"
  numberFont: "Georgia, serif" | "DM Serif Display, serif" | "Inter, sans-serif"
  numberFontSize: number
  numberColor: string
  numberBold: boolean
  numberItalic: boolean
  firstPage: number
}

const initialSettings: Settings = {
  binding: "coptic",
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
  margin: 10,
  borderWidth: 0,
  borderColor: "#c8c3b8",
  numberPosition: "outer",
  numberFont: "Georgia, serif",
  numberFontSize: 9,
  numberColor: "#30302c",
  numberBold: false,
  numberItalic: false,
  firstPage: 1,
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
  logicalPage,
  paperColor,
  className,
  ariaLabel,
}: {
  settings: Settings
  logicalPage: number
  paperColor: string
  className?: string
  ariaLabel?: string
}) {
  const page = displayedPage(settings, logicalPage)
  const pageSize = getFoldedPageSize(settings.paper)
  const spacing = settings.pattern === "dots" ? settings.dotSpacing : settings.lineSpacing
  const patternId = useId()
  const majorPatternId = useId()
  const majorSpacing = spacing * settings.dotMajorEvery
  const patternRadius = settings.pattern === "dots" ? settings.dotSize / 2 : settings.lineWidth / 2
  const centeredPatternBounds = getCenteredPatternBounds(pageSize, settings.margin, spacing, patternRadius)
  const patternStartX = centeredPatternBounds.x + patternRadius
  const patternStartY = centeredPatternBounds.y + patternRadius
  const patternBounds = settings.pattern === "lines"
    ? { ...centeredPatternBounds, x: settings.margin, width: pageSize.width - settings.margin * 2 }
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
  const borderInset = settings.margin + settings.borderWidth / 2

  return (
    <svg
      className={className}
      viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <rect width={pageSize.width} height={pageSize.height} fill={paperColor} />
      {settings.pattern !== "blank" && (
        <>
          <defs>
            <pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              x={settings.pattern === "lines" ? settings.margin : patternStartX - spacing / 2}
              y={patternStartY - spacing / 2}
              width={settings.pattern === "dots" || settings.pattern === "grid" ? spacing : pageSize.width}
              height={spacing}
            >
              {settings.pattern === "dots" ? (
                <circle cx={spacing / 2} cy={spacing / 2} r={settings.dotSize / 2} fill={settings.dotColor} />
              ) : (
                <>
                  <line
                    x2={settings.pattern === "grid" ? spacing : pageSize.width}
                    y1={spacing / 2}
                    y2={spacing / 2}
                    stroke={settings.lineColor}
                    strokeWidth={settings.lineWidth}
                  />
                  {settings.pattern === "grid" && (
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
          </defs>
          <rect {...patternBounds} fill={`url(#${patternId})`} />
          {settings.pattern === "dots" && settings.dotMajorEvery > 0 && (
            <rect {...majorBounds} fill={`url(#${majorPatternId})`} />
          )}
        </>
      )}
      {settings.borderWidth > 0 && (
        <rect
          x={borderInset}
          y={borderInset}
          width={pageSize.width - borderInset * 2}
          height={pageSize.height - borderInset * 2}
          fill="none"
          stroke={settings.borderColor}
          strokeWidth={settings.borderWidth}
        />
      )}
      {settings.numberPosition !== "none" && (
        <text
          x={settings.numberPosition === "center" ? pageSize.width / 2 : page % 2 === 1 ? pageSize.width - 9 : 9}
          y={pageSize.height - 7}
          fill={settings.numberColor}
          fontFamily={settings.numberFont}
          fontSize={settings.numberFontSize * 25.4 / 72}
          fontStyle={settings.numberItalic ? "italic" : "normal"}
          fontWeight={settings.numberBold ? 700 : 400}
          textAnchor={settings.numberPosition === "center" ? "middle" : page % 2 === 1 ? "end" : "start"}
        >
          {page}
        </text>
      )}
    </svg>
  )
}

function PageThumbnail({
  settings,
  pageSize,
  logicalPage,
  selected,
  onClick,
}: {
  settings: Settings
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
        logicalPage={logicalPage}
        paperColor={settings.previewPaperColor}
        className="block h-full w-full"
      />
    </button>
  )
}

function PrintPage({ settings, logicalPage }: { settings: Settings; logicalPage: number }) {
  return (
    <div className="paper-page">
      <PageSvg settings={settings} logicalPage={logicalPage} paperColor="#fffef9" className="block h-full w-full" />
    </div>
  )
}

function PrintDocument({ settings }: { settings: Settings }) {
  const paper = getPaperSize(settings.paper)
  const sides = createImposition({
    binding: settings.binding,
    signatures: settings.signatures,
    sheetsPerSignature: settings.sheets,
  })

  return (
    <div className="print-root" aria-hidden="true">
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      {sides.map((side) => (
        <section
          className="print-side"
          key={`${side.signature}-${side.sheet}-${side.side}`}
          data-signature={side.signature}
          data-sheet={side.sheet}
          data-side={side.side}
          style={{ width: `${paper.width}mm`, height: `${paper.height}mm` }}
        >
          {side.pages.map((page) => <PrintPage settings={settings} logicalPage={page} key={page} />)}
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
  const [showPlan, setShowPlan] = useState(false)

  const signatureCount = settings.binding === "saddle" ? 1 : settings.signatures
  const sides = useMemo(
    () => createImposition({
      binding: settings.binding,
      signatures: signatureCount,
      sheetsPerSignature: settings.sheets,
    }),
    [settings.binding, settings.sheets, signatureCount],
  )
  const totalPages = signatureCount * settings.sheets * 4
  const paper = getPaperSize(settings.paper)
  const pageSize = getFoldedPageSize(settings.paper)
  const pageName = paper.label.split(" → ")[1]
  const firstSignature = sides.filter((side) => side.signature === 1)
  const visiblePages = Array.from({ length: Math.min(totalPages, 10) }, (_, index) => index + 1)
  const documentName = settings.pattern === "dots"
    ? "Dot-grid notebook"
    : settings.pattern === "lines"
      ? "Ruled notebook"
      : settings.pattern === "grid"
        ? "Square-grid notebook"
        : "Blank notebook"

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

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

  function exportPdf() {
    setPrintSettings({ ...settings, signatures: signatureCount })
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
          <Button className="bg-[#25231f] px-4 hover:bg-[#3c3933]" onClick={exportPdf}>
            <Download /> Export PDF
          </Button>
        </header>

        <div className="grid xl:h-[calc(100svh-72px)] lg:grid-cols-[292px_minmax(0,1fr)] xl:grid-cols-[292px_minmax(440px,1fr)_312px]">
          <aside className="border-b bg-[#fbfaf6] lg:border-r lg:border-b-0 xl:h-full xl:overflow-y-auto">
            <div className="px-5 pt-5 pb-4">
              <h2 className="font-serif text-[22px]">Book setup</h2>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Choose a paper, then tune the construction.</p>
            </div>

            <Tabs defaultValue="paper" className="gap-0">
              <TabsList className="h-[42px] w-full justify-start gap-5 rounded-none border-b px-5 py-0">
                <TabsTrigger value="paper" className="h-full flex-none rounded-none px-0 text-[11px] font-bold tracking-[0.1em] data-[state=active]:text-[#c9823b] after:bg-[#c9823b]">PAPER</TabsTrigger>
                <TabsTrigger value="binding" className="h-full flex-none rounded-none px-0 text-[11px] font-bold tracking-[0.1em] data-[state=active]:text-[#c9823b] after:bg-[#c9823b]">BINDING</TabsTrigger>
              </TabsList>

              <TabsContent value="paper" className="mt-0">
                <section className="border-b p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <Label>Paper sheet</Label>
                    <span className="text-[10px] text-muted-foreground">{paperSizes.length} presets</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {paperSizes.map((paperSize) => {
                      const selected = settings.paper === paperSize.id
                      return (
                        <button
                          type="button"
                          key={paperSize.id}
                          className={`rounded-lg border px-2 py-3 text-left transition-colors ${selected ? "border-[#c9823b] bg-[#f3e4d1] ring-1 ring-[#c9823b]" : "bg-[#fffdf7] hover:border-[#aaa398]"}`}
                          onClick={() => update("paper", paperSize.id)}
                        >
                          <strong className={`block text-xs ${selected ? "text-[#a96528]" : "text-foreground"}`}>{paperSize.id === "tabloid" ? "Tabloid" : paperSize.id.toUpperCase()}</strong>
                          <span className="mt-1 block text-[9px] text-muted-foreground">{formatMillimeters(paperSize.width)} × {formatMillimeters(paperSize.height)} mm</span>
                          <span className="mt-0.5 block text-[9px] text-muted-foreground">folds to {paperSize.label.split(" → ")[1]}</span>
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
                    </SelectContent>
                  </Select>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <NumberField label="Signatures" value={signatureCount} min={1} max={12} disabled={settings.binding === "saddle"} onChange={(value) => update("signatures", value)} />
                    <NumberField label="Sheets each" value={settings.sheets} min={1} max={12} onChange={(value) => update("sheets", value)} />
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
                    {settings.binding === "saddle"
                      ? "All sheets nest into one signature. Best for smaller books."
                      : "Each signature is folded separately, then sewn together."}
                  </p>
                </section>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-3 divide-x border-b bg-[#d8d3c8]" aria-live="polite">
              {[
                [totalPages, "pages"],
                [signatureCount * settings.sheets, "sheets"],
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
                  logicalPage={currentPage}
                  paperColor={settings.previewPaperColor}
                  className="block h-full w-full shadow-[0_18px_34px_rgba(55,49,35,.14)]"
                  ariaLabel="Notebook page preview"
                />
              </div>
            </div>

            <section className="shrink-0 border-t bg-[#f3f0e8] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">{showPlan ? "Imposition · first signature" : "Pages"}</h3>
                <button type="button" className="flex items-center gap-1 text-[10px] font-semibold text-[#446a72]" onClick={() => setShowPlan((shown) => !shown)}>
                  {showPlan ? "View pages" : "View imposition plan"}<ArrowUpRight className="size-3" />
                </button>
              </div>
              <div className="flex h-[76px] gap-2 overflow-x-auto px-0.5 py-0.5">
                {showPlan ? firstSignature.map((side: ImpositionSide) => (
                  <div className="min-w-36 rounded border bg-[#fffdf7] p-2" key={`${side.sheet}-${side.side}`}>
                    <span className="block text-[8px] uppercase tracking-wider text-muted-foreground">Sheet {side.sheet} · {side.side}</span>
                    <div className="mt-1 grid grid-cols-2 divide-x border text-center font-serif text-xs">
                      {side.pages.map((page) => <span className="py-2" key={page}>{displayedPage(settings, page)}</span>)}
                    </div>
                  </div>
                )) : visiblePages.map((page) => (
                  <PageThumbnail
                    settings={settings}
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
            <div className="px-[18px] pt-[18px] pb-3">
              <h2 className="font-serif text-[22px]">Properties</h2>
            </div>

            <Tabs defaultValue="style" className="gap-0">
              <TabsList className="h-[42px] w-full justify-start gap-5 rounded-none border-b px-[18px] py-0">
                <TabsTrigger value="style" className="h-full flex-none rounded-none px-0 text-[10px] font-bold tracking-[0.1em] data-[state=active]:text-[#c9823b] after:bg-[#c9823b]">STYLE</TabsTrigger>
                <TabsTrigger value="layout" className="h-full flex-none rounded-none px-0 text-[10px] font-bold tracking-[0.1em] data-[state=active]:text-[#c9823b] after:bg-[#c9823b]">LAYOUT</TabsTrigger>
              </TabsList>

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
                  {(settings.pattern === "lines" || settings.pattern === "grid") && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField label="Line width (mm)" value={settings.lineWidth} min={0.05} max={1} step={0.05} onChange={(value) => update("lineWidth", value)} />
                        <NumberField label="Spacing (mm)" value={settings.lineSpacing} min={3} max={20} step={0.5} onChange={(value) => update("lineSpacing", value)} />
                      </div>
                      <ColorField label="Line color" value={settings.lineColor} onChange={(value) => update("lineColor", value)} />
                    </>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="layout" className="mt-0">
                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>Margins & border</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Margin (mm)" value={settings.margin} min={0} max={30} onChange={(value) => update("margin", value)} />
                    <NumberField label="Border (mm)" value={settings.borderWidth} min={0} max={2} step={0.1} onChange={(value) => update("borderWidth", value)} />
                  </div>
                  <ColorField label="Border color" value={settings.borderColor} onChange={(value) => update("borderColor", value)} />
                </section>

                <section className="grid gap-3 border-b p-[18px]">
                  <SectionTitle>Numbering</SectionTitle>
                  <Select value={settings.numberPosition} onValueChange={(value) => update("numberPosition", value as Settings["numberPosition"])}>
                    <SelectTrigger className="w-full bg-[#fffdf7]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outer">Outer corners</SelectItem>
                      <SelectItem value="center">Centered</SelectItem>
                      <SelectItem value="none">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1.5">
                      <Label>Font</Label>
                      <Select value={settings.numberFont} onValueChange={(value) => update("numberFont", value as Settings["numberFont"])}>
                        <SelectTrigger className="w-full bg-[#fffdf7]" aria-label="Page number font"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Georgia, serif">Georgia</SelectItem>
                          <SelectItem value="DM Serif Display, serif">DM Serif</SelectItem>
                          <SelectItem value="Inter, sans-serif">Inter</SelectItem>
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
                </section>
              </TabsContent>
            </Tabs>

            <div className="p-[18px]">
              <Button className="w-full bg-[#25231f] hover:bg-[#3c3933] xl:hidden" onClick={exportPdf}>
                <Download /> Export PDF
              </Button>
              <p className="mt-3 text-[10px] leading-4 text-muted-foreground">In the print dialog, choose Save as PDF, actual size, double-sided, and flip on the short edge.</p>
            </div>
          </aside>
        </div>
      </div>
      {printSettings && <PrintDocument settings={printSettings} />}
    </>
  )
}

export default App
