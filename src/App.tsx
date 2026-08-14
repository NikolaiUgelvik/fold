import { Download } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { BookSetup } from "@/components/book-setup"
import { SelectControl } from "@/components/form-controls"
import { PageProperties } from "@/components/page-properties"
import { Preview } from "@/components/preview"
import { PrintDocument } from "@/components/print-document"
import { Button } from "@/components/ui/button"
import { ensurePageNumberFontsLoaded } from "@/lib/font-loading"
import { getPrintPages, type PrintPass } from "@/lib/imposition"
import { createNotebookDocument } from "@/lib/notebook-document"
import { type PunchHolePlacement, usesSeparatePunchGuide } from "@/lib/punch-holes"
import { initialSettings, type Settings, type SettingsUpdate } from "@/lib/settings"

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

const documentNames: Record<Settings["pattern"], string> = {
  dots: "Dot-grid notebook",
  lines: "Ruled notebook",
  grid: "Square-grid notebook",
  graph: "Graph-paper notebook",
  blank: "Blank notebook",
}

type AppHeaderProps = {
  settings: Settings
  printPass: PrintPass
  onPrintPassChange: (pass: PrintPass) => void
  fontError: string | null
  documentName: string
  onExport: () => void
}

function AppHeader({
  settings,
  printPass,
  onPrintPassChange,
  fontError,
  documentName,
  onExport,
}: AppHeaderProps) {
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
          onChange={(value) => onPrintPassChange(value as PrintPass)}
          options={{
            all: "All sides",
            fronts: "Fronts only",
            backs: "Backs only",
            "backs-reversed": "Backs reversed",
            ...(usesSeparatePunchGuide(settings.punchHolePlacement) && {
              guide: "Punch guide only",
            }),
          }}
          className="w-32 bg-card"
          ariaLabel="Print pass"
        />
        <Button
          className="bg-primary px-3 hover:bg-primary-hover"
          aria-label="Export PDF"
          onClick={onExport}
        >
          <Download /> <span className="hidden sm:inline">Export PDF</span>
        </Button>
      </div>
    </header>
  )
}

function App() {
  const [settings, setSettings] = useState(initialSettings)
  const [currentPage, setCurrentPage] = useState(1)
  const [printSettings, setPrintSettings] = useState<{
    settings: Settings
    pass: PrintPass
  } | null>(null)
  const [printPass, setPrintPass] = useState<PrintPass>("all")
  const [previewPunchGuide, setPreviewPunchGuide] = useState(false)
  const [fontError, setFontError] = useState<string | null>(null)
  const document = useMemo(() => createNotebookDocument(settings), [settings])

  const updateSettings: SettingsUpdate = (key, value) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  useEffect(
    () => setCurrentPage((page) => Math.min(page, document.totalPages)),
    [document.totalPages],
  )
  usePrintDialog(printSettings, setPrintSettings)

  function changePunchHolePlacement(placement: PunchHolePlacement) {
    updateSettings("punchHolePlacement", placement)

    const separate = usesSeparatePunchGuide(placement)
    if (!separate && printPass === "guide") setPrintPass("all")
    setPreviewPunchGuide(separate)
  }

  const exportPdf = async () => {
    try {
      await ensurePageNumberFontsLoaded(
        window.document.fonts,
        settings,
        getPrintPages(document.sides, printPass),
      )
      setFontError(null)
      setPrintSettings({ settings, pass: printPass })
    } catch (error) {
      setFontError(
        error instanceof Error
          ? `${error.message}. Export was cancelled.`
          : "Could not load a page-number font. Export was cancelled.",
      )
    }
  }

  return (
    <>
      <div className="screen-app min-h-svh bg-canvas">
        <AppHeader
          settings={settings}
          printPass={printPass}
          onPrintPassChange={setPrintPass}
          fontError={fontError}
          documentName={documentNames[settings.pattern]}
          onExport={exportPdf}
        />
        <div className="app-grid grid">
          <BookSetup
            settings={settings}
            document={document}
            onSettingsChange={updateSettings}
            onPunchHolePlacementChange={changePunchHolePlacement}
          />
          <Preview
            settings={settings}
            document={document}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            previewPunchGuide={previewPunchGuide}
            onPreviewPunchGuideChange={setPreviewPunchGuide}
          />
          <PageProperties
            settings={settings}
            currentPage={currentPage}
            pageSize={document.pageSize}
            printPass={printPass}
            onSettingsChange={updateSettings}
            onExport={exportPdf}
          />
        </div>
      </div>
      {printSettings && (
        <PrintDocument settings={printSettings.settings} pass={printSettings.pass} />
      )}
    </>
  )
}

export default App
