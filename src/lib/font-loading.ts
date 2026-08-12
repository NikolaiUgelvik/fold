interface FontLoader {
  load(font: string, text?: string): PromiseLike<unknown>
  check(font: string, text?: string): boolean
}

export async function ensureFontLoaded(fonts: FontLoader, font: string, text: string) {
  await fonts.load(font, text)
  if (!fonts.check(font, text)) throw new Error(`Font did not load: ${font}`)
}
