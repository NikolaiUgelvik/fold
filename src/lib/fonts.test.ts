import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import test from "node:test"

test("self-hosts page-number fonts", () => {
  const css = readFileSync(new URL("../fonts.css", import.meta.url), "utf8")
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  const files = [...css.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map(([, file]) => file)

  assert.match(css, /font-family: ["']Pinyon Script["']/)
  assert.doesNotMatch(html + css, /fonts\.(?:googleapis|gstatic)\.com/)
  const ranges = [...css.matchAll(/unicode-range:\s*([^;]+);/g)].map(([, range]) => range)
  assert.deepEqual(new Set(ranges), new Set(["U+20-7e"]))
  assert.ok(files.length > 0)
  const fonts = files.map((file) => readFileSync(new URL(`../../public${file}`, import.meta.url)))
  for (const font of fonts) assert.equal(font.subarray(0, 4).toString("ascii"), "wOF2")

  const hashes = fonts.map((font) => createHash("sha256").update(font).digest("hex"))
  assert.equal(new Set(hashes).size, hashes.length)
})
