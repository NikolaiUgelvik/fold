import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import WebGL from "three/addons/capabilities/WebGL.js"

import { SelectControl } from "@/components/form-controls"
import type { createNotebookDocument } from "@/lib/notebook-document"
import {
  createPhysicalPreviewModel,
  type MaterialPresetId,
  materialPresets,
  type PhysicalPreviewModel,
  resolveOpeningDegrees,
} from "@/lib/physical-preview"
import type { Settings } from "@/lib/settings"

const PAGE_HEIGHT = 3
const RESTING_VOLUME_EPSILON = 0.0001
const CAMERA_FIT_MARGIN = 1.08

const materialPresetOptions = Object.fromEntries(
  Object.entries(materialPresets).map(([id, preset]) => [id, preset.label]),
)

function disposePageBlock(pageBlock: THREE.Group) {
  pageBlock.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) material.dispose()
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

function createPaperMaterial(model: PhysicalPreviewModel, active = false) {
  const { materialPreset } = model
  return new THREE.MeshPhysicalMaterial({
    color: active ? "#fffef9" : "#e9e3d5",
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

function createActivePageMesh(
  width: number,
  height: number,
  model: PhysicalPreviewModel,
  side: -1 | 1,
) {
  const geometry = new THREE.PlaneGeometry(width, height, 32, 2)
  const positions = geometry.getAttribute("position")
  const curveDepth =
    (1 - model.materialPreset.stiffness) * (1 - model.materialPreset.creaseSet * 0.5) * 0.045
  for (let index = 0; index < positions.count; index += 1) {
    const distanceFromSpine = (positions.getX(index) + width / 2) / width
    positions.setZ(index, Math.sin(distanceFromSpine * Math.PI) * curveDepth)
  }
  positions.needsUpdate = true
  geometry.computeVertexNormals()

  const page = new THREE.Mesh(geometry, createPaperMaterial(model, true))
  page.name = side === -1 ? "Active Folded Sheet left surface" : "Active Folded Sheet right surface"
  page.position.x = side * width * 0.5
  page.castShadow = false
  page.receiveShadow = true
  page.renderOrder = 1
  // ponytail: foreground the selected sheet until camera orbit can resolve stack occlusion.
  page.material.depthTest = false
  page.material.depthWrite = false
  return page
}

function createPageBlock(
  model: PhysicalPreviewModel,
  pageBlock: THREE.Group,
  openingPivots: OpeningPivot[],
) {
  const { width: pageWidthMillimeters, height: pageHeightMillimeters } = model.pageSize
  const width = PAGE_HEIGHT * (pageWidthMillimeters / pageHeightMillimeters)
  const millimetersToWorld = PAGE_HEIGHT / pageHeightMillimeters
  const sheetDepth = model.materialPreset.thickness * millimetersToWorld
  const signatureGap = model.materialPreset.signatureGap * millimetersToWorld
  const leftRotation = (openingDegrees: number) =>
    THREE.MathUtils.degToRad(180 - openingDegrees) / 2
  const rightRotation = (openingDegrees: number) => -leftRotation(openingDegrees)
  const signatures = [...new Set(model.units.map((unit) => unit.signature))]
  const activeSignature = model.units[model.activeUnitIndex].signature

  for (const [signatureIndex, signature] of signatures.entries()) {
    const firstUnit = model.units.findIndex((unit) => unit.signature === signature)
    const unitCount = model.units.filter((unit) => unit.signature === signature).length
    const lastUnit = firstUnit + unitCount
    const leftCount = Math.min(unitCount, Math.max(0, model.activeUnitIndex - firstUnit))
    const rightCount = Math.min(unitCount, Math.max(0, lastUnit - model.activeUnitIndex - 1))
    const signatureGroup = new THREE.Group()
    signatureGroup.name = `Signature ${signature}`
    signatureGroup.position.z = (signatureIndex - (signatures.length - 1) / 2) * signatureGap
    pageBlock.add(signatureGroup)

    addRestingVolume({
      parent: signatureGroup,
      side: -1,
      sheetCount: leftCount,
      width,
      height: PAGE_HEIGHT,
      depthPerSheet: sheetDepth,
      model,
      openingPivots,
      rotation: leftRotation,
    })
    addRestingVolume({
      parent: signatureGroup,
      side: 1,
      sheetCount: rightCount,
      width,
      height: PAGE_HEIGHT,
      depthPerSheet: sheetDepth,
      model,
      openingPivots,
      rotation: rightRotation,
    })

    if (signature === activeSignature) {
      const activeSheet = new THREE.Group()
      activeSheet.name = `Active Folded Sheet ${model.selectedSurface.sheet}`
      activeSheet.position.z = signatureGroup.position.z
      activeSheet.userData.selectedSurface = model.selectedSurface
      activeSheet.rotation.y = 0
      const leftPivot = new THREE.Group()
      leftPivot.rotation.y = leftRotation(model.openingDegrees)
      openingPivots.push({ object: leftPivot, rotation: leftRotation })
      leftPivot.add(createActivePageMesh(width, PAGE_HEIGHT, model, -1))
      const rightPivot = new THREE.Group()
      rightPivot.rotation.y = rightRotation(model.openingDegrees)
      openingPivots.push({ object: rightPivot, rotation: rightRotation })
      rightPivot.add(createActivePageMesh(width, PAGE_HEIGHT, model, 1))
      activeSheet.add(leftPivot, rightPivot)
      pageBlock.add(activeSheet)
    }
  }
}

function createLeafStack(
  model: PhysicalPreviewModel,
  pageBlock: THREE.Group,
  openingPivots: OpeningPivot[],
) {
  const { width: pageWidthMillimeters, height: pageHeightMillimeters } = model.pageSize
  const width = PAGE_HEIGHT * (pageWidthMillimeters / pageHeightMillimeters)
  const millimetersToWorld = PAGE_HEIGHT / pageHeightMillimeters
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
  activeLeaf.add(createActivePageMesh(width, PAGE_HEIGHT, model, direction))
  pageBlock.add(activeLeaf)
}

function replacePageBlock(
  pageBlock: THREE.Group,
  model: PhysicalPreviewModel,
  openingPivots: OpeningPivot[],
) {
  disposePageBlock(pageBlock)
  openingPivots.length = 0
  if (model.construction === "page-block") createPageBlock(model, pageBlock, openingPivots)
  else createLeafStack(model, pageBlock, openingPivots)
}

type RendererState = {
  pageBlock: THREE.Group
  openingPivots: OpeningPivot[]
  updateOpening: (openingDegrees: number) => void
  refit: (openingRange?: readonly [number, number]) => void
}

export function PhysicalDesignPreview({
  settings,
  document,
  currentPage,
  materialPreset,
  opening,
  onMaterialPresetChange,
  onOpeningChange,
}: {
  settings: Settings
  document: ReturnType<typeof createNotebookDocument<Settings>>
  currentPage: number
  materialPreset: MaterialPresetId
  opening: number
  onMaterialPresetChange: (preset: MaterialPresetId) => void
  onOpeningChange: (opening: number) => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const rendererStateRef = useRef<RendererState>(null)
  const [status, setStatus] = useState<"ready" | "unsupported" | "context-lost">("ready")
  const model = useMemo(
    () =>
      createPhysicalPreviewModel({
        binding: settings.binding,
        bindingEdge: settings.bindingEdge,
        sides: document.sides,
        pageSize: document.pageSize,
        logicalPage: currentPage,
        materialPreset,
        opening: 0,
      }),
    [
      currentPage,
      document.pageSize,
      document.sides,
      materialPreset,
      settings.binding,
      settings.bindingEdge,
    ],
  )
  const openingDegrees = resolveOpeningDegrees(settings.binding, materialPreset, opening)
  const openingDegreesRef = useRef(openingDegrees)
  openingDegreesRef.current = openingDegrees

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    if (!WebGL.isWebGL2Available()) {
      setStatus("unsupported")
      return
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.domElement.className = "absolute inset-0 h-full w-full"
    renderer.outputColorSpace = THREE.SRGBColorSpace
    viewport.append(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#25231f")
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0.15, 6.4)
    camera.lookAt(0, 0, 0)
    const pageBlock = new THREE.Group()
    pageBlock.name = "Page Block"
    scene.add(pageBlock)
    scene.add(new THREE.HemisphereLight("#fff7e7", "#3b2e25", 2.2))
    const keyLight = new THREE.DirectionalLight("#ffe8c3", 3)
    keyLight.position.set(0, 5, 6)
    scene.add(keyLight)

    let frame = 0
    const invalidate = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        renderer.render(scene, camera)
      })
    }
    const openingPivots: OpeningPivot[] = []
    let fitOpeningRange: readonly [number, number] | undefined
    const applyOpening = (degrees: number) => {
      for (const pivot of openingPivots) pivot.object.rotation.y = pivot.rotation(degrees)
    }
    const refit = (openingRange?: readonly [number, number]) => {
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

      const verticalTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const verticalExtent = Math.max(
        Math.abs(bounds.min.y - camera.position.y),
        Math.abs(bounds.max.y - camera.position.y),
      )
      const horizontalExtent = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))
      const perspectiveDistance = Math.max(
        verticalExtent / verticalTangent,
        horizontalExtent / (verticalTangent * camera.aspect),
      )
      camera.position.z = bounds.max.z + perspectiveDistance * CAMERA_FIT_MARGIN
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
      invalidate()
    }
    const updateOpening = (degrees: number) => {
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
      refit()
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

    rendererStateRef.current = { pageBlock, openingPivots, updateOpening, refit }
    renderer.domElement.addEventListener("webglcontextlost", onContextLost)
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored)
    resizeObserver.observe(viewport)
    resize()

    return () => {
      rendererStateRef.current = null
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost)
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored)
      disposePageBlock(pageBlock)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  useEffect(() => {
    const rendererState = rendererStateRef.current
    if (!rendererState) return
    replacePageBlock(rendererState.pageBlock, model, rendererState.openingPivots)
    rendererState.updateOpening(openingDegreesRef.current)
    rendererState.refit([
      resolveOpeningDegrees(settings.binding, materialPreset, 0),
      resolveOpeningDegrees(settings.binding, materialPreset, 100),
    ])
  }, [model, materialPreset, settings.binding])

  useEffect(() => {
    const rendererState = rendererStateRef.current
    if (!rendererState) return
    rendererState.updateOpening(openingDegrees)
  }, [openingDegrees])

  return (
    <section
      ref={viewportRef}
      aria-label={`Physical Design Preview, logical page ${currentPage}, ${model.construction === "page-block" ? "Page Block" : "Leaf Stack"}`}
      className="relative flex min-h-0 flex-1 overflow-hidden bg-primary"
    >
      {status === "ready" ? (
        <fieldset className="absolute right-4 bottom-4 z-10 flex items-end gap-3 rounded-md border border-white/20 bg-primary/80 p-3 text-primary-foreground shadow-lg backdrop-blur-sm">
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
        </fieldset>
      ) : (
        <p
          className="relative z-10 m-auto max-w-56 text-center text-caption text-primary-foreground/75"
          role="status"
        >
          {status === "unsupported"
            ? "Physical Design Preview requires WebGL 2. Use the 2D preview instead."
            : "Physical Design Preview lost its graphics context. Switch to 2D preview and try again."}
        </p>
      )}
    </section>
  )
}
