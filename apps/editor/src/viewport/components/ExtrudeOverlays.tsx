import {
  convertBrushToEditableMesh,
  extrudeEditableMeshEdge,
  extrudeEditableMeshFace
} from "@ggez/geometry-kernel";
import {
  createBrushExtrudeHandles,
  createMeshExtrudeHandles,
  extrudeBrushHandle,
  type BrushExtrudeHandle,
  type MeshExtrudeHandle
} from "@/viewport/editing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { toTuple, vec3, type Brush, type EditableMesh, type GeometryNode } from "@ggez/shared";
import type { ViewportState } from "@ggez/render-pipeline";
import { useThree } from "@react-three/fiber";
import type { ViewportCanvasProps } from "@/viewport/types";
import { EditableMeshPreviewOverlay } from "@/viewport/components/EditableMeshPreviewOverlay";
import { NodeTransformGroup } from "@/viewport/components/NodeTransformGroup";
import { PreviewLine } from "@/viewport/components/SelectionVisuals";
import { addFaceOffset } from "@/viewport/utils/geometry";
import { resolveViewportSnapSize } from "@/viewport/utils/snap";
import { axisLockColor, resolveExtrudeDirection } from "@/viewport/utils/interaction";
import type { ExtrudeGestureState } from "@/viewport/types";

function snapSignedDistance(value: number, snapSize: number) {
  return Math.round(value / snapSize) * snapSize;
}

export function BrushExtrudeOverlay({
  node,
  onCommitMeshTopology,
  onPreviewBrushData,
  onUpdateBrushData,
  setTransformDragging,
  visibleHandleIds,
  viewport
}: {
  node: Extract<GeometryNode, { kind: "brush" }>;
  onCommitMeshTopology: ViewportCanvasProps["onCommitMeshTopology"];
  onPreviewBrushData: ViewportCanvasProps["onPreviewBrushData"];
  onUpdateBrushData: ViewportCanvasProps["onUpdateBrushData"];
  setTransformDragging: (dragging: boolean) => void;
  visibleHandleIds?: string[];
  viewport: ViewportState;
}) {
  const handles = useMemo(() => createBrushExtrudeHandles(node.data), [node.data]);
  const editableMesh = useMemo(() => convertBrushToEditableMesh(node.data), [node.data]);
  const meshEdgeHandles = useMemo(
    () => (editableMesh ? createMeshExtrudeHandles(editableMesh).filter((handle) => handle.kind === "edge") : []),
    [editableMesh]
  );
  const faceHandles = useMemo(
    () => handles.filter((handle): handle is BrushExtrudeHandle & { kind: "face" } => handle.kind === "face"),
    [handles]
  );
  const [frozenHandles, setFrozenHandles] = useState<BrushExtrudeHandle[] | null>(null);
  const [previewMesh, setPreviewMesh] = useState<EditableMesh | null>(null);
  const handlesRef = useRef(faceHandles);
  const handleIdFilter = visibleHandleIds ? new Set(visibleHandleIds) : undefined;
  const renderedHandles = (frozenHandles ?? faceHandles).filter((handle) =>
    handleIdFilter ? handleIdFilter.has(handle.id) : true
  );
  const renderedMeshEdgeHandles = meshEdgeHandles.filter((handle) =>
    handleIdFilter ? handleIdFilter.has(handle.id) : true
  );
  handlesRef.current = faceHandles;
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setFrozenHandles(dragging ? structuredClone(handlesRef.current) : null);
  }, []);

  useEffect(() => {
    setFrozenHandles(null);
    setPreviewMesh(null);
  }, [node.id]);

  if (renderedHandles.length === 0 && renderedMeshEdgeHandles.length === 0) {
    return null;
  }

  return (
    <>
      <NodeTransformGroup transform={node.transform}>
        {renderedHandles.map((handle) => (
          <BrushExtrudeDragHandle
            handle={handle}
            key={`${handle.kind}:${handle.id}`}
            node={node}
            onDragStateChange={handleDragStateChange}
            onPreviewBrushData={onPreviewBrushData}
            onUpdateBrushData={onUpdateBrushData}
            setTransformDragging={setTransformDragging}
            viewport={viewport}
          />
        ))}
        {editableMesh
          ? renderedMeshEdgeHandles.map((handle) => (
              <BrushMeshExtrudeDragHandle
                baseMesh={editableMesh}
                handle={handle}
                key={`brush-mesh:${handle.id}`}
                node={node}
                onCommitMeshTopology={onCommitMeshTopology}
                onPreviewMeshChange={setPreviewMesh}
                setTransformDragging={setTransformDragging}
                viewport={viewport}
              />
            ))
          : null}
      </NodeTransformGroup>
      {previewMesh ? <EditableMeshPreviewOverlay mesh={previewMesh} node={node} /> : null}
    </>
  );
}

export function MeshExtrudeOverlay({
  node,
  onUpdateMeshData,
  setTransformDragging,
  visibleHandleIds,
  viewport
}: {
  node: Extract<GeometryNode, { kind: "mesh" }>;
  onUpdateMeshData: ViewportCanvasProps["onUpdateMeshData"];
  setTransformDragging: (dragging: boolean) => void;
  visibleHandleIds?: string[];
  viewport: ViewportState;
}) {
  const handles = useMemo(() => createMeshExtrudeHandles(node.data), [node.data]);
  const [frozenHandles, setFrozenHandles] = useState<MeshExtrudeHandle[] | null>(null);
  const [previewMesh, setPreviewMesh] = useState<EditableMesh | null>(null);
  const handlesRef = useRef(handles);
  const handleIdFilter = visibleHandleIds ? new Set(visibleHandleIds) : undefined;
  const renderedHandles = (frozenHandles ?? handles).filter((handle) =>
    handleIdFilter ? handleIdFilter.has(handle.id) : true
  );
  handlesRef.current = handles;
  const handleDragStateChange = useCallback((dragging: boolean) => {
    setFrozenHandles(dragging ? structuredClone(handlesRef.current) : null);
  }, []);

  useEffect(() => {
    setFrozenHandles(null);
    setPreviewMesh(null);
  }, [node.id]);

  if (renderedHandles.length === 0) {
    return null;
  }

  return (
    <>
      <NodeTransformGroup transform={node.transform}>
        {renderedHandles.map((handle) => (
          <MeshExtrudeDragHandle
            handle={handle}
            key={`${handle.kind}:${handle.id}`}
            node={node}
            onDragStateChange={handleDragStateChange}
            onPreviewMeshChange={setPreviewMesh}
            onUpdateMeshData={onUpdateMeshData}
            setTransformDragging={setTransformDragging}
            viewport={viewport}
          />
        ))}
      </NodeTransformGroup>
      {previewMesh ? <EditableMeshPreviewOverlay mesh={previewMesh} node={node} /> : null}
    </>
  );
}

export function ExtrudeAxisGuide({
  node,
  state,
  viewport
}: {
  node: GeometryNode;
  state: ExtrudeGestureState;
  viewport: ViewportState;
}) {
  if (!state.axisLock || state.handle.kind !== "edge") {
    return null;
  }

  const direction = resolveExtrudeDirection(state);
  const snapSize = resolveViewportSnapSize(viewport);
  const length = Math.max(snapSize * 6, 6);
  const start = addFaceOffset(state.handle.position, direction, -length * 0.5);
  const end = addFaceOffset(state.handle.position, direction, length * 0.5);

  return (
    <NodeTransformGroup transform={node.transform}>
      <PreviewLine color={axisLockColor(state.axisLock)} end={end} start={start} />
    </NodeTransformGroup>
  );
}

function BrushExtrudeDragHandle({
  handle,
  node,
  onDragStateChange,
  onPreviewBrushData,
  onUpdateBrushData,
  setTransformDragging,
  viewport
}: {
  handle: BrushExtrudeHandle;
  node: Extract<GeometryNode, { kind: "brush" }>;
  onDragStateChange: (dragging: boolean) => void;
  onPreviewBrushData: ViewportCanvasProps["onPreviewBrushData"];
  onUpdateBrushData: ViewportCanvasProps["onUpdateBrushData"];
  setTransformDragging: (dragging: boolean) => void;
  viewport: ViewportState;
}) {
  const dragStateRef = useRef<{
    baseBrush: Brush;
    baseHandle: BrushExtrudeHandle;
    plane: Plane;
    startPoint: Vector3;
  } | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const { camera, gl } = useThree();
  const snapSize = resolveViewportSnapSize(viewport);
  const extrusionNormal = handle.normal ? new Vector3(handle.normal.x, handle.normal.y, handle.normal.z).normalize() : undefined;
  const tip = useMemo(
    () => (handle.normal ? addFaceOffset(handle.position, handle.normal, handle.kind === "face" ? 0.42 : 0.3) : handle.position),
    [handle]
  );
  const stemEnd = useMemo(
    () => (handle.normal ? addFaceOffset(handle.position, handle.normal, handle.kind === "face" ? 0.28 : 0.18) : handle.position),
    [handle]
  );

  useEffect(() => {
    return () => {
      dragStateRef.current = null;
      onDragStateChange(false);
      setTransformDragging(false);
    };
  }, [onDragStateChange, setTransformDragging]);

  if (!extrusionNormal) {
    return null;
  }

  return (
    <group>
      <PreviewLine color={handle.kind === "face" ? "#7dd3fc" : "#67e8f9"} end={stemEnd} start={handle.position} />
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();

          const cameraDirection = camera.getWorldDirection(new Vector3());
          let tangent = new Vector3().crossVectors(cameraDirection, extrusionNormal);

          if (tangent.lengthSq() <= 0.0001) {
            tangent = new Vector3().crossVectors(new Vector3(0, 1, 0), extrusionNormal);
          }

          if (tangent.lengthSq() <= 0.0001) {
            tangent = new Vector3().crossVectors(new Vector3(1, 0, 0), extrusionNormal);
          }

          const planeNormal = new Vector3().crossVectors(extrusionNormal, tangent).normalize();
          const plane = new Plane().setFromNormalAndCoplanarPoint(
            planeNormal,
            new Vector3(tip.x, tip.y, tip.z)
          );
          const startPoint = event.ray.intersectPlane(plane, new Vector3()) ?? new Vector3(tip.x, tip.y, tip.z);

          dragStateRef.current = {
            baseBrush: structuredClone(node.data),
            baseHandle: structuredClone(handle),
            plane,
            startPoint
          };
          onDragStateChange(true);
          setTransformDragging(true);

          const handlePointerMove = (pointerEvent: PointerEvent) => {
            if (!dragStateRef.current) {
              return;
            }

            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new Vector2(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1)
            );
            raycasterRef.current.setFromCamera(ndc, camera);
            const point = raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, new Vector3());

            if (!point) {
              return;
            }

            const delta = point.clone().sub(dragStateRef.current.startPoint).dot(extrusionNormal);
            const snappedDelta = snapSignedDistance(delta, snapSize);
            const nextBrush = extrudeBrushHandle(
              dragStateRef.current.baseBrush,
              dragStateRef.current.baseHandle,
              snappedDelta
            );

            if (nextBrush) {
              onPreviewBrushData(node.id, nextBrush);
            } else {
              onPreviewBrushData(node.id, dragStateRef.current.baseBrush);
            }
          };

          const handlePointerUp = (pointerEvent: PointerEvent) => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            onDragStateChange(false);
            setTransformDragging(false);

            if (!dragStateRef.current) {
              return;
            }

            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new Vector2(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1)
            );
            raycasterRef.current.setFromCamera(ndc, camera);
            const point = raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, new Vector3());
            const delta = point ? point.clone().sub(dragStateRef.current.startPoint).dot(extrusionNormal) : 0;
            const snappedDelta = snapSignedDistance(delta, snapSize);
            const nextBrush = extrudeBrushHandle(
              dragStateRef.current.baseBrush,
              dragStateRef.current.baseHandle,
              snappedDelta
            );

            if (nextBrush) {
              onUpdateBrushData(node.id, nextBrush, dragStateRef.current.baseBrush);
            } else {
              onPreviewBrushData(node.id, dragStateRef.current.baseBrush);
            }

            dragStateRef.current = null;
          };

          window.addEventListener("pointermove", handlePointerMove);
          window.addEventListener("pointerup", handlePointerUp, { once: true });
        }}
        position={toTuple(tip)}
      >
        <octahedronGeometry args={[handle.kind === "face" ? 0.12 : 0.09, 0]} />
        <meshStandardMaterial
          color={handle.kind === "face" ? "#dbeafe" : "#cffafe"}
          emissive={handle.kind === "face" ? "#38bdf8" : "#06b6d4"}
          emissiveIntensity={0.28}
        />
      </mesh>
    </group>
  );
}

function BrushMeshExtrudeDragHandle({
  baseMesh,
  handle,
  node,
  onCommitMeshTopology,
  onPreviewMeshChange,
  setTransformDragging,
  viewport
}: {
  baseMesh: EditableMesh;
  handle: MeshExtrudeHandle;
  node: Extract<GeometryNode, { kind: "brush" }>;
  onCommitMeshTopology: ViewportCanvasProps["onCommitMeshTopology"];
  onPreviewMeshChange: (mesh: EditableMesh | null) => void;
  setTransformDragging: (dragging: boolean) => void;
  viewport: ViewportState;
}) {
  const dragStateRef = useRef<{
    baseHandle: MeshExtrudeHandle;
    baseMesh: EditableMesh;
    plane: Plane;
    startPoint: Vector3;
  } | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const { camera, gl } = useThree();
  const snapSize = resolveViewportSnapSize(viewport);
  const extrusionNormal = useMemo(
    () => new Vector3(handle.normal.x, handle.normal.y, handle.normal.z).normalize(),
    [handle.normal.x, handle.normal.y, handle.normal.z]
  );
  const tip = useMemo(() => addFaceOffset(handle.position, handle.normal, 0.3), [handle]);
  const stemEnd = useMemo(() => addFaceOffset(handle.position, handle.normal, 0.18), [handle]);

  useEffect(() => {
    return () => {
      dragStateRef.current = null;
      onPreviewMeshChange(null);
      setTransformDragging(false);
    };
  }, [onPreviewMeshChange, setTransformDragging]);

  return (
    <group>
      <PreviewLine color="#67e8f9" end={stemEnd} start={handle.position} />
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();

          const cameraDirection = camera.getWorldDirection(new Vector3());
          let tangent = new Vector3().crossVectors(cameraDirection, extrusionNormal);

          if (tangent.lengthSq() <= 0.0001) {
            tangent = new Vector3().crossVectors(new Vector3(0, 1, 0), extrusionNormal);
          }

          if (tangent.lengthSq() <= 0.0001) {
            tangent = new Vector3().crossVectors(new Vector3(1, 0, 0), extrusionNormal);
          }

          const planeNormal = new Vector3().crossVectors(extrusionNormal, tangent).normalize();
          const plane = new Plane().setFromNormalAndCoplanarPoint(
            planeNormal,
            new Vector3(tip.x, tip.y, tip.z)
          );
          const startPoint = event.ray.intersectPlane(plane, new Vector3()) ?? new Vector3(tip.x, tip.y, tip.z);

          dragStateRef.current = {
            baseHandle: structuredClone(handle),
            baseMesh: structuredClone(baseMesh),
            plane,
            startPoint
          };
          setTransformDragging(true);

          const handlePointerMove = (pointerEvent: PointerEvent) => {
            if (!dragStateRef.current) {
              return;
            }

            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new Vector2(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1)
            );
            raycasterRef.current.setFromCamera(ndc, camera);
            const point = raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, new Vector3());

            if (!point) {
              return;
            }

            const delta = point.clone().sub(dragStateRef.current.startPoint).dot(extrusionNormal);
            const snappedDelta = snapSignedDistance(delta, snapSize);

            if (Math.abs(snappedDelta) <= 0.0001) {
              onPreviewMeshChange(null);
              return;
            }

            const nextMesh = extrudeEditableMeshEdge(
              dragStateRef.current.baseMesh,
              dragStateRef.current.baseHandle.vertexIds as [string, string],
              snappedDelta,
              vec3(extrusionNormal.x, extrusionNormal.y, extrusionNormal.z)
            );

            onPreviewMeshChange(nextMesh ?? null);
          };

          const handlePointerUp = (pointerEvent: PointerEvent) => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            setTransformDragging(false);

            if (!dragStateRef.current) {
              onPreviewMeshChange(null);
              return;
            }

            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new Vector2(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1)
            );
            raycasterRef.current.setFromCamera(ndc, camera);
            const point = raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, new Vector3());
            const delta = point ? point.clone().sub(dragStateRef.current.startPoint).dot(extrusionNormal) : 0;
            const snappedDelta = snapSignedDistance(delta, snapSize);

            if (Math.abs(snappedDelta) <= 0.0001) {
              onPreviewMeshChange(null);
              dragStateRef.current = null;
              return;
            }

            const nextMesh = extrudeEditableMeshEdge(
              dragStateRef.current.baseMesh,
              dragStateRef.current.baseHandle.vertexIds as [string, string],
              snappedDelta,
              vec3(extrusionNormal.x, extrusionNormal.y, extrusionNormal.z)
            );

            onPreviewMeshChange(null);

            if (nextMesh) {
              onCommitMeshTopology(node.id, nextMesh);
            }

            dragStateRef.current = null;
          };

          window.addEventListener("pointermove", handlePointerMove);
          window.addEventListener("pointerup", handlePointerUp, { once: true });
        }}
        position={toTuple(tip)}
      >
        <octahedronGeometry args={[0.09, 0]} />
        <meshStandardMaterial
          color="#cffafe"
          emissive="#06b6d4"
          emissiveIntensity={0.28}
        />
      </mesh>
    </group>
  );
}

function MeshExtrudeDragHandle({
  handle,
  node,
  onDragStateChange,
  onPreviewMeshChange,
  onUpdateMeshData,
  setTransformDragging,
  viewport
}: {
  handle: MeshExtrudeHandle;
  node: Extract<GeometryNode, { kind: "mesh" }>;
  onDragStateChange: (dragging: boolean) => void;
  onPreviewMeshChange: (mesh: EditableMesh | null) => void;
  onUpdateMeshData: ViewportCanvasProps["onUpdateMeshData"];
  setTransformDragging: (dragging: boolean) => void;
  viewport: ViewportState;
}) {
  const dragStateRef = useRef<{
    baseHandle: MeshExtrudeHandle;
    baseMesh: EditableMesh;
    plane: Plane;
    startPoint: Vector3;
  } | null>(null);
  const raycasterRef = useRef(new Raycaster());
  const { camera, gl } = useThree();
  const snapSize = resolveViewportSnapSize(viewport);
  const extrusionNormal = useMemo(
    () => new Vector3(handle.normal.x, handle.normal.y, handle.normal.z).normalize(),
    [handle.normal.x, handle.normal.y, handle.normal.z]
  );
  const tip = useMemo(
    () => addFaceOffset(handle.position, handle.normal, handle.kind === "face" ? 0.42 : 0.3),
    [handle]
  );
  const stemEnd = useMemo(
    () => addFaceOffset(handle.position, handle.normal, handle.kind === "face" ? 0.28 : 0.18),
    [handle]
  );

  useEffect(() => {
    return () => {
      dragStateRef.current = null;
      onPreviewMeshChange(null);
      onDragStateChange(false);
      setTransformDragging(false);
    };
  }, [onDragStateChange, onPreviewMeshChange, setTransformDragging]);

  return (
    <group>
      <PreviewLine color={handle.kind === "face" ? "#7dd3fc" : "#67e8f9"} end={stemEnd} start={handle.position} />
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();

          const cameraDirection = camera.getWorldDirection(new Vector3());
          let tangent = new Vector3().crossVectors(cameraDirection, extrusionNormal);

          if (tangent.lengthSq() <= 0.0001) {
            tangent = new Vector3().crossVectors(new Vector3(0, 1, 0), extrusionNormal);
          }

          if (tangent.lengthSq() <= 0.0001) {
            tangent = new Vector3().crossVectors(new Vector3(1, 0, 0), extrusionNormal);
          }

          const planeNormal = new Vector3().crossVectors(extrusionNormal, tangent).normalize();
          const plane = new Plane().setFromNormalAndCoplanarPoint(
            planeNormal,
            new Vector3(tip.x, tip.y, tip.z)
          );
          const startPoint = event.ray.intersectPlane(plane, new Vector3()) ?? new Vector3(tip.x, tip.y, tip.z);

          dragStateRef.current = {
            baseHandle: structuredClone(handle),
            baseMesh: structuredClone(node.data),
            plane,
            startPoint
          };
          onDragStateChange(true);
          setTransformDragging(true);

          const handlePointerMove = (pointerEvent: PointerEvent) => {
            if (!dragStateRef.current) {
              return;
            }

            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new Vector2(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1)
            );
            raycasterRef.current.setFromCamera(ndc, camera);
            const point = raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, new Vector3());

            if (!point) {
              return;
            }

            const delta = point.clone().sub(dragStateRef.current.startPoint).dot(extrusionNormal);
            const snappedDelta = snapSignedDistance(delta, snapSize);

            if (Math.abs(snappedDelta) <= 0.0001) {
              onPreviewMeshChange(null);
              return;
            }

            const nextMesh =
              dragStateRef.current.baseHandle.kind === "face"
                ? extrudeEditableMeshFace(
                    dragStateRef.current.baseMesh,
                    dragStateRef.current.baseHandle.id,
                    snappedDelta
                  )
                : extrudeEditableMeshEdge(
                    dragStateRef.current.baseMesh,
                    dragStateRef.current.baseHandle.vertexIds as [string, string],
                    snappedDelta,
                    vec3(extrusionNormal.x, extrusionNormal.y, extrusionNormal.z)
                  );

            onPreviewMeshChange(nextMesh ?? null);
          };

          const handlePointerUp = (pointerEvent: PointerEvent) => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            onDragStateChange(false);
            setTransformDragging(false);

            if (!dragStateRef.current) {
              return;
            }

            const rect = gl.domElement.getBoundingClientRect();
            const ndc = new Vector2(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1)
            );
            raycasterRef.current.setFromCamera(ndc, camera);
            const point = raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, new Vector3());
            const delta = point ? point.clone().sub(dragStateRef.current.startPoint).dot(extrusionNormal) : 0;
            const snappedDelta = snapSignedDistance(delta, snapSize);

            if (Math.abs(snappedDelta) <= 0.0001) {
              onPreviewMeshChange(null);
              dragStateRef.current = null;
              return;
            }

            const nextMesh =
              dragStateRef.current.baseHandle.kind === "face"
                ? extrudeEditableMeshFace(
                    dragStateRef.current.baseMesh,
                    dragStateRef.current.baseHandle.id,
                    snappedDelta
                  )
                : extrudeEditableMeshEdge(
                    dragStateRef.current.baseMesh,
                    dragStateRef.current.baseHandle.vertexIds as [string, string],
                    snappedDelta,
                    vec3(extrusionNormal.x, extrusionNormal.y, extrusionNormal.z)
                  );

            onPreviewMeshChange(null);

            if (nextMesh) {
              onUpdateMeshData(node.id, nextMesh, dragStateRef.current.baseMesh);
            }

            dragStateRef.current = null;
          };

          window.addEventListener("pointermove", handlePointerMove);
          window.addEventListener("pointerup", handlePointerUp, { once: true });
        }}
        position={toTuple(tip)}
      >
        <octahedronGeometry args={[handle.kind === "face" ? 0.12 : 0.09, 0]} />
        <meshStandardMaterial
          color={handle.kind === "face" ? "#dbeafe" : "#cffafe"}
          emissive={handle.kind === "face" ? "#38bdf8" : "#06b6d4"}
          emissiveIntensity={0.28}
        />
      </mesh>
    </group>
  );
}
