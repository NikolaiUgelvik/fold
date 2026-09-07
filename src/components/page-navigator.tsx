import { CheckSquare, Settings2 } from "lucide-react"
import {
  type KeyboardEvent,
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { SelectControl } from "@/components/form-controls"
import { PageSvg } from "@/components/notebook-page"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { NotebookDocument } from "@/lib/notebook-document"
import { pageRange, parsePageSelection } from "@/lib/page-selection"
import { countPageAppearanceOverrides, resolvePageAppearance, type Settings } from "@/lib/settings"

export type PageNavigatorProps = {
  settings: Settings
  document: NotebookDocument
  currentPage: number
  selectedPages: number[]
  editingDefaults: boolean
  onSelectionChange: (pages: number[], focusedPage: number) => void
  onEditDefaults: () => void
  onOpenSetup: () => void
}

type SelectionGesture = {
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  toggle?: boolean
}

const pageLabels: Record<Settings["pattern"] | Settings["customPages"][number]["type"], string> = {
  dots: "Dotted",
  cross: "Cross grid",
  lines: "Lined",
  grid: "Grid",
  graph: "Graph paper",
  fourLine: "Four-line",
  slant: "Slant-line",
  blank: "Blank",
  title: "Title page",
  index: "Index",
  sudoku: "Sudoku",
}

type PageSelectionToolsProps = Pick<PageNavigatorProps, "document" | "currentPage"> & {
  onSelect: (pages: number[], focusedPage?: number) => void
}

function PageRangeSelection({
  document,
  onSelect,
}: Pick<PageSelectionToolsProps, "document" | "onSelect">) {
  const id = useId()
  const [rangeInput, setRangeInput] = useState("")
  const [rangeSubmitted, setRangeSubmitted] = useState(false)
  const result = useMemo(
    () => parsePageSelection(rangeInput, document.totalPages),
    [rangeInput, document.totalPages],
  )
  const showRangeResult = Boolean(rangeInput.trim()) || rangeSubmitted

  return (
    <>
      <form
        className="grid gap-1"
        onSubmit={(event) => {
          event.preventDefault()
          setRangeSubmitted(true)
          if (result.pages) onSelect(result.pages)
        }}
      >
        <label htmlFor={`${id}-range`} className="text-xs font-semibold">
          Select pages
        </label>
        <div className="flex gap-1">
          <Input
            id={`${id}-range`}
            className="min-h-11 bg-card"
            placeholder="3–16,21–24"
            value={rangeInput}
            aria-invalid={showRangeResult && Boolean(result.error)}
            aria-describedby={`${id}-range-help`}
            onChange={(event) => {
              setRangeInput(event.target.value)
              setRangeSubmitted(false)
            }}
          />
          <Button type="submit" variant="outline" className="min-h-11 px-3">
            Select
          </Button>
        </div>
        <p
          id={`${id}-range-help`}
          className={`text-caption leading-4 ${showRangeResult && result.error ? "text-destructive" : "text-muted-foreground"}`}
          aria-live="polite"
        >
          {showRangeResult
            ? (result.error ?? `${result.pages?.length} pages in this selection`)
            : "Use ranges, all, odd, or even. Logical page numbers."}
        </p>
      </form>
      <fieldset className="grid grid-cols-3 gap-1" aria-label="Quick page selection">
        {(["all", "odd", "even"] as const).map((value) => (
          <Button
            key={value}
            variant="outline"
            className="min-h-11 px-2 text-xs"
            onClick={() => {
              setRangeInput(value)
              setRangeSubmitted(true)
              const selection = parsePageSelection(value, document.totalPages)
              if (selection.pages) onSelect(selection.pages)
            }}
          >
            {value === "all" ? "All pages" : value === "odd" ? "Odd" : "Even"}
          </Button>
        ))}
      </fieldset>
    </>
  )
}

function PageJumpControl({ document, currentPage, onSelect }: PageSelectionToolsProps) {
  const id = useId()
  const [jumpInput, setJumpInput] = useState("")
  const [jumpError, setJumpError] = useState("")
  return (
    <>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const page = Number(jumpInput)
          if (
            !/^\d+$/.test(jumpInput.trim()) ||
            !Number.isSafeInteger(page) ||
            page < 1 ||
            page > document.totalPages
          ) {
            setJumpError(`Enter a page from 1 to ${document.totalPages}.`)
            return
          }
          setJumpError("")
          onSelect([page], page)
          setJumpInput("")
        }}
      >
        <label htmlFor={`${id}-jump`} className="shrink-0 text-xs font-semibold">
          Go to
        </label>
        <Input
          id={`${id}-jump`}
          className="min-h-11 bg-card"
          inputMode="numeric"
          placeholder={String(currentPage)}
          aria-label="Go to page"
          value={jumpInput}
          aria-invalid={Boolean(jumpError)}
          aria-describedby={jumpError ? `${id}-jump-error` : undefined}
          onChange={(event) => {
            setJumpInput(event.target.value)
            setJumpError("")
          }}
        />
        <Button type="submit" variant="outline" className="min-h-11 px-3">
          Go
        </Button>
      </form>
      {jumpError && (
        <p id={`${id}-jump-error`} role="alert" className="text-caption text-destructive">
          {jumpError}
        </p>
      )}
    </>
  )
}

function PageSelectionTools(props: PageSelectionToolsProps) {
  const { document, onSelect } = props
  const signatures = useMemo(() => {
    const groups = new Map<number, Set<number>>()
    for (const side of document.sides) {
      const pages = groups.get(side.signature) ?? new Set<number>()
      for (const page of side.pages) pages.add(page)
      groups.set(side.signature, pages)
    }
    return [...groups].map(([signature, pages]) => ({
      signature,
      pages: [...pages].sort((left, right) => left - right),
    }))
  }, [document.sides])
  const signatureOptions: Record<string, string> = { "": "Select a Signature…" }
  for (const { signature, pages } of signatures) {
    signatureOptions[String(signature)] = `Signature ${signature} · ${pages.length} pages`
  }
  return (
    <div className="page-selection-tools grid gap-2 border-b px-3 pb-3">
      <PageRangeSelection document={document} onSelect={onSelect} />
      <SelectControl
        value=""
        ariaLabel="Select Signature"
        className="min-h-11 w-full bg-card"
        options={signatureOptions}
        onChange={(value) => {
          const signature = signatures.find((item) => item.signature === Number(value))
          if (signature) onSelect(signature.pages)
        }}
      />
      <PageJumpControl {...props} />
    </div>
  )
}

const ROW_HEIGHT = 144
const OVERSCAN = 2

type PagePreviewListProps = Pick<
  PageNavigatorProps,
  "settings" | "document" | "currentPage" | "selectedPages" | "editingDefaults"
> & {
  touchSelection: boolean
  onSelectPage: (page: number, gesture: SelectionGesture) => void
}

function PagePreviewCaption({
  page,
  label,
  pageNumberText,
  overrideCount,
  focused,
}: {
  page: number
  label: string
  pageNumberText: string
  overrideCount: number
  focused: boolean
}) {
  return (
    <span className="min-w-0 text-xs">
      <strong className="block">Page {page}</strong>
      <span className="mt-1 block text-muted-foreground">{label}</span>
      {pageNumberText !== String(page) && (
        <span className="mt-1 block truncate text-caption text-muted-foreground">
          Number: {pageNumberText}
        </span>
      )}
      {overrideCount > 0 && (
        <span className="mt-1 block text-caption text-muted-foreground">Customized</span>
      )}
      {focused && <span className="mt-1 block text-caption font-semibold">In preview</span>}
    </span>
  )
}

const PagePreviewRow = memo(function PagePreviewRow({
  navigation,
  page,
  selected,
  tabIndex,
  onKeyDown,
  onFocus,
}: {
  navigation: PagePreviewListProps
  page: number
  selected: boolean
  tabIndex: number
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, page: number) => void
  onFocus: (page: number) => void
}) {
  const { settings, document, touchSelection, onSelectPage } = navigation
  const focused = navigation.currentPage === page
  const appearance = resolvePageAppearance(settings, page)
  const label = pageLabels[settings.customPages[page]?.type ?? appearance.pattern]
  const overrideCount = countPageAppearanceOverrides(settings.pageAppearanceOverrides, page)
  const ratio = document.pageSize.width / document.pageSize.height
  return (
    <div
      className={`page-preview-row absolute inset-x-2 flex rounded-md border ${selected ? "border-ring bg-accent" : "border-border bg-card"} ${focused ? "ring-2 ring-ring ring-offset-1" : ""}`}
      style={{ top: (page - 1) * ROW_HEIGHT + 4, height: ROW_HEIGHT - 8 }}
      data-selected={selected}
      data-focused={focused}
    >
      {touchSelection && (
        <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            className="size-5 accent-ring"
            checked={selected}
            onChange={() => onSelectPage(page, { toggle: true })}
            aria-label={`Select page ${page}`}
          />
        </label>
      )}
      <button
        type="button"
        data-page={page}
        className="page-preview-button flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
        tabIndex={tabIndex}
        aria-pressed={selected}
        aria-current={focused ? "page" : undefined}
        aria-label={`Page ${page}, ${label}, displayed number ${appearance.pageNumberText}${overrideCount ? `, ${overrideCount} appearance overrides` : ""}`}
        onClick={(event) => onSelectPage(page, event)}
        onKeyDown={(event) => onKeyDown(event, page)}
        onFocus={() => onFocus(page)}
      >
        <span
          className="shrink-0"
          style={{ width: Math.min(80, 120 * ratio), height: Math.min(120, 80 / ratio) }}
          aria-hidden="true"
        >
          <PageSvg
            settings={settings}
            punchHoleSets={document.punchHoleSets}
            logicalPage={page}
            paperColor={settings.previewPaperColor}
            showPunchHoles={document.punchHolePages.has(page)}
            className="block h-full w-full shadow-sm"
          />
        </span>
        <PagePreviewCaption
          page={page}
          label={label}
          pageNumberText={appearance.pageNumberText}
          overrideCount={overrideCount}
          focused={focused}
        />
      </button>
    </div>
  )
})

function getKeyboardPage(key: string, page: number, totalPages: number) {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return Math.max(1, page - 1)
    case "ArrowDown":
    case "ArrowRight":
      return Math.min(totalPages, page + 1)
    case "Home":
      return 1
    case "End":
      return totalPages
    default:
      return null
  }
}

function PagePreviewList(props: PagePreviewListProps) {
  const { currentPage, document, selectedPages, editingDefaults, onSelectPage } = props
  const viewportRef = useRef<HTMLElement>(null)
  const pendingFocus = useRef(false)
  const [keyboardPage, setKeyboardPage] = useState(currentPage)
  const [viewport, setViewport] = useState({ top: 0, height: 0 })
  const selected = useMemo(() => new Set(selectedPages), [selectedPages])
  const start = Math.max(
    0,
    Math.min(document.totalPages - 1, Math.floor(viewport.top / ROW_HEIGHT) - OVERSCAN),
  )
  const end = Math.min(
    document.totalPages,
    Math.ceil((viewport.top + viewport.height) / ROW_HEIGHT) + OVERSCAN,
  )
  const tabPage = keyboardPage > start && keyboardPage <= end ? keyboardPage : start + 1

  useLayoutEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const update = () => setViewport({ top: element.scrollTop, height: element.clientHeight })
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [])

  function revealPage(page: number) {
    const element = viewportRef.current
    if (!element) return
    const top = (page - 1) * ROW_HEIGHT
    if (top < element.scrollTop) element.scrollTop = top
    else if (top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, top + ROW_HEIGHT - element.clientHeight)
    }
    setViewport({ top: element.scrollTop, height: element.clientHeight })
  }

  useEffect(() => {
    if (editingDefaults || !selectedPages.includes(currentPage)) return
    setKeyboardPage(currentPage)
    const element = viewportRef.current
    if (!element) return
    const top = (currentPage - 1) * ROW_HEIGHT
    if (top < element.scrollTop || top + ROW_HEIGHT > element.scrollTop + element.clientHeight) {
      element.scrollTop = top
      setViewport({ top: element.scrollTop, height: element.clientHeight })
    }
  }, [currentPage, editingDefaults, selectedPages])

  useLayoutEffect(() => {
    if (!pendingFocus.current) return
    const button = viewportRef.current?.querySelector<HTMLButtonElement>(
      `button[data-page="${keyboardPage}"]`,
    )
    if (button) {
      button.focus({ preventScroll: true })
      pendingFocus.current = false
    }
  })

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, page: number) {
    if (event.key === " ") {
      event.preventDefault()
      onSelectPage(page, {
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        toggle: true,
      })
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      onSelectPage(page, event)
      return
    }
    const target = getKeyboardPage(event.key, page, document.totalPages)
    if (target === null) return
    event.preventDefault()
    pendingFocus.current = true
    setKeyboardPage(target)
    revealPage(target)
    if (event.shiftKey || (!event.ctrlKey && !event.metaKey)) onSelectPage(target, event)
  }

  return (
    <section
      ref={viewportRef}
      className="page-navigator-list min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1"
      aria-label="Notebook page previews"
      onScroll={(event) =>
        setViewport({
          top: event.currentTarget.scrollTop,
          height: event.currentTarget.clientHeight,
        })
      }
    >
      <div className="relative" style={{ height: document.totalPages * ROW_HEIGHT }}>
        {Array.from({ length: Math.max(0, end - start) }, (_, index) => {
          const page = start + index + 1
          return (
            <PagePreviewRow
              key={page}
              navigation={props}
              page={page}
              selected={!editingDefaults && selected.has(page)}
              tabIndex={page === tabPage ? 0 : -1}
              onKeyDown={handleKeyDown}
              onFocus={setKeyboardPage}
            />
          )
        })}
      </div>
    </section>
  )
}

export function PageNavigator(props: PageNavigatorProps) {
  const { document, currentPage, selectedPages, editingDefaults, onSelectionChange } = props
  const [touchSelection, setTouchSelection] = useState(false)
  const tools = useRef<HTMLDetailsElement>(null)
  const anchor = useRef(currentPage)
  const lastFocusedPage = useRef(currentPage)

  useEffect(() => {
    if (lastFocusedPage.current !== currentPage) anchor.current = currentPage
    lastFocusedPage.current = currentPage
  }, [currentPage])

  function togglePageSelection(page: number) {
    if (!selectedPages.includes(page)) {
      return [...selectedPages, page].sort((left, right) => left - right)
    }
    if (selectedPages.length === 1) return selectedPages
    return selectedPages.filter((selected) => selected !== page)
  }

  function selectPages(
    pages: number[],
    focusedPage = pages.includes(currentPage) ? currentPage : pages[0],
  ) {
    if (focusedPage === undefined) return
    if (tools.current) tools.current.open = false
    anchor.current = focusedPage
    lastFocusedPage.current = focusedPage
    onSelectionChange(pages, focusedPage)
  }

  function selectPage(page: number, gesture: SelectionGesture) {
    const rangeAnchor = Math.max(1, Math.min(document.totalPages, anchor.current))
    const additive = gesture.ctrlKey || gesture.metaKey
    if (gesture.shiftKey) {
      const range = pageRange(rangeAnchor, page)
      const pages = additive
        ? [...new Set([...selectedPages, ...range])].sort((left, right) => left - right)
        : range
      lastFocusedPage.current = page
      onSelectionChange(pages, page)
      return
    }
    if (!editingDefaults && (gesture.toggle || additive || touchSelection)) {
      const pages = togglePageSelection(page)
      selectPages(pages, pages.includes(page) ? page : undefined)
      return
    }
    selectPages([page], page)
  }

  return (
    <section
      className="page-navigator flex h-full min-h-0 min-w-0 flex-col bg-secondary"
      aria-label="Pages"
    >
      <div className="page-navigator-heading flex items-center justify-between gap-2 px-3 pt-3">
        <h2 className="text-sm font-semibold">
          Pages <span className="font-normal text-muted-foreground">{document.totalPages}</span>
        </h2>
        <Button
          variant="outline"
          className="min-h-11 px-2 text-xs"
          aria-pressed={touchSelection}
          onClick={() => setTouchSelection(!touchSelection)}
        >
          <CheckSquare aria-hidden="true" /> {touchSelection ? "Done selecting" : "Select multiple"}
        </Button>
      </div>
      <details ref={tools} className="page-selection-disclosure">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold">Select pages…</summary>
        <div className="grid grid-cols-2 gap-1 px-3 py-2">
          <Button
            variant="outline"
            className="min-h-11 whitespace-normal px-2 text-xs"
            aria-pressed={editingDefaults}
            onClick={props.onEditDefaults}
          >
            Notebook defaults
          </Button>
          <Button variant="outline" className="min-h-11 px-2 text-xs" onClick={props.onOpenSetup}>
            <Settings2 aria-hidden="true" /> Notebook setup
          </Button>
        </div>
        <PageSelectionTools document={document} currentPage={currentPage} onSelect={selectPages} />
      </details>
      <div
        className="page-selection-status shrink-0 px-3 py-2 text-caption text-muted-foreground"
        aria-live="polite"
      >
        {editingDefaults
          ? "Editing notebook defaults"
          : `${selectedPages.length} ${selectedPages.length === 1 ? "page" : "pages"} selected`}
        <p className="page-selection-help mt-1 text-2xs">
          {touchSelection
            ? "Tap pages or checkboxes. At least one page stays selected."
            : "Shift selects a range. Ctrl/⌘ toggles. Arrows navigate; Space toggles."}
        </p>
      </div>
      <PagePreviewList {...props} touchSelection={touchSelection} onSelectPage={selectPage} />
    </section>
  )
}
