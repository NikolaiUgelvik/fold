export const numberFonts = [
  { label: "Georgia", value: "Georgia, serif" },
  { label: "DM Serif Display", value: '"DM Serif Display", serif' },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "IBM Plex Mono", value: '"IBM Plex Mono", monospace' },
  { label: "Playfair Display", value: '"Playfair Display", serif' },
  { label: "Lora", value: "Lora, serif" },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Libre Baskerville", value: '"Libre Baskerville", serif' },
  { label: "Caveat", value: "Caveat, cursive" },
  { label: "Dancing Script", value: '"Dancing Script", cursive' },
  { label: "Great Vibes", value: '"Great Vibes", cursive' },
  { label: "Pinyon Script", value: '"Pinyon Script", cursive' },
  { label: "Cinzel Decorative", value: '"Cinzel Decorative", serif' },
] as const

export function getNumberFont(value: string) {
  return numberFonts.find((font) => font.value === value) ?? numberFonts[0]
}

export async function ensureFontLoaded(
  fonts: Pick<FontFaceSet, "load" | "check">,
  font: string,
  text: string,
) {
  await fonts.load(font, text)
  if (!fonts.check(font, text)) throw new Error(`Font did not load: ${font}`)
}
