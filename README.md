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

To export, select **Export / print PDF**, then choose **Save as PDF**, actual
size, and double-sided printing. Use short-edge flipping, except for full-sheet
portrait Japanese stab pages, which use long-edge flipping.
For Japanese stab binding, stack full sheets in page order before sewing the
four-hole pattern. If two-up printing is enabled, cut each sheet in half first.
