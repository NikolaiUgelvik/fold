export const SUDOKU_LINE_WIDTH = 0.18
export const SUDOKU_BOX_WIDTH = 0.45

export type SudokuBoardLayout = {
  puzzle: string
  x: number
  y: number
  size: number
}

export function layoutSudokuBoards(
  boards: string[],
  bounds: { x: number; y: number; width: number; height: number },
): SudokuBoardLayout[] {
  const width = bounds.width - SUDOKU_BOX_WIDTH
  const height = bounds.height - SUDOKU_BOX_WIDTH
  if (!boards.length || width <= 0 || height <= 0) return []
  const gap = Math.max(
    SUDOKU_BOX_WIDTH,
    Math.min(6, width / boards.length / 4, height / boards.length / 4),
  )
  let columns = 1
  let size = 0
  for (let candidate = 1; candidate <= boards.length; candidate++) {
    const rows = Math.ceil(boards.length / candidate)
    const candidateSize = Math.min(
      (width - gap * (candidate - 1)) / candidate,
      (height - gap * (rows - 1)) / rows,
    )
    if (candidateSize > size) {
      size = candidateSize
      columns = candidate
    }
  }
  if (size <= 0) return []
  const rows = Math.ceil(boards.length / columns)
  const top = bounds.y + (bounds.height - rows * size - (rows - 1) * gap) / 2
  return boards.map((puzzle, index) => {
    const row = Math.floor(index / columns)
    const rowCount = Math.min(columns, boards.length - row * columns)
    const left = bounds.x + (bounds.width - rowCount * size - (rowCount - 1) * gap) / 2
    return {
      puzzle,
      x: left + (index % columns) * (size + gap),
      y: top + row * (size + gap),
      size,
    }
  })
}
