import { Download } from "lucide-react"
import { type ReactNode, useState } from "react"

import {
  CheckboxField,
  ColorField,
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
import type { PrintPass } from "@/lib/imposition"
import { displayedPage, type PageNumberVisibility } from "@/lib/page-numbering"
import { usesSeparatePunchGuide } from "@/lib/punch-holes"
import {
  countPageAppearanceOverrides,
  isPageAppearanceKey,
  type PageAppearance,
  type PageAppearanceOverride,
  type PageAppearanceOverrideKey,
  resetPageAppearanceOverride,
  resolvePageAppearance,
  type Settings,
  type SettingsUpdate,
  setPageAppearanceOverride,
  setPageAppearanceSettingOverride,
} from "@/lib/settings"
import { tropheeColors } from "@/lib/trophee-colors"

type PagePropertiesProps = {
  settings: Settings
  currentPage: number
  pageSize: { width: number; height: number }
  printPass: PrintPass
  onSettingsChange: SettingsUpdate
  onExport: () => void
}

type NumberSettingKey = {
  [Key in keyof PageAppearance]: PageAppearance[Key] extends number ? Key : never
}[keyof PageAppearance]

type AppearanceScope = "all" | "page"

type AppearanceTabProps = PagePropertiesProps & {
  scope: AppearanceScope
  bookSettings: Settings
  onPageNumberTextChange: (value: string) => void
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="text-label font-bold uppercase tracking-section text-muted-foreground">
      {children}
    </h2>
  )
}

function StyleTab({ settings, onSettingsChange }: PagePropertiesProps) {
  function settingNumberField(
    setting: NumberSettingKey,
    label: string,
    min: number,
    max: number,
    step?: number,
  ) {
    return (
      <NumberField
        label={label}
        value={settings[setting]}
        min={min}
        max={max}
        step={step}
        onChange={(value) => onSettingsChange(setting, value)}
      />
    )
  }
  return (
    <TabsContent value="style" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Preview paper color · Book-wide</SectionTitle>
        <Select
          value={settings.previewPaperColor}
          onValueChange={(value) => onSettingsChange("previewPaperColor", value)}
        >
          <SelectTrigger className="w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="#fffef9">
              <span className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full border"
                  style={{ backgroundColor: "#fffef9" }}
                />
                White (default)
              </span>
            </SelectItem>
            {tropheeColors.map((color) => (
              <SelectItem value={color.hex} key={color.hex}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full border"
                    style={{ backgroundColor: color.hex }}
                  />
                  {color.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-2xs leading-4 text-muted-foreground">
          Clairefontaine Trophée screen swatches. Preview only; PDF pages stay white.
        </p>
      </section>

      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Page pattern</SectionTitle>
        <SelectControl
          value={settings.pattern}
          ariaLabel="Page pattern"
          onChange={(value) => onSettingsChange("pattern", value as Settings["pattern"])}
          options={{
            dots: "Dot grid",
            lines: "Ruled lines",
            grid: "Square grid",
            graph: "Graph paper",
            blank: "Blank",
          }}
        />
        {settings.pattern === "dots" && (
          <>
            <FieldRow>
              {settingNumberField("dotSize", "Dot size (mm)", 0.05, 2, 0.05)}
              {settingNumberField("dotSpacing", "Spacing (mm)", 2, 20, 0.5)}
            </FieldRow>
            <FieldRow>
              {settingNumberField("dotMajorEvery", "Major interval", 0, 20)}
              {settingNumberField("dotMajorSize", "Major size (mm)", 0.05, 4, 0.05)}
            </FieldRow>
            <p className="text-2xs leading-4 text-muted-foreground">
              Set the interval to 0 to disable major dots.
            </p>
            <ColorField
              label="Dot color"
              value={settings.dotColor}
              onChange={(value) => onSettingsChange("dotColor", value)}
            />
          </>
        )}
        {(settings.pattern === "lines" ||
          settings.pattern === "grid" ||
          settings.pattern === "graph") && (
          <>
            <FieldRow>
              {settingNumberField(
                "lineWidth",
                settings.pattern === "graph" ? "Thin width (mm)" : "Line width (mm)",
                0.05,
                1,
                0.05,
              )}
              {settingNumberField(
                "lineSpacing",
                settings.pattern === "graph" ? "Cell size (mm)" : "Spacing (mm)",
                3,
                20,
                0.5,
              )}
            </FieldRow>
            <ColorField
              label={settings.pattern === "graph" ? "Thin line color" : "Line color"}
              value={settings.lineColor}
              onChange={(value) => onSettingsChange("lineColor", value)}
            />
          </>
        )}
        {settings.pattern === "graph" && (
          <>
            <FieldRow>
              {settingNumberField("graphMajorEvery", "Cells per block", 2, 20)}
              {settingNumberField("graphMajorLineWidth", "Thick width (mm)", 0.05, 2, 0.05)}
            </FieldRow>
            <ColorField
              label="Thick line color"
              value={settings.graphMajorColor}
              onChange={(value) => onSettingsChange("graphMajorColor", value)}
            />
            <CheckboxField
              checked={settings.graphCompleteBlocks}
              onChange={(checked) => onSettingsChange("graphCompleteBlocks", checked)}
              title="Complete blocks only"
              description="Remove partial cell groups and center the grid."
            />
          </>
        )}
      </section>
    </TabsContent>
  )
}

function LayoutTab({
  settings,
  bookSettings,
  currentPage,
  pageSize,
  scope,
  onSettingsChange,
  onPageNumberTextChange,
}: AppearanceTabProps) {
  const selectedNumberFont = getNumberFont(settings.numberFont)
  const customNumberText = bookSettings.pageAppearanceOverrides[currentPage]?.pageNumberText ?? ""
  return (
    <TabsContent value="layout" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Margins & border</SectionTitle>
        <FieldRow>
          <NumberField
            label="Margin (mm)"
            value={settings.margin}
            min={0}
            max={30}
            onChange={(value) => onSettingsChange("margin", value)}
          />
          <NumberField
            label="Gutter (mm)"
            value={settings.gutterMargin}
            min={0}
            max={Math.max(0, pageSize.width - settings.margin * 2 - 10)}
            step={0.5}
            onChange={(value) => onSettingsChange("gutterMargin", value)}
          />
        </FieldRow>
        <p className="text-2xs leading-4 text-muted-foreground">
          The gutter is added to the binding-side margin.
        </p>
        <FieldRow>
          <NumberField
            label="Border (mm)"
            value={settings.borderWidth}
            min={0}
            max={2}
            step={0.1}
            onChange={(value) => onSettingsChange("borderWidth", value)}
          />
          <ColorField
            label="Border color"
            value={settings.borderColor}
            onChange={(value) => onSettingsChange("borderColor", value)}
          />
        </FieldRow>
      </section>

      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>Numbering</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="numbered-pages">
              Pages
            </label>
            <SelectControl
              id="numbered-pages"
              value={settings.numberVisibility}
              onChange={(value) =>
                onSettingsChange("numberVisibility", value as PageNumberVisibility)
              }
              options={
                scope === "all"
                  ? {
                      both: "Left & right",
                      right: "Right only",
                      left: "Left only",
                      none: "Hidden",
                    }
                  : { both: "Shown", none: "Hidden" }
              }
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="page-number-position">
              Position
            </label>
            <SelectControl
              id="page-number-position"
              disabled={settings.numberVisibility === "none"}
              value={settings.numberPosition}
              onChange={(value) =>
                onSettingsChange("numberPosition", value as Settings["numberPosition"])
              }
              options={{ outer: "Outer corners", center: "Centered" }}
            />
          </div>
        </div>
        {scope === "page" && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium" htmlFor="displayed-page-number">
              Displayed number
            </label>
            <div className="flex gap-2">
              <Input
                id="displayed-page-number"
                value={customNumberText}
                maxLength={24}
                aria-describedby="displayed-page-number-help"
                placeholder={`Automatic: ${displayedPage(bookSettings, currentPage)}`}
                onChange={(event) => {
                  if (isPageNumberTextSupported(event.target.value))
                    onPageNumberTextChange(event.target.value)
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!customNumberText}
                onClick={() => onPageNumberTextChange("")}
              >
                Automatic
              </Button>
            </div>
            <p id="displayed-page-number-help" className="text-2xs leading-4 text-muted-foreground">
              Use up to 24 English letters, numbers, spaces, or punctuation. Leave blank for the
              automatic sequence; later pages are unchanged.
            </p>
          </div>
        )}
        <fieldset disabled={settings.numberVisibility === "none"} className="grid gap-3">
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="number-font">
                Font
              </label>
              <Select
                value={settings.numberFont}
                onValueChange={(value) => onSettingsChange("numberFont", value)}
              >
                <SelectTrigger
                  id="number-font"
                  className="w-full bg-card"
                  aria-label="Page number font"
                >
                  <SelectValue>
                    <span className="text-base" style={{ fontFamily: selectedNumberFont.value }}>
                      {selectedNumberFont.label} (1 2 3)
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {numberFonts.map((font) => (
                    <SelectItem
                      value={font.value}
                      textValue={`${font.label} (1 2 3)`}
                      key={font.value}
                    >
                      <span className="text-base" style={{ fontFamily: font.value }}>
                        {font.label} (1 2 3)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumberField
              label="Size (pt)"
              value={settings.numberFontSize}
              min={4}
              max={72}
              step={0.5}
              onChange={(value) => onSettingsChange("numberFontSize", value)}
            />
          </div>
          <ColorField
            label="Number color"
            value={settings.numberColor}
            onChange={(value) => onSettingsChange("numberColor", value)}
          />
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Style</legend>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                aria-pressed={settings.numberBold}
                className={settings.numberBold ? "border-ring bg-accent text-accent-strong" : ""}
                onClick={() => onSettingsChange("numberBold", !settings.numberBold)}
              >
                <strong>B</strong> Bold
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={settings.numberItalic}
                className={settings.numberItalic ? "border-ring bg-accent text-accent-strong" : ""}
                onClick={() => onSettingsChange("numberItalic", !settings.numberItalic)}
              >
                <em>I</em> Italic
              </Button>
            </div>
          </fieldset>
          {scope === "all" && (
            <NumberField
              label="Automatic sequence starts at"
              value={settings.firstPage}
              min={1}
              max={9999}
              onChange={(value) => onSettingsChange("firstPage", value)}
            />
          )}
        </fieldset>
      </section>
    </TabsContent>
  )
}

function PageTab({ settings, currentPage, onSettingsChange }: PagePropertiesProps) {
  const customPage = settings.customPages[currentPage]
  function setCustomPage(page: Settings["customPages"][number] | null) {
    const nextCustomPages = { ...settings.customPages }
    if (page) nextCustomPages[currentPage] = page
    else delete nextCustomPages[currentPage]
    onSettingsChange("customPages", nextCustomPages)
  }
  return (
    <TabsContent value="page" className="mt-0">
      <section className="grid gap-3 border-b p-4.5">
        <SectionTitle>{`Page ${displayedPage(settings, currentPage)}`}</SectionTitle>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="page-template">
            Template
          </label>
          <SelectControl
            id="page-template"
            value={customPage?.type ?? "default"}
            onChange={(value) => {
              if (value === "title") setCustomPage({ type: "title", title: "", subtitle: "" })
              else if (value === "index")
                setCustomPage({ type: "index", title: "Index", entries: "" })
              else setCustomPage(null)
            }}
            options={{ default: "Default page", title: "Title page", index: "Index page" }}
          />
        </div>
        {customPage?.type === "title" &&
          (
            [
              ["title", "Title", 40, "My Notebook"],
              ["subtitle", "Subtitle", 60, "Name or date"],
            ] as const
          ).map(([field, label, maxLength, placeholder]) => (
            <div className="grid gap-1.5" key={field}>
              <label className="text-sm font-medium" htmlFor={`page-${field}`}>
                {label}
              </label>
              <Input
                id={`page-${field}`}
                value={customPage[field]}
                maxLength={maxLength}
                placeholder={placeholder}
                onChange={(event) => setCustomPage({ ...customPage, [field]: event.target.value })}
              />
            </div>
          ))}
        {customPage?.type === "index" && (
          <>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="index-heading">
                Heading
              </label>
              <Input
                id="index-heading"
                value={customPage.title}
                maxLength={40}
                onChange={(event) => setCustomPage({ ...customPage, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="index-entries">
                Entries
              </label>
              <textarea
                id="index-entries"
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-32 w-full resize-y rounded-md border bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3"
                value={customPage.entries}
                placeholder={"Projects | 4\nNotes | 12"}
                onChange={(event) => setCustomPage({ ...customPage, entries: event.target.value })}
              />
              <p className="text-2xs leading-4 text-muted-foreground">
                Use one entry per line. Put a | before its page number.
              </p>
            </div>
          </>
        )}
        <p className="text-2xs leading-4 text-muted-foreground">
          Title and index templates replace the pattern and border. Title templates hide page
          numbers by default; appearance overrides are retained.
        </p>
      </section>
    </TabsContent>
  )
}

function getPrintInstructions(
  settings: Pick<Settings, "binding" | "yotsumeOrientation" | "yotsumeTwoUp">,
  printPass: PrintPass,
) {
  if (printPass === "all") {
    const edge =
      settings.binding === "yotsume" &&
      !settings.yotsumeTwoUp &&
      settings.yotsumeOrientation === "portrait"
        ? "long"
        : "short"
    return (
      <>
        In the print dialog, choose Save as PDF, actual size, double-sided, and flip on the {edge}{" "}
        edge.
      </>
    )
  }
  if (printPass === "fronts")
    return "Print at actual size, then reload the stack without reordering it and export the backs."
  if (printPass === "guide") return "Print the separate punch guide at actual size."
  return "Use reversed backs when the last front sheet is on top of the printed stack. Use same-order backs when the first is on top."
}

function PrintInstructions({ settings, printPass, onExport }: PagePropertiesProps) {
  return (
    <div className="p-4.5">
      <Button className="w-full bg-primary hover:bg-primary-hover xl:hidden" onClick={onExport}>
        <Download /> Export PDF
      </Button>
      <p className="mt-3 text-caption leading-4 text-muted-foreground">
        {getPrintInstructions(settings, printPass)}
        {(printPass === "fronts" || printPass === "backs" || printPass === "backs-reversed") &&
          usesSeparatePunchGuide(settings.punchHolePlacement) &&
          " Export the punch guide separately when needed."}
      </p>
    </div>
  )
}

function AppearanceScopeControl({
  scope,
  currentPage,
  overrideCount,
  onScopeChange,
  onReset,
}: {
  scope: AppearanceScope
  currentPage: number
  overrideCount: number
  onScopeChange: (scope: AppearanceScope) => void
  onReset: () => void
}) {
  return (
    <fieldset className="grid gap-2 border-b bg-muted px-4.5 py-3.5">
      <legend className="text-xs font-semibold">Apply appearance to</legend>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["all", "All pages", "Book defaults"],
            ["page", "This page", `Page ${currentPage}`],
          ] as const
        ).map(([value, label, description]) => (
          <label
            className={`flex cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 py-2 ${scope === value ? "border-ring ring-1 ring-ring" : ""}`}
            key={value}
          >
            <input
              type="radio"
              name="appearance-scope"
              value={value}
              checked={scope === value}
              className="size-3.5 accent-ring"
              onChange={() => onScopeChange(value)}
            />
            <span>
              <strong className="block text-xs">{label}</strong>
              <span className="block text-2xs text-muted-foreground">{description}</span>
            </span>
          </label>
        ))}
      </div>
      {scope === "all" ? (
        <p className="text-2xs leading-4 text-muted-foreground">
          Sets book defaults. Existing page overrides are kept.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xs leading-4 text-muted-foreground">
            {overrideCount} {overrideCount === 1 ? "override" : "overrides"}. Other values inherit
            book defaults.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-7 px-2 text-2xs"
            disabled={overrideCount === 0}
            onClick={onReset}
          >
            Reset to book defaults
          </Button>
        </div>
      )}
    </fieldset>
  )
}

// fallow-ignore-next-line private-type-leak -- Props are private to this feature module.
export function PageProperties(props: PagePropertiesProps): ReactNode {
  const [activeTab, setActiveTab] = useState<"style" | "layout" | "page">("style")
  const [scope, setScope] = useState<AppearanceScope>("all")
  const { settings, currentPage, onSettingsChange } = props
  const appearance = resolvePageAppearance(settings, currentPage)
  const scopedSettings =
    scope === "all"
      ? settings
      : {
          ...settings,
          ...appearance,
          numberVisibility: appearance.numberVisible ? ("both" as const) : ("none" as const),
        }

  function setPageAppearanceValue<Key extends PageAppearanceOverrideKey>(
    key: Key,
    value: PageAppearanceOverride[Key] | undefined,
  ) {
    onSettingsChange(
      "pageAppearanceOverrides",
      setPageAppearanceOverride(settings.pageAppearanceOverrides, currentPage, key, value),
    )
  }

  const updateScopedSettings: SettingsUpdate = (key, value) => {
    if (scope === "all" || !isPageAppearanceKey(key)) {
      onSettingsChange(key, value)
      return
    }

    onSettingsChange(
      "pageAppearanceOverrides",
      setPageAppearanceSettingOverride(
        settings,
        currentPage,
        key,
        value as PageAppearance[typeof key],
      ),
    )
  }

  const scopedProps = {
    ...props,
    settings: scopedSettings,
    onSettingsChange: updateScopedSettings,
  }

  return (
    <aside className="border-t bg-background lg:col-span-2 xl:col-span-1 xl:h-full xl:overflow-y-auto xl:border-t-0 xl:border-l">
      <div className="px-4.5 pt-4.5 pb-2">
        <h2 className="font-serif text-heading">Properties</h2>
      </div>

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

        {activeTab !== "page" && (
          <AppearanceScopeControl
            scope={scope}
            currentPage={currentPage}
            overrideCount={countPageAppearanceOverrides(
              settings.pageAppearanceOverrides,
              currentPage,
            )}
            onScopeChange={setScope}
            onReset={() =>
              onSettingsChange(
                "pageAppearanceOverrides",
                resetPageAppearanceOverride(settings.pageAppearanceOverrides, currentPage),
              )
            }
          />
        )}

        <StyleTab {...scopedProps} />

        <LayoutTab
          {...scopedProps}
          scope={scope}
          bookSettings={settings}
          onPageNumberTextChange={(value) =>
            setPageAppearanceValue(
              "pageNumberText",
              value && value !== String(displayedPage(settings, currentPage)) ? value : undefined,
            )
          }
        />

        <PageTab {...props} />
      </Tabs>

      <PrintInstructions {...props} />
    </aside>
  )
}
