export const sudokuDifficulties = ["easy", "medium", "hard"] as const
export type SudokuDifficulty = (typeof sudokuDifficulties)[number]

const units = Array.from({ length: 27 }, (_, unit) =>
  Array.from({ length: 9 }, (_, offset) => {
    if (unit < 9) return unit * 9 + offset
    if (unit < 18) return unit - 9 + offset * 9
    const box = unit - 18
    return Math.floor(box / 3) * 27 + (box % 3) * 3 + Math.floor(offset / 3) * 9 + (offset % 3)
  }),
)

function updateCandidates(board: Uint8Array, candidates: Uint16Array) {
  for (let index = 0; index < 81; index++) candidates[index] = board[index] ? 0 : 0x1ff
  for (const unit of units) {
    let used = 0
    for (const index of unit) {
      if (board[index]) used |= 1 << (board[index] - 1)
    }
    for (const index of unit) candidates[index] &= ~used
  }
}

function fillNakedSingles(board: Uint8Array, candidates: Uint16Array) {
  let changed = false
  for (let index = 0; index < 81; index++) {
    const mask = candidates[index]
    if (mask && (mask & (mask - 1)) === 0) {
      board[index] = 32 - Math.clz32(mask)
      changed = true
    }
  }
  return changed
}

function fillHiddenSingles(board: Uint8Array, candidates: Uint16Array) {
  let changed = false
  for (const unit of units) {
    let seen = 0
    let repeated = 0
    for (const index of unit) {
      repeated |= seen & candidates[index]
      seen |= candidates[index]
    }
    const unique = seen & ~repeated
    for (const index of unit) {
      const mask = candidates[index] & unique
      if (mask && !board[index]) {
        board[index] = 32 - Math.clz32(mask)
        changed = true
      }
    }
  }
  return changed
}

function solveWithSingles(board: Uint8Array, candidates: Uint16Array, hidden: boolean) {
  while (board.includes(0)) {
    updateCandidates(board, candidates)
    if (fillNakedSingles(board, candidates)) continue
    if (!hidden || !fillHiddenSingles(board, candidates)) return false
  }
  return true
}

// Rates a valid, uniquely solvable puzzle by the strongest technique it requires.
// Hard means singles are insufficient; it is not a claim that guessing is necessary.
export function rateSudoku(puzzle: Uint8Array): SudokuDifficulty {
  const board = puzzle.slice()
  const candidates = new Uint16Array(81)
  if (solveWithSingles(board, candidates, false)) return "easy"
  return solveWithSingles(board, candidates, true) ? "medium" : "hard"
}
