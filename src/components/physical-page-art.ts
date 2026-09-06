import * as THREE from "three"

import type { PageMetrics, PageSurface, PageTextRun } from "@/lib/page-surface"

const ATLAS_SIZE = 2048
const ATLAS_PIXELS_PER_MILLIMETER = 8
const ATLAS_TILE_GUARD = 8
const ATLAS_TEXT_INSET = 2

const vertexShader = `
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uPageSize;
uniform int uFlipX;
uniform int uPattern;
uniform int uSlantOverlay;
uniform vec4 uOverlayBounds;
uniform vec4 uPatternBounds;
uniform vec4 uMajorBounds;
uniform vec2 uPatternStart;
uniform float uSpacing;
uniform float uMajorSpacing;
uniform float uDotRadius;
uniform float uMajorDotRadius;
uniform float uLineWidth;
uniform float uMajorLineWidth;
uniform vec2 uCrossLengths;
uniform float uCrossLineWidth;
uniform float uFourLineGap;
uniform float uSlantAngle;
uniform vec3 uDotColor;
uniform vec3 uLineColor;
uniform vec3 uGraphMajorColor;
uniform vec3 uCrossColor;
uniform vec4 uBorderRect;
uniform float uBorderWidth;
uniform vec3 uBorderColor;
uniform sampler2D uPunchHoles;
uniform int uPunchHoleCount;
uniform float uPunchHoleRadius;
uniform sampler2D uIndexLines;
uniform int uIndexLineCount;
uniform float uIndexLineStart;
uniform float uIndexLineEnd;
uniform vec3 uIndexLineColor;

float insideRect(vec2 point, vec4 rect) {
  return step(rect.x, point.x) * step(rect.y, point.y) *
    step(point.x, rect.x + rect.z) * step(point.y, rect.y + rect.w);
}

float nearestGridDistance(float value, float start, float spacing) {
  return abs(fract((value - start) / spacing + 0.5) - 0.5) * spacing;
}

float lineMask(float distance, float width) {
  float edge = max(fwidth(distance), 0.015);
  return 1.0 - smoothstep(width * 0.5 - edge, width * 0.5 + edge, distance);
}

float circleMask(float distance, float radius) {
  float edge = max(fwidth(distance), 0.015);
  return 1.0 - smoothstep(radius - edge, radius + edge, distance);
}

float repeatedRectangleDistance(vec2 distance, vec2 size) {
  vec2 edge = distance - size * 0.5;
  // An axis covered by adjacent tiles has no exposed edge at the tile boundary.
  if (size.x >= uSpacing) edge.x = -uSpacing;
  if (size.y >= uSpacing) edge.y = -uSpacing;
  return length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0);
}

void over(inout vec4 painted, vec3 color, float alpha) {
  painted.rgb = mix(painted.rgb, color, alpha);
  painted.a = alpha + painted.a * (1.0 - alpha);
}

float decode16(vec2 bytes) {
  return (bytes.x * 255.0 * 256.0 + bytes.y * 255.0) / 65535.0;
}

float fourLineDistance(vec2 point) {
  float period = uSpacing * 4.0 + uFourLineGap;
  float d = mod(point.y - uPatternStart.y, period);
  return d < uSpacing * 4.0
    ? abs(fract(d / uSpacing) - 0.5) * uSpacing
    : min(d - uSpacing * 3.5, period + uSpacing * 0.5 - d);
}

float slantDistance(vec2 point) {
  float angle = radians(uSlantAngle);
  vec2 normal = vec2(cos(angle), sin(angle));
  float perpSpacing = uSpacing * cos(angle);
  float proj = dot(point - uPatternStart, normal);
  return abs(fract(proj / perpSpacing + 0.5) - 0.5) * perpSpacing;
}

void main() {
  vec2 point = vec2(
    (uFlipX == 1 ? 1.0 - vUv.x : vUv.x) * uPageSize.x,
    (1.0 - vUv.y) * uPageSize.y
  );
  vec4 painted = vec4(0.0);
  float patternArea = insideRect(point, uPatternBounds);

  if (patternArea > 0.0 && uPattern == 1) {
    float dot = circleMask(
      length(vec2(
        nearestGridDistance(point.x, uPatternStart.x, uSpacing),
        nearestGridDistance(point.y, uPatternStart.y, uSpacing)
      )),
      uDotRadius
    );
    over(painted, uDotColor, dot);
    if (insideRect(point, uMajorBounds) > 0.0 && uMajorSpacing > 0.0) {
      float majorDot = circleMask(
        length(vec2(
          nearestGridDistance(point.x, uPatternStart.x, uMajorSpacing),
          nearestGridDistance(point.y, uPatternStart.y, uMajorSpacing)
        )),
        uMajorDotRadius
      );
      over(painted, uDotColor, majorDot);
    }
  }

  if (patternArea > 0.0 && uPattern >= 2 && uPattern <= 4) {
    float horizontal = lineMask(
      nearestGridDistance(point.y, uPatternStart.y, uSpacing),
      uLineWidth
    );
    float base = uPattern == 2
      ? horizontal
      : max(horizontal, lineMask(nearestGridDistance(point.x, uPatternStart.x, uSpacing), uLineWidth));
    over(painted, uLineColor, base);
    if (uPattern == 4 && uMajorSpacing > 0.0) {
      float major = max(
        lineMask(nearestGridDistance(point.x, uPatternStart.x, uMajorSpacing), uMajorLineWidth),
        lineMask(nearestGridDistance(point.y, uPatternStart.y, uMajorSpacing), uMajorLineWidth)
      );
      over(painted, uGraphMajorColor, major);
    }
  }

  if (patternArea > 0.0 && uPattern == 5) {
    over(painted, uLineColor, lineMask(fourLineDistance(point), uLineWidth));
  }

  if (patternArea > 0.0 && uPattern == 6) {
    over(painted, uLineColor, lineMask(slantDistance(point), uLineWidth));
  }

  if (patternArea > 0.0 && uPattern == 7) {
    vec2 distance = vec2(
      nearestGridDistance(point.x, uPatternStart.x, uSpacing),
      nearestGridDistance(point.y, uPatternStart.y, uSpacing)
    );
    float crossDistance = min(
      repeatedRectangleDistance(distance, vec2(uCrossLengths.x, uCrossLineWidth)),
      repeatedRectangleDistance(distance, vec2(uCrossLineWidth, uCrossLengths.y))
    );
    float edge = max(fwidth(crossDistance), 0.015);
    over(painted, uCrossColor, 1.0 - smoothstep(-edge, edge, crossDistance));
  }

  if (uSlantOverlay == 1 && insideRect(point, uOverlayBounds) > 0.0) {
    over(painted, uLineColor, lineMask(slantDistance(point), uLineWidth));
  }

  if (uBorderWidth > 0.0 && insideRect(point, uBorderRect) > 0.0) {
    float borderDistance = min(
      min(abs(point.x - uBorderRect.x), abs(point.x - (uBorderRect.x + uBorderRect.z))),
      min(abs(point.y - uBorderRect.y), abs(point.y - (uBorderRect.y + uBorderRect.w)))
    );
    over(painted, uBorderColor, lineMask(borderDistance, uBorderWidth));
  }

  for (int index = 0; index < uPunchHoleCount; index += 1) {
    vec4 bytes = texelFetch(uPunchHoles, ivec2(index, 0), 0);
    vec2 center = vec2(decode16(bytes.rg), decode16(bytes.ba)) * uPageSize;
    float ring = max(
      0.0,
      circleMask(length(point - center), uPunchHoleRadius + 0.125) -
        circleMask(length(point - center), max(0.0, uPunchHoleRadius - 0.125))
    );
    over(painted, vec3(0.028), ring);
  }

  for (int index = 0; index < uIndexLineCount; index += 1) {
    vec4 bytes = texelFetch(uIndexLines, ivec2(index, 0), 0);
    float y = decode16(bytes.rg) * uPageSize.y;
    float withinLine = step(uIndexLineStart, point.x) * step(point.x, uIndexLineEnd);
    float dash = step(mod(point.x - uIndexLineStart, 2.5), 1.0);
    over(painted, uIndexLineColor, lineMask(abs(point.y - y), 0.25) * withinLine * dash);
  }

  outColor = painted;
}
`

function encodeCoordinate(value: number) {
  const encoded = Math.round(Math.min(1, Math.max(0, value)) * 65535)
  return [encoded >> 8, encoded & 0xff]
}

function createCoordinateTexture(coordinates: number[][]) {
  const data = new Uint8Array(Math.max(1, coordinates.length) * 4)
  for (const [index, values] of coordinates.entries()) {
    for (const [component, value] of values.entries()) {
      const [high, low] = encodeCoordinate(value)
      data.set([high, low], index * 4 + component * 2)
    }
  }
  const texture = new THREE.DataTexture(
    data,
    Math.max(1, coordinates.length),
    1,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  )
  texture.colorSpace = THREE.NoColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function patternId(surface: PageSurface) {
  if (surface.metrics.customPage) return 0
  return { blank: 0, dots: 1, lines: 2, grid: 3, graph: 4, fourLine: 5, slant: 6, cross: 7 }[
    surface.appearance.pattern
  ]
}

function boundsAsVector4(bounds: { x: number; y: number; width: number; height: number } | null) {
  return new THREE.Vector4(bounds?.x ?? 0, bounds?.y ?? 0, bounds?.width ?? 0, bounds?.height ?? 0)
}

function slantOverlayValue(
  customPage: PageMetrics["customPage"],
  overlayPattern: "none" | "slant",
) {
  return !customPage && overlayPattern === "slant" ? 1 : 0
}

function createPageArtMaterial(surface: PageSurface, flipX: boolean, renderSide: THREE.Side) {
  const { appearance, metrics } = surface
  const borderWidth = metrics.customPage ? 0 : appearance.borderWidth
  const borderHeight = Math.max(
    0,
    metrics.pageSize.height - metrics.pageMargins.top - metrics.pageMargins.bottom - borderWidth,
  )
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: renderSide,
    uniforms: {
      uPageSize: { value: new THREE.Vector2(metrics.pageSize.width, metrics.pageSize.height) },
      uFlipX: { value: flipX ? 1 : 0 },
      uPattern: { value: patternId(surface) },
      uSlantOverlay: { value: slantOverlayValue(metrics.customPage, appearance.overlayPattern) },
      uOverlayBounds: { value: boundsAsVector4(metrics.slantOverlayBounds) },
      uPatternBounds: { value: boundsAsVector4(metrics.patternBounds) },
      uMajorBounds: { value: boundsAsVector4(metrics.majorBounds) },
      uPatternStart: { value: new THREE.Vector2(metrics.patternStartX, metrics.patternStartY) },
      uSpacing: { value: metrics.spacing },
      uMajorSpacing: {
        value:
          appearance.pattern === "dots" && appearance.dotMajorEvery <= 0 ? 0 : metrics.majorSpacing,
      },
      uDotRadius: { value: appearance.dotSize / 2 },
      uMajorDotRadius: { value: appearance.dotMajorSize / 2 },
      uLineWidth: { value: appearance.lineWidth },
      uMajorLineWidth: { value: appearance.graphMajorLineWidth },
      uCrossLengths: {
        value: new THREE.Vector2(appearance.crossHorizontalLength, appearance.crossVerticalLength),
      },
      uCrossLineWidth: { value: appearance.crossLineWidth },
      uFourLineGap: { value: appearance.fourLineGap },
      uSlantAngle: { value: appearance.slantAngle },
      uDotColor: { value: new THREE.Color(appearance.dotColor) },
      uLineColor: { value: new THREE.Color(appearance.lineColor) },
      uGraphMajorColor: { value: new THREE.Color(appearance.graphMajorColor) },
      uCrossColor: { value: new THREE.Color(appearance.crossColor) },
      uBorderRect: {
        value: new THREE.Vector4(
          metrics.borderX,
          metrics.borderY,
          Math.max(0, metrics.contentWidth - borderWidth),
          borderHeight,
        ),
      },
      uBorderWidth: { value: borderWidth },
      uBorderColor: { value: new THREE.Color(appearance.borderColor) },
      uPunchHoles: {
        value: createCoordinateTexture(
          surface.punchHoles.map((hole) => [
            hole.x / metrics.pageSize.width,
            hole.y / metrics.pageSize.height,
          ]),
        ),
      },
      uPunchHoleCount: { value: surface.punchHoles.length },
      uPunchHoleRadius: { value: appearance.punchHoleDiameter / 2 },
      uIndexLines: {
        value: createCoordinateTexture(
          surface.indexLineYs.map((y) => [y / metrics.pageSize.height]),
        ),
      },
      uIndexLineCount: { value: surface.indexLineYs.length },
      uIndexLineStart: { value: metrics.pageMargins.left + metrics.contentWidth * 0.58 },
      uIndexLineEnd: { value: metrics.pageSize.width - metrics.pageMargins.right - 10 },
      uIndexLineColor: { value: new THREE.Color("#908b82") },
    },
  })
}

type AtlasEntry = {
  x: number
  y: number
  width: number
  height: number
  pageX: number
  pageY: number
}

function fontFor(run: PageTextRun) {
  return `${run.fontStyle} ${run.fontWeight} ${run.fontSize * ATLAS_PIXELS_PER_MILLIMETER}px ${run.fontFamily}`
}

function extrudeTileEdges(context: CanvasRenderingContext2D, width: number, height: number) {
  const innerWidth = width - ATLAS_TILE_GUARD * 2
  const innerHeight = height - ATLAS_TILE_GUARD * 2
  context.drawImage(
    context.canvas,
    ATLAS_TILE_GUARD,
    ATLAS_TILE_GUARD,
    innerWidth,
    1,
    ATLAS_TILE_GUARD,
    0,
    innerWidth,
    ATLAS_TILE_GUARD,
  )
  context.drawImage(
    context.canvas,
    ATLAS_TILE_GUARD,
    height - ATLAS_TILE_GUARD - 1,
    innerWidth,
    1,
    ATLAS_TILE_GUARD,
    height - ATLAS_TILE_GUARD,
    innerWidth,
    ATLAS_TILE_GUARD,
  )
  context.drawImage(
    context.canvas,
    ATLAS_TILE_GUARD,
    ATLAS_TILE_GUARD,
    1,
    innerHeight,
    0,
    ATLAS_TILE_GUARD,
    ATLAS_TILE_GUARD,
    innerHeight,
  )
  context.drawImage(
    context.canvas,
    width - ATLAS_TILE_GUARD - 1,
    ATLAS_TILE_GUARD,
    1,
    innerHeight,
    width - ATLAS_TILE_GUARD,
    ATLAS_TILE_GUARD,
    ATLAS_TILE_GUARD,
    innerHeight,
  )
}

export function getSurfaceFontRequests(surfaces: PageSurface[]) {
  const requests = new Map<string, Set<string>>()
  for (const surface of surfaces) {
    for (const run of surface.textRuns) {
      const text = requests.get(fontFor(run)) ?? new Set<string>()
      text.add(run.text)
      requests.set(fontFor(run), text)
    }
  }
  return requests
}

type TextTile = {
  canvas: HTMLCanvasElement
  width: number
  height: number
  contentWidth: number
  ascent: number
}

function createTextTile(run: PageTextRun): TextTile | null {
  const measureCanvas = document.createElement("canvas")
  const measureContext = measureCanvas.getContext("2d")
  if (!measureContext) return null
  measureContext.font = fontFor(run)
  const measurement = measureContext.measureText(run.text)
  const contentWidth = Math.max(1, Math.ceil(measurement.width))
  const ascent = Math.max(1, Math.ceil(measurement.actualBoundingBoxAscent || run.fontSize))
  const descent = Math.max(1, Math.ceil(measurement.actualBoundingBoxDescent || run.fontSize * 0.3))
  const edgePadding = ATLAS_TILE_GUARD + ATLAS_TEXT_INSET
  const width = contentWidth + edgePadding * 2
  const height = ascent + descent + edgePadding * 2
  if (width > ATLAS_SIZE || height > ATLAS_SIZE) return null

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) return null
  context.font = fontFor(run)
  context.fillStyle = run.color
  context.textBaseline = "alphabetic"
  context.fillText(run.text, edgePadding, edgePadding + ascent)
  extrudeTileEdges(context, width, height)
  return { canvas, width, height, contentWidth, ascent }
}

export class TextRunAtlas {
  readonly canvas = document.createElement("canvas")
  readonly texture: THREE.CanvasTexture
  private readonly context: CanvasRenderingContext2D
  private readonly entries = new Map<string, AtlasEntry>()
  private cursorX = 0
  private cursorY = 0
  private rowHeight = 0

  constructor() {
    this.canvas.width = ATLAS_SIZE
    this.canvas.height = ATLAS_SIZE
    const context = this.canvas.getContext("2d")
    if (!context) throw new Error("Could not create the text atlas canvas")
    this.context = context
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = true
  }

  prepare(surfaces: PageSurface[]) {
    this.entries.clear()
    this.cursorX = 0
    this.cursorY = 0
    this.rowHeight = 0
    this.context.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE)
    for (const surface of surfaces) {
      for (const run of surface.textRuns) this.add(surface.logicalPage, run)
    }
    this.texture.needsUpdate = true
  }

  get(logicalPage: number, runId: string) {
    return this.entries.get(`${logicalPage}:${runId}`)
  }

  dispose() {
    this.texture.dispose()
  }

  private reserve(width: number, height: number) {
    if (this.cursorX + width > ATLAS_SIZE) {
      this.cursorX = 0
      this.cursorY += this.rowHeight
      this.rowHeight = 0
    }
    if (this.cursorY + height > ATLAS_SIZE) return null
    const placement = { x: this.cursorX, y: this.cursorY }
    this.cursorX += width
    this.rowHeight = Math.max(this.rowHeight, height)
    return placement
  }

  private add(logicalPage: number, run: PageTextRun) {
    const key = `${logicalPage}:${run.id}`
    if (this.entries.has(key)) return
    const tile = createTextTile(run)
    if (!tile) return
    const placement = this.reserve(tile.width, tile.height)
    if (!placement) return
    this.context.drawImage(tile.canvas, placement.x, placement.y)

    const textWidth = tile.contentWidth / ATLAS_PIXELS_PER_MILLIMETER
    const textLeft =
      run.x -
      (run.anchor === "middle" ? textWidth / 2 : run.anchor === "end" ? textWidth : 0) -
      (ATLAS_TILE_GUARD + ATLAS_TEXT_INSET) / ATLAS_PIXELS_PER_MILLIMETER
    this.entries.set(key, {
      x: placement.x,
      y: placement.y,
      width: tile.width,
      height: tile.height,
      pageX: textLeft,
      pageY:
        run.y -
        tile.ascent / ATLAS_PIXELS_PER_MILLIMETER -
        (ATLAS_TILE_GUARD + ATLAS_TEXT_INSET) / ATLAS_PIXELS_PER_MILLIMETER,
    })
  }
}

function createTextMesh(
  entry: AtlasEntry,
  pageSize: { width: number; height: number },
  millimetersToWorld: number,
  flipX: boolean,
  material: THREE.MeshBasicMaterial,
  renderSide: THREE.Side,
) {
  const width = (entry.width / ATLAS_PIXELS_PER_MILLIMETER) * millimetersToWorld
  const height = (entry.height / ATLAS_PIXELS_PER_MILLIMETER) * millimetersToWorld
  const geometry = new THREE.PlaneGeometry(width, height)
  const uvs = geometry.getAttribute("uv")
  const u0 = entry.x / ATLAS_SIZE
  const u1 = (entry.x + entry.width) / ATLAS_SIZE
  const v0 = 1 - (entry.y + entry.height) / ATLAS_SIZE
  const v1 = 1 - entry.y / ATLAS_SIZE
  for (let index = 0; index < uvs.count; index += 1) {
    const u = uvs.getX(index)
    const v = uvs.getY(index)
    uvs.setXY(index, (flipX ? 1 - u : u) * (u1 - u0) + u0, v * (v1 - v0) + v0)
  }
  uvs.needsUpdate = true

  const text = new THREE.Mesh(geometry, material)
  const pageX = entry.pageX + entry.width / ATLAS_PIXELS_PER_MILLIMETER / 2
  const x = flipX ? pageSize.width - pageX : pageX
  text.position.set(
    (x - pageSize.width / 2) * millimetersToWorld,
    (pageSize.height / 2 - (entry.pageY + entry.height / ATLAS_PIXELS_PER_MILLIMETER / 2)) *
      millimetersToWorld,
    renderSide === THREE.BackSide ? -0.001 : 0.001,
  )
  text.renderOrder = 3
  return text
}

export function createPageArtGroup({
  surface,
  geometry,
  millimetersToWorld,
  flipX,
  renderSide,
  atlas,
  includeText,
}: {
  surface: PageSurface
  geometry: THREE.BufferGeometry
  millimetersToWorld: number
  flipX: boolean
  renderSide: THREE.Side
  atlas: TextRunAtlas
  includeText: boolean
}) {
  const art = new THREE.Group()
  const pageArt = new THREE.Mesh(
    geometry.clone(),
    createPageArtMaterial(surface, flipX, renderSide),
  )
  pageArt.position.z = renderSide === THREE.BackSide ? -0.0005 : 0.0005
  pageArt.renderOrder = 2
  art.add(pageArt)

  if (!includeText) return art
  const textMaterial = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: renderSide,
    toneMapped: false,
  })
  for (const run of surface.textRuns) {
    const entry = atlas.get(surface.logicalPage, run.id)
    if (!entry) continue
    art.add(
      createTextMesh(
        entry,
        surface.metrics.pageSize,
        millimetersToWorld,
        flipX,
        textMaterial,
        renderSide,
      ),
    )
  }
  return art
}
