import { rateSudoku, type SudokuDifficulty } from "./sudoku-difficulty.ts"

const ALL_DIGITS = 0x1ff
const TARGET_CLUES: Record<SudokuDifficulty, number> = { easy: 40, medium: 32, hard: 26 }
const GENERATION_ATTEMPTS = 12
const SEARCH_LIMIT = 20_000

function shuffled(values: number[]): number[] {
  for (let index = values.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1))
    const value = values[index]
    values[index] = values[other]
    values[other] = value
  }
  return values
}

function shuffledUnits(): number[] {
  return shuffled([0, 1, 2]).flatMap((group) =>
    shuffled([0, 1, 2]).map((offset) => group * 3 + offset),
  )
}

function boxIndex(index: number): number {
  return Math.floor(index / 27) * 3 + Math.floor((index % 9) / 3)
}

function bitCount(bits: number): number {
  let count = 0
  let remaining = bits
  while (remaining) {
    remaining &= remaining - 1
    count++
  }
  return count
}

// Pack the cell index and candidate mask to avoid allocating at each search node.
function nextCell(
  board: Uint8Array,
  rows: Uint16Array,
  columns: Uint16Array,
  boxes: Uint16Array,
): number {
  let selected = -1
  let fewest = 10
  for (let index = 0; index < 81; index++) {
    if (board[index]) continue
    const candidates =
      ALL_DIGITS & ~(rows[Math.floor(index / 9)] | columns[index % 9] | boxes[boxIndex(index)])
    const count = bitCount(candidates)
    if (count < fewest) {
      selected = (index << 9) | candidates
      fewest = count
      if (count <= 1) break
    }
  }
  return selected
}

function hasUniqueSolution(board: Uint8Array): boolean {
  const rows = new Uint16Array(9)
  const columns = new Uint16Array(9)
  const boxes = new Uint16Array(9)
  for (let index = 0; index < 81; index++) {
    if (!board[index]) continue
    const bit = 1 << (board[index] - 1)
    rows[Math.floor(index / 9)] |= bit
    columns[index % 9] |= bit
    boxes[boxIndex(index)] |= bit
  }
  let remaining = SEARCH_LIMIT

  function countSolutions(): number {
    // An unproven removal is rejected, even if the search found one solution.
    if (--remaining < 0) return 2
    const selected = nextCell(board, rows, columns, boxes)
    if (selected === -1) return 1
    const index = selected >> 9
    let candidates = selected & ALL_DIGITS
    const row = Math.floor(index / 9)
    const column = index % 9
    const box = boxIndex(index)
    let solutions = 0
    while (candidates && solutions < 2) {
      const bit = candidates & -candidates
      candidates &= candidates - 1
      board[index] = 32 - Math.clz32(bit)
      rows[row] |= bit
      columns[column] |= bit
      boxes[box] |= bit
      solutions += countSolutions()
      board[index] = 0
      rows[row] &= ~bit
      columns[column] &= ~bit
      boxes[box] &= ~bit
    }
    return solutions
  }

  return countSolutions() === 1
}

function createSolvedBoard(): Uint8Array {
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const rows = shuffledUnits()
  const columns = shuffledUnits()
  const board = new Uint8Array(81)
  for (let index = 0; index < 81; index++) {
    const row = rows[Math.floor(index / 9)]
    const column = columns[index % 9]
    board[index] = digits[(row * 3 + Math.floor(row / 3) + column) % 9]
  }
  return board
}

function carvePuzzle(board: Uint8Array, difficulty: SudokuDifficulty): string | null {
  let matchingPuzzle: string | null = null

  let clues = 81
  for (const index of shuffled(Array.from({ length: 81 }, (_, index) => index))) {
    const digit = board[index]
    board[index] = 0
    if (!hasUniqueSolution(board)) {
      board[index] = digit
      continue
    }
    clues--
    if (clues > 42) continue
    if (rateSudoku(board) === difficulty) matchingPuzzle = board.join("")
    if (matchingPuzzle && clues <= TARGET_CLUES[difficulty]) return matchingPuzzle
  }
  return matchingPuzzle
}

export function generateSudoku(difficulty: SudokuDifficulty): string {
  for (let attempt = 0; attempt < GENERATION_ATTEMPTS; attempt++) {
    const puzzle = carvePuzzle(createSolvedBoard(), difficulty)
    if (puzzle) return puzzle
  }
  throw new Error(`Could not generate a ${difficulty} puzzle. Try again.`)
}

export function isSudokuBoards(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return false
  // Iteration also rejects sparse arrays instead of silently skipping their holes.
  for (const board of value) {
    if (typeof board !== "string" || board.length !== 81 || /[^0-9]/.test(board)) return false
  }
  return true
}
