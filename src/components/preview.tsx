import { ArrowLeft, ArrowRight, Maximize, Minus, Plus } from "lucide-react"
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react"

import { PageSvg } from "@/components/notebook-page"
import { Button } from "@/components/ui/button"
import { isFoldedBinding } from "@/lib/imposition"
import type { NotebookDocument } from "@/lib/notebook-document"
import { createPunchGuideViewModel } from "@/lib/notebook-document"
import { formatMillimeters } from "@/lib/paper"
import { getReaderPose, type MaterialPresetId, stepReaderPose } from "@/lib/physical-preview"
import { usesSeparatePunchGuide } from "@/lib/punch-holes"
import type { Settings } from "@/lib/settings"

const PhysicalDesignPreview = lazy(() =>
  import("@/components/physical-design-preview").then(({ PhysicalDesignPreview }) => ({
    default: PhysicalDesignPreview,
  })),
)

export type PreviewProps = {
  settings: Settings
  document: NotebookDocument
  currentPage: number
  onCurrentPageChange: (page: number) => void
  previewPunchGuide: boolean
  onPreviewPunchGuideChange: (shown: boolean) => void
}

type PreviewMode = "page" | "spread" | "physical"

type PreviewToolbarProps = PreviewProps & {
  physicalPreviewSupported: boolean
  zoom: number
  onZoomChange: (zoom: number) => void
  mode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
}

function PreviewModeSwitch({
  mode,
  physicalPreviewSupported,
  onModeChange,
  onPreviewPunchGuideChange,
}: Pick<
  PreviewToolbarProps,
  "mode" | "physicalPreviewSupported" | "onModeChange" | "onPreviewPunchGuideChange"
>) {
  return (
    <fieldset className="preview-mode-switch flex items-center gap-1" aria-label="Preview mode">
      {(["page", "spread", "physical"] as const).map((value) => (
        <Button
          key={value}
          variant="outline"
          className="min-h-11 px-3 text-xs"
          aria-pressed={mode === value}
          disabled={value === "physical" && !physicalPreviewSupported}
          title={
            value === "physical" && !physicalPreviewSupported
              ? "Physical Design Preview requires WebGL 2"
              : undefined
          }
          onClick={() => {
            onPreviewPunchGuideChange(false)
            onModeChange(value)
          }}
        >
          {value === "page" ? "Page" : value === "spread" ? "Spread" : "Physical"}
        </Button>
      ))}
      {!physicalPreviewSupported && (
        <span className="sr-only">
          Physical Design Preview requires WebGL 2. Page and Spread previews are available.
        </span>
      )}
    </fieldset>
  )
}

function ZoomControls({ zoom, onZoomChange }: Pick<PreviewToolbarProps, "zoom" | "onZoomChange">) {
  return (
    <div className="preview-zoom-controls flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        className="size-11"
        aria-label="Zoom out"
        disabled={zoom <= 50}
        onClick={() => onZoomChange(Math.max(50, zoom - 25))}
      >
        <Minus />
      </Button>
      <span className="w-10 text-center text-caption text-muted-foreground" aria-live="polite">
        {zoom}%
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-11"
        aria-label="Zoom in"
        disabled={zoom >= 300}
        onClick={() => onZoomChange(Math.min(300, zoom + 25))}
      >
        <Plus />
      </Button>
      <Button
        variant="outline"
        className="min-h-11 px-3 text-xs"
        aria-label="Fit preview"
        title="Reset zoom and fit to canvas"
        onClick={() => onZoomChange(100)}
      >
        <Maximize aria-hidden="true" /> Fit
      </Button>
    </div>
  )
}

function PreviewTitle({
  document,
  currentPage,
  mode,
  guideShown,
}: Pick<PreviewToolbarProps, "document" | "currentPage" | "mode"> & {
  guideShown: boolean
}) {
  const pageSize = guideShown ? document.pageLayout.paper : document.pageSize
  const shownPages =
    mode === "spread" ? getReaderPose(currentPage, document.totalPages).pages : [currentPage]
  const pageLabel =
    shownPages.length === 2 ? `Pages ${shownPages.join("–")}` : `Page ${currentPage}`
  return (
    <div className="preview-toolbar-title text-caption text-muted-foreground">
      <p className="font-semibold text-foreground">
        {guideShown
          ? "Punch guide"
          : mode === "physical"
            ? "Physical Design Preview"
            : `${pageLabel} of ${document.totalPages}`}
      </p>
      <p>
        {guideShown ? "Separate sheet" : document.pageName} · {formatMillimeters(pageSize.width)} ×{" "}
        {formatMillimeters(pageSize.height)} mm
      </p>
    </div>
  )
}

const navigationLabels = {
  page: { previous: "Previous page", next: "Next page" },
  spread: { previous: "Previous spread", next: "Next spread" },
  physical: { previous: "Physical previous", next: "Physical next" },
}

function PreviewPageNavigation({
  settings,
  document,
  currentPage,
  onCurrentPageChange,
  mode,
}: Pick<
  PreviewToolbarProps,
  "settings" | "document" | "currentPage" | "onCurrentPageChange" | "mode"
>) {
  const readerOrder =
    mode === "spread" || (mode === "physical" && isFoldedBinding(settings.binding))
  const previousPage = readerOrder
    ? stepReaderPose(currentPage, document.totalPages, -1)
    : Math.max(1, currentPage - 1)
  const nextPage = readerOrder
    ? stepReaderPose(currentPage, document.totalPages, 1)
    : Math.min(document.totalPages, currentPage + 1)
  const labels = navigationLabels[readerOrder ? mode : "page"]
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        className="size-11"
        aria-label={labels.previous}
        disabled={previousPage === currentPage}
        onClick={() => onCurrentPageChange(previousPage)}
      >
        <ArrowLeft />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-11"
        aria-label={labels.next}
        disabled={nextPage === currentPage}
        onClick={() => onCurrentPageChange(nextPage)}
      >
        <ArrowRight />
      </Button>
    </div>
  )
}

function PreviewToolbar(props: PreviewToolbarProps) {
  const { settings, mode, previewPunchGuide, onPreviewPunchGuideChange } = props
  const guide = createPunchGuideViewModel(props.document, previewPunchGuide)
  return (
    <div className="preview-toolbar flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-secondary px-3 py-2 text-secondary-foreground">
      <PreviewModeSwitch {...props} />
      <PreviewTitle {...props} guideShown={guide.shown} />
      <div className="preview-toolbar-actions flex flex-wrap items-center gap-2">
        {mode !== "physical" && (
          <ZoomControls zoom={props.zoom} onZoomChange={props.onZoomChange} />
        )}
        {usesSeparatePunchGuide(settings.punchHolePlacement) && (
          <Button
            variant="outline"
            className="min-h-11 px-3 text-xs"
            aria-pressed={guide.shown}
            onClick={() => {
              if (mode === "physical") props.onModeChange("page")
              onPreviewPunchGuideChange(!guide.shown)
            }}
          >
            {guide.toggleLabel}
          </Button>
        )}
        {!guide.shown && <PreviewPageNavigation {...props} />}
      </div>
    </div>
  )
}

function usePreviewViewport() {
  const viewportRef = useRef<HTMLElement>(null)
  const [availableSize, setAvailableSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const measure = () =>
      setAvailableSize({
        width: Math.max(0, element.clientWidth - 32),
        height: Math.max(0, element.clientHeight - 32),
      })
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [])
  return { viewportRef, availableSize }
}

function PunchGuidePreview({
  document,
  punchGuide,
  paperColor,
  ariaLabel,
}: Pick<PreviewProps, "document"> & {
  punchGuide: NonNullable<NotebookDocument["guide"]>
  paperColor: Settings["previewPaperColor"]
  ariaLabel: string | undefined
}) {
  const layout = document.pageLayout.layout
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={`grid h-full w-full overflow-hidden bg-paper ${layout === "stacked" ? "grid-rows-2 divide-y" : layout === "side-by-side" ? "grid-cols-2 divide-x" : "grid-cols-1"}`}
    >
      {punchGuide.pages.map((page) => (
        <div className="min-h-0 min-w-0 overflow-hidden" key={page}>
          <PageSvg
            settings={punchGuide.settings}
            punchHoleSets={document.punchHoleSets}
            logicalPage={page}
            paperColor={paperColor}
            showPunchHoles
            className="block h-full w-full"
          />
        </div>
      ))}
    </div>
  )
}

function FlatPreview({
  settings,
  document,
  currentPage,
  previewPunchGuide,
  mode,
  zoom,
}: Pick<
  PreviewToolbarProps,
  "settings" | "document" | "currentPage" | "previewPunchGuide" | "mode" | "zoom"
>) {
  const { viewportRef, availableSize } = usePreviewViewport()
  const guide = createPunchGuideViewModel(document, previewPunchGuide)
  const punchGuide = guide.guide
  const readingPages =
    mode === "spread" ? getReaderPose(currentPage, document.totalPages).pages : [currentPage]
  const rightBound = settings.binding === "yotsume" && settings.bindingEdge === "right"
  const pages = rightBound && readingPages.length === 2 ? [...readingPages].reverse() : readingPages
  const dimensions = guide.shown
    ? document.pageLayout.paper
    : { width: document.pageSize.width * pages.length, height: document.pageSize.height }
  const scale =
    (Math.min(availableSize.width / dimensions.width, availableSize.height / dimensions.height) *
      zoom) /
    100

  return (
    <section
      ref={viewportRef}
      className="preview-canvas flex min-h-0 min-w-0 flex-1 overflow-auto p-4"
      aria-label="Preview canvas"
    >
      <div
        className="preview-page-size relative m-auto flex shrink-0 shadow-paper"
        style={{ width: dimensions.width * scale, height: dimensions.height * scale }}
      >
        {guide.shown && punchGuide ? (
          <PunchGuidePreview
            document={document}
            punchGuide={punchGuide}
            paperColor={settings.previewPaperColor}
            ariaLabel={guide.ariaLabel}
          />
        ) : (
          pages.map((page) => (
            <div className="h-full min-w-0 flex-1" key={page}>
              <PageSvg
                settings={settings}
                punchHoleSets={document.punchHoleSets}
                logicalPage={page}
                paperColor={settings.previewPaperColor}
                showPunchHoles={document.punchHolePages.has(page)}
                className="block h-full w-full"
                ariaLabel={
                  mode === "spread"
                    ? `Notebook spread preview, page ${page}`
                    : "Notebook page preview"
                }
              />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export function Preview(props: PreviewProps) {
  const [physicalPreviewSupported] = useState(() =>
    Boolean(document.createElement("canvas").getContext("webgl2")),
  )
  const [zoom, setZoom] = useState(100)
  const [mode, setMode] = useState<PreviewMode>("page")
  const [materialPreset, setMaterialPreset] = useState<MaterialPresetId>("everyday")
  const [opening, setOpening] = useState(65)
  return (
    <main className="preview-workspace h-full min-h-0 min-w-0 flex flex-col overflow-hidden bg-canvas">
      <PreviewToolbar
        {...props}
        physicalPreviewSupported={physicalPreviewSupported}
        zoom={zoom}
        onZoomChange={setZoom}
        mode={mode}
        onModeChange={setMode}
      />
      {mode === "physical" ? (
        <Suspense
          fallback={
            <div
              className="flex min-h-0 flex-1 items-center justify-center bg-primary text-primary-foreground"
              role="status"
            >
              Loading Physical Design Preview…
            </div>
          }
        >
          <PhysicalDesignPreview
            settings={props.settings}
            document={props.document}
            currentPage={props.currentPage}
            onCurrentPageChange={props.onCurrentPageChange}
            materialPreset={materialPreset}
            opening={opening}
            onMaterialPresetChange={setMaterialPreset}
            onOpeningChange={setOpening}
          />
        </Suspense>
      ) : (
        <FlatPreview {...props} mode={mode} zoom={zoom} />
      )}
    </main>
  )
}
