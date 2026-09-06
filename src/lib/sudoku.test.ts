import assert from "node:assert/strict"
import test from "node:test"
import { generateSudoku, isSudokuBoards } from "./sudoku.ts"
import { rateSudoku, sudokuDifficulties } from "./sudoku-difficulty.ts"

const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"

// Independent, non-bitmask solver: stop after two solutions so ambiguity fails the test.
function solve(puzzle: string): string[] {
  const board = [...puzzle].map(Number)
  const solutions: string[] = []

  function candidates(index: number): number[] {
    const row = Math.floor(index / 9)
    const column = index % 9
    const used = new Set<number>()
    for (let offset = 0; offset < 9; offset++) {
      used.add(board[row * 9 + offset])
      used.add(board[offset * 9 + column])
      used.add(
        board[
          (Math.floor(row / 3) * 3 + Math.floor(offset / 3)) * 9 +
            Math.floor(column / 3) * 3 +
            (offset % 3)
        ],
      )
    }
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => !used.has(digit))
  }

  function search() {
    let selected = -1
    let available: number[] = []
    for (let index = 0; index < 81; index++) {
      if (board[index]) continue
      const options = candidates(index)
      if (options.length === 0) return
      if (selected < 0 || options.length < available.length) {
        selected = index
        available = options
      }
    }
    if (selected < 0) {
      solutions.push(board.join(""))
      return
    }
    for (const digit of available) {
      board[selected] = digit
      search()
      board[selected] = 0
      if (solutions.length === 2) return
    }
  }

  search()
  return solutions
}

function assertSolved(solution: string) {
  const rows = solution.match(/.{9}/g) ?? []
  const columns = Array.from({ length: 9 }, (_, column) => rows.map((row) => row[column]).join(""))
  const boxes = Array.from({ length: 9 }, (_, box) => {
    const firstRow = Math.floor(box / 3) * 3
    const firstColumn = (box % 3) * 3
    return rows
      .slice(firstRow, firstRow + 3)
      .map((row) => row.slice(firstColumn, firstColumn + 3))
      .join("")
  })
  for (const unit of [...rows, ...columns, ...boxes]) {
    assert.equal([...unit].sort().join(""), "123456789")
  }
}

test("difficulty follows solving techniques, not the number of starting clues", () => {
  const puzzles = {
    easy: "000008000200600040900000102090000000031276900026040318682709001000403006003062000",
    medium: "600000000005030287027000060080390070100067804062005000006070509000903100000010748",
    hard: "008600017009000400271548396784900000590000040002070009005000104000000000926000050",
  }
  for (const difficulty of sudokuDifficulties) {
    const puzzle = puzzles[difficulty]
    assert.equal(puzzle.replaceAll("0", "").length, 32)
    assert.equal(rateSudoku(Uint8Array.from(puzzle, Number)), difficulty)
  }
})

test("generated Sudoku preserves clues and has exactly one valid solution", (context) => {
  let seed = 12345
  context.mock.method(Math, "random", () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  })
  for (const difficulty of sudokuDifficulties) {
    const puzzle = generateSudoku(difficulty)
    assert.equal(rateSudoku(Uint8Array.from(puzzle, Number)), difficulty)
    assert.match(puzzle, /^[0-9]{81}$/)
    const clues = [...puzzle].filter((digit) => digit !== "0").length
    assert.ok(clues > 0 && clues < 81, `unexpected clue count: ${clues}`)
    const solutions = solve(puzzle)
    assert.equal(solutions.length, 1, puzzle)
    assertSolved(solutions[0])
    for (let index = 0; index < 81; index++) {
      if (puzzle[index] !== "0") assert.equal(solutions[0][index], puzzle[index])
    }
  }
})

test("generation exhaustion reports failure instead of returning the wrong difficulty", (context) => {
  context.mock.method(Math, "random", () => 0)
  assert.throws(() => generateSudoku("hard"), Error)
})

test("Sudoku board validation accepts both supported count boundaries", () => {
  assert.equal(isSudokuBoards([PUZZLE]), true)
  assert.equal(isSudokuBoards(Array.from({ length: 6 }, () => PUZZLE)), true)
})

test("Sudoku board validation rejects malformed counts, values, and cell encodings", () => {
  const invalid: unknown[] = [
    null,
    PUZZLE,
    [],
    Array.from({ length: 7 }, () => PUZZLE),
    new Array(1),
    [null],
    [[...PUZZLE].map(Number)],
    [PUZZLE.slice(1)],
    [`${PUZZLE}0`],
    [`${PUZZLE.slice(1)}x`],
    [`${PUZZLE.slice(1)}\n`],
    [`${PUZZLE.slice(1)}１`],
    [PUZZLE, "bad"],
  ]
  for (const value of invalid) assert.equal(isSudokuBoards(value), false)
})
