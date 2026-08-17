# Sharp page-surface rendering

Context: [Wayfinder research ticket #4](https://github.com/NikolaiUgelvik/fold/issues/4).

## Current art that a preview must represent

`PageSvg` is the source rendering of a page today: it makes repeating dot, line,
grid, and graph SVG patterns; a stroked border; optional punch-hole circles; page
numbers using loaded fonts; and SVG title/index text including index leader lines.
It is parameterised per logical page, including per-page appearance overrides.
[Source: `src/components/notebook-page.tsx`](../../src/components/notebook-page.tsx).

The comparison below is about carrying that art onto a deforming WebGL page at
close range. It deliberately does not select a product strategy.

## Facts common to every path

- WebGL exposes implementation-dependent limits such as `MAX_TEXTURE_SIZE`,
  `MAX_TEXTURE_IMAGE_UNITS`, and `MAX_VERTEX_ATTRIBS`; applications can query
  them with `getParameter`. The WebGL guidance warns not to assume desktop
  limits: its conservative WebGL baseline includes a 4096 maximum 2D texture
  size, eight fragment texture units, eight combined units, and 16 vertex
  attributes. [WebGL parameters (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getParameter), [WebGL best practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#understand_system_limits).
- There is no portable WebGL API for total VRAM. MDN recommends a per-screen-
  pixel VRAM budget and purging cached textures/buffers above it after resize.
  [WebGL best practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#estimate_a_per-pixel_vram_budget).
- A 2D RGBA8 level costs `width × height × 4` bytes before implementation
  overhead; a full mip chain adds about 30% by the WebGL guidance. Therefore a
  4096² page is about 64 MiB at base level and about 85 MiB with mipmaps. This
  arithmetic is a planning estimate, not a queryable allocation size.
  [WebGL best practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#use_mipmaps_for_any_texture_youll_see_in_3d).
- Minification and magnification have distinct texture filters. WebGL permits
  `NEAREST` or `LINEAR` for magnification and adds mipmap choices for
  minification; filtering changes sampling, not the source raster resolution.
  [WebGL texture parameters (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texParameter).
- Context antialiasing is a creation attribute, while shader derivatives provide
  `dFdx`, `dFdy`, and `fwidth`; the derivatives extension specifically calls
  `dFdx`/`dFdy` common tools for estimating an anti-aliasing filter width for
  procedural textures. [WebGL context attributes (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/getContextAttributes), [OES standard derivatives (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/OES_standard_derivatives).

## Paths and their documented trade-offs

| Path | What it represents well | Close-range / aliasing boundary | Texture, memory, and draw-call boundary |
| --- | --- | --- | --- |
| **One page raster texture** | A rendered page snapshot, including all SVG patterns, browser font shaping, title/index text, and arbitrary future page decoration. | It is finite-resolution: magnifying past its texel density cannot recover detail. Mipmaps improve minified, oblique, or distant sampling but do not improve magnification; Three.js exposes anisotropy as extra samples that make the highest-density axis less blurry at added sampling cost. | One sampled image normally makes surface rendering simple, but unique pages imply separate images or an atlas. An atlas can reduce batches because changing textures splits batches, but it has packing/invalidating concerns. Mipmaps add about 30% memory. [Three.js Texture](https://threejs.org/docs/pages/Texture.html), [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#use_mipmaps_for_any_texture_youll_see_in_3d), [texture atlasing guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#batch_draw_calls).
| **Canvas/SVG rasterisation into a texture** | The existing SVG page can be rasterised as a unit, so its repeat rules, strokes, and text layout remain browser-produced at the chosen render size. `CanvasTexture` directly accepts an HTML canvas and defaults to linear magnification and trilinear mipmapped minification. | Canvas output is still a bitmap after upload. Canvas image smoothing controls raster image scaling; it is not a general solution for under-resolved text or line art. Rasterising only after fonts are ready is necessary to capture the intended glyphs; the existing page already uses font families. | A changed canvas must be uploaded again. DOM-source `texImage`/`texSubImage` uploads can cause a pipeline flush, and the WebGL guidance says to place them before drawing or between pipelines. `OffscreenCanvas` can be transferred to a worker and can produce an `ImageBitmap`, which is an available scheduling tool rather than a quality change. [CanvasTexture](https://threejs.org/docs/pages/CanvasTexture.html), [canvas smoothing](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled), [WebGL upload guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#teximagetexsubimage_uploads_esp_videos_can_cause_pipeline_flushes), [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas).
| **Shader / vector-like procedural marks** | Repeating dots, rules, grids, graph majors, rectangular borders, and simple leader dashes can be evaluated from page-space coordinates without a page-sized art raster. Shader derivatives can make procedural-edge coverage track the screen-space footprint. | This keeps geometric definitions through page deformation, but it does not make arbitrary typefaces or arbitrary SVG text free: glyph outlines, shaping/layout, and a robust edge-distance representation must be supplied separately. Derivative functions are extension-gated in WebGL 1; WebGL 2 includes derivatives in its shading language. | It exchanges texture storage for fragment work and shader/attribute/uniform limits. The WebGL guidance notes fragment shaders execute far more often than vertex shaders, so per-fragment page art needs profiling at the close camera distance. [OES standard derivatives](https://developer.mozilla.org/en-US/docs/Web/API/OES_standard_derivatives), [WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#prefer_doing_work_in_the_vertex_shader), [SVG text](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/text).
| **Instanced primitives** | Many repeated independent elements—dot pattern marks, short rule segments, punch holes, or repeated border pieces—can reuse one geometry with per-instance transforms/attributes. WebGL instanced draws execute multiple instances of one element range, and `vertexAttribDivisor` controls the rate of per-instance attributes. | The primitives remain geometric during close inspection, but circles/lines still need an edge-coverage treatment and very dense page patterns can turn into high instance counts and overdraw. It is unsuitable by itself for the current arbitrary title/index strings unless glyphs are converted to instances or another text representation is added. | Instancing reduces submission count for like geometry, not the number of shaded fragments or the per-instance data transfer. Three.js `InstancedMesh` uses one geometry and material with a count, and requires setting `needsUpdate` after bulk matrix/color changes; its GPU resources must be disposed when unused. [WebGL 2 instanced draws](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/drawArraysInstanced), [ANGLE instancing](https://developer.mozilla.org/en-US/docs/Web/API/ANGLE_instanced_arrays), [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).

## Facts a later decision needs

1. **Quality target:** specify page physical dimensions, nearest camera distance,
   viewport size, device-pixel ratio, and acceptance samples for the thinnest
   line, smallest page number, title, and dense index entry. These establish
   whether a raster's selected texel density is sufficient and expose shimmer
   during a turn.
2. **Content cardinality and invalidation:** measure pages/signatures visible at
   once, how often each page's art changes, whether pages are unique, and whether
   title/index text must match the existing browser SVG exactly. These determine
   how much cached raster memory and upload work exists versus repeated geometry.
3. **Capability/degradation matrix:** record queried `MAX_TEXTURE_SIZE`, texture
   unit and attribute limits, derivative availability for WebGL 1 if supported,
   and renderer `maxTextureSize`, `maxTextures`, `maxAttributes`,
   `maxSamples`, and maximum anisotropy. Three.js exposes these through renderer
   capabilities. [Three.js WebGLRenderer capabilities](https://threejs.org/docs/pages/WebGLRenderer.html).
4. **Budget measurements:** on target desktop GPUs, capture peak texture/buffer
   memory estimates, upload time after a page edit, frame time during a nearby
   turn, draw calls, triangles/instances, and fragment cost. Three.js exposes
   renderer memory and per-frame render statistics for monitoring.
   [Three.js renderer info](https://threejs.org/docs/pages/WebGLRenderer.html#property:info).
5. **Text and colour checks:** use the shipped fonts and representative long
   title/index strings, and compare the WebGL surface against `PageSvg` at the
   acceptance camera. Texture colour-space configuration is explicit in Three.js,
   so this comparison also needs a declared source/output colour-space contract.
   [Three.js Texture colour space](https://threejs.org/docs/pages/Texture.html#property:colorSpace).

## Source scope

External sources above are browser API documentation, Khronos-linked WebGL API
references, and official Three.js documentation. The local `PageSvg` source is
the owning source for statements about Fold's current page art.
