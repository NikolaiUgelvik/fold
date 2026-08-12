import assert from "node:assert/strict"
import test from "node:test"
import { ensureFontLoaded } from "./font-loading.ts"

test("rejects a font load that would use fallback text", async () => {
  await assert.rejects(ensureFontLoaded({
    load: async () => [],
    check: () => false,
  }, "16px MissingFont, serif", "1 2 3"))
})

test("accepts a font after it is available", async () => {
  await ensureFontLoaded({
    load: async () => [],
    check: () => true,
  }, "16px LoadedFont, serif", "1 2 3")
})
