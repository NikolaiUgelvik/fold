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
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import WebGL from "three/addons/capabilities/WebGL.js"

import { PageSvg } from "@/components/notebook-page"
import { Button } from "@/components/ui/button"
import type { ImpositionSide } from "@/lib/imposition"
import { type createNotebookDocument, createPunchGuideViewModel } from "@/lib/notebook-document"
import { formatMillimeters } from "@/lib/paper"
import { usesSeparatePunchGuide } from "@/lib/punch-holes"
import { countPageAppearanceOverrides, resolvePageAppearance, type Settings } from "@/lib/settings"

type PreviewProps = {
  settings: Settings
  document: ReturnType<typeof createNotebookDocument<Settings>>
  currentPage: number
  onCurrentPageChange: (page: number) => void
  previewPunchGuide: boolean
  onPreviewPunchGuideChange: (shown: boolean) => void
}

type PreviewMode = "2d" | "physical"

type PreviewContentProps = PreviewProps & {
  zoom: number
  onZoomChange: (zoom: number) => void
  mode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
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

function PhysicalDesignPreview({ currentPage }: { currentPage: number }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"ready" | "unsupported" | "context-lost">("ready")

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (!WebGL.isWebGL2Available()) {
      setStatus("unsupported")
      return
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.domElement.className = "absolute inset-0 h-full w-full"
    renderer.outputColorSpace = THREE.SRGBColorSpace
    viewport.append(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#25231f")
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    camera.position.set(0, 0, 5)
    const pageBlock = new THREE.Group()
    pageBlock.name = "Page Block"
    scene.add(pageBlock)

    let frame = 0
    const invalidate = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        renderer.render(scene, camera)
      })
    }
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect()
      if (!width || !height) return
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      invalidate()
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      setStatus("context-lost")
    }
    const onContextRestored = () => {
      setStatus("ready")
      resize()
    }
    const resizeObserver = new ResizeObserver(resize)

    renderer.domElement.addEventListener("webglcontextlost", onContextLost)
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored)
    resizeObserver.observe(viewport)
    resize()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost)
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored)
      pageBlock.clear()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  const message =
    status === "unsupported"
      ? "Physical Design Preview requires WebGL 2. Use the 2D preview instead."
      : status === "context-lost"
        ? "Physical Design Preview lost its graphics context. Switch to 2D preview and try again."
        : "Page Block rendering starts here."

  return (
    <div
      ref={viewportRef}
      role="img"
      aria-label={`Physical Design Preview, logical page ${currentPage}`}
      className="relative flex min-h-0 flex-1 items-end overflow-hidden bg-primary p-5 text-primary-foreground"
    >
      <p
        className="relative z-10 max-w-56 text-caption text-primary-foreground/75"
        role={status === "ready" ? undefined : "status"}
      >
        {message}
      </p>
    </div>
  )
}

function PageThumbnail({
  settings,
  logicalPage,
  overrideCount,
  selected,
  onClick,
}: {
  settings: Settings
  logicalPage: number
  overrideCount: number
  selected: boolean
  onClick: () => void
}) {
  const appearance = resolvePageAppearance(settings, logicalPage)
  const pageType = settings.customPages[logicalPage]?.type ?? appearance.pattern
  const { icon: Icon, label } = pageTypeIcons[pageType]

  return (
    <button
      type="button"
      className={`relative flex h-18 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-sm border bg-card text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring ${selected ? "border-ring text-foreground ring-1 ring-ring" : ""}`}
      aria-label={`Logical page ${logicalPage}, displayed number ${appearance.pageNumberText}, ${label}${overrideCount > 0 ? `, ${overrideCount} appearance ${overrideCount === 1 ? "override" : "overrides"}` : ""}`}
      aria-current={selected ? "page" : undefined}
      onClick={onClick}
    >
      {overrideCount > 0 && (
        <span
          className="absolute top-0.5 right-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-3xs font-bold leading-none text-primary-foreground"
          aria-hidden="true"
        >
          {overrideCount}
        </span>
      )}
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
    mode,
    onModeChange,
  } = props
  const { totalPages, pageLayout, pageSize, pageName } = document
  const { shown: showPunchGuide, toggleLabel: guideToggleLabel } = guidePreview
  return (
    <div className="flex h-15 shrink-0 items-center justify-between border-b bg-secondary px-5 text-secondary-foreground">
      <div>
        <p className="text-xs font-semibold">
          {showPunchGuide
            ? "Punch guide"
            : mode === "physical"
              ? "Physical Design Preview"
              : "Live preview"}
        </p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          {showPunchGuide ? "Separate sheet" : pageName} ·{" "}
          {formatMillimeters(showPunchGuide ? pageLayout.paper.width : pageSize.width)} ×{" "}
          {formatMillimeters(showPunchGuide ? pageLayout.paper.height : pageSize.height)} mm
        </p>
      </div>
      <div className="flex items-center gap-2">
        <fieldset className="flex items-center gap-1" aria-label="Preview mode">
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            aria-pressed={mode === "2d"}
            onClick={() => onModeChange("2d")}
          >
            2D
          </Button>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            aria-pressed={mode === "physical"}
            onClick={() => {
              onPreviewPunchGuideChange(false)
              onModeChange("physical")
            }}
          >
            Physical
          </Button>
        </fieldset>
        {mode === "2d" && (
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
            <span
              className="w-10 text-center text-caption text-muted-foreground"
              aria-live="polite"
            >
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
        )}
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
  const { settings, currentPage, zoom, document, guidePreview, mode } = props
  const { punchHoleSets, punchHolePages, pageLayout, pageSize } = document
  const { shown: showPunchGuide, guide: punchGuide, ariaLabel: guideAriaLabel } = guidePreview
  if (mode === "physical") {
    return <PhysicalDesignPreview currentPage={currentPage} />
  }

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
  const overrideCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const page of Object.keys(settings.pageAppearanceOverrides)) {
      const logicalPage = Number(page)
      counts[logicalPage] = countPageAppearanceOverrides(
        settings.pageAppearanceOverrides,
        logicalPage,
      )
    }
    return counts
  }, [settings.pageAppearanceOverrides])
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
                overrideCount={overrideCounts[page] ?? 0}
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
  const [mode, setMode] = useState<PreviewMode>("2d")
  const [showPlan, setShowPlan] = useState(false)
  const contentProps: PreviewContentProps = {
    ...props,
    zoom,
    onZoomChange: setZoom,
    mode,
    onModeChange: setMode,
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
