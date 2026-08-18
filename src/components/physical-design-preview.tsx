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
} from "@/lib/physical-preview"
import type { Settings } from "@/lib/settings"

const PAGE_HEIGHT = 3

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
    transparent: materialPreset.translucency > 0,
    opacity: 1 - materialPreset.translucency * 0.08,
    side: THREE.DoubleSide,
  })
}

function addRestingVolume({
  parent,
  side,
  sheetCount,
  width,
  height,
  depthPerSheet,
  model,
  rotation,
}: {
  parent: THREE.Group
  side: -1 | 1
  sheetCount: number
  width: number
  height: number
  depthPerSheet: number
  model: PhysicalPreviewModel
  rotation: number
}) {
  if (sheetCount === 0) return
  const pivot = new THREE.Group()
  pivot.rotation.y = rotation
  const depth = Math.max(0.012, sheetCount * depthPerSheet)
  const volume = new THREE.Mesh(
    createProfiledVolumeGeometry(width, height, depth, model.materialPreset.profile),
    createPaperMaterial(model),
  )
  volume.name = `${sheetCount} resting ${sheetCount === 1 ? "sheet" : "sheets"}`
  volume.position.x = side * width * 0.5
  volume.castShadow = true
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
  page.castShadow = true
  page.receiveShadow = true
  return page
}

function createPageBlock(model: PhysicalPreviewModel, pageBlock: THREE.Group) {
  const { width: pageWidthMillimeters, height: pageHeightMillimeters } = model.pageSize
  const width = PAGE_HEIGHT * (pageWidthMillimeters / pageHeightMillimeters)
  const millimetersToWorld = PAGE_HEIGHT / pageHeightMillimeters
  const sheetDepth = model.materialPreset.thickness * millimetersToWorld
  const signatureGap = model.materialPreset.signatureGap * millimetersToWorld
  const spreadTilt = THREE.MathUtils.degToRad(180 - model.openingDegrees) / 2
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
      rotation: spreadTilt,
    })
    addRestingVolume({
      parent: signatureGroup,
      side: 1,
      sheetCount: rightCount,
      width,
      height: PAGE_HEIGHT,
      depthPerSheet: sheetDepth,
      model,
      rotation: -spreadTilt,
    })

    if (signature === activeSignature) {
      const activeSheet = new THREE.Group()
      activeSheet.name = `Active Folded Sheet ${model.selectedSurface.sheet}`
      activeSheet.position.z = signatureGroup.position.z
      activeSheet.userData.selectedSurface = model.selectedSurface
      activeSheet.rotation.y = 0
      const leftPivot = new THREE.Group()
      leftPivot.rotation.y = spreadTilt
      leftPivot.add(createActivePageMesh(width, PAGE_HEIGHT, model, -1))
      const rightPivot = new THREE.Group()
      rightPivot.rotation.y = -spreadTilt
      rightPivot.add(createActivePageMesh(width, PAGE_HEIGHT, model, 1))
      activeSheet.add(leftPivot, rightPivot)
      pageBlock.add(activeSheet)
    }
  }
}

function createLeafStack(model: PhysicalPreviewModel, pageBlock: THREE.Group) {
  const { width: pageWidthMillimeters, height: pageHeightMillimeters } = model.pageSize
  const width = PAGE_HEIGHT * (pageWidthMillimeters / pageHeightMillimeters)
  const millimetersToWorld = PAGE_HEIGHT / pageHeightMillimeters
  const direction = model.bindingEdge === "left" ? 1 : -1
  const fan = THREE.MathUtils.degToRad(model.openingDegrees)
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
    rotation: -direction * fan * 0.5,
  })
  addRestingVolume({
    parent: pageBlock,
    side: direction,
    sheetCount: right,
    width,
    height: PAGE_HEIGHT,
    depthPerSheet: depthPerLeaf,
    model,
    rotation: direction * fan * 0.5,
  })

  const activeLeaf = new THREE.Group()
  activeLeaf.name = `Active Leaf ${model.activeUnitIndex + 1}`
  activeLeaf.userData.selectedSurface = model.selectedSurface
  activeLeaf.rotation.y =
    direction * fan * (model.activeUnitIndex / Math.max(1, model.units.length - 1) - 0.5)
  activeLeaf.add(createActivePageMesh(width, PAGE_HEIGHT, model, direction))
  pageBlock.add(activeLeaf)
}

function replacePageBlock(pageBlock: THREE.Group, model: PhysicalPreviewModel) {
  disposePageBlock(pageBlock)
  if (model.construction === "page-block") createPageBlock(model, pageBlock)
  else createLeafStack(model, pageBlock)
}

type RendererState = { pageBlock: THREE.Group; invalidate: () => void }

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
        opening,
      }),
    [
      currentPage,
      document.pageSize,
      document.sides,
      materialPreset,
      opening,
      settings.binding,
      settings.bindingEdge,
    ],
  )

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
    renderer.shadowMap.enabled = true
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
    keyLight.position.set(-3, 5, 6)
    keyLight.castShadow = true
    scene.add(keyLight)

    let frame = 0
    const invalidate = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        renderer.render(scene, camera)
      })
    }
    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect()
      if (!width || !height) return
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
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

    rendererStateRef.current = { pageBlock, invalidate }
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
    replacePageBlock(rendererState.pageBlock, model)
    rendererState.invalidate()
  }, [model])

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
