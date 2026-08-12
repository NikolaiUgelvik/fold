export async function ensureFontLoaded(
  fonts: Pick<FontFaceSet, "load" | "check">,
  font: string,
  text: string,
) {
  await fonts.load(font, text)
  if (!fonts.check(font, text)) throw new Error(`Font did not load: ${font}`)
}
