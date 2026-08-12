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
