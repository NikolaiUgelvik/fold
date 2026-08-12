export type Binding = "coptic" | "saddle" | "yotsume"

export interface ImpositionSide {
  signature: number
  sheet: number
  side: "front" | "back"
  pages: number[]
}

function positiveInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return value
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
        pages: binding === "yotsume"
          ? twoUp ? [firstLeaf, firstLeaf + 2] : [firstLeaf]
          : [last - sheet * 2, first + sheet * 2],
      })
      sides.push({
        signature: signature + 1,
        sheet: sheet + 1,
        side: "back",
        pages: binding === "yotsume"
          ? twoUp ? [firstLeaf + 3, firstLeaf + 1] : [firstLeaf + 1]
          : [first + sheet * 2 + 1, last - sheet * 2 - 1],
      })
    }
  }

  return sides
}
