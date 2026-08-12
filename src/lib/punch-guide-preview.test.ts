import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("shows the separate punch guide in the live preview", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8")
  const bookSetup = app.slice(
    app.indexOf("function BookSetup"),
    app.indexOf("function PreviewToolbar"),
  )
  const preview = app.slice(
    app.indexOf("function PreviewToolbar"),
    app.indexOf("function StyleTab"),
  )

  assert.match(app, /function getPunchGuide/)
  assert.match(preview, /aria-label="Punch guide preview"/)
  assert.match(preview, /showPunchGuide \? "View pages" : "View guide"/)
  assert.match(bookSetup, /sides\.length \+ guideSides/)
})
