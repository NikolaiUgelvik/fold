import { PageSvg } from "@/components/notebook-page"
import type { PrintPass } from "@/lib/imposition"
import { createNotebookDocument, createPrintPageViewModel } from "@/lib/notebook-document"
import { createPrintPlan } from "@/lib/print-plan"
import type { HoleSet } from "@/lib/punch-holes"
import type { Settings } from "@/lib/settings"

function PrintPage({
  settings,
  punchHoleSets,
  logicalPage,
  showPunchHoles,
}: {
  settings: Settings
  punchHoleSets: HoleSet[]
  logicalPage: number
  showPunchHoles: boolean
}) {
  const page = createPrintPageViewModel(logicalPage, showPunchHoles)
  return (
    <div className="paper-page">
      <PageSvg
        settings={settings}
        punchHoleSets={punchHoleSets}
        logicalPage={page.logicalPage}
        paperColor={page.paperColor}
        showPunchHoles={page.showPunchHoles}
        className="block h-full w-full"
      />
    </div>
  )
}

export function PrintDocument({
  settings,
  pass,
  includeGuide,
}: {
  settings: Settings
  pass: PrintPass
  includeGuide: boolean
}) {
  const document = createNotebookDocument(settings)
  const { paper, layout } = document.pageLayout
  const sides = createPrintPlan(document, settings, pass, includeGuide)
  return (
    <div
      className="print-root"
      aria-hidden="true"
      data-divider={settings.pageDivider ? "on" : "off"}
    >
      <style>{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; }`}</style>
      {sides.map((side) => (
        <section
          className="print-side"
          key={`${side.signature}-${side.sheet}-${side.side}`}
          data-layout={layout}
          data-signature={side.signature}
          data-sheet={side.sheet}
          data-side={side.side}
          style={{ width: `${paper.width}mm`, height: `${paper.height}mm` }}
        >
          {side.pages.map((page) => (
            <PrintPage
              settings={side.settings}
              punchHoleSets={document.punchHoleSets}
              logicalPage={page}
              showPunchHoles={side.punchHolePages.has(page)}
              key={page}
            />
          ))}
        </section>
      ))}
    </div>
  )
}
