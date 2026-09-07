import { ArrowLeft, ArrowRight, Printer } from "lucide-react"
import { useMemo, useState } from "react"
import { CheckboxField, Field, SelectControl } from "@/components/form-controls"
import { PageSvg } from "@/components/notebook-page"
import { Button } from "@/components/ui/button"
import type { PrintPass } from "@/lib/imposition"
import type { NotebookDocument } from "@/lib/notebook-document"
import { formatMillimeters } from "@/lib/paper"
import { createPrintPlan, type PrintSheet } from "@/lib/print-plan"
import type { Settings } from "@/lib/settings"

export type PrintPreparationProps = {
  settings: Settings
  document: NotebookDocument
  onPrint: (pass: PrintPass, includeGuide: boolean) => void
  busy: boolean
  error: string | null
}

function passInstructions(settings: Settings, pass: PrintPass) {
  switch (pass) {
    case "all": {
      const edge =
        settings.binding === "yotsume" &&
        !settings.yotsumeTwoUp &&
        settings.yotsumeOrientation === "portrait"
          ? "long"
          : "short"
      return `For a printer, enable double-sided printing and flip on the ${edge} edge. For a PDF, choose Save as PDF in the browser dialog; duplex is a setting for printing that PDF later.`
    }
    case "fronts":
      return "Manual duplex · first pass. Print single-sided, then reload the stack without reordering it. Print the backs next. Test one sheet first to establish your printer’s feed orientation."
    case "guide":
      return "Print the punch guide separately, single-sided, at actual size. It is not part of the page sequence."
    default:
      return "Manual duplex · second pass. Print single-sided. Choose same-order backs when the first front sheet is on top of the stack; choose reversed backs when the last front sheet is on top."
  }
}

function PrintGuidance({ settings, pass }: { settings: Settings; pass: PrintPass }) {
  const assembly =
    settings.binding === "yotsume"
      ? settings.yotsumeTwoUp
        ? "Cut each sheet in half, then stack the leaves in page order before sewing."
        : "Stack full sheets in page order before sewing."
      : "Fold and nest the sheets within each Signature, then assemble the Signatures in order."
  return (
    <div className="grid gap-2 rounded-md border bg-muted p-4 text-sm">
      <p>
        <strong>Actual size / 100%.</strong> Turn off browser headers and footers. Do not fit or
        shrink to printable area.
      </p>
      <p>{passInstructions(settings, pass)}</p>
      <p>{assembly}</p>
    </div>
  )
}

function SheetArtwork({ document, sheet }: { document: NotebookDocument; sheet: PrintSheet }) {
  const { layout, paper } = document.pageLayout
  return (
    <div
      className="print-sheet-preview mx-auto grid w-full overflow-hidden border bg-white shadow-sm"
      data-layout={layout}
      data-divider={sheet.settings.pageDivider ? "on" : "off"}
      style={{ aspectRatio: `${paper.width} / ${paper.height}` }}
    >
      {sheet.pages.map((page) => (
        <div key={page} className="min-h-0 min-w-0 overflow-hidden">
          <PageSvg
            settings={sheet.settings}
            punchHoleSets={document.punchHoleSets}
            logicalPage={page}
            paperColor="none"
            showPunchHoles={sheet.punchHolePages.has(page)}
            className="block h-full w-full"
          />
        </div>
      ))}
    </div>
  )
}

function SheetPreview({ document, sheets }: { document: NotebookDocument; sheets: PrintSheet[] }) {
  const [sideIndex, setSideIndex] = useState(0)
  const index = Math.min(sideIndex, Math.max(0, sheets.length - 1))
  const options = Object.fromEntries(
    sheets.map((sheet, i) => [
      String(i),
      sheet.side === "punch-guide"
        ? "Separate punch guide"
        : `Signature ${sheet.signature} · Sheet ${sheet.sheet} · ${sheet.side}`,
    ]),
  )
  const sheet = sheets[index]
  if (!sheet) return <p>No sides are available for this print pass.</p>
  return (
    <section className="grid min-w-0 content-start gap-3">
      <div>
        <h3 className="font-semibold">Inspect printed sheets</h3>
        <p className="text-xs text-muted-foreground">
          Every output side is available, across all {document.signatureCount} Signatures. This
          changes only the preview, not which sides are printed.
        </p>
      </div>
      <Field label="Preview sheet side" htmlFor="print-preview-side">
        <SelectControl
          id="print-preview-side"
          value={String(index)}
          options={options}
          onChange={(value) => setSideIndex(Number(value))}
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          aria-label="Previous print side"
          disabled={index === 0}
          onClick={() => setSideIndex(index - 1)}
        >
          <ArrowLeft />
        </Button>
        <span className="text-sm" aria-live="polite">
          Output side {index + 1} of {sheets.length}
        </span>
        <Button
          variant="outline"
          aria-label="Next print side"
          disabled={index >= sheets.length - 1}
          onClick={() => setSideIndex(index + 1)}
        >
          <ArrowRight />
        </Button>
      </div>
      <SheetArtwork document={document} sheet={sheet} />
    </section>
  )
}

export function PrintPreparation({
  settings,
  document,
  onPrint,
  busy,
  error,
}: PrintPreparationProps) {
  const [pass, setPass] = useState<PrintPass>("all")
  const [includeGuide, setIncludeGuide] = useState(false)
  const effectiveIncludeGuide = pass === "all" && includeGuide && !!document.guide
  const sheets = useMemo(
    () => createPrintPlan(document, settings, pass, effectiveIncludeGuide),
    [document, settings, pass, effectiveIncludeGuide],
  )
  const { paper } = document.pageLayout
  return (
    <div className="grid gap-6 p-5 lg:grid-cols-2">
      <fieldset className="grid min-w-0 content-start gap-4" disabled={busy}>
        <p className="text-sm">
          Fold opens your browser’s print dialog. Print directly or choose Save as PDF there.
        </p>
        <dl className="grid grid-cols-2 gap-3 rounded-md border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Paper sheet</dt>
            <dd>
              {formatMillimeters(paper.width)} × {formatMillimeters(paper.height)} mm
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Finished page</dt>
            <dd>
              {document.pageName} · {formatMillimeters(document.pageSize.width)} ×{" "}
              {formatMillimeters(document.pageSize.height)} mm
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Notebook</dt>
            <dd>
              {document.totalPages} pages · {document.sides.length / 2} sheets
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">This output</dt>
            <dd aria-live="polite">
              {sheets.length} sides
              {effectiveIncludeGuide || pass === "guide" ? " · includes guide" : ""}
            </dd>
          </div>
        </dl>
        <Field label="Print pass" htmlFor="print-pass">
          <SelectControl
            id="print-pass"
            value={pass}
            onChange={(value) => setPass(value as PrintPass)}
            options={{
              all: "All sides · PDF or automatic duplex",
              fronts: "Fronts only · manual duplex",
              backs: "Backs · same order",
              "backs-reversed": "Backs · reversed order",
              ...(document.guide ? { guide: "Punch guide only" } : {}),
            }}
          />
        </Field>
        {document.guide && pass === "all" && (
          <CheckboxField
            checked={includeGuide}
            onChange={setIncludeGuide}
            title="Append separate punch guide"
            description="Adds one output side after the notebook. You can instead print the guide separately using Punch guide only."
          />
        )}
        {document.guide && pass !== "all" && pass !== "guide" && (
          <p className="text-xs text-muted-foreground">
            The punch guide is excluded from manual duplex passes. Print it separately with Punch
            guide only.
          </p>
        )}
        <PrintGuidance settings={settings} pass={pass} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button disabled={busy} onClick={() => onPrint(pass, effectiveIncludeGuide)}>
          <Printer />
          {busy ? "Preparing pages…" : "Open print dialog"}
        </Button>
      </fieldset>
      <SheetPreview key={`${pass}-${effectiveIncludeGuide}`} document={document} sheets={sheets} />
    </div>
  )
}
