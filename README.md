# Fold

A browser-only Vite, React, TypeScript, and shadcn/ui app for designing
notebook pages and imposing them onto folded or cut ISO A-series and US paper sheets.

## Run

```sh
npm install
npm run dev
```

## Check

```sh
npm test
npm run build
```

Choose **Cross grid (+)** under **Style → Page pattern** for a grid of plus marks.
Set horizontal and vertical full stroke lengths independently, along with spacing,
thickness, and color. These settings support both all-page defaults and individual
page overrides, and are preserved in saved projects, previews, and PDF output.

Choose **Sudoku** under **Content → Template** to place 1–6 generated 9×9 puzzles
on the current page. Boards fit automatically within the page margins, with bold
3×3 box boundaries. Every generated puzzle has a unique solution. Increasing the
board count keeps existing puzzles; **Generate new puzzles** replaces them.
Puzzle contents are preserved in saved projects, both previews, and PDF output.

Set **Difficulty** to **Easy** (single-candidate cells), **Medium** (also needs
hidden singles), or **Hard** (needs techniques beyond singles). Changing difficulty
regenerates the current page's boards; added boards use the selected level.
Difficulty is saved per page. Older saved puzzles stay unchanged and default to
Easy for future generation.

To export, choose a print pass, select **Export PDF**, then use actual size in
the print dialog. For automatic duplex, choose **All sides** and short-edge
flipping, except for full-sheet portrait Japanese stab pages, which use
long-edge flipping.

For manual duplex, print **Fronts only**, reload the stack without reordering
it, then print the backs. Choose **Backs reversed** if the last front sheet is
on top of the printed stack; otherwise choose **Backs only**. If you configured
a separate punch guide, export it afterward with **Punch guide only**.

For Japanese stab binding, stack full sheets in page order before sewing the
four-hole pattern. If two-up printing is enabled, cut each sheet in half first.

## Trademark notice

Clairefontaine is a trademark of its owner. Fold is an independent project and
is not affiliated with, endorsed by, sponsored by, or otherwise related to
Clairefontaine. The Clairefontaine and Trophée names are used only to identify
color references.

## License

Fold is licensed under the [Apache License 2.0](LICENSE).
