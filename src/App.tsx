import { BookOpen, PanelsTopLeft, SlidersHorizontal } from "lucide-react"
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { BookSetup } from "@/components/book-setup"
import { PageNavigator } from "@/components/page-navigator"
import { PageProperties } from "@/components/page-properties"
import { Preview } from "@/components/preview"
import { PrintDocument } from "@/components/print-document"
import { PrintPreparation } from "@/components/print-preparation"
import { ProjectsPanel } from "@/components/projects"
import { WorkspaceDialog } from "@/components/workspace-dialog"
import { WorkspaceHeader } from "@/components/workspace-header"
import type { Workspace } from "@/lib/editor-history"
import { ensurePageNumberFontsLoaded } from "@/lib/font-loading"
import { getPrintPages, type PrintPass } from "@/lib/imposition"
import {
  createNotebookDocument,
  createNotebookDocumentKernel,
  type NotebookDocument,
} from "@/lib/notebook-document"
import { type PunchHolePlacement, usesSeparatePunchGuide } from "@/lib/punch-holes"
import type { Settings } from "@/lib/settings"
import { useWorkspace } from "@/lib/use-workspace"

type PrintSnapshot = { settings: Settings; pass: PrintPass; includeGuide: boolean }
type MobilePanel = "pages" | "edit" | "setup"

function usePrintExport(settings: Settings, notebook: NotebookDocument) {
  const [snapshot, setSnapshot] = useState<PrintSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  useEffect(() => {
    if (!snapshot) return
    const clear = () => setSnapshot(null)
    const frame = requestAnimationFrame(() => window.print())
    window.addEventListener("afterprint", clear, { once: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("afterprint", clear)
    }
  }, [snapshot])
  async function print(pass: PrintPass, includeGuide: boolean) {
    const request = ++requestId.current
    setBusy(true)
    setError(null)
    try {
      await ensurePageNumberFontsLoaded(
        window.document.fonts,
        settings,
        getPrintPages(notebook.sides, pass),
      )
      if (request === requestId.current) setSnapshot({ settings, pass, includeGuide })
    } catch (error) {
      if (request === requestId.current)
        setError(
          error instanceof Error
            ? `${error.message}. Printing was cancelled.`
            : "Could not prepare pages. Printing was cancelled.",
        )
    } finally {
      if (request === requestId.current) setBusy(false)
    }
  }
  function cancel() {
    requestId.current++
    setSnapshot(null)
    setBusy(false)
    setError(null)
  }
  return { snapshot, busy, error, print, cancel }
}

function useNotebook(settings: Settings) {
  const kernel = useMemo(
    () =>
      createNotebookDocumentKernel({
        binding: settings.binding,
        paper: settings.paper,
        yotsumeOrientation: settings.yotsumeOrientation,
        yotsumeTwoUp: settings.yotsumeTwoUp,
        signatures: settings.signatures,
        sheets: settings.sheets,
      }),
    [
      settings.binding,
      settings.paper,
      settings.yotsumeOrientation,
      settings.yotsumeTwoUp,
      settings.signatures,
      settings.sheets,
    ],
  )
  return useMemo(() => createNotebookDocument(settings, kernel), [settings, kernel])
}

function usePageSelection(totalPages: number) {
  const [raw, setSelection] = useState({ pages: [1], currentPage: 1 })
  const [editingDefaults, setEditingDefaults] = useState(false)
  const selection = useMemo(() => {
    const currentPage = Math.min(raw.currentPage, totalPages)
    const pages = raw.pages.filter((page) => page <= totalPages)
    return { currentPage, pages: pages.length ? pages : [currentPage] }
  }, [raw, totalPages])
  useEffect(() => {
    if (selection.currentPage !== raw.currentPage || selection.pages.length !== raw.pages.length)
      setSelection(selection)
  }, [selection, raw])
  function select(pages: number[], currentPage: number) {
    setSelection({ pages, currentPage })
    setEditingDefaults(false)
  }
  return { ...selection, editingDefaults, setEditingDefaults, select }
}

function MobileNavigation({
  active,
  onChange,
}: {
  active: MobilePanel
  onChange: (panel: MobilePanel) => void
}) {
  return (
    <nav className="mobile-workspace-nav" aria-label="Workspace panels">
      {(
        [
          { value: "pages", label: "Pages", icon: BookOpen },
          { value: "edit", label: "Edit", icon: PanelsTopLeft },
          { value: "setup", label: "Setup", icon: SlidersHorizontal },
        ] as const
      ).map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={active === value}
          onClick={() => onChange(value)}
          className={active === value ? "bg-accent text-accent-foreground" : ""}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </nav>
  )
}

function WorkspaceNotice({
  error,
  recovery,
  onDismiss,
}: {
  error: string
  recovery: string
  onDismiss: () => void
}) {
  if (error)
    return (
      <p role="alert" className="workspace-notice text-destructive">
        {error}
      </p>
    )
  if (!recovery) return null
  return (
    <div className="workspace-notice">
      <p role="status">{recovery}</p>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

function App() {
  const workspace = useWorkspace()
  const { settings } = workspace
  const notebook = useNotebook(settings)
  const selection = usePageSelection(notebook.totalPages)
  const printing = usePrintExport(settings, notebook)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("edit")
  const [sheetHeight, setSheetHeight] = useState(48)
  const [dialog, setDialog] = useState<"setup" | "projects" | "print" | null>(null)
  const [previewPunchGuide, setPreviewPunchGuide] = useState(false)
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  function selectPages(pages: number[], currentPage: number) {
    workspace.endEdit()
    selection.select(pages, currentPage)
    setPreviewPunchGuide(false)
  }
  function changePunchHolePlacement(placement: PunchHolePlacement) {
    workspace.updateSettings("punchHolePlacement", placement)
    setPreviewPunchGuide(usesSeparatePunchGuide(placement))
  }
  function openWorkspace(next: Workspace) {
    workspace.open(next)
    selectPages([1], 1)
    setDialog(null)
    setNoticeDismissed(true)
  }
  function openSetup() {
    if (window.matchMedia("(min-width: 64rem)").matches) setDialog("setup")
    else setMobilePanel("setup")
  }
  function closeDialog() {
    printing.cancel()
    setDialog(null)
  }
  function focusEdit(event: FocusEvent) {
    if (["projects", "print"].includes(dialog ?? "")) return
    if (
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLInputElement &&
        !["checkbox", "radio"].includes(event.target.type))
    )
      workspace.beginEdit()
  }
  function undoShortcut(event: KeyboardEvent) {
    if (["projects", "print"].includes(dialog ?? "")) return
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return
    const key = event.key.toLowerCase()
    if (!["z", "y"].includes(key)) return
    event.preventDefault()
    const redo = event.shiftKey || key === "y"
    ;(redo ? workspace.redo : workspace.undo)()
    workspace.beginEdit()
  }

  const setup = (
    <BookSetup
      settings={settings}
      document={notebook}
      onSettingsChange={workspace.updateSettings}
      onPunchHolePlacementChange={changePunchHolePlacement}
    />
  )
  return (
    <>
      <section
        className="screen-app editor-app"
        aria-label="Notebook editor"
        data-mobile-panel={mobilePanel}
        onFocusCapture={focusEdit}
        onBlur={workspace.endEdit}
        onKeyDownCapture={undoShortcut}
      >
        <WorkspaceHeader
          name={workspace.name}
          onNameChange={workspace.updateName}
          saveStatus={workspace.saveStatus}
          canUndo={workspace.canUndo}
          canRedo={workspace.canRedo}
          onUndo={workspace.undo}
          onRedo={workspace.redo}
          onProjects={() => setDialog("projects")}
          onPrint={() => setDialog("print")}
        />
        <WorkspaceNotice
          error={workspace.storageError}
          recovery={noticeDismissed ? "" : workspace.recoveryNotice}
          onDismiss={() => setNoticeDismissed(true)}
        />
        <div
          className="workspace-grid"
          style={{ "--sheet-height": `${sheetHeight}%` } as CSSProperties}
        >
          <div className="navigator-panel workspace-sheet">
            <PageNavigator
              settings={settings}
              document={notebook}
              currentPage={selection.currentPage}
              selectedPages={selection.pages}
              editingDefaults={selection.editingDefaults}
              onSelectionChange={selectPages}
              onEditDefaults={() => {
                workspace.endEdit()
                selection.setEditingDefaults(true)
                setMobilePanel("edit")
              }}
              onOpenSetup={openSetup}
            />
          </div>
          <div className="preview-panel">
            <Preview
              settings={settings}
              document={notebook}
              currentPage={selection.currentPage}
              onCurrentPageChange={(page) => selectPages([page], page)}
              previewPunchGuide={previewPunchGuide}
              onPreviewPunchGuideChange={setPreviewPunchGuide}
            />
          </div>
          <div className="mobile-sheet-resizer">
            <label htmlFor="sheet-height">Panel height</label>
            <input
              id="sheet-height"
              type="range"
              min="30"
              max="65"
              value={sheetHeight}
              onChange={(event) => setSheetHeight(Number(event.target.value))}
            />
          </div>
          <div className="inspector-panel workspace-sheet">
            <PageProperties
              settings={settings}
              currentPage={selection.currentPage}
              selectedPages={selection.pages}
              editingDefaults={selection.editingDefaults}
              pageSize={notebook.pageSize}
              onSettingsChange={workspace.updateSettings}
            />
          </div>
          {mobilePanel === "setup" && <div className="setup-panel workspace-sheet">{setup}</div>}
        </div>
        <MobileNavigation active={mobilePanel} onChange={setMobilePanel} />
        {dialog === "setup" && (
          <WorkspaceDialog title="Notebook setup" onClose={closeDialog}>
            {setup}
          </WorkspaceDialog>
        )}
        {dialog === "projects" && (
          <WorkspaceDialog title="Projects" onClose={closeDialog}>
            <ProjectsPanel
              settings={settings}
              name={workspace.name}
              hasChanges={workspace.hasChanges}
              onOpen={openWorkspace}
              onSaved={workspace.markSaved}
            />
          </WorkspaceDialog>
        )}
        {dialog === "print" && (
          <WorkspaceDialog title="Print / PDF" className="print-dialog" onClose={closeDialog}>
            <PrintPreparation
              settings={settings}
              document={notebook}
              onPrint={printing.print}
              busy={printing.busy}
              error={printing.error}
            />
          </WorkspaceDialog>
        )}
      </section>
      {printing.snapshot && <PrintDocument {...printing.snapshot} />}
    </>
  )
}

export default App
