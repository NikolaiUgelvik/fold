import type { SudokuDifficulty } from "./sudoku-difficulty.ts"

export type CustomPage =
  | { type: "title"; title: string; subtitle: string }
  | { type: "index"; title: string; entries: string }
  | { type: "sudoku"; difficulty: SudokuDifficulty; boards: string[] }

export function parseIndexEntries(entries: string) {
  return entries.split("\n").flatMap((line) => {
    const separator = line.lastIndexOf("|")
    const label = (separator < 0 ? line : line.slice(0, separator)).trim()
    if (!label) return []
    return [{ label, page: separator < 0 ? "" : line.slice(separator + 1).trim() }]
  })
}
