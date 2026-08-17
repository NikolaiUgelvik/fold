# Browser renderer and lighting

Context: resolves [Wayfinder research ticket #2](https://github.com/NikolaiUgelvik/fold/issues/2), under the [physical design preview map](https://github.com/NikolaiUgelvik/fold/issues/1).

## Recommendation

Use **direct Three.js with `WebGLRenderer` (WebGL 2)** as the initial renderer. Mount and dispose it from one React component/effect, with a canvas ref. This is the smallest addition to the current React/Vite app: it has neither `three` nor a React Three renderer today. React documents Effects as the mechanism for synchronising with an external system and requires cleanup; refs retain values without causing renders ([`useEffect`](https://react.dev/reference/react/useEffect), [`useRef`](https://react.dev/reference/react/useRef)).

`WebGLRenderer` uses WebGL 2; Three.js dropped WebGL 1 support in r163 ([source](https://github.com/mrdoob/three.js/blob/dev/src/renderers/WebGLRenderer.js)). Three.js supplies `WebGL.isWebGL2Available()` for capability detection ([WebGL addon](https://threejs.org/docs/pages/WebGL.html)). The product still needs to decide what an unavailable or lost context means; this research does not select that behaviour.

Do not make WebGPU a V1 requirement. `WebGPURenderer` can select a WebGL 2 backend with `forceWebGL`, but WebGPU itself needs an availability check ([`WebGPURenderer`](https://threejs.org/docs/pages/WebGPURenderer.html), [WebGPU addon](https://threejs.org/docs/pages/WebGPU.html)). That makes it a credible later experiment, not documented evidence that it is a better initial browser target.

A React-specific renderer is optional rather than required. React Three Fiber's `Canvas` owns a renderer, scene, camera, render loop, and resize handling ([Canvas API](https://r3f.docs.pmnd.rs/api/canvas)); direct Three.js retains those same responsibilities in the effect. No documented capability here requires Fiber, so avoid its extra dependency until declarative scene composition produces a demonstrated benefit.

## Lighting and shadows

Use `MeshStandardMaterial` for physically based paper surfaces and an environment map for indirect light. The material is PBR and supports an environment map; Three.js documents PMREM preprocessing for physically based environment lighting ([`MeshStandardMaterial`](https://threejs.org/docs/pages/MeshStandardMaterial.html), [`PMREMGenerator`](https://threejs.org/docs/pages/PMREMGenerator.html)).

Enable renderer shadow maps and use `PCFShadowMap` first. It is the default and is softer than `BasicShadowMap`; `VSMShadowMap` is the smoothest listed option but costs more ([`WebGLRenderer.ShadowMap`](https://threejs.org/docs/pages/WebGLRenderer.html#ShadowMap)). Shadow maps are disabled by default, and static lighting can disable automatic updates after an explicit update ([same source](https://threejs.org/docs/pages/WebGLRenderer.html#ShadowMap)). Start by profiling map size, light count, and movement before changing the shadow algorithm.

For contact and fold darkening, evaluate the Three.js `GTAOPass` in the post-processing chain. It is an explicit addon and exposes AO, denoise, and pass parameters ([`GTAOPass`](https://threejs.org/docs/pages/GTAOPass.html)). `SSAOPass` is also an addon, while Three.js characterises it as basic and points to GTAO as a more advanced, more expensive option ([`SSAOPass`](https://threejs.org/docs/pages/SSAOPass.html)). This establishes GTAO as the quality candidate, not an unconditional default: it adds render targets and GPU work, so retain a no-screen-space-AO quality level if profiling requires it. A material `aoMap` is separate: it reads the red channel and requires a second UV set ([`MeshStandardMaterial.aoMap`](https://threejs.org/docs/pages/MeshStandardMaterial.html#aoMap)).

## Colour management

Use Three.js's colour-management workflow end to end. Its manual specifies that CSS/hex colours and colour textures are ordinarily sRGB, lighting and shader work are Linear-sRGB, non-colour data textures use `NoColorSpace`, and the renderer converts to the display colour space on output ([Color Management manual](https://threejs.org/manual/en/color-management.html)). `WebGLRenderer.outputColorSpace` defaults to `SRGBColorSpace`; tone mapping is a renderer setting with several documented operators ([`WebGLRenderer`](https://threejs.org/docs/pages/WebGLRenderer.html#outputColorSpace)).

For a high-quality HDR/post-processing path, keep the output transform at the end of the chain and select tone mapping only after visual comparison of the intended lighting. Three.js documents that `OutputPass` performs tone mapping and colour-space conversion, and should be used when post-processing is active ([`OutputPass`](https://threejs.org/docs/pages/OutputPass.html)). Do not manually mark every texture sRGB: normal, roughness, AO, and other non-colour maps are data textures.

## Browser constraints to plan for

- WebGL context attributes are requests: the WebGL specification says an implementation should make a best effort to honour `antialias`, `depth`, and `stencil` when enabled; the actual attributes are those of the created drawing buffer ([WebGL 1.0 §5.2.1](https://registry.khronos.org/webgl/specs/latest/1.0/#5.2.1)). Query renderer/context capabilities rather than assume desktop MSAA or a particular buffer format.
- GPU limits differ by system. MDN specifically warns not to extrapolate texture and sampler limits from the development machine, and notes that portable VRAM-total queries do not exist ([WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)). Cap canvas pixel ratio and render-target sizes; shadow maps and GTAO targets scale with pixel count.
- Context loss is normal browser failure handling. The WebGL specification defines `webglcontextlost` and `webglcontextrestored` events ([WebGL 1.0 §5.15.2](https://registry.khronos.org/webgl/specs/latest/1.0/#5.15.2)); MDN lists memory pressure, GPU switching, GPU resets, and driver updates as examples ([`isContextLost()`](https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/isContextLost)). Preserve document state outside GPU resources so the renderer can be recreated.
- Avoid synchronous GPU readback in interactive rendering. MDN identifies CPU `readPixels()` as a finish/round-trip and recommends resource-conscious VRAM management ([WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)).

## Minimal later extension seam

Keep the physical Page Block in its own `THREE.Group` under the preview scene root. A later cover or thread can then be added as a sibling scene object without changing document ownership or inventing a cover/thread API now. This is a scene-graph boundary only; their geometry, materials, mechanics, and behaviour remain out of scope.

## Decision boundary

This recommends a renderer path and documented quality constraints only. It does not select page material presets, camera/UI/accessibility behaviour, degradation behaviour, covers, threads, or direct editing of 3D surfaces.
