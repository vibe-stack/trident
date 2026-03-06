import { useEffect, useMemo, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas, type RootState, useThree } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import {
  disableBvhRaycast,
  enableBvhRaycast,
  type DerivedRenderMesh,
  type DerivedRenderScene,
  type ViewportState
} from "@web-hammer/render-pipeline";
import { snapVec3, toTuple, vec3 } from "@web-hammer/shared";
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  Vector2,
  Vector3,
  type PerspectiveCamera
} from "three";
import type { ToolId } from "@web-hammer/tool-system";

type ViewportCanvasProps = {
  activeToolId: ToolId;
  onClearSelection: () => void;
  onFocusNode: (nodeId: string) => void;
  onPlaceAsset: (position: { x: number; y: number; z: number }) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  renderScene: DerivedRenderScene;
  selectedNodeIds: string[];
  viewport: ViewportState;
};

type MarqueeState = {
  active: boolean;
  current: Vector2;
  origin: Vector2;
};

const tempBox = new Box3();
const projectedPoint = new Vector3();

function EditorCameraRig({
  controlsEnabled,
  viewport
}: Pick<ViewportCanvasProps, "viewport"> & { controlsEnabled: boolean }) {
  const camera = useThree((state) => state.camera as PerspectiveCamera);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const [x, y, z] = toTuple(viewport.camera.position);
    const [targetX, targetY, targetZ] = toTuple(viewport.camera.target);

    camera.position.set(x, y, z);
    camera.near = viewport.camera.near;
    camera.far = viewport.camera.far;
    camera.fov = viewport.camera.fov;
    camera.updateProjectionMatrix();

    controlsRef.current?.target.set(targetX, targetY, targetZ);
    controlsRef.current?.update();
  }, [camera, viewport]);

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.12}
      enableDamping
      enabled={controlsEnabled}
      makeDefault
      maxDistance={viewport.camera.maxDistance}
      minDistance={viewport.camera.minDistance}
      minPolarAngle={0.01}
      maxPolarAngle={Math.PI - 0.01}
      target={toTuple(viewport.camera.target)}
    />
  );
}

function ConstructionGrid({
  activeToolId,
  onPlaceAsset,
  viewport
}: Pick<ViewportCanvasProps, "activeToolId" | "onPlaceAsset" | "viewport">) {
  if (!viewport.grid.visible) {
    return null;
  }

  const majorDivisions = Math.max(1, Math.floor(viewport.grid.minorDivisions / viewport.grid.majorLineEvery));

  return (
    <group position={[0, viewport.grid.elevation, 0]}>
      <mesh
        onClick={(event) => {
          if (activeToolId !== "asset-place") {
            return;
          }

          event.stopPropagation();
          const snapped = snapVec3(
            vec3(event.point.x, viewport.grid.elevation, event.point.z),
            viewport.grid.snapSize
          );
          onPlaceAsset(snapped);
        }}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.0125, 0]}
      >
        <planeGeometry args={[viewport.grid.size, viewport.grid.size]} />
        <meshStandardMaterial color="#0d151e" metalness={0.1} roughness={0.95} transparent opacity={0.65} />
      </mesh>
      <gridHelper args={[viewport.grid.size, viewport.grid.minorDivisions, "#24384b", "#16212b"]} position={[0, 0.001, 0]} />
      <gridHelper args={[viewport.grid.size, majorDivisions, "#f69036", "#36516f"]} position={[0, 0.002, 0]} />
    </group>
  );
}

function RenderPrimitive({
  hovered,
  mesh,
  onFocusNode,
  onHoverEnd,
  onHoverStart,
  onMeshObjectChange,
  onSelectNodes,
  selected
}: {
  hovered: boolean;
  mesh: DerivedRenderMesh;
  onFocusNode: (nodeId: string) => void;
  onHoverEnd: () => void;
  onHoverStart: (nodeId: string) => void;
  onMeshObjectChange: (nodeId: string, object: Mesh | null) => void;
  onSelectNodes: (nodeIds: string[]) => void;
  selected: boolean;
}) {
  const meshRef = useRef<Mesh | null>(null);
  const geometry = useMemo(() => {
    if (!mesh.surface) {
      return undefined;
    }

    const bufferGeometry = new BufferGeometry();
    bufferGeometry.setAttribute("position", new Float32BufferAttribute(mesh.surface.positions, 3));
    bufferGeometry.setIndex(mesh.surface.indices);
    bufferGeometry.computeVertexNormals();
    bufferGeometry.computeBoundingBox();
    bufferGeometry.computeBoundingSphere();

    return bufferGeometry;
  }, [mesh.surface]);

  useEffect(() => {
    const currentMesh = meshRef.current;

    if (geometry && currentMesh && mesh.bvhEnabled) {
      enableBvhRaycast(currentMesh, geometry);
    }

    return () => {
      if (geometry) {
        disableBvhRaycast(geometry);
      }

      geometry?.dispose();
    };
  }, [geometry, mesh.bvhEnabled]);

  const materialProps = {
    color: selected ? "#ffb35a" : hovered ? "#d8f4f0" : mesh.material.color,
    flatShading: mesh.material.flatShaded,
    wireframe: mesh.material.wireframe,
    metalness: mesh.material.wireframe ? 0.05 : 0.15,
    roughness: mesh.material.wireframe ? 0.45 : 0.72,
    side: DoubleSide,
    emissive: selected ? "#f69036" : hovered ? "#2a7f74" : "#000000",
    emissiveIntensity: selected ? 0.42 : hovered ? 0.16 : 0
  };

  return (
    <mesh
      castShadow
      onClick={(event) => {
        event.stopPropagation();
        onSelectNodes([mesh.nodeId]);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onFocusNode(mesh.nodeId);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverEnd();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverStart(mesh.nodeId);
      }}
      ref={(object) => {
        meshRef.current = object;
        onMeshObjectChange(mesh.nodeId, object);
      }}
      receiveShadow
      position={toTuple(mesh.position)}
      rotation={toTuple(mesh.rotation)}
      scale={toTuple(mesh.scale)}
    >
      {geometry ? <primitive attach="geometry" object={geometry} /> : null}
      {mesh.primitive?.kind === "box" ? <boxGeometry args={toTuple(mesh.primitive.size)} /> : null}
      {mesh.primitive?.kind === "icosahedron" ? (
        <icosahedronGeometry args={[mesh.primitive.radius, mesh.primitive.detail]} />
      ) : null}
      {mesh.primitive?.kind === "cylinder" ? (
        <cylinderGeometry
          args={[
            mesh.primitive.radiusTop,
            mesh.primitive.radiusBottom,
            mesh.primitive.height,
            mesh.primitive.radialSegments
          ]}
        />
      ) : null}
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

function ScenePreview({
  onFocusNode,
  onMeshObjectChange,
  onSelectNode,
  renderScene,
  selectedNodeIds
}: {
  onFocusNode: (nodeId: string) => void;
  onMeshObjectChange: (nodeId: string, object: Mesh | null) => void;
  onSelectNode: (nodeIds: string[]) => void;
  renderScene: DerivedRenderScene;
  selectedNodeIds: string[];
}) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string>();

  return (
    <>
      {renderScene.meshes.map((mesh) => (
        <RenderPrimitive
          hovered={hoveredNodeId === mesh.nodeId}
          key={mesh.nodeId}
          mesh={mesh}
          onFocusNode={onFocusNode}
          onHoverEnd={() => setHoveredNodeId(undefined)}
          onHoverStart={setHoveredNodeId}
          onMeshObjectChange={onMeshObjectChange}
          onSelectNodes={onSelectNode}
          selected={selectedNodeIds.includes(mesh.nodeId)}
        />
      ))}

      {renderScene.entityMarkers.map((entity) => (
        <group key={entity.entityId} position={toTuple(entity.position)}>
          <mesh position={[0, 0.8, 0]}>
            <octahedronGeometry args={[0.35, 0]} />
            <meshStandardMaterial color={entity.color} emissive={entity.color} emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.7, 8]} />
            <meshStandardMaterial color="#d8e0ea" metalness={0.1} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function ViewportCanvas({
  activeToolId,
  onClearSelection,
  onFocusNode,
  onPlaceAsset,
  onSelectNodes,
  renderScene,
  selectedNodeIds,
  viewport
}: ViewportCanvasProps) {
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const marqueeActiveRef = useRef(false);
  const meshObjectsRef = useRef(new Map<string, Mesh>());
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);

  const handleMeshObjectChange = (nodeId: string, object: Mesh | null) => {
    if (object) {
      meshObjectsRef.current.set(nodeId, object);
      return;
    }

    meshObjectsRef.current.delete(nodeId);
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 0 || !event.shiftKey) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const point = new Vector2(event.clientX - bounds.left, event.clientY - bounds.top);

    marqueeActiveRef.current = true;
    setMarquee({
      active: true,
      current: point,
      origin: point
    });
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!marqueeActiveRef.current || !marquee) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const point = new Vector2(event.clientX - bounds.left, event.clientY - bounds.top);

    setMarquee({
      ...marquee,
      current: point
    });
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!marqueeActiveRef.current || !marquee) {
      return;
    }

    marqueeActiveRef.current = false;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = new Vector2(event.clientX - bounds.left, event.clientY - bounds.top);
    const finalMarquee = {
      ...marquee,
      current: point
    };

    setMarquee(null);

    if (!cameraRef.current) {
      return;
    }

    const selectionRect = createScreenRect(finalMarquee.origin, finalMarquee.current);

    if (selectionRect.width < 4 && selectionRect.height < 4) {
      return;
    }

    const selectedIds = Array.from(meshObjectsRef.current.entries())
      .filter(([, object]) => intersectsSelectionRect(object, cameraRef.current!, bounds, selectionRect))
      .map(([nodeId]) => nodeId);

    if (selectedIds.length > 0) {
      onSelectNodes(selectedIds);
      return;
    }

    onClearSelection();
  };

  const marqueeRect = marquee ? createScreenRect(marquee.origin, marquee.current) : undefined;

  return (
    <div
      className="relative size-full overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Canvas
        camera={{
          far: viewport.camera.far,
          fov: viewport.camera.fov,
          near: viewport.camera.near,
          position: toTuple(viewport.camera.position)
        }}
        gl={async (props) => {
          const renderer = new WebGPURenderer(props as ConstructorParameters<typeof WebGPURenderer>[0]);
          await renderer.init();
          return renderer;
        }}
        onCreated={(state: RootState) => {
          cameraRef.current = state.camera as PerspectiveCamera;
        }}
        onPointerMissed={() => {
          if (!marqueeActiveRef.current) {
            onClearSelection();
          }
        }}
        shadows
      >
        <color attach="background" args={["#0b1118"]} />
        <fog attach="fog" args={["#0b1118", 45, 180]} />
        <ambientLight intensity={0.45} />
        <hemisphereLight args={["#9ec5f8", "#0f1721", 0.7]} />
        <directionalLight
          castShadow
          intensity={1.4}
          position={[18, 26, 12]}
          shadow-bias={-0.0002}
          shadow-mapSize-height={2048}
          shadow-mapSize-width={2048}
          shadow-normalBias={0.045}
        />
        <EditorCameraRig controlsEnabled={!marqueeActiveRef.current} viewport={viewport} />
        <ConstructionGrid activeToolId={activeToolId} onPlaceAsset={onPlaceAsset} viewport={viewport} />
        <axesHelper args={[3]} />
        <ScenePreview
          onFocusNode={onFocusNode}
          onMeshObjectChange={handleMeshObjectChange}
          onSelectNode={onSelectNodes}
          renderScene={renderScene}
          selectedNodeIds={selectedNodeIds}
        />
      </Canvas>

      {marqueeRect ? (
        <div
          className="pointer-events-none absolute rounded-sm bg-emerald-400/12 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.75)]"
          style={{
            height: marqueeRect.height,
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.width
          }}
        />
      ) : null}
    </div>
  );
}

function createScreenRect(origin: Vector2, current: Vector2) {
  return {
    height: Math.abs(current.y - origin.y),
    left: Math.min(origin.x, current.x),
    top: Math.min(origin.y, current.y),
    width: Math.abs(current.x - origin.x)
  };
}

function intersectsSelectionRect(
  object: Mesh,
  camera: PerspectiveCamera,
  viewportBounds: DOMRect,
  selectionRect: ReturnType<typeof createScreenRect>
): boolean {
  tempBox.setFromObject(object);

  if (tempBox.isEmpty()) {
    return false;
  }

  const screenRect = projectBoxToScreenRect(tempBox, camera, viewportBounds);
  return rectsIntersect(screenRect, selectionRect);
}

function projectBoxToScreenRect(box: Box3, camera: PerspectiveCamera, viewportBounds: DOMRect) {
  const min = box.min;
  const max = box.max;
  const corners = [
    [min.x, min.y, min.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [min.x, max.y, max.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z]
  ];

  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  corners.forEach(([x, y, z]) => {
    projectedPoint.set(x, y, z).project(camera);
    const screenX = ((projectedPoint.x + 1) * 0.5) * viewportBounds.width;
    const screenY = ((1 - projectedPoint.y) * 0.5) * viewportBounds.height;

    left = Math.min(left, screenX);
    right = Math.max(right, screenX);
    top = Math.min(top, screenY);
    bottom = Math.max(bottom, screenY);
  });

  return {
    height: Math.max(0, bottom - top),
    left,
    top,
    width: Math.max(0, right - left)
  };
}

function rectsIntersect(
  left: ReturnType<typeof createScreenRect>,
  right: ReturnType<typeof createScreenRect>
) {
  return !(
    left.left + left.width < right.left ||
    right.left + right.width < left.left ||
    left.top + left.height < right.top ||
    right.top + right.height < left.top
  );
}
