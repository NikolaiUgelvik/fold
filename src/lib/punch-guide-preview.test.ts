import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("shows the separate punch guide in the live preview", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8")
  const screenApp = app.slice(app.indexOf("function App()"))

  assert.match(app, /function getPunchGuide/)
  assert.match(screenApp, /aria-label="Punch guide preview"/)
  assert.match(screenApp, /showPunchGuide \? "View pages" : "View guide"/)
  assert.match(screenApp, /sides\.length \+ guideSides/)
})
