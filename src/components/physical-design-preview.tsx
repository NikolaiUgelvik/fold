import { Minus, Plus, RotateCcw, RotateCw } from "lucide-react"
import { type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import WebGL from "three/addons/capabilities/WebGL.js"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { SelectControl } from "@/components/form-controls"
import {
  createPageArtGroup,
  getSurfaceFontRequests,
  TextRunAtlas,
} from "@/components/physical-page-art"
import { Button } from "@/components/ui/button"
import type { Binding } from "@/lib/imposition"
import type { createNotebookDocument } from "@/lib/notebook-document"
import { createPageSurface, type PageSurface } from "@/lib/page-surface"
import {
  createPhysicalPreviewModel,
  type FoldedPreviewLeaf,
  type MaterialPresetId,
  materialPresets,
  type PhysicalPreviewModel,
  resolveOpeningDegrees,
  stepReaderPose,
} from "@/lib/physical-preview"
import type { Settings } from "@/lib/settings"

const PAGE_HEIGHT = 3
const RESTING_VOLUME_EPSILON = 0.0001
const CAMERA_FIT_MARGIN = 1.08
const CAMERA_ROTATION_STEP = THREE.MathUtils.degToRad(15)
const CAMERA_ZOOM_FACTOR = 1.2
const TURN_DURATION = 220

const materialPresetOptions = Object.fromEntries(
  Object.entries(materialPresets).map(([id, preset]) => [id, preset.label]),
)

function disposePageBlock(pageBlock: THREE.Group) {
  const disposedMaterials = new Set<THREE.Material>()
  pageBlock.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (disposedMaterials.has(material)) continue
      disposedMaterials.add(material)
      if (material instanceof THREE.ShaderMaterial) {
        for (const uniform of Object.values(material.uniforms)) {
          if (uniform.value instanceof THREE.Texture) uniform.value.dispose()
        }
      }
      material.dispose()
    }
  })
  pageBlock.clear()
}

function createProfiledVolumeGeometry(
  width: number,
  height: number,
  depth: number,
  profile: number,
) {
  const geometry = new THREE.BoxGeometry(width, height, depth, 8, 1, 1)
  const positions = geometry.getAttribute("position")
  for (let index = 0; index < positions.count; index += 1) {
    const distanceFromSpine = (positions.getX(index) + width / 2) / width
    const taper = 1 - profile * (1 - distanceFromSpine) * 0.35
    const curve = Math.sin(distanceFromSpine * Math.PI) * profile * depth * 0.4
    positions.setZ(index, positions.getZ(index) * taper + curve)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

function createPaperMaterial(model: PhysicalPreviewModel, active = false, paperColor = "#fffef9") {
  const { materialPreset } = model
  return new THREE.MeshPhysicalMaterial({
    color: active ? paperColor : "#e9e3d5",
    roughness: 0.78 - materialPreset.stiffness * 0.25,
    transmission: materialPreset.translucency * 0.2,
    thickness: 0.01,
    opacity: 1,
    side: THREE.DoubleSide,
  })
}

type OpeningPivot = {
  object: THREE.Object3D
  rotation: (openingDegrees: number) => number
}

function addRestingVolume({
  parent,
  side,
  sheetCount,
  width,
  height,
  depthPerSheet,
  model,
  openingPivots,
  rotation,
}: {
  parent: THREE.Group
  side: -1 | 1
  sheetCount: number
  width: number
  height: number
  depthPerSheet: number
  model: PhysicalPreviewModel
  openingPivots: OpeningPivot[]
  rotation: (openingDegrees: number) => number
}) {
  if (sheetCount === 0) return
  const pivot = new THREE.Group()
  pivot.rotation.y = rotation(model.openingDegrees)
  openingPivots.push({ object: pivot, rotation })
  const depth = sheetCount * depthPerSheet
  const volume = new THREE.Mesh(
    createProfiledVolumeGeometry(width, height, depth, model.materialPreset.profile),
    createPaperMaterial(model),
  )
  volume.name = `${sheetCount} resting ${sheetCount === 1 ? "sheet" : "sheets"}`
  volume.position.set(
    side * width * 0.5,
    0,
    -(depth / 2 + model.materialPreset.profile * depth * 0.4 + RESTING_VOLUME_EPSILON),
  )
  volume.castShadow = false
  volume.receiveShadow = true
  pivot.add(volume)
  parent.add(pivot)
}

type PageArtLayer = {
  surface: PageSurface
  renderSide: THREE.Side
  flipX?: boolean
}

function createActivePageMesh(
  width: number,
  height: number,
  model: PhysicalPreviewModel,
  side: -1 | 1,
  layers: PageArtLayer[],
  atlas: TextRunAtlas,
  includeText: boolean,
  paperColor: string,
  face: -1 | 1 = 1,
) {
  const geometry = new THREE.PlaneGeometry(width, height, 32, 2)
  const positions = geometry.getAttribute("position")
  const curveDepth =
    (1 - model.materialPreset.stiffness) * (1 - model.materialPreset.creaseSet * 0.5) * 0.045
  for (let index = 0; index < positions.count; index += 1) {
    const distanceFromSpine = (positions.getX(index) + width / 2) / width
    positions.setZ(index, Math.sin(distanceFromSpine * Math.PI) * curveDepth * face)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()

  const page = new THREE.Mesh(geometry, createPaperMaterial(model, true, paperColor))
  page.name = side === -1 ? "Active Folded Sheet left surface" : "Active Folded Sheet right surface"
  page.position.x = side * width * 0.5
  page.castShadow = false
  page.receiveShadow = true
  page.renderOrder = 1
  // ponytail: foreground the selected sheet until camera orbit can resolve stack occlusion.
  page.material.depthTest = false
  page.material.depthWrite = false

  const millimetersToWorld = height / layers[0].surface.metrics.pageSize.height
  for (const layer of layers) {
    const flipX =
      layer.flipX ??
      (side === 1
        ? layer.surface.metrics.bindingEdge === "right"
        : layer.surface.metrics.bindingEdge === "left")
    page.add(
      createPageArtGroup({
        surface: layer.surface,
        geometry,
        millimetersToWorld,
        flipX,
        renderSide: layer.renderSide,
        atlas,
        includeText,
      }),
    )
  }
  return page
}

type ActivePageSurfaces = {
  selected: PageSurface
  facing: PageSurface
  left: PageSurface
  right: PageSurface
  visible: PageSurface[]
  artwork: PageSurface[]
  byPage: Map<number, PageSurface>
}

function getPageDimensions(model: PhysicalPreviewModel) {
  const { width, height } = model.pageSize
  return {
    width: PAGE_HEIGHT * (width / height),
    millimetersToWorld: PAGE_HEIGHT / height,
  }
}

function foldedLeafRotation(
  side: FoldedPreviewLeaf["stackSide"],
  pose: NonNullable<PhysicalPreviewModel["readerPose"]>["kind"],
  openingDegrees: number,
) {
  if (pose === "front") return 0
  if (pose === "back") return -Math.PI
  const halfClosedAngle = THREE.MathUtils.degToRad(180 - openingDegrees) / 2
  return side === "left" ? -Math.PI + halfClosedAngle : -halfClosedAngle
}

function createFoldedLeafBody(
  leaf: FoldedPreviewLeaf,
  dimensions: { width: number; depth: number; signatureGap: number },
  model: PhysicalPreviewModel,
  surfaces: ActivePageSurfaces,
  atlas: TextRunAtlas,
  includeText: boolean,
  paperColor: string,
) {
  const { width, depth, signatureGap } = dimensions
  const face = leaf.stackSide === "left" ? -1 : 1
  const body = new THREE.Group()
  body.position.z = -face * (leaf.stackIndex * depth + leaf.signatureOffset * signatureGap)
  const volume = new THREE.Mesh(
    createProfiledVolumeGeometry(width, PAGE_HEIGHT, depth, model.materialPreset.profile),
    createPaperMaterial(model),
  )
  volume.name = "Leaf paper volume"
  volume.position.set(
    width / 2,
    0,
    -face * (depth / 2 + model.materialPreset.profile * depth * 0.4 + RESTING_VOLUME_EPSILON),
  )
  volume.scale.z = face
  volume.receiveShadow = true
  body.add(volume)

  // The adjacent leaf supplies the page uncovered during a turn. Its paper
  // stays in the stack; only artwork exposure changes as the turning leaf lands.
  if (leaf.stackIndex > 1) return body
  const front = surfaces.byPage.get(leaf.pages[0])
  const back = surfaces.byPage.get(leaf.pages[1])
  if (!front || !back) throw new RangeError(`Leaf ${leaf.pages[0]} has incomplete artwork`)
  const page = createActivePageMesh(
    width,
    PAGE_HEIGHT,
    model,
    1,
    [
      { surface: front, renderSide: THREE.FrontSide, flipX: false },
      { surface: back, renderSide: THREE.BackSide, flipX: true },
    ],
    atlas,
    includeText,
    paperColor,
    face,
  )
  page.name = `Leaf ${leaf.pages.join("–")} page surfaces`
  page.visible = leaf.stackIndex === 0
  body.add(page)
  return body
}

function createPageBlock(
  model: PhysicalPreviewModel,
  pageBlock: THREE.Group,
  openingPivots: OpeningPivot[],
  surfaces: ActivePageSurfaces,
  atlas: TextRunAtlas,
  includeText: boolean,
  paperColor: string,
) {
  const readerPose = model.readerPose
  if (!readerPose) return

  const { width, millimetersToWorld } = getPageDimensions(model)
  const leafDimensions = {
    width,
    depth: model.materialPreset.thickness * millimetersToWorld,
    signatureGap: model.materialPreset.signatureGap * millimetersToWorld,
  }
  const activePose = new THREE.Group()
  activePose.name = `Active Reader Pose ${readerPose.pages.join("–")}`
  activePose.userData.readerPose = readerPose
  activePose.position.x =
    readerPose.kind === "front" ? -width / 2 : readerPose.kind === "back" ? width / 2 : 0
  pageBlock.add(activePose)

  const signatures = new THREE.Group()
  signatures.name = "Signatures"
  activePose.add(signatures)
  const signatureGroups = new Map<number, THREE.Group>()
  const sheetByPage = new Map<number, THREE.Group>()
  for (const unit of model.units) {
    let signature = signatureGroups.get(unit.signature)
    if (!signature) {
      signature = new THREE.Group()
      signature.name = `Signature ${unit.signature}`
      signature.userData.signature = unit.signature
      signatures.add(signature)
      signatureGroups.set(unit.signature, signature)
    }
    const sheet = new THREE.Group()
    sheet.name = `Folded Sheet ${unit.sheet}`
    sheet.userData.unit = unit
    signature.add(sheet)
    for (const surface of unit.surfaces) sheetByPage.set(surface.logicalPage, sheet)
  }

  for (const leaf of model.foldedLeaves) {
    const pivot = new THREE.Group()
    pivot.name = `Leaf ${leaf.pages.join("–")}`
    pivot.userData = { ...leaf, foldedLeaf: leaf }
    const rotation = (openingDegrees: number) =>
      foldedLeafRotation(leaf.stackSide, readerPose.kind, openingDegrees)
    pivot.rotation.y = rotation(model.openingDegrees)
    openingPivots.push({ object: pivot, rotation })
    const sheet = sheetByPage.get(leaf.pages[0])
    if (!sheet) throw new RangeError(`Leaf ${leaf.pages[0]} has no imposed sheet`)
    sheet.add(pivot)

    pivot.add(
      createFoldedLeafBody(leaf, leafDimensions, model, surfaces, atlas, includeText, paperColor),
    )
  }
}

function createLeafStack(
  model: PhysicalPreviewModel,
  pageBlock: THREE.Group,
  openingPivots: OpeningPivot[],
  surfaces: ActivePageSurfaces,
  atlas: TextRunAtlas,
  includeText: boolean,
  paperColor: string,
) {
  const { width, millimetersToWorld } = getPageDimensions(model)
  const direction = model.bindingEdge === "left" ? 1 : -1
  const fan = (openingDegrees: number) => THREE.MathUtils.degToRad(openingDegrees)
  const depthPerLeaf = model.materialPreset.thickness * millimetersToWorld
  const { left, right } = model.restingCounts

  addRestingVolume({
    parent: pageBlock,
    side: direction,
    sheetCount: left,
    width,
    height: PAGE_HEIGHT,
    depthPerSheet: depthPerLeaf,
    model,
    openingPivots,
    rotation: (openingDegrees) => -direction * fan(openingDegrees) * 0.5,
  })
  addRestingVolume({
    parent: pageBlock,
    side: direction,
    sheetCount: right,
    width,
    height: PAGE_HEIGHT,
    depthPerSheet: depthPerLeaf,
    model,
    openingPivots,
    rotation: (openingDegrees) => direction * fan(openingDegrees) * 0.5,
  })

  const activeLeaf = new THREE.Group()
  activeLeaf.name = `Active Leaf ${model.activeUnitIndex + 1}`
  activeLeaf.userData.selectedSurface = model.selectedSurface
  const activeLeafRotation = (openingDegrees: number) =>
    direction *
    fan(openingDegrees) *
    (model.activeUnitIndex / Math.max(1, model.units.length - 1) - 0.5)
  activeLeaf.rotation.y = activeLeafRotation(model.openingDegrees)
  openingPivots.push({ object: activeLeaf, rotation: activeLeafRotation })
  const [front, back] =
    model.selectedSurface.side === "front"
      ? [surfaces.selected, surfaces.facing]
      : [surfaces.facing, surfaces.selected]
  activeLeaf.add(
    createActivePageMesh(
      width,
      PAGE_HEIGHT,
      model,
      direction,
      [
        { surface: front, renderSide: THREE.FrontSide },
        { surface: back, renderSide: THREE.BackSide },
      ],
      atlas,
      includeText,
      paperColor,
    ),
  )
  pageBlock.add(activeLeaf)
}

function replacePageBlock(
  pageBlock: THREE.Group,
  model: PhysicalPreviewModel,
  openingPivots: OpeningPivot[],
  surfaces: ActivePageSurfaces,
  atlas: TextRunAtlas,
  includeText: boolean,
  paperColor: string,
) {
  disposePageBlock(pageBlock)
  openingPivots.length = 0
  atlas.prepare(includeText ? surfaces.artwork : [])
  if (model.construction === "page-block") {
    createPageBlock(model, pageBlock, openingPivots, surfaces, atlas, includeText, paperColor)
  } else {
    createLeafStack(model, pageBlock, openingPivots, surfaces, atlas, includeText, paperColor)
  }
}

function pageFromKey(
  key: string,
  model: PhysicalPreviewModel,
  currentPage: number,
  totalPages: number,
) {
  switch (key) {
    case "ArrowLeft":
      return model.readerPose ? stepReaderPose(currentPage, totalPages, -1) : currentPage - 1
    case "ArrowRight":
      return model.readerPose ? stepReaderPose(currentPage, totalPages, 1) : currentPage + 1
    case "Home":
      return 1
    case "End":
      return totalPages
    default:
      return undefined
  }
}

function resolvePendingTurn({
  model,
  previousReaderPoseAnchor,
  currentPage,
  previousPage,
  wasTurning,
}: {
  model: PhysicalPreviewModel
  previousReaderPoseAnchor: number | undefined
  currentPage: number
  previousPage: number
  wasTurning: boolean
}): -1 | 1 | undefined {
  if (wasTurning) return undefined
  const readerPoseDistance =
    model.readerPose && previousReaderPoseAnchor !== undefined
      ? model.readerPose.anchor - previousReaderPoseAnchor
      : currentPage - previousPage
  if (readerPoseDistance === 0) return undefined
  if (Math.abs(readerPoseDistance) > (model.readerPose ? 2 : 1)) return undefined
  return readerPoseDistance > 0 ? 1 : -1
}

function resolveRefitRange(
  model: PhysicalPreviewModel,
  binding: Binding,
  materialPreset: MaterialPresetId,
): readonly [number, number] {
  if (model.readerPose?.kind === "spread" || !model.readerPose) {
    return [
      resolveOpeningDegrees(binding, materialPreset, 0),
      resolveOpeningDegrees(binding, materialPreset, 100),
    ]
  }
  return [0, 0]
}

type PageTurn = {
  direction: -1 | 1
  from: PhysicalPreviewModel
  to: PhysicalPreviewModel
  openingDegrees: number
}

function resolveFoldedPageTurn(turn: PageTurn) {
  const fromPose = turn.from.readerPose
  const toPose = turn.to.readerPose
  if (!fromPose || !toPose) return
  const destinationSide = turn.direction === 1 ? "left" : "right"
  const movingLeaf = turn.to.foldedLeaves.find(
    (leaf) => leaf.stackSide === destinationSide && leaf.stackIndex === 0,
  )
  const previousLeaf = turn.from.foldedLeaves.find((leaf) => leaf.pages[0] === movingLeaf?.pages[0])
  if (!movingLeaf || !previousLeaf || movingLeaf.stackSide === previousLeaf.stackSide) return
  return {
    movingLeaf,
    destinationSide,
    startRotation: foldedLeafRotation(
      previousLeaf.stackSide,
      toPose.kind === "spread" ? "spread" : fromPose.kind,
      turn.openingDegrees,
    ),
  }
}

function preparePageTurn(pageBlock: THREE.Group, turn: PageTurn) {
  let pivot: THREE.Object3D | undefined
  let revealedPage: THREE.Object3D | undefined
  let startRotation: number
  if (turn.to.readerPose && turn.from.readerPose) {
    const foldedTurn = resolveFoldedPageTurn(turn)
    if (!foldedTurn) return
    const { movingLeaf, destinationSide } = foldedTurn
    pageBlock.traverse((object) => {
      const leaf: FoldedPreviewLeaf | undefined = object.userData.foldedLeaf
      if (leaf?.pages[0] === movingLeaf.pages[0]) pivot = object
      if (leaf?.stackSide === destinationSide && leaf.stackIndex === 1) {
        revealedPage = object.getObjectByName(`${object.name} page surfaces`)
      }
    })
    startRotation = foldedTurn.startRotation
  } else {
    pivot = pageBlock.children.find((child) => child.name.startsWith("Active Leaf "))
    if (!pivot) return
    startRotation = pivot.rotation.y - turn.direction * Math.PI * 0.5
  }
  if (!pivot) return
  const object = pivot
  const endRotation = object.rotation.y
  // The moving leaf is composited after the resting Page Block, keeping existing
  // transmissive-paper and depth-free artwork policies without stack bleed-through.
  object.traverse((part) => part.layers.set(1))
  if (revealedPage) revealedPage.visible = true
  return {
    object,
    startRotation,
    endRotation,
    finish: () => {
      object.rotation.y = endRotation
      if (revealedPage) revealedPage.visible = false
      object.traverse((part) => part.layers.set(0))
    },
  }
}

function resolveRebuiltPageTurn({
  model,
  previousModel,
  currentPage,
  pendingTurn,
  animateTurns,
  wasTurning,
  openingDegrees,
}: {
  model: PhysicalPreviewModel
  previousModel: PhysicalPreviewModel
  currentPage: number
  pendingTurn: PageTurn | undefined
  animateTurns: boolean
  wasTurning: boolean
  openingDegrees: number
}): PageTurn | undefined {
  if (!animateTurns) return
  const previousPage = previousModel.selectedSurface.logicalPage
  if (currentPage === previousPage) return model === previousModel ? pendingTurn : undefined
  const direction = resolvePendingTurn({
    model,
    previousReaderPoseAnchor: previousModel.readerPose?.anchor,
    currentPage,
    previousPage,
    wasTurning,
  })
  if (!direction) return
  return { direction, from: previousModel, to: model, openingDegrees }
}

type RendererState = {
  pageBlock: THREE.Group
  openingPivots: OpeningPivot[]
  textAtlas: TextRunAtlas
  updateOpening: (openingDegrees: number) => void
  refit: (openingRange?: readonly [number, number], resetView?: boolean) => void
  rotateCamera: (angle: number) => void
  zoomCamera: (inward: boolean) => void
  resetCamera: () => void
  cancelTurn: () => boolean
  animateTurn: (turn: PageTurn) => void
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  )
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reducedMotion
}

function collectLeafArtworkPages(
  logicalPages: readonly number[],
  leaves: readonly FoldedPreviewLeaf[],
) {
  const artworkPages = new Set(logicalPages)
  for (const leaf of leaves) {
    if (leaf.stackIndex <= 1) {
      for (const page of leaf.pages) artworkPages.add(page)
    }
  }
  return artworkPages
}

function useActivePageSurfaces(
  settings: Settings,
  model: PhysicalPreviewModel,
  punchHoleSets: Settings["punchHoleSets"],
  punchHolePages: Set<number>,
) {
  return useMemo<ActivePageSurfaces>(() => {
    const logicalPages = model.readerPose?.pages ?? [
      model.selectedSurface.logicalPage,
      model.selectedSurface.facingLogicalPage,
    ]
    const artworkPages = collectLeafArtworkPages(logicalPages, model.foldedLeaves)
    const byPage = new Map<number, PageSurface>()
    const visible: PageSurface[] = []
    for (const logicalPage of artworkPages) {
      const surface = createPageSurface(
        settings,
        logicalPage,
        punchHoleSets,
        punchHolePages.has(logicalPage),
      )
      byPage.set(logicalPage, surface)
      if (logicalPages.includes(logicalPage)) visible.push(surface)
    }
    const selected = visible[0]
    const facing = visible[1] ?? selected
    const [left, right] = model.readerPose
      ? [selected, facing]
      : selected.metrics.bindingEdge === "right"
        ? [selected, facing]
        : [facing, selected]
    return { selected, facing, left, right, visible, artwork: [...byPage.values()], byPage }
  }, [model, punchHolePages, punchHoleSets, settings])
}

function useSurfaceTextReady(activeSurfaces: ActivePageSurfaces) {
  const surfaceKey = useMemo(() => JSON.stringify(activeSurfaces), [activeSurfaces])
  const [readySurfaceKey, setReadySurfaceKey] = useState("")
  useEffect(() => {
    let cancelled = false
    setReadySurfaceKey("")
    const fonts = globalThis.document.fonts
    const requests = getSurfaceFontRequests(activeSurfaces.artwork)
    void fonts.ready
      .then(() =>
        Promise.all([...requests].map(([font, text]) => fonts.load(font, [...text].join("")))),
      )
      .catch(() => undefined)
      .then(() => {
        if (!cancelled) setReadySurfaceKey(surfaceKey)
      })
    return () => {
      cancelled = true
    }
  }, [activeSurfaces, surfaceKey])
  return readySurfaceKey === surfaceKey
}

function usePhysicalPreviewModel(
  settings: Settings,
  document: ReturnType<typeof createNotebookDocument>,
  currentPage: number,
  materialPreset: MaterialPresetId,
  opening: number,
  rendererStateRef: RefObject<RendererState | null>,
) {
  const reducedMotion = usePrefersReducedMotion()
  const [animateTurns, setAnimateTurns] = useState(() => !reducedMotion)
  const [status, setStatus] = useState<"ready" | "unsupported" | "context-lost">("ready")
  const model = useMemo(
    () =>
      createPhysicalPreviewModel({
        binding: settings.binding,
        bindingEdge: settings.bindingEdge,
        sides: document.sides,
        totalPages: document.totalPages,
        pageSize: document.pageSize,
        logicalPage: currentPage,
        materialPreset,
        opening: 0,
      }),
    [
      currentPage,
      document.pageSize,
      document.sides,
      document.totalPages,
      materialPreset,
      settings.binding,
      settings.bindingEdge,
    ],
  )
  useEffect(() => {
    if (reducedMotion) setAnimateTurns(false)
  }, [reducedMotion])
  const activeSurfaces = useActivePageSurfaces(
    settings,
    model,
    document.punchHoleSets,
    document.punchHolePages,
  )
  const includeText = useSurfaceTextReady(activeSurfaces)
  const openingDegrees = resolveOpeningDegrees(settings.binding, materialPreset, opening)
  const effectiveOpeningDegrees = model.readerPose?.kind === "spread" ? openingDegrees : 0
  useEffect(() => {
    const rendererState = rendererStateRef.current
    if (!rendererState) return
    rendererState.updateOpening(effectiveOpeningDegrees)
  }, [effectiveOpeningDegrees, rendererStateRef])
  return {
    model,
    status,
    setStatus,
    animateTurns,
    setAnimateTurns,
    activeSurfaces,
    includeText,
    effectiveOpeningDegrees,
    turnOpeningDegrees: openingDegrees,
  }
}

function PreviewControls({
  rendererStateRef,
  materialPreset,
  opening,
  animateTurns,
  onMaterialPresetChange,
  onOpeningChange,
  onAnimateTurnsChange,
}: {
  rendererStateRef: RefObject<RendererState | null>
  materialPreset: MaterialPresetId
  opening: number
  animateTurns: boolean
  onMaterialPresetChange: (preset: MaterialPresetId) => void
  onOpeningChange: (opening: number) => void
  onAnimateTurnsChange: (animated: boolean) => void
}) {
  return (
    <div className="absolute right-4 bottom-4 z-10 flex flex-wrap items-end justify-end gap-3 rounded-md border border-white/20 bg-primary/80 p-3 text-primary-foreground shadow-lg backdrop-blur-sm">
      <fieldset className="flex gap-1" aria-label="Camera controls">
        <Button
          variant="outline"
          size="icon-sm"
          className="border-white/20 bg-primary"
          aria-label="Rotate camera left"
          onClick={() => rendererStateRef.current?.rotateCamera(CAMERA_ROTATION_STEP)}
        >
          <RotateCcw />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="border-white/20 bg-primary"
          aria-label="Rotate camera right"
          onClick={() => rendererStateRef.current?.rotateCamera(-CAMERA_ROTATION_STEP)}
        >
          <RotateCw />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="border-white/20 bg-primary"
          aria-label="Zoom out"
          onClick={() => rendererStateRef.current?.zoomCamera(false)}
        >
          <Minus />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="border-white/20 bg-primary"
          aria-label="Zoom in"
          onClick={() => rendererStateRef.current?.zoomCamera(true)}
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="border-white/20 bg-primary"
          aria-label="Reset camera"
          onClick={() => rendererStateRef.current?.resetCamera()}
        >
          <RotateCcw />
        </Button>
      </fieldset>
      <fieldset className="flex items-end gap-3" aria-label="Physical preview controls">
        <div className="grid gap-1 text-caption font-semibold">
          <span>Material</span>
          <SelectControl
            value={materialPreset}
            onChange={(preset) => onMaterialPresetChange(preset as MaterialPresetId)}
            options={materialPresetOptions}
            ariaLabel="Material Preset"
            className="h-8 w-32 border-white/20 bg-primary text-xs"
          />
        </div>
        <label className="grid gap-1 text-caption font-semibold">
          Opening {Math.round(opening)}%
          <input
            type="range"
            min="0"
            max="100"
            value={opening}
            className="h-8 w-28 accent-ring"
            aria-label="Opening"
            onChange={(event) => onOpeningChange(event.currentTarget.valueAsNumber)}
          />
        </label>
        <label className="flex items-center gap-1 text-caption font-semibold">
          <input
            type="checkbox"
            checked={animateTurns}
            className="accent-ring"
            onChange={(event) => onAnimateTurnsChange(event.currentTarget.checked)}
          />
          Animate turns
        </label>
      </fieldset>
    </div>
  )
}

function PreviewStatusMessage({ status }: { status: "unsupported" | "context-lost" }) {
  return (
    <p
      className="relative z-10 m-auto max-w-56 text-center text-caption text-primary-foreground/75"
      role="status"
    >
      {status === "unsupported"
        ? "Physical Design Preview requires WebGL 2. Use the 2D preview instead."
        : "Physical Design Preview lost its graphics context. Switch to 2D preview and try again."}
    </p>
  )
}

export function PhysicalDesignPreview({
  settings,
  document,
  currentPage,
  materialPreset,
  opening,
  onCurrentPageChange,
  onMaterialPresetChange,
  onOpeningChange,
}: {
  settings: Settings
  document: ReturnType<typeof createNotebookDocument>
  currentPage: number
  materialPreset: MaterialPresetId
  opening: number
  onCurrentPageChange: (page: number) => void
  onMaterialPresetChange: (preset: MaterialPresetId) => void
  onOpeningChange: (opening: number) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const rendererStateRef = useRef<RendererState>(null)
  const pendingTurnRef = useRef<PageTurn | undefined>(undefined)
  const {
    model,
    status,
    setStatus,
    animateTurns,
    setAnimateTurns,
    activeSurfaces,
    includeText,
    effectiveOpeningDegrees,
    turnOpeningDegrees,
  } = usePhysicalPreviewModel(
    settings,
    document,
    currentPage,
    materialPreset,
    opening,
    rendererStateRef,
  )
  const previousModelRef = useRef(model)
  const openingDegreesRef = useRef(effectiveOpeningDegrees)
  openingDegreesRef.current = effectiveOpeningDegrees
  const turnOpeningDegreesRef = useRef(turnOpeningDegrees)
  turnOpeningDegreesRef.current = turnOpeningDegrees

  function handlePreviewKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!(event.target instanceof HTMLCanvasElement)) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const page = pageFromKey(event.key, model, currentPage, document.totalPages)
    if (page === undefined) return
    event.preventDefault()
    onCurrentPageChange(Math.min(document.totalPages, Math.max(1, page)))
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (!WebGL.isWebGL2Available()) {
      setStatus("unsupported")
      return
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.domElement.className = "absolute inset-0 h-full w-full"
    renderer.domElement.tabIndex = 0
    renderer.domElement.setAttribute("aria-label", "Physical Design Preview")
    renderer.domElement.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight Home End")
    renderer.outputColorSpace = THREE.SRGBColorSpace
    viewport.append(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#25231f")
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0.15, 6.4)
    camera.lookAt(0, 0, 0)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minAzimuthAngle = -Math.PI / 4
    controls.maxAzimuthAngle = Math.PI / 4
    controls.minPolarAngle = Math.PI / 6
    controls.maxPolarAngle = Math.PI / 2 + 0.15
    const pageBlock = new THREE.Group()
    pageBlock.name = "Page Block"
    scene.add(pageBlock)
    const fillLight = new THREE.HemisphereLight("#fff7e7", "#3b2e25", 2.2)
    fillLight.layers.enable(1)
    scene.add(fillLight)
    const keyLight = new THREE.DirectionalLight("#ffe8c3", 3)
    keyLight.position.set(0, 5, 6)
    keyLight.layers.enable(1)
    scene.add(keyLight)

    let frame = 0
    let turnFrame = 0
    let finishTurn: (() => void) | undefined
    const renderScene = () => {
      renderer.render(scene, camera)
      if (!finishTurn) return
      const background = scene.background
      const autoClear = renderer.autoClear
      const cameraLayers = camera.layers.mask
      scene.background = null
      renderer.autoClear = false
      camera.layers.set(1)
      try {
        renderer.render(scene, camera)
      } finally {
        camera.layers.mask = cameraLayers
        renderer.autoClear = autoClear
        scene.background = background
      }
    }
    const invalidate = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        renderScene()
      })
    }
    controls.addEventListener("change", invalidate)
    const openingPivots: OpeningPivot[] = []
    const textAtlas = new TextRunAtlas()
    let fitOpeningRange: readonly [number, number] | undefined
    let hasCameraFit = false
    const defaultCameraPosition = new THREE.Vector3()
    const defaultCameraTarget = new THREE.Vector3()
    const resetCamera = () => {
      camera.position.copy(defaultCameraPosition)
      controls.target.copy(defaultCameraTarget)
      controls.update()
      invalidate()
    }
    const rotateCamera = (angle: number) => {
      controls.rotateLeft(angle)
      controls.update()
    }
    const zoomCamera = (inward: boolean) => {
      if (inward) controls.dollyIn(CAMERA_ZOOM_FACTOR)
      else controls.dollyOut(CAMERA_ZOOM_FACTOR)
      controls.update()
    }
    const cancelTurn = () => {
      if (!finishTurn) return false
      cancelAnimationFrame(turnFrame)
      turnFrame = 0
      finishTurn()
      finishTurn = undefined
      invalidate()
      return true
    }
    const animateTurn = (turn: PageTurn) => {
      cancelTurn()
      const prepared = preparePageTurn(pageBlock, turn)
      if (!prepared) return
      finishTurn = prepared.finish
      const start = performance.now()
      prepared.object.rotation.y = prepared.startRotation
      const renderTurn = (time: number) => {
        const progress = THREE.MathUtils.clamp((time - start) / TURN_DURATION, 0, 1)
        prepared.object.rotation.y =
          prepared.endRotation +
          (prepared.startRotation - prepared.endRotation) * (1 - progress) ** 3
        if (progress < 1) turnFrame = requestAnimationFrame(renderTurn)
        else cancelTurn()
        renderScene()
      }
      turnFrame = requestAnimationFrame(renderTurn)
    }
    const applyOpening = (degrees: number) => {
      for (const pivot of openingPivots) pivot.object.rotation.y = pivot.rotation(degrees)
    }
    const refit = (openingRange?: readonly [number, number], resetView = false) => {
      if (openingRange) fitOpeningRange = openingRange
      if (!fitOpeningRange || !camera.aspect) return

      const bounds = new THREE.Box3()
      for (const endpoint of fitOpeningRange) {
        applyOpening(endpoint)
        pageBlock.updateWorldMatrix(true, true)
        bounds.union(new THREE.Box3().setFromObject(pageBlock))
      }
      applyOpening(openingDegreesRef.current)
      if (bounds.isEmpty()) return

      bounds.getCenter(defaultCameraTarget)
      defaultCameraTarget.y = 0
      const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const verticalExtent = Math.max(
        Math.abs(bounds.min.y - defaultCameraTarget.y),
        Math.abs(bounds.max.y - defaultCameraTarget.y),
      )
      const horizontalExtent = Math.max(
        Math.abs(bounds.min.x - defaultCameraTarget.x),
        Math.abs(bounds.max.x - defaultCameraTarget.x),
      )
      const perspectiveDistance = Math.max(
        verticalExtent / verticalTangent,
        horizontalExtent / (verticalTangent * camera.aspect),
      )
      defaultCameraPosition.set(
        defaultCameraTarget.x + perspectiveDistance * 0.35,
        defaultCameraTarget.y + perspectiveDistance * 0.15,
        bounds.max.z + perspectiveDistance * CAMERA_FIT_MARGIN,
      )
      const shouldResetView = resetView || !hasCameraFit
      const defaultDistance = defaultCameraPosition.distanceTo(defaultCameraTarget)
      const currentDistance = shouldResetView
        ? defaultDistance
        : camera.position.distanceTo(controls.target)
      controls.minDistance = Math.min(defaultDistance * 0.7, currentDistance)
      controls.maxDistance = Math.max(defaultDistance * 1.5, currentDistance)
      camera.updateProjectionMatrix()
      if (shouldResetView) {
        hasCameraFit = true
        resetCamera()
      }
    }
    const updateOpening = (degrees: number) => {
      cancelTurn()
      applyOpening(degrees)
      invalidate()
    }
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect()
      if (!width || !height) return
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      refit(undefined, true)
      invalidate()
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      setStatus("context-lost")
    }
    const onContextRestored = () => {
      setStatus("ready")
      resize()
    }
    const resizeObserver = new ResizeObserver(resize)

    rendererStateRef.current = {
      pageBlock,
      openingPivots,
      textAtlas,
      updateOpening,
      refit,
      rotateCamera,
      zoomCamera,
      resetCamera,
      cancelTurn,
      animateTurn,
    }
    renderer.domElement.addEventListener("webglcontextlost", onContextLost)
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored)
    resizeObserver.observe(viewport)
    resize()

    return () => {
      rendererStateRef.current = null
      cancelTurn()
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      controls.removeEventListener("change", invalidate)
      controls.dispose()
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost)
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored)
      disposePageBlock(pageBlock)
      textAtlas.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [setStatus])

  useEffect(() => {
    const rendererState = rendererStateRef.current
    if (!rendererState) return
    const previousModel = previousModelRef.current
    const previousPage = previousModel.selectedSurface.logicalPage
    pendingTurnRef.current = resolveRebuiltPageTurn({
      model,
      previousModel,
      currentPage,
      pendingTurn: pendingTurnRef.current,
      animateTurns,
      wasTurning: rendererState.cancelTurn(),
      openingDegrees: turnOpeningDegreesRef.current,
    })
    replacePageBlock(
      rendererState.pageBlock,
      model,
      rendererState.openingPivots,
      activeSurfaces,
      rendererState.textAtlas,
      includeText,
      settings.previewPaperColor,
    )
    rendererState.updateOpening(openingDegreesRef.current)
    rendererState.refit(
      resolveRefitRange(model, settings.binding, materialPreset),
      model !== previousModel && currentPage === previousPage,
    )
    const pendingTurn = pendingTurnRef.current
    if (animateTurns && includeText && pendingTurn) {
      rendererState.animateTurn(pendingTurn)
      pendingTurnRef.current = undefined
    }
    previousModelRef.current = model
  }, [
    activeSurfaces,
    animateTurns,
    currentPage,
    includeText,
    materialPreset,
    model,
    settings.binding,
    settings.previewPaperColor,
  ])

  return (
    <section
      ref={viewportRef}
      aria-label={`Physical Design Preview, logical page ${currentPage}, ${model.construction === "page-block" ? "Page Block" : "Leaf Stack"}`}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-primary"
      onKeyDown={handlePreviewKeyDown}
    >
      {status === "ready" ? (
        <PreviewControls
          rendererStateRef={rendererStateRef}
          materialPreset={materialPreset}
          opening={opening}
          animateTurns={animateTurns}
          onMaterialPresetChange={onMaterialPresetChange}
          onOpeningChange={onOpeningChange}
          onAnimateTurnsChange={setAnimateTurns}
        />
      ) : (
        <PreviewStatusMessage status={status} />
      )}
      <p className="sr-only" aria-live="polite">
        Physical preview page {currentPage} of {document.totalPages}
      </p>
    </section>
  )
}
