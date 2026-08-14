import {
  AlignJustify,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  File,
  Grid2X2,
  Grid3X3,
  Grip,
  Heading1,
  List,
  Minus,
  Plus,
} from "lucide-react"
import { type CSSProperties, type ReactNode, useState } from "react"

import { PageSvg } from "@/components/notebook-page"
import { Button } from "@/components/ui/button"
import type { ImpositionSide } from "@/lib/imposition"
import { type createNotebookDocument, createPunchGuideViewModel } from "@/lib/notebook-document"
import { formatMillimeters } from "@/lib/paper"
import { usesSeparatePunchGuide } from "@/lib/punch-holes"
import { resolvePageAppearance, type Settings } from "@/lib/settings"

type PreviewProps = {
  settings: Settings
  document: ReturnType<typeof createNotebookDocument<Settings>>
  currentPage: number
  onCurrentPageChange: (page: number) => void
  previewPunchGuide: boolean
  onPreviewPunchGuideChange: (shown: boolean) => void
}

type PreviewContentProps = PreviewProps & {
  zoom: number
  onZoomChange: (zoom: number) => void
  showPlan: boolean
  onShowPlanChange: (shown: boolean) => void
  guidePreview: ReturnType<typeof createPunchGuideViewModel<Settings>>
}

const pageTypeIcons = {
  dots: { icon: Grip, label: "dotted page" },
  lines: { icon: AlignJustify, label: "lined page" },
  grid: { icon: Grid2X2, label: "grid page" },
  graph: { icon: Grid3X3, label: "graph paper page" },
  blank: { icon: File, label: "blank page" },
  title: { icon: Heading1, label: "title page" },
  index: { icon: List, label: "index page" },
}

function PageThumbnail({
  settings,
  logicalPage,
  selected,
  onClick,
}: {
  settings: Settings
  logicalPage: number
  selected: boolean
  onClick: () => void
}) {
  const appearance = resolvePageAppearance(settings, logicalPage)
  const pageType = settings.customPages[logicalPage]?.type ?? appearance.pattern
  const { icon: Icon, label } = pageTypeIcons[pageType]

  return (
    <button
      type="button"
      className={`flex h-18 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-sm border bg-card text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-ring text-foreground ring-1 ring-ring" : ""}`}
      aria-label={`Logical page ${logicalPage}, displayed number ${appearance.pageNumberText}, ${label}`}
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
    >
      <Icon className="size-5" aria-hidden />
      <span className="max-w-12 truncate text-caption font-semibold text-foreground">
        {appearance.pageNumberText}
      </span>
    </button>
  )
}

function PreviewToolbar(props: PreviewContentProps) {
  const {
    settings,
    currentPage,
    onCurrentPageChange,
    zoom,
    onZoomChange,
    previewPunchGuide,
    onPreviewPunchGuideChange,
    document,
    guidePreview,
  } = props
  const { totalPages, pageLayout, pageSize, pageName } = document
  const { shown: showPunchGuide, toggleLabel: guideToggleLabel } = guidePreview
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
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
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
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
          >
            <Plus />
          </Button>
        </div>
        {usesSeparatePunchGuide(settings.punchHolePlacement) && (
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={() => onPreviewPunchGuideChange(!previewPunchGuide)}
          >
            {guideToggleLabel}
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
              onClick={() => onCurrentPageChange(currentPage - 1)}
            >
              <ArrowLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={currentPage === totalPages}
              onClick={() => onCurrentPageChange(currentPage + 1)}
            >
              <ArrowRight />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

const PreviewPage = (props: PreviewContentProps) => {
  const { settings, currentPage, zoom, document, guidePreview } = props
  const { punchHoleSets, punchHolePages, pageLayout, pageSize } = document
  const { shown: showPunchGuide, guide: punchGuide, ariaLabel: guideAriaLabel } = guidePreview
  return (
    <div className="flex min-h-135 flex-1 overflow-auto p-4 lg:p-6 xl:min-h-0">
      <div
        className="relative m-auto shrink-0 xl:max-h-[var(--preview-max-height)]"
        style={
          {
            aspectRatio: showPunchGuide
              ? `${pageLayout.paper.width} / ${pageLayout.paper.height}`
              : `${pageSize.width} / ${pageSize.height}`,
            height: `min(${zoom * 0.7}vh, ${zoom * 7.4}px)`,
            "--preview-max-height": `${zoom}%`,
          } as CSSProperties
        }
      >
        {showPunchGuide && punchGuide ? (
          <div
            role="img"
            aria-label={guideAriaLabel}
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

function PreviewStrip(props: PreviewContentProps) {
  const {
    settings,
    currentPage,
    onCurrentPageChange,
    onPreviewPunchGuideChange,
    showPlan,
    onShowPlanChange,
    document,
    guidePreview,
  } = props
  const firstSignature = document.sides.filter((side) => side.signature === 1)
  const pages = Array.from({ length: document.totalPages }, (_, index) => index + 1)
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
          onClick={() => onShowPlanChange(!showPlan)}
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
                      {resolvePageAppearance(settings, page).pageNumberText}
                    </span>
                  ))}
                </div>
              </div>
            ))
          : pages.map((page) => (
              <PageThumbnail
                settings={settings}
                logicalPage={page}
                selected={!guidePreview.shown && currentPage === page}
                onClick={() => {
                  onCurrentPageChange(page)
                  onPreviewPunchGuideChange(false)
                }}
                key={page}
              />
            ))}
      </div>
    </section>
  )
}

// fallow-ignore-next-line private-type-leak -- Props are private to this feature module.
export function Preview(props: PreviewProps): ReactNode {
  const [zoom, setZoom] = useState(100)
  const [showPlan, setShowPlan] = useState(false)
  const contentProps: PreviewContentProps = {
    ...props,
    zoom,
    onZoomChange: setZoom,
    showPlan,
    onShowPlanChange: setShowPlan,
    guidePreview: createPunchGuideViewModel(props.document, props.previewPunchGuide),
  }
  return (
    <main className="flex min-h-175 min-w-0 flex-col bg-canvas xl:h-full xl:min-h-0 xl:overflow-hidden">
      <PreviewToolbar {...contentProps} />

      <PreviewPage {...contentProps} />

      <PreviewStrip {...contentProps} />
    </main>
  )
}
