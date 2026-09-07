import { createContext, type ReactNode, useContext, useId, useState } from "react"

import {
  CheckboxField,
  ColorField,
  Field,
  type FieldMetadata,
  FieldRow,
  NumberField,
  SelectControl,
} from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TabBar, TabBarTrigger, Tabs, TabsContent } from "@/components/ui/tabs"
import { getNumberFont, isPageNumberTextSupported, numberFonts } from "@/lib/font-loading"
import {
  changeSelectedTemplate,
  editSudokuSelection,
  type PageTemplate,
  resetSelectedAppearance,
  type SudokuSelectionEdit,
  selectionValue,
  updateSelectedAppearance,
  updateSelectedContent,
} from "@/lib/page-editing"
import { displayedPage } from "@/lib/page-numbering"
import {
  type PageAppearance,
  type PageAppearanceOverride,
  type ResolvedPageAppearance,
  resolvePageAppearance,
  type Settings,
  type SettingsUpdate,
} from "@/lib/settings"
import type { SudokuDifficulty } from "@/lib/sudoku-difficulty"

export type PagePropertiesProps = {
  settings: Settings
  currentPage: number
  selectedPages: number[]
  editingDefaults: boolean
  pageSize: { width: number; height: number }
  onSettingsChange: SettingsUpdate
}

type AppearanceEditor = Pick<
  PagePropertiesProps,
  "settings" | "selectedPages" | "editingDefaults" | "onSettingsChange"
> & { appearances: ResolvedPageAppearance[] }

const AppearanceContext = createContext<AppearanceEditor | null>(null)

type AppearanceKey = keyof ResolvedPageAppearance
type NumberSettingKey = {
  [Key in keyof PageAppearance]: PageAppearance[Key] extends number ? Key : never
}[keyof PageAppearance]
type StringSettingKey = {
  [Key in keyof PageAppearance]: PageAppearance[Key] extends string ? Key : never
}[keyof PageAppearance]

function useAppearanceEditor() {
  const editor = useContext(AppearanceContext)
  if (!editor) throw new Error("Appearance fields require the page inspector")
  return editor
}

function useAppearanceField<Key extends AppearanceKey>(key: Key) {
  const { settings, selectedPages, editingDefaults, appearances, onSettingsChange } =
    useAppearanceEditor()
  const value = selectionValue(appearances, (appearance) => appearance[key])
  const overrideKey =
    key === "numberVisibility" ? "numberVisible" : (key as keyof PageAppearanceOverride)
  const customCount = editingDefaults
    ? 0
    : selectedPages.reduce(
        (count, page) =>
          count + Number(Object.hasOwn(settings.pageAppearanceOverrides[page] ?? {}, overrideKey)),
        0,
      )
  const state: FieldMetadata["state"] = editingDefaults
    ? "default"
    : customCount === 0
      ? "inherited"
      : customCount === selectedPages.length
        ? "custom"
        : "mixed"

  return {
    value,
    mixed: value === undefined,
    state,
    onReset:
      !editingDefaults && customCount > 0
        ? () =>
            onSettingsChange(
              "pageAppearanceOverrides",
              updateSelectedAppearance(
                settings.pageAppearanceOverrides,
                selectedPages,
                overrideKey,
                undefined,
              ),
            )
        : undefined,
    onChange: (nextValue: ResolvedPageAppearance[Key]) => {
      if (editingDefaults) {
        if (key === "numberVisible" || key === "pageNumberText") {
          throw new Error("Page-specific numbering requires a page selection")
        }
        onSettingsChange(
          key as keyof PageAppearance,
          nextValue as PageAppearance[keyof PageAppearance],
        )
        return
      }
      onSettingsChange(
        "pageAppearanceOverrides",
        updateSelectedAppearance(
          settings.pageAppearanceOverrides,
          selectedPages,
          overrideKey,
          nextValue as PageAppearanceOverride[typeof overrideKey],
        ),
      )
    },
  }
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>
}

function NumberSettingField({
  setting,
  ...props
}: {
  setting: NumberSettingKey
  label: string
  min: number
  max: number
  step?: number
}) {
  const field = useAppearanceField(setting)
  return <NumberField {...props} {...field} />
}

function ColorSettingField({
  setting,
  label,
}: {
  setting:
    | "dotColor"
    | "crossColor"
    | "lineColor"
    | "graphMajorColor"
    | "borderColor"
    | "numberColor"
  label: string
}) {
  const field = useAppearanceField(setting)
  return <ColorField label={label} {...field} />
}

function SelectSettingField<Key extends StringSettingKey>({
  setting,
  label,
  options,
  hint,
}: {
  setting: Key
  label: string
  options: Record<string, string>
  hint?: string
}) {
  const id = useId()
  const { value, mixed, state, onReset, onChange } = useAppearanceField(setting)
  return (
    <Field label={label} htmlFor={id} hint={hint} state={state} onReset={onReset}>
      <SelectControl
        id={id}
        value={value}
        mixed={mixed}
        options={options}
        onChange={(next) => onChange(next as ResolvedPageAppearance[Key])}
      />
    </Field>
  )
}

const pointPatternFields = {
  dots: {
    size: { setting: "dotSize", label: "Dot size (mm)", min: 0.05, max: 2 },
    spacing: "dotSpacing",
    color: { setting: "dotColor", label: "Dot color" },
  },
  cross: {
    size: { setting: "crossLineWidth", label: "Thickness (mm)", min: 0.05, max: 1 },
    spacing: "crossSpacing",
    color: { setting: "crossColor", label: "Cross color" },
  },
} as const

function PointPatternSection({ pattern }: { pattern: "dots" | "cross" }) {
  const fields = pointPatternFields[pattern]
  return (
    <>
      {pattern === "cross" && (
        <>
          <FieldRow>
            <NumberSettingField
              setting="crossHorizontalLength"
              label="Horizontal length (mm)"
              min={0.1}
              max={10}
              step={0.1}
            />
            <NumberSettingField
              setting="crossVerticalLength"
              label="Vertical length (mm)"
              min={0.1}
              max={10}
              step={0.1}
            />
          </FieldRow>
          <p className="text-xs leading-4 text-muted-foreground">
            Lengths span each full stroke, from end to end.
          </p>
        </>
      )}
      <FieldRow>
        <NumberSettingField {...fields.size} step={0.05} />
        <NumberSettingField
          setting={fields.spacing}
          label="Spacing (mm)"
          min={2}
          max={20}
          step={0.5}
        />
      </FieldRow>
      {pattern === "dots" && (
        <>
          <FieldRow>
            <NumberSettingField setting="dotMajorEvery" label="Major interval" min={0} max={20} />
            <NumberSettingField
              setting="dotMajorSize"
              label="Major size (mm)"
              min={0.05}
              max={4}
              step={0.05}
            />
          </FieldRow>
          <p className="text-xs leading-4 text-muted-foreground">
            Set the interval to 0 to disable major dots.
          </p>
        </>
      )}
      <ColorSettingField {...fields.color} />
    </>
  )
}

function LinePatternSection({ graph }: { graph: boolean }) {
  return (
    <>
      <FieldRow>
        <NumberSettingField
          setting="lineWidth"
          label={graph ? "Thin width (mm)" : "Line width (mm)"}
          min={0.05}
          max={1}
          step={0.05}
        />
        <NumberSettingField
          setting="lineSpacing"
          label={graph ? "Cell size (mm)" : "Spacing (mm)"}
          min={3}
          max={20}
          step={0.5}
        />
      </FieldRow>
      <ColorSettingField setting="lineColor" label={graph ? "Thin line color" : "Line color"} />
    </>
  )
}

function GraphSection() {
  const { value, onChange, ...metadata } = useAppearanceField("graphCompleteBlocks")
  return (
    <>
      <FieldRow>
        <NumberSettingField setting="graphMajorEvery" label="Cells per block" min={2} max={20} />
        <NumberSettingField
          setting="graphMajorLineWidth"
          label="Thick width (mm)"
          min={0.05}
          max={2}
          step={0.05}
        />
      </FieldRow>
      <ColorSettingField setting="graphMajorColor" label="Thick line color" />
      <CheckboxField
        checked={value}
        onChange={onChange}
        {...metadata}
        title="Complete blocks only"
        description="Remove partial cell groups and center the grid."
      />
    </>
  )
}

function PatternDetails({
  pattern,
  overlayPattern,
}: {
  pattern: PageAppearance["pattern"] | undefined
  overlayPattern: PageAppearance["overlayPattern"] | undefined
}) {
  let patternFields: ReactNode
  switch (pattern) {
    case undefined:
      patternFields = (
        <p className="text-xs leading-4 text-muted-foreground">
          Patterns are mixed. Choose a pattern to edit its specific settings across the selection.
        </p>
      )
      break
    case "blank":
      patternFields = null
      break
    case "dots":
    case "cross":
      patternFields = <PointPatternSection pattern={pattern} />
      break
    default:
      patternFields = <LinePatternSection graph={pattern === "graph"} />
  }
  return (
    <>
      {patternFields}
      {pattern === "fourLine" && (
        <>
          <NumberSettingField
            setting="fourLineGap"
            label="Group gap (mm)"
            min={0}
            max={20}
            step={0.5}
          />
          <p className="text-xs leading-4 text-muted-foreground">
            Four lines per group, with a wider gap between groups for handwriting practice.
          </p>
        </>
      )}
      {(pattern === "slant" || overlayPattern === "slant") && (
        <NumberSettingField setting="slantAngle" label="Angle from vertical (°)" min={5} max={45} />
      )}
      {pattern === "graph" && <GraphSection />}
    </>
  )
}

function TemplateSuppressionNotice() {
  return (
    <p className="rounded-md border bg-muted p-3 text-sm leading-5 text-muted-foreground">
      The selection includes title, index, or Sudoku templates, which replace the pattern and
      border. Select only default pages, or choose Default page in Content, to edit these settings.
      Existing appearance values are retained.
    </p>
  )
}

function StyleTab({ templatesSuppressStyle }: { templatesSuppressStyle: boolean }) {
  const pattern = useAppearanceField("pattern")
  const overlay = useAppearanceField("overlayPattern")
  return (
    <TabsContent value="style" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Page pattern</SectionTitle>
        {templatesSuppressStyle ? (
          <TemplateSuppressionNotice />
        ) : (
          <>
            <SelectSettingField
              setting="pattern"
              label="Pattern"
              options={{
                dots: "Dot grid",
                cross: "Cross grid (+)",
                lines: "Ruled lines",
                grid: "Square grid",
                graph: "Graph paper",
                fourLine: "Four-line",
                slant: "Slant lines",
                blank: "Blank",
              }}
            />
            <SelectSettingField
              setting="overlayPattern"
              label="Overlay pattern"
              options={{ none: "None", slant: "Slant lines" }}
              hint="Slant lines are drawn over the page pattern using its spacing, width, and color."
            />
            <PatternDetails pattern={pattern.value} overlayPattern={overlay.value} />
          </>
        )}
      </section>
    </TabsContent>
  )
}

function NumberVisibilityField() {
  const { value, mixed, state, onReset, onChange } = useAppearanceField("numberVisible")
  return (
    <Field label="Page numbers" htmlFor="numbered-pages" state={state} onReset={onReset}>
      <SelectControl
        id="numbered-pages"
        value={value ? "shown" : "hidden"}
        mixed={mixed}
        onChange={(next) => onChange(next === "shown")}
        options={{ shown: "Shown", hidden: "Hidden" }}
      />
    </Field>
  )
}

function PageNumberTextField() {
  const { value, mixed, state, onReset, onChange } = useAppearanceField("pageNumberText")
  const { settings, selectedPages, onSettingsChange } = useAppearanceEditor()
  return (
    <Field
      label="Displayed number"
      htmlFor="displayed-page-number"
      state={state}
      onReset={onReset}
      hint="Up to 24 English letters, numbers, spaces, or punctuation. Editing applies the same text to every selected page. Clear or reset to restore each page’s automatic number."
    >
      <Input
        id="displayed-page-number"
        value={value ?? ""}
        placeholder={mixed ? "Mixed" : "Automatic"}
        maxLength={24}
        onChange={(event) => {
          const text = event.target.value
          if (!isPageNumberTextSupported(text)) return
          if (text) onChange(text)
          else
            onSettingsChange(
              "pageAppearanceOverrides",
              updateSelectedAppearance(
                settings.pageAppearanceOverrides,
                selectedPages,
                "pageNumberText",
                undefined,
              ),
            )
        }}
      />
    </Field>
  )
}

function NumberFontField() {
  const { value, mixed, state, onReset, onChange } = useAppearanceField("numberFont")
  const selectedFont = value === undefined ? undefined : getNumberFont(value)
  return (
    <Field label="Font" htmlFor="number-font" state={state} onReset={onReset}>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger id="number-font" className="w-full bg-card" aria-label="Page number font">
          <SelectValue placeholder="Mixed">
            {mixed ? (
              "Mixed"
            ) : (
              <span className="text-base" style={{ fontFamily: selectedFont?.value }}>
                {selectedFont?.label} (1 2 3)
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {numberFonts.map((font) => (
            <SelectItem value={font.value} textValue={`${font.label} (1 2 3)`} key={font.value}>
              <span className="text-base" style={{ fontFamily: font.value }}>
                {font.label} (1 2 3)
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function NumberStyleField({
  setting,
  label,
}: {
  setting: "numberBold" | "numberItalic"
  label: string
}) {
  const id = useId()
  const { value, mixed, state, onReset, onChange } = useAppearanceField(setting)
  return (
    <Field label={label} htmlFor={id} state={state} onReset={onReset}>
      <Button
        id={id}
        type="button"
        variant="outline"
        aria-pressed={mixed ? "mixed" : value}
        className={value ? "border-ring bg-accent text-accent-strong" : ""}
        onClick={() => onChange(!value)}
      >
        {setting === "numberBold" ? <strong>B</strong> : <em>I</em>}
        {mixed ? "Mixed" : value ? "On" : "Off"}
      </Button>
    </Field>
  )
}

function LayoutTab({
  pageSize,
  templatesSuppressStyle,
}: {
  pageSize: PagePropertiesProps["pageSize"]
  templatesSuppressStyle: boolean
}) {
  const { settings, editingDefaults, appearances, onSettingsChange } = useAppearanceEditor()
  const maxMargin = Math.max(...appearances.map((appearance) => appearance.margin))
  return (
    <TabsContent value="layout" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Margins & border</SectionTitle>
        <FieldRow>
          <NumberSettingField setting="margin" label="Margin (mm)" min={0} max={30} />
          <NumberSettingField
            setting="gutterMargin"
            label="Gutter (mm)"
            min={0}
            max={Math.max(0, pageSize.width - maxMargin * 2 - 10)}
            step={0.5}
          />
        </FieldRow>
        <p className="text-xs leading-4 text-muted-foreground">
          The gutter is added to the binding-side margin.
        </p>
        {templatesSuppressStyle ? (
          <TemplateSuppressionNotice />
        ) : (
          <FieldRow>
            <NumberSettingField
              setting="borderWidth"
              label="Border (mm)"
              min={0}
              max={2}
              step={0.1}
            />
            <ColorSettingField setting="borderColor" label="Border color" />
          </FieldRow>
        )}
      </section>
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Numbering</SectionTitle>
        <FieldRow>
          {editingDefaults ? (
            <SelectSettingField
              setting="numberVisibility"
              label="Page numbers"
              options={{
                both: "Left & right",
                right: "Right only",
                left: "Left only",
                none: "Hidden",
              }}
            />
          ) : (
            <NumberVisibilityField />
          )}
          <SelectSettingField
            setting="numberPosition"
            label="Position"
            options={{ outer: "Outer corners", center: "Centered" }}
          />
        </FieldRow>
        {!editingDefaults && <PageNumberTextField />}
        <NumberFontField />
        <NumberSettingField
          setting="numberFontSize"
          label="Size (pt)"
          min={4}
          max={72}
          step={0.5}
        />
        <ColorSettingField setting="numberColor" label="Number color" />
        <FieldRow>
          <NumberStyleField setting="numberBold" label="Bold" />
          <NumberStyleField setting="numberItalic" label="Italic" />
        </FieldRow>
        {editingDefaults && (
          <NumberField
            label="Automatic sequence starts at"
            value={settings.firstPage}
            state="default"
            min={1}
            max={9999}
            onChange={(value) => onSettingsChange("firstPage", value)}
          />
        )}
        <p className="text-xs leading-4 text-muted-foreground">
          Number styling is retained when numbers are hidden. Title pages inherit hidden numbers
          unless customized.
        </p>
      </section>
    </TabsContent>
  )
}

type ContentEditorProps = Pick<
  PagePropertiesProps,
  "settings" | "selectedPages" | "onSettingsChange"
>

function ContentTextField({
  settings,
  selectedPages,
  onSettingsChange,
  template,
  field,
  label,
  maxLength,
  placeholder,
  multiline = false,
}: ContentEditorProps & {
  template: "title" | "index"
  field: "title" | "subtitle" | "entries"
  label: string
  maxLength?: number
  placeholder?: string
  multiline?: boolean
}) {
  const id = useId()
  const value = selectionValue(selectedPages, (page) => {
    const content = settings.customPages[page]
    if (content?.type !== template) return ""
    if (field === "title") return content.title
    if (field === "subtitle" && content.type === "title") return content.subtitle
    if (field === "entries" && content.type === "index") return content.entries
    return ""
  })
  const inputProps = {
    id,
    value: value ?? "",
    placeholder: value === undefined ? "Mixed" : placeholder,
    maxLength,
    onChange: (event: { target: { value: string } }) =>
      onSettingsChange(
        "customPages",
        updateSelectedContent(settings.customPages, selectedPages, (content) =>
          content?.type === template ? { ...content, [field]: event.target.value } : content,
        ),
      ),
  }
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={multiline ? "Use one entry per line. Put a | before its page number." : undefined}
    >
      {multiline ? (
        <textarea
          {...inputProps}
          className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full resize-y rounded-md border bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3"
        />
      ) : (
        <Input {...inputProps} />
      )}
    </Field>
  )
}

const sudokuDifficultyOptions = { easy: "Easy", medium: "Medium", hard: "Hard" } satisfies Record<
  SudokuDifficulty,
  string
>

function SudokuControls({
  settings,
  selectedPages,
  currentPage,
  onEdit,
}: Pick<PagePropertiesProps, "settings" | "selectedPages" | "currentPage"> & {
  onEdit: (edit: SudokuSelectionEdit) => void
}) {
  const difficulty = selectionValue(selectedPages, (page) => {
    const content = settings.customPages[page]
    return content?.type === "sudoku" ? content.difficulty : undefined
  })
  const count = selectionValue(selectedPages, (page) => {
    const content = settings.customPages[page]
    return content?.type === "sudoku" ? String(content.boards.length) : undefined
  })
  const sourcePage = selectedPages.includes(currentPage) ? currentPage : selectedPages[0]
  return (
    <>
      <Field label="Difficulty" htmlFor="sudoku-difficulty">
        <SelectControl
          id="sudoku-difficulty"
          value={difficulty}
          mixed={difficulty === undefined}
          options={sudokuDifficultyOptions}
          onChange={(value) =>
            onEdit({ type: "difficulty", difficulty: value as SudokuDifficulty })
          }
        />
      </Field>
      <Field label="Boards per page" htmlFor="sudoku-board-count">
        <SelectControl
          id="sudoku-board-count"
          value={count}
          mixed={count === undefined}
          options={{ "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6" }}
          onChange={(value) => onEdit({ type: "count", count: Number(value) })}
        />
      </Field>
      <Button type="button" variant="outline" onClick={() => onEdit({ type: "generate" })}>
        Generate unique puzzles per page
      </Button>
      {selectedPages.length > 1 && (
        <Button
          type="button"
          variant="outline"
          className="h-auto whitespace-normal py-2"
          onClick={() => onEdit({ type: "copy", sourcePage })}
        >
          Copy page {displayedPage(settings, sourcePage)} puzzles to selection
        </Button>
      )}
      <p className="text-xs leading-4 text-muted-foreground">
        Generation creates different puzzles for each selected page. Copy uses the focused page’s
        puzzles, count, and difficulty on every selected page.
      </p>
      <p className="text-xs leading-4 text-muted-foreground">
        Easy uses single-candidate cells. Medium also requires finding a digit’s only possible
        position in a row, column, or box. Hard needs techniques beyond those singles. Changing
        difficulty replaces every selected page’s puzzles while keeping its own board count.
      </p>
      <p className="text-xs leading-4 text-muted-foreground">
        Each 9×9 puzzle has a unique solution and fits within its page’s margins. Changing board
        count retains each page’s own remaining puzzles and generates only additional boards.
      </p>
    </>
  )
}

function PageTab(props: PagePropertiesProps) {
  const { settings, selectedPages, editingDefaults, onSettingsChange } = props
  const [error, setError] = useState("")
  const template = selectionValue(
    selectedPages,
    (page) => settings.customPages[page]?.type ?? "default",
  )
  function applyContentChange(change: () => Settings["customPages"]) {
    try {
      const customPages = change()
      onSettingsChange("customPages", customPages)
      setError("")
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not generate puzzles. Try again.")
    }
  }
  return (
    <TabsContent value="page" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Page content</SectionTitle>
        {editingDefaults ? (
          <p className="rounded-md border bg-muted p-3 text-sm leading-5">
            Content belongs to pages, not notebook defaults. Select one or more pages in Pages to
            choose templates and edit their content.
          </p>
        ) : (
          <>
            <Field label="Template" htmlFor="page-template">
              <SelectControl
                id="page-template"
                value={template}
                mixed={template === undefined}
                options={{
                  default: "Default page",
                  title: "Title page",
                  index: "Index page",
                  sudoku: "Sudoku",
                }}
                onChange={(value) =>
                  applyContentChange(() =>
                    changeSelectedTemplate(
                      settings.customPages,
                      selectedPages,
                      value as PageTemplate,
                    ),
                  )
                }
              />
            </Field>
            {template === undefined && (
              <p className="text-sm leading-5 text-muted-foreground">
                Templates are mixed. Choose a template before editing content. Pages already using
                that template keep their existing content.
              </p>
            )}
            {template === "title" && (
              <>
                <ContentTextField
                  {...props}
                  template="title"
                  field="title"
                  label="Title"
                  maxLength={40}
                  placeholder="My Notebook"
                />
                <ContentTextField
                  {...props}
                  template="title"
                  field="subtitle"
                  label="Subtitle"
                  maxLength={60}
                  placeholder="Name or date"
                />
              </>
            )}
            {template === "index" && (
              <>
                <ContentTextField
                  {...props}
                  template="index"
                  field="title"
                  label="Heading"
                  maxLength={40}
                />
                <ContentTextField
                  {...props}
                  template="index"
                  field="entries"
                  label="Entries"
                  multiline
                  placeholder={"Projects | 4\nNotes | 12"}
                />
              </>
            )}
            {template === "sudoku" && (
              <SudokuControls
                {...props}
                onEdit={(edit) =>
                  applyContentChange(() =>
                    editSudokuSelection(settings.customPages, selectedPages, edit),
                  )
                }
              />
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <p className="text-xs leading-4 text-muted-foreground">
              Title, index, and Sudoku templates replace the pattern and border. Title templates
              hide page numbers by default; appearance overrides are retained.
            </p>
          </>
        )}
      </section>
    </TabsContent>
  )
}

function selectionRanges(pages: number[]) {
  const ranges: string[] = []
  let start = pages[0]
  let end = start
  function appendRange() {
    ranges.push(start === end ? String(start) : `${start}–${end}`)
  }
  for (const page of pages.slice(1)) {
    if (page === end + 1) end = page
    else {
      appendRange()
      start = page
      end = page
    }
  }
  appendRange()
  return ranges.join(", ")
}

export function PageProperties(props: PagePropertiesProps): ReactNode {
  const [activeTab, setActiveTab] = useState<"style" | "layout" | "page">("style")
  const { settings, selectedPages, editingDefaults, pageSize, onSettingsChange } = props
  const appearances = editingDefaults
    ? [{ ...settings, numberVisible: settings.numberVisibility !== "none", pageNumberText: "" }]
    : selectedPages.map((page) => resolvePageAppearance(settings, page))
  const templatesSuppressStyle =
    !editingDefaults && selectedPages.some((page) => settings.customPages[page] !== undefined)
  const hasOverrides = selectedPages.some(
    (page) => Object.keys(settings.pageAppearanceOverrides[page] ?? {}).length > 0,
  )
  return (
    <aside className="page-inspector min-h-0 min-w-0 bg-background" aria-label="Page properties">
      <div className="inspector-selection-header sticky top-0 z-10 grid gap-1 border-b bg-background px-4.5 py-3">
        <h2 className="font-serif text-heading">
          {editingDefaults
            ? "Notebook defaults"
            : `${selectedPages.length} ${selectedPages.length === 1 ? "page" : "pages"} selected`}
        </h2>
        <p
          className="truncate text-sm text-muted-foreground"
          title={editingDefaults ? undefined : `Logical pages ${selectionRanges(selectedPages)}`}
        >
          {editingDefaults
            ? "Existing page overrides are kept."
            : `Logical pages ${selectionRanges(selectedPages)}`}
        </p>
        <p className="selection-edit-hint text-xs text-muted-foreground">
          {editingDefaults
            ? "Edits change inherited appearance."
            : "Only the property you change is applied to this selection."}
        </p>
      </div>
      <AppearanceContext.Provider
        value={{ settings, selectedPages, editingDefaults, appearances, onSettingsChange }}
      >
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="gap-0"
        >
          <TabBar className="px-4.5">
            <TabBarTrigger value="style">STYLE</TabBarTrigger>
            <TabBarTrigger value="layout">LAYOUT</TabBarTrigger>
            <TabBarTrigger value="page">CONTENT</TabBarTrigger>
          </TabBar>
          <StyleTab templatesSuppressStyle={templatesSuppressStyle} />
          <LayoutTab pageSize={pageSize} templatesSuppressStyle={templatesSuppressStyle} />
          <PageTab {...props} />
        </Tabs>
      </AppearanceContext.Provider>
      {!editingDefaults && hasOverrides && (
        <div className="grid gap-2 p-4.5">
          <Button
            type="button"
            variant="outline"
            className="h-auto whitespace-normal py-2"
            onClick={() =>
              onSettingsChange(
                "pageAppearanceOverrides",
                resetSelectedAppearance(settings.pageAppearanceOverrides, selectedPages),
              )
            }
          >
            Reset selected pages’ appearance to defaults
          </Button>
          <p className="text-xs leading-4 text-muted-foreground">
            Resets every appearance property, including numbering. Templates and content are kept.
          </p>
        </div>
      )}
    </aside>
  )
}
