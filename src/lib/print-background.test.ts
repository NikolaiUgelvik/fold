import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("does not paint a background in exported pages", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../App.tsx", import.meta.url), "utf8"),
    readFile(new URL("../index.css", import.meta.url), "utf8"),
  ])
  const printCss = css.slice(css.indexOf("@media print"))

  assert.match(app, /function PrintPage[\s\S]*?paperColor="none"/)
  assert.doesNotMatch(printCss, /\.paper-page\s*{[^}]*background:/)
})
