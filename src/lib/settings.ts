import type { CustomPage } from "./custom-pages.ts"
import type { Binding } from "./imposition.ts"
import type { PageNumberVisibility } from "./page-numbering.ts"
import type { Orientation, PaperId } from "./paper.ts"
import type { BindingEdge, HoleGroup, HoleSet, PunchHolePlacement } from "./punch-holes.ts"

type IdentifiedHoleGroup = HoleGroup & { id: string }
type IdentifiedHoleSet = Omit<HoleSet, "groups"> & {
  id: string
  groups: IdentifiedHoleGroup[]
}

export interface Settings {
  binding: Binding
  yotsumeOrientation: Orientation
  yotsumeTwoUp: boolean
  punchHolePlacement: PunchHolePlacement
  bindingEdge: BindingEdge
  punchHoleEndInset: number
  punchHoleDiameter: number
  // fallow-ignore-next-line private-type-leak -- Identified hole types are implementation details.
  punchHoleSets: IdentifiedHoleSet[]
  paper: PaperId
  previewPaperColor: string
  signatures: number
  sheets: number
  pattern: "dots" | "lines" | "grid" | "graph" | "blank"
  dotSize: number
  dotSpacing: number
  dotMajorEvery: number
  dotMajorSize: number
  dotColor: string
  lineWidth: number
  lineSpacing: number
  lineColor: string
  graphMajorEvery: number
  graphMajorLineWidth: number
  graphMajorColor: string
  graphCompleteBlocks: boolean
  margin: number
  gutterMargin: number
  borderWidth: number
  borderColor: string
  numberVisibility: PageNumberVisibility
  numberPosition: "outer" | "center"
  numberFont: string
  numberFontSize: number
  numberColor: string
  numberBold: boolean
  numberItalic: boolean
  firstPage: number
  customPages: Record<number, CustomPage>
}

export type SettingsUpdate = <Key extends keyof Settings>(key: Key, value: Settings[Key]) => void

export const initialSettings: Settings = {
  binding: "coptic",
  yotsumeOrientation: "portrait",
  yotsumeTwoUp: false,
  punchHolePlacement: "none",
  bindingEdge: "left",
  punchHoleEndInset: 15,
  punchHoleDiameter: 2,
  punchHoleSets: [
    {
      id: "initial-set",
      offset: 12,
      groups: [{ id: "initial-group", holes: 4, weight: 1 }],
    },
  ],
  paper: "a4",
  previewPaperColor: "#fffef9",
  signatures: 4,
  sheets: 4,
  pattern: "dots",
  dotSize: 0.35,
  dotSpacing: 5,
  dotMajorEvery: 0,
  dotMajorSize: 0.7,
  dotColor: "#aeb4b6",
  lineWidth: 0.2,
  lineSpacing: 7,
  lineColor: "#aeb9c4",
  graphMajorEvery: 5,
  graphMajorLineWidth: 0.4,
  graphMajorColor: "#8295a8",
  graphCompleteBlocks: false,
  margin: 10,
  gutterMargin: 10,
  borderWidth: 0,
  borderColor: "#c8c3b8",
  numberVisibility: "both",
  numberPosition: "outer",
  numberFont: "Georgia, serif",
  numberFontSize: 9,
  numberColor: "#30302c",
  numberBold: false,
  numberItalic: false,
  firstPage: 1,
  customPages: {},
}
