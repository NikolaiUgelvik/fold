import type { CustomPage } from "./custom-pages.ts"
import type { PageAppearanceOverride, PageAppearanceOverrideKey, Settings } from "./settings.ts"
import { generateSudoku } from "./sudoku.ts"
import type { SudokuDifficulty } from "./sudoku-difficulty.ts"

export function selectionValue<Item, Value>(
  items: readonly Item[],
  getValue: (item: Item) => Value,
) {
  const value = getValue(items[0])
  return items.every((item) => Object.is(getValue(item), value)) ? value : undefined
}

export function updateSelectedAppearance<Key extends PageAppearanceOverrideKey>(
  overrides: Settings["pageAppearanceOverrides"],
  pages: readonly number[],
  key: Key,
  value: PageAppearanceOverride[Key] | undefined,
) {
  const next = { ...overrides }
  for (const page of pages) {
    const appearance = { ...overrides[page] }
    if (value === undefined) delete appearance[key]
    else Object.assign(appearance, { [key]: value })
    if (Object.keys(appearance).length) next[page] = appearance
    else delete next[page]
  }
  return next
}

export function resetSelectedAppearance(
  overrides: Settings["pageAppearanceOverrides"],
  pages: readonly number[],
) {
  const next = { ...overrides }
  for (const page of pages) delete next[page]
  return next
}

export function updateSelectedContent(
  customPages: Settings["customPages"],
  pages: readonly number[],
  update: (page: CustomPage | undefined, logicalPage: number) => CustomPage | undefined,
) {
  const next = { ...customPages }
  for (const logicalPage of pages) {
    const page = update(customPages[logicalPage], logicalPage)
    if (page) next[logicalPage] = page
    else delete next[logicalPage]
  }
  return next
}

export type PageTemplate = CustomPage["type"] | "default"

function selectedSudokuBoards(customPages: Settings["customPages"], pages: readonly number[]) {
  const boards = new Set<string>()
  for (const logicalPage of pages) {
    const page = customPages[logicalPage]
    if (page?.type === "sudoku") {
      for (const board of page.boards) boards.add(board)
    }
  }
  return boards
}

function generateDifferentSudoku(difficulty: SudokuDifficulty, generated: Set<string>) {
  const board = generateSudoku(difficulty)
  if (generated.has(board)) {
    throw new Error("Could not generate different puzzles for every page. Try again.")
  }
  generated.add(board)
  return board
}

export function changeSelectedTemplate(
  customPages: Settings["customPages"],
  pages: readonly number[],
  template: PageTemplate,
) {
  const generated = selectedSudokuBoards(customPages, pages)
  return updateSelectedContent(customPages, pages, (page) => {
    if (page?.type === template) return page
    switch (template) {
      case "title":
        return { type: template, title: "", subtitle: "" }
      case "index":
        return { type: template, title: "Index", entries: "" }
      case "sudoku":
        return {
          type: template,
          difficulty: "easy",
          boards: [generateDifferentSudoku("easy", generated)],
        }
      case "default":
        return undefined
    }
  })
}

export type SudokuSelectionEdit =
  | { type: "count"; count: number }
  | { type: "difficulty"; difficulty: SudokuDifficulty }
  | { type: "generate" }
  | { type: "copy"; sourcePage: number }

export function editSudokuSelection(
  customPages: Settings["customPages"],
  pages: readonly number[],
  edit: SudokuSelectionEdit,
) {
  if (edit.type === "copy") {
    const source = customPages[edit.sourcePage]
    if (source?.type !== "sudoku") throw new Error("Select a Sudoku page to copy puzzles.")
    return updateSelectedContent(customPages, pages, (page) =>
      page?.type === "sudoku"
        ? { ...page, difficulty: source.difficulty, boards: [...source.boards] }
        : page,
    )
  }
  const generated =
    edit.type === "count" ? selectedSudokuBoards(customPages, pages) : new Set<string>()
  return updateSelectedContent(customPages, pages, (page) => {
    if (page?.type !== "sudoku") return page
    const difficulty = edit.type === "difficulty" ? edit.difficulty : page.difficulty
    const count = edit.type === "count" ? edit.count : page.boards.length
    const boards = edit.type === "count" ? page.boards.slice(0, count) : []
    while (boards.length < count) boards.push(generateDifferentSudoku(difficulty, generated))
    return { ...page, difficulty, boards }
  })
}
