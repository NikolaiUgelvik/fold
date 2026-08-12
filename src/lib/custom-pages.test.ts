import assert from "node:assert/strict"
import test from "node:test"

import { parseIndexEntries } from "./custom-pages.ts"

test("parses index entries and ignores blank lines", () => {
  assert.deepEqual(parseIndexEntries("Projects | 4\n\nNotes | 12\nAppendix"), [
    { label: "Projects", page: "4" },
    { label: "Notes", page: "12" },
    { label: "Appendix", page: "" },
  ])
})
