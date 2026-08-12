import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("self-hosts page-number fonts", () => {
  const css = readFileSync(new URL("../fonts.css", import.meta.url), "utf8")
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  const files = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map(([, file]) => file)

  assert.match(css, /font-family: 'Pinyon Script'/)
  assert.doesNotMatch(html + css, /fonts\.(?:googleapis|gstatic)\.com/)
  assert.ok(files.length > 0)
  for (const file of files) {
    assert.equal(readFileSync(new URL(`../../public${file}`, import.meta.url), { encoding: "ascii", flag: "r" }).slice(0, 4), "wOF2")
  }
})
