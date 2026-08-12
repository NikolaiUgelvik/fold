# Page-number font shortlist

## Finding

The initial shortlist clustered around conventional book serifs and neutral sans serifs. **Keep Playfair Display, Lora, Merriweather, Libre Baskerville, and Inter; omit Roboto because it overlaps visually with Inter. Treat DM Serif Display as a limited option:** Google Fonts supplies it only at weight 400, so native bold and bold italic are unavailable.

Google Fonts defines regular as weight 400 and documents requests by italic (`ital`) and weight (`wght`) axes; the table checks the four combinations used by the app: 400 normal, 700 normal, 400 italic, and 700 italic ([CSS API documentation](https://developers.google.com/fonts/docs/css2)).

| Family | Page-number character | Regular | 700 | Italic | 700 italic |
|---|---|:---:|:---:|:---:|:---:|
| [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) | Formal, high-contrast book style; best when numbers are not tiny | Yes | Yes | Yes | Yes |
| [Lora](https://fonts.google.com/specimen/Lora) | Warm, literary serif with moderate contrast | Yes | Yes | Yes | Yes |
| [Merriweather](https://fonts.google.com/specimen/Merriweather) | Sturdy, screen-readable serif; strongest all-purpose book choice | Yes | Yes | Yes | Yes |
| [Libre Baskerville](https://fonts.google.com/specimen/Libre+Baskerville) | Traditional book serif with clear text proportions | Yes | Yes | Yes | Yes |
| [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display) | Elegant display serif, but less flexible and delicate at small sizes | Yes | **No** | Yes | **No** |
| [Inter](https://fonts.google.com/specimen/Inter) | Clean modern sans, particularly clear at UI-sized text | Yes | Yes | Yes | Yes |

## Distinctive options

The CSS API defines regular as 400 and italic as `ital=1`. Google Fonts lists each family's available styles on its specimen page ([CSS API documentation](https://developers.google.com/fonts/docs/css2)). The linked API checks request `0123456789` in all four target styles. A returned `@font-face` rule marks native support.

| Family | Character | Numerals | Regular | 700 | Italic | 700 italic |
|---|---|:---:|:---:|:---:|:---:|:---:|
| [Caveat](https://fonts.google.com/specimen/Caveat) | Handwritten | [Yes](https://fonts.googleapis.com/css2?family=Caveat:ital,wght@0,400;0,700;1,400;1,700&text=0123456789) | Yes | Yes | No | No |
| [Dancing Script](https://fonts.google.com/specimen/Dancing+Script) | Casual script | [Yes](https://fonts.googleapis.com/css2?family=Dancing+Script:ital,wght@0,400;0,700;1,400;1,700&text=0123456789) | Yes | Yes | No | No |
| [Great Vibes](https://fonts.google.com/specimen/Great+Vibes) | Formal calligraphy | [Yes](https://fonts.googleapis.com/css2?family=Great+Vibes:ital,wght@0,400;0,700;1,400;1,700&text=0123456789) | Yes | No | No | No |
| [Pinyon Script](https://fonts.google.com/specimen/Pinyon+Script) | Formal handwritten script | [Yes](https://fonts.googleapis.com/css2?family=Pinyon+Script&text=0123456789) | Yes | No | No | No |
| [Cinzel Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) | Ornamental | [Yes](https://fonts.googleapis.com/css2?family=Cinzel+Decorative:ital,wght@0,400;0,700;1,400;1,700&text=0123456789) | Yes | Yes | No | No |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) | Monospace | [Yes](https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,700;1,400;1,700&text=0123456789) | Yes | Yes | Yes | Yes |

All six have usable numerals, so no substitution is needed. Great Vibes and Pinyon Script only provide regular weight.

## Recommendation

Default to **Merriweather** or **Libre Baskerville** for conventional book pages, **Lora** for a softer notebook feel, and **Inter** for modern layouts. Use **Caveat**, **Dancing Script**, **Great Vibes**, or **Pinyon Script** for handwritten or calligraphic numbers; **Cinzel Decorative** for ornament; and **IBM Plex Mono** for a mechanical look.
