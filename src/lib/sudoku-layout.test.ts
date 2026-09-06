import assert from "node:assert/strict"
import test from "node:test"

import { layoutSudokuBoards, SUDOKU_BOX_WIDTH } from "./sudoku-layout.ts"

test("Sudoku packing keeps square boards and their strokes inside margins without overlap", () => {
  for (const bounds of [
    { x: 21, y: 12, width: 110, height: 180 },
    { x: 12, y: 21, width: 180, height: 110 },
    { x: 40, y: 40, width: 2, height: 3 },
  ]) {
    for (let count = 1; count <= 6; count++) {
      const puzzles = Array.from({ length: count }, (_, index) => String(index))
      const boards = layoutSudokuBoards(puzzles, bounds)
      assert.deepEqual(
        boards.map((board) => board.puzzle),
        puzzles,
      )
      for (const [index, board] of boards.entries()) {
        const halfStroke = SUDOKU_BOX_WIDTH / 2
        assert.ok(board.size > 0)
        assert.ok(board.x - halfStroke >= bounds.x - 1e-9)
        assert.ok(board.y - halfStroke >= bounds.y - 1e-9)
        assert.ok(board.x + board.size + halfStroke <= bounds.x + bounds.width + 1e-9)
        assert.ok(board.y + board.size + halfStroke <= bounds.y + bounds.height + 1e-9)
        for (const other of boards.slice(index + 1)) {
          assert.ok(
            board.x + board.size + SUDOKU_BOX_WIDTH <= other.x + 1e-9 ||
              other.x + other.size + SUDOKU_BOX_WIDTH <= board.x + 1e-9 ||
              board.y + board.size + SUDOKU_BOX_WIDTH <= other.y + 1e-9 ||
              other.y + other.size + SUDOKU_BOX_WIDTH <= board.y + 1e-9,
          )
        }
      }
    }
  }
})

test("Sudoku packing leaves exhausted content areas empty rather than overflowing margins", () => {
  for (const width of [0, -10, SUDOKU_BOX_WIDTH]) {
    assert.deepEqual(layoutSudokuBoards(["puzzle"], { x: 10, y: 10, width, height: 100 }), [])
  }
})
