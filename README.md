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

## Editing a notebook

The Pages navigator is the editing target. Click a page, Shift-click a range,
or Ctrl/Cmd-click to toggle individual pages. **Select pages…** accepts ranges
such as `3–16,21–24`, `all`, `odd`, and `even`, and includes Signature selection
and a direct page jump. **Select multiple** exposes checkboxes for touch.
Arrow keys navigate pages; Shift extends the selection and Space toggles a page.

Style, Layout, and Content all act on the same selection. Mixed values display
**Mixed**; changing a field applies only that property, preserving the other
values on each page. Selecting all pages really changes every selected page.
**Notebook defaults** instead changes inherited appearance while preserving
page customizations. Each customized appearance field has its own **Reset**;
resetting one field does not discard other customizations or content.

Choose **Cross grid (+)** under **Style → Pattern** for plus marks with
independent horizontal/vertical stroke lengths, spacing, thickness, and color.
Title, Index, and Sudoku templates replace the pattern and border, so those
controls are hidden for selections containing these templates.

Choose **Sudoku** under **Content → Template** to generate 1–6 puzzles per
selected page. **Generate unique puzzles per page** gives pages different
puzzles; **Copy page … puzzles to selection** intentionally copies the focused
page's puzzles. Increasing board count preserves each page's existing puzzles.
Every puzzle has a unique solution and fits within its page's margins.

Difficulty is saved per page: **Easy** uses single-candidate cells, **Medium**
also needs hidden singles, and **Hard** needs techniques beyond singles.
Changing difficulty replaces each selected page's puzzles while retaining its
own board count. Existing saved puzzles remain unchanged until edited.

Use **Page**, **Spread**, or **Physical** to inspect the notebook. **Fit**
resets the flat preview zoom. Binding, paper, and punch guides are under
**Notebook setup**. Preview paper colors do not paint PDF backgrounds.
On mobile, **Pages / Edit / Setup** switch the lower panel while the preview
stays visible; **Panel height** adjusts the space for editing.

**Undo / Redo** (Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z, or Ctrl+Y) work across
notebook edits. A bulk change is one action; continuous numeric/text editing
is grouped while the input remains focused.

The named draft recovers automatically in the same browser. **Projects → Save
a copy** creates a named snapshot without overwriting an existing copy.
New/open actions protect changes that are not backed by a saved copy.
Drafts and copies are local only: they are not uploaded or synced, and clearing
browser storage removes them. Storage failures are shown in the header.

## Printing and PDF

Open **Print / PDF** to check paper dimensions, output count, duplex instructions,
and actual sheet previews across all Signatures. **Open print dialog** invokes
the browser; choose a printer or **Save as PDF** there. Use actual size / 100%
and disable browser headers and footers.

For automatic duplex, choose **All sides** and short-edge flipping, except for
full-sheet portrait Japanese stab pages, which use long-edge flipping.
For manual duplex, print **Fronts only** single-sided, reload the stack without
reordering it, then print the backs. Choose **Backs · reversed order** if the
last front sheet is on top; otherwise choose **Backs · same order**.
Test one sheet to establish your printer's feed orientation.

Separate punch guides are excluded by default. Append one explicitly to
**All sides**, or print it independently with **Punch guide only**.

For Japanese stab binding, stack full sheets in page order before sewing the
four-hole pattern. If two-up printing is enabled, cut each sheet in half first.

## Trademark notice

Clairefontaine is a trademark of its owner. Fold is an independent project and
is not affiliated with, endorsed by, sponsored by, or otherwise related to
Clairefontaine. The Clairefontaine and Trophée names are used only to identify
color references.

## License

Fold is licensed under the [Apache License 2.0](LICENSE).
