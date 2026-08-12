// Official screen swatches from https://clairefontaine.eu/en/papers/trophee/#specs
const swatches = `Pearl grey|#eceade
Steel grey|#dad5d2
Cream|#fef7e4
Chamois|#f4e4c0
Caramel|#c6a477
Orange|#e3aa73
Apricot|#f1cb9c
Peach|#e9bbac
Gold|#f3d068
Daffodil|#fdf69e
Canary|#fbf0b0
Salmon|#f4d8cd
Pink|#f2dcdf
Lilac|#dbd7ee
Wild rose|#de9ec3
Lavander|#a2badc
Dark blue|#b1d5e1
Nature green|#c8e1c4
Sky blue|#73cbf4
Blue|#9fd5f9
Jade|#deeaa4
Green|#d7eaaf
Pale green|#eef7e1
Flame|#e09017
Intensive orange|#cb4e14
Coral red|#c10212
Intensive red|#ac1751
Intensive pink|#d46d9a
Intensive Lilac|#776daa
Royal Blue|#6bb9dd
Intensive blue|#478dc8
Intensive yellow|#ffec02
Yellow sunflower|#e7bb27
Intensive green|#a3bd38
Billiard green|#76a85f
Forest green|#226b4e
Black|#010101
Fluo pink|#c5027c
Fluo yellow|#f6e80d
Fluo green|#b9c932
Fluo orange|#e2a415`

export const tropheeColors = swatches.split("\n").map((swatch) => {
  const [name, hex] = swatch.split("|")
  return { name, hex }
})
