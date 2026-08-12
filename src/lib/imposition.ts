export type Binding = "coptic" | "saddle"

export interface ImpositionSide {
  signature: number
  sheet: number
  side: "front" | "back"
  pages: [number, number]
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
}: {
  binding: Binding
  signatures: number
  sheetsPerSignature: number
}): ImpositionSide[] {
  const sheets = positiveInteger(sheetsPerSignature, "sheetsPerSignature")
  const signatureCount = binding === "saddle" ? 1 : positiveInteger(signatures, "signatures")
  const sides: ImpositionSide[] = []

  for (let signature = 0; signature < signatureCount; signature += 1) {
    const first = signature * sheets * 4 + 1
    const last = first + sheets * 4 - 1

    for (let sheet = 0; sheet < sheets; sheet += 1) {
      sides.push({
        signature: signature + 1,
        sheet: sheet + 1,
        side: "front",
        pages: [last - sheet * 2, first + sheet * 2],
      })
      sides.push({
        signature: signature + 1,
        sheet: sheet + 1,
        side: "back",
        pages: [first + sheet * 2 + 1, last - sheet * 2 - 1],
      })
    }
  }

  return sides
}
