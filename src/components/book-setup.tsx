import { ArrowDown, ArrowUp, BookOpen, Info, Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"

import { CheckboxField, FieldRow, NumberField, SelectControl } from "@/components/form-controls"
import { Button } from "@/components/ui/button"
import { TabBar, TabBarTrigger, Tabs, TabsContent } from "@/components/ui/tabs"
import { type Binding, isFoldedBinding } from "@/lib/imposition"
import type { createNotebookDocument } from "@/lib/notebook-document"
import { getPageLayout } from "@/lib/page-layout"
import { formatMillimeters, type Orientation, paperSizes } from "@/lib/paper"
import type { BindingEdge, HoleGroup, PunchHolePlacement } from "@/lib/punch-holes"
import type { Settings, SettingsUpdate } from "@/lib/settings"

type BookSetupProps = {
  settings: Settings
  document: ReturnType<typeof createNotebookDocument<Settings>>
  onSettingsChange: SettingsUpdate
  onPunchHolePlacementChange: (placement: PunchHolePlacement) => void
}

function moveItem<T>(items: T[], from: number, to: number) {
  const moved = [...items]
  moved.splice(to, 0, moved.splice(from, 1)[0])
  return moved
}

function PaperTab({ settings, document, onSettingsChange }: BookSetupProps) {
  const { pageSize, pageName } = document
  return (
    <TabsContent value="paper" className="mt-0">
      <section className="border-b p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium">Paper sheet</span>
          <span className="text-caption text-muted-foreground">{paperSizes.length} presets</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {paperSizes.map((paperSize) => {
            const selected = settings.paper === paperSize.id
            const sheetSize = getPageLayout(
              paperSize.id,
              settings.binding,
              settings.yotsumeOrientation,
              settings.yotsumeTwoUp,
            ).paper
            return (
              <button
                type="button"
                key={paperSize.id}
                className={`rounded-lg border px-2 py-3 text-left transition-colors ${selected ? "border-ring bg-accent ring-1 ring-ring" : "bg-card hover:border-border-strong"}`}
                onClick={() => onSettingsChange("paper", paperSize.id)}
              >
                <strong
                  className={`block text-xs ${selected ? "text-accent-strong" : "text-foreground"}`}
                >
                  {paperSize.id === "tabloid" ? "Tabloid" : paperSize.id.toUpperCase()}
                </strong>
                <span className="mt-1 block text-2xs text-muted-foreground">
                  {formatMillimeters(sheetSize.width)} × {formatMillimeters(sheetSize.height)} mm
                </span>
                <span className="mt-0.5 block text-2xs text-muted-foreground">
                  {isFoldedBinding(settings.binding)
                    ? `folds to ${paperSize.pageName}`
                    : settings.yotsumeTwoUp
                      ? `cuts to ${paperSize.pageName}`
                      : `full-size ${paperSize.sheetName}`}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 rounded-lg bg-muted p-3">
          <p className="text-caption font-bold uppercase tracking-label-tight text-muted-foreground">
            Finished page
          </p>
          <p className="mt-1 text-xs font-semibold">
            {pageName} · {formatMillimeters(pageSize.width)} × {formatMillimeters(pageSize.height)}{" "}
            mm
          </p>
        </div>
      </section>
    </TabsContent>
  )
}

function BindingTab({ settings, document, onSettingsChange }: BookSetupProps) {
  const { signatureCount } = document
  return (
    <TabsContent value="binding" className="mt-0">
      <section className="border-b p-5">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm font-medium" htmlFor="binding">
            Binding
          </label>
          <BookOpen className="size-4 text-ring" />
        </div>
        <SelectControl
          id="binding"
          value={settings.binding}
          onChange={(value) => onSettingsChange("binding", value as Binding)}
          options={{
            coptic: "Coptic / multi-signature",
            saddle: "Saddle stitch",
            yotsume: "Japanese stab / yotsume toji",
          }}
        />
        {settings.binding === "yotsume" && (
          <>
            <div className="mt-3 grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="binding-edge">
                Binding edge
              </label>
              <SelectControl
                id="binding-edge"
                value={settings.bindingEdge}
                onChange={(value) => onSettingsChange("bindingEdge", value as BindingEdge)}
                options={{ left: "Left", right: "Right" }}
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              <label className="text-sm font-medium" htmlFor="page-orientation">
                Page orientation
              </label>
              <SelectControl
                id="page-orientation"
                value={settings.yotsumeOrientation}
                onChange={(value) => onSettingsChange("yotsumeOrientation", value as Orientation)}
                options={{ portrait: "Portrait", landscape: "Landscape" }}
              />
            </div>
            <CheckboxField
              className="mt-3"
              checked={settings.yotsumeTwoUp}
              onChange={(checked) => onSettingsChange("yotsumeTwoUp", checked)}
              title="Two-up, cut in half"
              description="Print two leaves per sheet instead of using the full sheet."
            />
          </>
        )}
        <div
          className={`mt-3 grid gap-2 ${settings.binding === "yotsume" ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {isFoldedBinding(settings.binding) && (
            <NumberField
              label="Signatures"
              value={signatureCount}
              min={1}
              max={12}
              disabled={settings.binding === "saddle"}
              onChange={(value) => onSettingsChange("signatures", value)}
            />
          )}
          <NumberField
            label={settings.binding === "yotsume" ? "Sheets" : "Sheets each"}
            value={settings.sheets}
            min={1}
            max={12}
            onChange={(value) => onSettingsChange("sheets", value)}
          />
        </div>
        <p className="mt-3 text-caption leading-4 text-muted-foreground">
          {settings.binding === "saddle"
            ? "All sheets nest into one signature. Best for smaller books."
            : settings.binding === "yotsume"
              ? settings.yotsumeTwoUp
                ? "Prints two sequential leaves per sheet. Cut in half, stack in page order, then sew with four-hole stab binding."
                : "Prints one leaf per sheet. Stack in page order, then sew with four-hole stab binding."
              : "Each signature is folded separately, then sewn together."}
        </p>
      </section>
    </TabsContent>
  )
}

function HolesTab({
  settings,
  document,
  onSettingsChange,
  onPunchHolePlacementChange,
}: BookSetupProps) {
  const { punchHoleSets, pageSize } = document
  function updateHoleSet(setIndex: number, change: Partial<Settings["punchHoleSets"][number]>) {
    onSettingsChange(
      "punchHoleSets",
      settings.punchHoleSets.map((set, index) =>
        index === setIndex ? { ...set, ...change } : set,
      ),
    )
  }
  function updateHoleGroup(
    setIndex: number,
    groupIndex: number,
    key: keyof HoleGroup,
    value: number,
  ) {
    updateHoleSet(setIndex, {
      groups: settings.punchHoleSets[setIndex].groups.map((group, index) =>
        index === groupIndex ? { ...group, [key]: value } : group,
      ),
    })
  }
  return (
    <TabsContent value="holes" className="mt-0">
      <section className="border-b p-5">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="punch-indicators">
            Punch indicators
          </label>
          <SelectControl
            id="punch-indicators"
            value={settings.punchHolePlacement}
            onChange={(value) => onPunchHolePlacementChange(value as PunchHolePlacement)}
            options={{
              every: "Every page",
              "signature-front": "Each signature · sheet 1 front",
              "signature-back": "Each signature · last sheet back",
              separate: "Separate guide sheet",
              none: "None",
            }}
          />
          <p className="text-2xs leading-4 text-muted-foreground">
            A separate guide is appended after the notebook without changing its pagination.
          </p>
        </div>
        <fieldset
          className={`mt-3 grid gap-3 ${settings.punchHolePlacement === "none" ? "opacity-45" : ""}`}
          disabled={settings.punchHolePlacement === "none"}
        >
          <FieldRow>
            <NumberField
              label="End inset (mm)"
              value={settings.punchHoleEndInset}
              min={5}
              max={Math.max(5, pageSize.height / 2 - 1)}
              step={0.5}
              onChange={(value) => onSettingsChange("punchHoleEndInset", value)}
            />
            <NumberField
              label="Hole diameter (mm)"
              value={settings.punchHoleDiameter}
              min={0.5}
              max={10}
              step={0.5}
              onChange={(value) => onSettingsChange("punchHoleDiameter", value)}
            />
          </FieldRow>
          <div className="grid gap-3 border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {settings.binding === "yotsume" ? "Horizontal sets" : "Pattern groups"}
              </span>
              <span className="text-2xs text-muted-foreground">
                {punchHoleSets.reduce(
                  (total, set) =>
                    total + set.groups.reduce((setTotal, group) => setTotal + group.holes, 0),
                  0,
                )}{" "}
                holes
              </span>
            </div>
            {punchHoleSets.map((set, setIndex) => (
              <div className="rounded-md border bg-card p-2" key={set.id}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-label-tight text-muted-foreground">
                    {settings.binding === "yotsume" ? `Set ${setIndex + 1}` : "Center fold"}
                  </span>
                  {settings.binding === "yotsume" && settings.punchHoleSets.length > 1 && (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Move hole set ${setIndex + 1} up`}
                        disabled={setIndex === 0}
                        onClick={() =>
                          onSettingsChange(
                            "punchHoleSets",
                            moveItem(settings.punchHoleSets, setIndex, setIndex - 1),
                          )
                        }
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Move hole set ${setIndex + 1} down`}
                        disabled={setIndex === settings.punchHoleSets.length - 1}
                        onClick={() =>
                          onSettingsChange(
                            "punchHoleSets",
                            moveItem(settings.punchHoleSets, setIndex, setIndex + 1),
                          )
                        }
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        aria-label={`Remove hole set ${setIndex + 1}`}
                        onClick={() =>
                          onSettingsChange(
                            "punchHoleSets",
                            settings.punchHoleSets.filter((_, index) => index !== setIndex),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>
                {settings.binding === "yotsume" && (
                  <NumberField
                    label="Edge offset (mm)"
                    value={set.offset}
                    min={2}
                    max={Math.max(2, pageSize.width / 2)}
                    step={0.5}
                    onChange={(value) => updateHoleSet(setIndex, { offset: value })}
                  />
                )}
                <div className="mt-2 grid gap-2 border-t pt-2">
                  {set.groups.map((group, groupIndex) => (
                    <div className="grid grid-cols-2 items-end gap-2" key={group.id}>
                      <NumberField
                        label="Holes"
                        value={group.holes}
                        min={0}
                        max={20}
                        onChange={(value) => updateHoleGroup(setIndex, groupIndex, "holes", value)}
                      />
                      <NumberField
                        label="Weight"
                        value={group.weight}
                        min={1}
                        max={1000}
                        onChange={(value) => updateHoleGroup(setIndex, groupIndex, "weight", value)}
                      />
                      <div className="col-span-2 flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Move group ${groupIndex + 1} up in set ${setIndex + 1}`}
                          disabled={groupIndex === 0}
                          onClick={() =>
                            updateHoleSet(setIndex, {
                              groups: moveItem(set.groups, groupIndex, groupIndex - 1),
                            })
                          }
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Move group ${groupIndex + 1} down in set ${setIndex + 1}`}
                          disabled={groupIndex === set.groups.length - 1}
                          onClick={() =>
                            updateHoleSet(setIndex, {
                              groups: moveItem(set.groups, groupIndex, groupIndex + 1),
                            })
                          }
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={`Remove group ${groupIndex + 1} from set ${setIndex + 1}`}
                          onClick={() =>
                            updateHoleSet(setIndex, {
                              groups: set.groups.filter((_, index) => index !== groupIndex),
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      updateHoleSet(setIndex, {
                        groups: [...set.groups, { id: crypto.randomUUID(), holes: 1, weight: 1 }],
                      })
                    }
                  >
                    <Plus /> Add group
                  </Button>
                </div>
              </div>
            ))}
            {settings.binding === "yotsume" && (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onSettingsChange("punchHoleSets", [
                    ...settings.punchHoleSets,
                    {
                      id: crypto.randomUUID(),
                      offset: 18,
                      groups: [{ id: crypto.randomUUID(), holes: 1, weight: 1 }],
                    },
                  ])
                }
              >
                <Plus /> Add horizontal set
              </Button>
            )}
          </div>
        </fieldset>
        <p className="mt-3 text-2xs leading-4 text-muted-foreground">
          Weights divide the area between the end insets. Add a zero-hole group as a spacer—for
          example, 3 / 0 / 3 holes.
          {settings.binding === "yotsume"
            ? " Each horizontal set has its own edge offset and groups."
            : " Folded bindings use one set on the center fold."}
        </p>
      </section>
    </TabsContent>
  )
}

// fallow-ignore-next-line private-type-leak -- Props are private to this feature module.
export function BookSetup(props: BookSetupProps): ReactNode {
  const { sides, totalPages, guideSides } = props.document
  return (
    <aside className="border-b bg-background lg:border-r lg:border-b-0 xl:h-full xl:overflow-y-auto">
      <div className="px-5 pt-5 pb-2">
        <h2 className="font-serif text-heading">Book setup</h2>
        <p className="mt-1 text-label leading-4 text-muted-foreground">
          Choose a binding, then tune the construction.
        </p>
      </div>

      <Tabs defaultValue="binding" className="gap-0">
        <TabBar>
          <TabBarTrigger value="binding">BINDING</TabBarTrigger>
          <TabBarTrigger value="paper">PAPER</TabBarTrigger>
          <TabBarTrigger value="holes">HOLES</TabBarTrigger>
        </TabBar>

        <PaperTab {...props} />

        <BindingTab {...props} />

        <HolesTab {...props} />
      </Tabs>

      <div className="grid grid-cols-3 divide-x border-b bg-border" aria-live="polite">
        {[
          [totalPages, "pages"],
          [sides.length / 2 + guideSides, "sheets"],
          [sides.length + guideSides, "sides"],
        ].map(([value, label]) => (
          <div className="bg-background py-3 text-center" key={label}>
            <strong className="block font-serif text-xl font-normal">{value}</strong>
            <span className="text-3xs font-bold uppercase tracking-label text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-5 py-4 text-caption leading-4 text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
        <p>Changing paper keeps your page style and recalculates the imposition.</p>
      </div>
    </aside>
  )
}
