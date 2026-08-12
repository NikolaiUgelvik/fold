export type Binding = "coptic" | "saddle" | "yotsume"
export type FoldedBinding = Exclude<Binding, "yotsume">

export function isFoldedBinding(binding: Binding): binding is FoldedBinding {
  return binding !== "yotsume"
}

export interface ImpositionSide {
  signature: number
  sheet: number
  side: "front" | "back"
  pages: number[]
}

export type PrintPass = "all" | "fronts" | "backs" | "backs-reversed" | "guide"

const printPasses = {
  all: { side: null, reversed: false },
  fronts: { side: "front", reversed: false },
  backs: { side: "back", reversed: false },
  "backs-reversed": { side: "back", reversed: true },
  guide: { side: undefined, reversed: false },
} as const satisfies Record<
  PrintPass,
  { side: ImpositionSide["side"] | null | undefined; reversed: boolean }
>

export function getPrintSides(sides: ImpositionSide[], pass: PrintPass) {
  const metadata = printPasses[pass]
  if (metadata.side === null) return sides
  if (metadata.side === undefined) return []
  const selected = sides.filter((side) => side.side === metadata.side)
  return metadata.reversed ? selected.reverse() : selected
}

function positiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return value
}

function getSidePages(
  binding: Binding,
  twoUp: boolean,
  firstLeaf: number,
  foldedPages: number[],
  reverse = false,
) {
  if (isFoldedBinding(binding)) return foldedPages
  const pages = twoUp ? [firstLeaf, firstLeaf + 2] : [firstLeaf]
  return reverse ? pages.reverse() : pages
}

export function createImposition({
  binding,
  signatures,
  sheetsPerSignature,
  twoUp = false,
}: {
  binding: Binding
  signatures: number
  sheetsPerSignature: number
  twoUp?: boolean
}): ImpositionSide[] {
  const sheets = positiveInteger(sheetsPerSignature, "sheetsPerSignature")
  const signatureCount = binding === "coptic" ? positiveInteger(signatures, "signatures") : 1
  const sides: ImpositionSide[] = []

  for (let signature = 0; signature < signatureCount; signature += 1) {
    const first = signature * sheets * 4 + 1
    const last = first + sheets * 4 - 1

    for (let sheet = 0; sheet < sheets; sheet += 1) {
      const firstLeaf = first + sheet * (twoUp ? 4 : 2)
      sides.push({
        signature: signature + 1,
        sheet: sheet + 1,
        side: "front",
        pages: getSidePages(binding, twoUp, firstLeaf, [last - sheet * 2, first + sheet * 2]),
      })
      sides.push({
        signature: signature + 1,
        sheet: sheet + 1,
        side: "back",
        pages: getSidePages(
          binding,
          twoUp,
          firstLeaf + 1,
          [first + sheet * 2 + 1, last - sheet * 2 - 1],
          true,
        ),
      })
    }
  }

  return sides
}
