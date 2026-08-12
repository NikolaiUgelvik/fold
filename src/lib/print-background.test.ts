import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("does not paint a background in exported pages", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8")
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8")
  const printCss = css.slice(css.indexOf("@media print"))

  assert.match(app, /function PrintPage[\s\S]*?paperColor="none"/)
  assert.doesNotMatch(printCss, /\.paper-page\s*{[^}]*background:/)
})
